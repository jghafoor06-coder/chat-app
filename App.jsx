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

  // A stable, random Socket.IO room identifier for this device session
  const callerIdRef = useRef(
    Math.floor(100000 + Math.random() * 900000).toString(),
  );
  const callerId = callerIdRef.current;

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const otherUserIdRef = useRef(null); // always-fresh peer callerId
  const localStreamRef = useRef(null); // always-fresh localStream

  // Keep refs in sync
  useEffect(() => {
    otherUserIdRef.current = otherUserId;
  }, [otherUserId]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

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
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Fallback for older react-native-webrtc
    pc.onaddstream = event => {
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
      console.log('🧊 ICE state:', pc.iceConnectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Initialize media stream once, then create the first peer connection
  useEffect(() => {
    const init = async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: {min: 500, ideal: 720, max: 1280},
            height: {min: 300, ideal: 720, max: 1280},
            frameRate: {ideal: 30, max: 60},
          },
        });
        setLocalStream(stream);
        localStreamRef.current = stream;
        createPeerConnection(stream);
      } catch (err) {
        console.error('❌ getUserMedia error:', err);
        // Still create the peer connection so createOffer/createAnswer don't crash
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
  const resetCall = () => {
    setCallType('JOIN');
    setOtherUserId(null);
    setCallStatus(null);
    setRemoteStream(null);
    setActiveCallRef(null);
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
        setOtherUserId(callerSocketId);
        otherUserIdRef.current = callerSocketId;
        setCallStatus('ringing');
        setCallType('INCOMING');
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

    /**
     * "newCall" — someone sends us a WebRTC offer via Socket.IO.
     * Payload: { callerId, rtcMessage }
     */
    const onNewCall = async data => {
      console.log('📡 Socket newCall from:', data.callerId);
      setOtherUserId(data.callerId);
      otherUserIdRef.current = data.callerId;
      setCallStatus('ringing');

      try {
        await peerConnectionRef.current?.setRemoteDescription(
          new RTCSessionDescription(data.rtcMessage),
        );
      } catch (err) {
        console.error('❌ setRemoteDescription (offer):', err);
      }
      // Only navigate if not already doing so via Firebase listener
      setCallType(prev => (prev === 'INCOMING' ? prev : 'INCOMING'));
    };

    /**
     * "callAnswered" — callee accepted, sending back their SDP answer.
     * Payload: { callee, rtcMessage }
     */
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

    /**
     * "ICEcandidate" — remote peer's ICE candidate.
     * Payload: { sender, rtcMessage: { candidate } }
     */
    const onIceCandidate = async data => {
      try {
        if (peerConnectionRef.current && data.rtcMessage?.candidate) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue = {
    localStream,
    remoteStream,
    callerId,      // Socket.IO room ID for this device
    otherUserId,   // Socket.IO room ID of the remote peer
    setOtherUserId,
    callType,
    setCallType,
    callStatus,
    setCallStatus,
    socketRef,
    peerConnectionRef,
    activeCallRef, // Firebase ref to /calls/<id> for status updates
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
