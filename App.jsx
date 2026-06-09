import {StyleSheet} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import React, {useEffect, useState, useRef, createContext} from 'react';
import Root from './src/navigation/Root';
import SocketIOClient from 'socket.io-client';

import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
} from 'react-native-webrtc';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

// Create context for sharing WebRTC state across screens
export const WebRTCContext = createContext();

const navigationRef = React.createRef();

const SERVER_URL = 'http://192.168.18.41:3500';

const ICE_SERVERS = {
  iceServers: [
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'stun:stun1.l.google.com:19302'},
    {urls: 'stun:stun2.l.google.com:19302'},
  ],
};

const App = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [otherUserId, setOtherUserId] = useState(null); // Socket.IO callerId of peer
  const [callType, setCallType] = useState('JOIN');
  const [callStatus, setCallStatus] = useState(null);
  const [activeCallRef, setActiveCallRef] = useState(null); // Firebase ref to the active /calls doc
  // Display info for the other person in the call (name, image)
  const [activeCallPeerName, setActiveCallPeerName] = useState(null);
  const [activeCallPeerImage, setActiveCallPeerImage] = useState(null);
  const [activeCallMode, setActiveCallMode] = useState(null);

  // A stable, random Socket.IO room identifier for this device session
  const callerIdRef = useRef(
    Math.floor(100000 + Math.random() * 900000).toString(),
  );
  const callerId = callerIdRef.current;

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const otherUserIdRef = useRef(null); // always-fresh peer callerId
  const localStreamRef = useRef(null); // always-fresh localStream
  const activeCallRefRef = useRef(null); // always-fresh Firebase call ref

  // Synchronous setter: updates both React state AND the ref immediately.
  // This is critical because ICE candidates fire right after setLocalDescription
  // and need otherUserIdRef to be correct for routing via Socket.IO.
  const setPeerUserId = (id) => {
    setOtherUserId(id);
    otherUserIdRef.current = id;
  };

  // Keep refs in sync
  useEffect(() => {
    otherUserIdRef.current = otherUserId;
  }, [otherUserId]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    activeCallRefRef.current = activeCallRef;
  }, [activeCallRef]);

  // Navigate when callType changes
  useEffect(() => {
    if (callType === 'INCOMING') {
      navigationRef.current?.navigate('IncomingCall');
    } else if (callType === 'OUTGOING') {
      navigationRef.current?.navigate('OutgoingCall');
    } else if (callType === 'WEBRTC_ROOM') {
      navigationRef.current?.navigate('WebRTCRoom');
    }
  }, [callType]);

  /**
   * Build a fresh RTCPeerConnection with local tracks attached.
   * Call once at startup and again after every call ends.
   */
  const createPeerConnection = stream => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    // Remote stream (modern API)
    pc.ontrack = event => {
      console.log('📺 ontrack received:', event.track?.kind, '| streams:', event.streams?.length);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else if (event.track) {
        // Fallback: if tracks arrive without a stream wrapper, create one
        console.log('📺 ontrack: track arrived without stream, creating MediaStream');
        const stream = new MediaStream([event.track]);
        setRemoteStream(stream);
      }
    };

    // Fallback for older react-native-webrtc
    pc.onaddstream = event => {
      console.log('📺 onaddstream received');
      setRemoteStream(event.stream);
    };

    // ICE candidates — read otherUserIdRef at call-time (never stale)
    pc.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current?.emit('ICEcandidate', {
          calleeId: otherUserIdRef.current,
          rtcMessage: {
            type: 'candidate',
            candidate: event.candidate,
          },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE state:', pc.iceConnectionState, '| signaling:', pc.signalingState);
    };

    pc.onnegotiationneeded = () => {
      console.log('🔄 Negotiation needed');
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const getMediaStream = async mode => {
    try {
      return await mediaDevices.getUserMedia({
        audio: true,
        video:
          mode === 'video'
            ? {
                width: { min: 500, ideal: 720, max: 1280 },
                height: { min: 300, ideal: 720, max: 1280 },
                frameRate: { ideal: 30, max: 60 },
              }
            : false,
      });
    } catch (err) {
      console.error('❌ getUserMedia error:', err);
      return null;
    }
  };

  const removeVideoTracks = stream => {
    if (!stream) return;
    stream.getVideoTracks().forEach(track => {
      try {
        track.stop();
      } catch (_) {}
      stream.removeTrack(track);
    });
  };

  const prepareLocalStreamForMode = async mode => {
    if (!peerConnectionRef.current) return;

    if (mode === 'video') {
      const hasVideo = localStreamRef.current?.getVideoTracks()?.length > 0;
      if (hasVideo) {
        return;
      }

      const stream = await getMediaStream('video');
      if (!stream) return;

      const newVideoTrack = stream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const audioTracks = localStreamRef.current?.getAudioTracks() || [];
      const updatedStream = new MediaStream([...audioTracks, newVideoTrack]);
      setLocalStream(updatedStream);
      localStreamRef.current = updatedStream;
      peerConnectionRef.current.addTrack(newVideoTrack, updatedStream);
      return;
    }

    if (mode === 'audio') {
      if (!localStreamRef.current?.getVideoTracks()?.length) {
        return;
      }

      removeVideoTracks(localStreamRef.current);
      const updatedStream = new MediaStream(localStreamRef.current.getAudioTracks());
      setLocalStream(updatedStream);
      localStreamRef.current = updatedStream;

      const videoSenders = peerConnectionRef.current
        .getSenders()
        .filter(sender => sender.track?.kind === 'video');

      videoSenders.forEach(sender => {
        try {
          peerConnectionRef.current.removeTrack(sender);
        } catch (err) {
          console.warn('Failed to remove video sender:', err);
        }
      });
    }
  };

  // Initialize media stream once, then create the first peer connection
  useEffect(() => {
    const init = async () => {
      const stream = await getMediaStream('audio');
      if (stream) {
        setLocalStream(stream);
        localStreamRef.current = stream;
        createPeerConnection(stream);
      } else {
        createPeerConnection(null);
      }
    };
    init();

    return () => peerConnectionRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize Socket.IO
  useEffect(() => {
    const socket = SocketIOClient(SERVER_URL, {
      transports: ['websocket'],
      query: {callerId},
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      // Register callerId immediately if already logged in
      const uid = auth().currentUser?.uid;
      if (uid) {
        database().ref(`/users/${uid}`).update({socketCallerId: callerId});
      }
    });

    socket.on('disconnect', () => console.log('❌ Socket disconnected'));

    // Also register when the user logs in AFTER the socket has connected
    // (e.g. user was on login screen when socket first connected)
    const unsubscribeAuth = auth().onAuthStateChanged(user => {
      if (user && socketRef.current?.connected) {
        database()
          .ref(`/users/${user.uid}`)
          .update({socketCallerId: callerId});
        console.log('✅ socketCallerId registered for', user.uid);
      }
    });

    return () => {
      socket.disconnect();
      unsubscribeAuth();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset helper — recreates peer connection for next call
  // @param endStatus - Firebase call status to write (e.g. 'ended', 'rejected', 'missed')
  const resetCall = (endStatus = 'ended') => {
    // Update Firebase call status for call history tracking
    // Uses ref to avoid stale closure when called from socket event handlers
    const ref = activeCallRefRef.current;
    if (ref) {
      try {
        ref.update({status: endStatus, endedAt: Date.now()});
      } catch (err) {
        console.error('❌ Failed to update call status:', err);
      }
    }
    setCallType('JOIN');
    setPeerUserId(null);
    setCallStatus(null);
    setRemoteStream(null);
    setActiveCallRef(null);
    setActiveCallPeerName(null);
    setActiveCallPeerImage(null);
    setActiveCallMode(null);
    createPeerConnection(localStreamRef.current);
  };

  // ─────────────────────────────────────────────
  // INCOMING CALL DETECTION via Firebase /calls
  // ─────────────────────────────────────────────
  useEffect(() => {
    // Wait until user is authenticated
    const unsubscribe = auth().onAuthStateChanged(user => {
      if (!user) return;

      const callsRef = database()
        .ref('/calls')
        .orderByChild('receiverId')
        .equalTo(user.uid);

      const onNewCall = callsRef.on('child_added', async snapshot => {
        const callData = snapshot.val();
        if (!callData) return;

        // Only handle ringing calls (not ones we already processed)
        if (callData.status !== 'ringing') return;

        // Don't answer our own outgoing calls
        if (callData.callerId === user.uid) return;

        console.log('📞 Incoming Firebase call from:', callData.callerName);

        // Look up the caller's Socket.IO callerId from their Firebase profile
        const callerSnap = await database()
          .ref(`/users/${callData.callerId}/socketCallerId`)
          .once('value');
        const callerSocketId = callerSnap.val();

        if (!callerSocketId) {
          console.warn('⚠️ Caller socketCallerId not found in Firebase');
          return;
        }

        // Save active call ref so IncomingCallScreen can update its status
        const callFirebaseRef = database().ref(`/calls/${snapshot.key}`);
        setActiveCallRef(callFirebaseRef);
        setPeerUserId(callerSocketId);
        setCallStatus('ringing');
        setCallType('INCOMING');
        setActiveCallMode(callData.type || 'audio');

        // Store caller display info for call screens
        setActiveCallPeerName(callData.callerName || null);
        setActiveCallPeerImage(callData.callerImage || null);
      });

      return () => callsRef.off('child_added', onNewCall);
    });

    return () => unsubscribe();
  }, []);

  // ─────────────────────────────────────────────
  // SOCKET.IO SIGNALING EVENTS
  // ─────────────────────────────────────────────
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    
    const onNewCall = async data => {
      console.log('📡 Socket newCall from:', data.callerId);
      setPeerUserId(data.callerId);
      setCallStatus('ringing');

      try {
        await peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription(data.rtcMessage),
        );
        console.log('✅ Remote offer set, signaling state:', peerConnectionRef.current?.signalingState);
      } catch (err) {
        console.error('❌ setRemoteDescription (offer):', err);
      }
      
      setCallType(prev => (prev === 'INCOMING' ? prev : 'INCOMING'));
    };

    const onCallAnswered = async data => {
      console.log('✅ callAnswered from:', data.callee);
      setCallStatus('answered');
      try {
        await peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription(data.rtcMessage),
        );
      } catch (err) {
        console.error('❌ setRemoteDescription (answer):', err);
      }
      setCallType('WEBRTC_ROOM');
    };

    const onIceCandidate = async data => {
      try {
        if (peerConnectionRef.current && data.rtcMessage?.candidate) {
          console.log('🧊 Received ICE candidate from peer');
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.rtcMessage.candidate),
          );
        }
      } catch (err) {
        console.error('❌ addIceCandidate:', err);
      }
    };

    const onCallRejected = () => {
      console.log('❌ Call rejected');
      resetCall();
    };

    const onEndCall = () => {
      console.log('📵 Call ended by remote');
      resetCall();
    };

    socket.on('newCall', onNewCall);
    socket.on('callAnswered', onCallAnswered);
    socket.on('ICEcandidate', onIceCandidate);
    socket.on('callRejected', onCallRejected);
    socket.on('endCall', onEndCall);

    return () => {
      socket.off('newCall', onNewCall);
      socket.off('callAnswered', onCallAnswered);
      socket.off('ICEcandidate', onIceCandidate);
      socket.off('callRejected', onCallRejected);
      socket.off('endCall', onEndCall);
    };

  }, []);

  const contextValue = {
    localStream,
    remoteStream,
    callerId,      // Socket.IO room ID for this device
    otherUserId,   // Socket.IO room ID of the remote peer
    setPeerUserId,  // Synchronous setter — use this when initiating calls
    callType,
    setCallType,
    callStatus,
    setCallStatus,
    socketRef,
    peerConnectionRef,
    activeCallRef, // Firebase ref to /calls/<id> for status updates
    activeCallPeerName,  // Display name of the other person in the call
    activeCallPeerImage, // Profile image URL of the other person
    activeCallMode,
    setActiveCallMode,
    prepareLocalStreamForMode,
    setActiveCallPeerName,
    setActiveCallPeerImage,
    resetCall,
  };

  return (
    <WebRTCContext.Provider value={contextValue}>
      <NavigationContainer ref={navigationRef}>
        <Root />
      </NavigationContainer>
    </WebRTCContext.Provider>
  );
};

export default App;

const styles = StyleSheet.create({});
