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
  const [otherUserId, setOtherUserId] = useState(null);
  const [callType, setCallType] = useState('JOIN');
  const [callStatus, setCallStatus] = useState(null);
  const [activeCallRef, setActiveCallRef] = useState(null);

  const callerIdRef = useRef(
    Math.floor(100000 + Math.random() * 900000).toString(),
  );
  const callerId = callerIdRef.current;

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const otherUserIdRef = useRef(null);
  const localStreamRef = useRef(null);

  // Keep refs in sync with state
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

  const createPeerConnection = stream => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.ontrack = event => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Fallback for older react-native-webrtc
    pc.onaddstream = event => setRemoteStream(event.stream);

    pc.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current?.emit('ICEcandidate', {
          calleeId: otherUserIdRef.current,
          rtcMessage: {type: 'candidate', candidate: event.candidate},
        });
      }
    };

    pc.oniceconnectionstatechange = () =>
      console.log('🧊 ICE state:', pc.iceConnectionState);

    peerConnectionRef.current = pc;
    return pc;
  };

  const resetCall = () => {
    setCallType('JOIN');
    setOtherUserId(null);
    setCallStatus(null);
    setRemoteStream(null);
    setActiveCallRef(null);
    createPeerConnection(localStreamRef.current);
  };

  // ─────────────────────────────────────────────────────
  // Single unified useEffect: media + socket + all events
  // ─────────────────────────────────────────────────────
  useEffect(() => {
    let socket;

    const init = async () => {
      // 1. Get local media stream
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
        console.log('🎤 Local stream obtained');
      } catch (err) {
        console.error('❌ getUserMedia error:', err);
        // Still create peer connection (audio-only or will fail gracefully)
        createPeerConnection(null);
      }

      // 2. Connect Socket.IO
      socket = SocketIOClient(SERVER_URL, {
        transports: ['websocket'],
        query: {callerId},
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ Socket connected:', socket.id, '| callerId:', callerId);
        const uid = auth().currentUser?.uid;
        if (uid) {
          database().ref(`/users/${uid}`).update({socketCallerId: callerId});
          console.log('✅ socketCallerId saved for uid:', uid);
        }
      });

      socket.on('disconnect', () => console.log('❌ Socket disconnected'));

      // 3. Register all Socket.IO signaling handlers
      socket.on('newCall', async data => {
        console.log('📞 newCall received from:', data.callerId);
        setOtherUserId(data.callerId);
        otherUserIdRef.current = data.callerId;
        setCallStatus('ringing');

        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.rtcMessage),
            );
            console.log('✅ Remote description set from offer');
          }
        } catch (err) {
          console.error('❌ setRemoteDescription (offer):', err);
        }

        setCallType('INCOMING');
      });

      socket.on('callAnswered', async data => {
        console.log('✅ callAnswered from:', data.callee);
        setCallStatus('answered');
        try {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(
              new RTCSessionDescription(data.rtcMessage),
            );
            console.log('✅ Remote description set from answer');
          }
        } catch (err) {
          console.error('❌ setRemoteDescription (answer):', err);
        }
        setCallType('WEBRTC_ROOM');
      });

      socket.on('ICEcandidate', async data => {
        try {
          if (peerConnectionRef.current && data.rtcMessage?.candidate) {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(data.rtcMessage.candidate),
            );
            console.log('✅ ICE candidate added');
          }
        } catch (err) {
          console.error('❌ addIceCandidate:', err);
        }
      });

      socket.on('callRejected', () => {
        console.log('❌ Call rejected by remote');
        resetCall();
      });

      socket.on('endCall', () => {
        console.log('📵 Call ended by remote');
        resetCall();
      });
    };

    init();

    // 4. Register socketCallerId when user logs in after socket connects
    const unsubscribeAuth = auth().onAuthStateChanged(user => {
      if (user && socketRef.current?.connected) {
        database()
          .ref(`/users/${user.uid}`)
          .update({socketCallerId: callerId});
        console.log('✅ socketCallerId registered on auth change for:', user.uid);
      }
    });

    return () => {
      socket?.disconnect();
      peerConnectionRef.current?.close();
      unsubscribeAuth();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────
  // Firebase /calls listener (for ChatScreen calls)
  // ─────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(user => {
      if (!user) return;

      const callsRef = database()
        .ref('/calls')
        .orderByChild('receiverId')
        .equalTo(user.uid);

      const onFirebaseCall = callsRef.on('child_added', async snapshot => {
        const callData = snapshot.val();
        if (!callData || callData.status !== 'ringing') return;
        if (callData.callerId === user.uid) return; // skip own outgoing calls

        console.log('📞 Incoming Firebase call from:', callData.callerName);

        const callerSnap = await database()
          .ref(`/users/${callData.callerId}/socketCallerId`)
          .once('value');
        const callerSocketId = callerSnap.val();

        if (!callerSocketId) {
          console.warn('⚠️ Caller socketCallerId not found in Firebase');
          return;
        }

        const callFirebaseRef = database().ref(`/calls/${snapshot.key}`);
        setActiveCallRef(callFirebaseRef);
        setOtherUserId(callerSocketId);
        otherUserIdRef.current = callerSocketId;
        setCallStatus('ringing');
        setCallType('INCOMING');
      });

      return () => callsRef.off('child_added', onFirebaseCall);
    });

    return () => unsubscribe();
  }, []);

  const contextValue = {
    localStream,
    remoteStream,
    callerId,
    otherUserId,
    setOtherUserId,
    callType,
    setCallType,
    callStatus,
    setCallStatus,
    socketRef,
    peerConnectionRef,
    activeCallRef,
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
