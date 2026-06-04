import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useState, useRef, createContext } from 'react';
import Root from './src/navigation/Root';
import SocketIOClient from 'socket.io-client';

import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc';

// Create context for sharing WebRTC state across screens
export const WebRTCContext = createContext();

const navigationRef = React.createRef();

// ICE servers config
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const App = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callerId] = useState(
    Math.floor(100000 + Math.random() * 900000).toString(),
  );
  const [otherUserId, setOtherUserId] = useState(null);
  const [callType, setCallType] = useState('JOIN'); // JOIN, OUTGOING, INCOMING, WEBRTC_ROOM
  const [callStatus, setCallStatus] = useState(null); // ringing, answered, rejected, ended

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  // Use a ref to always have the latest otherUserId inside callbacks (avoids stale closure)
  const otherUserIdRef = useRef(null);

  // Keep otherUserIdRef in sync with state
  useEffect(() => {
    otherUserIdRef.current = otherUserId;
  }, [otherUserId]);

  // Handle navigation based on call type changes
  useEffect(() => {
    if (callType === 'INCOMING') {
      console.log('Navigating to IncomingCall');
      navigationRef.current?.navigate('IncomingCall');
    } else if (callType === 'OUTGOING') {
      console.log('Navigating to OutgoingCall');
      navigationRef.current?.navigate('OutgoingCall');
    } else if (callType === 'WEBRTC_ROOM') {
      console.log('Navigating to WebRTCRoom');
      navigationRef.current?.navigate('WebRTCRoom');
    }
  }, [callType]);

  // Initialize socket connection (once)
  useEffect(() => {
    socketRef.current = SocketIOClient('http://192.168.18.41:3500', {
      transports: ['websocket'],
      query: {
        callerId,
      },
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [callerId]);

  /**
   * Create a fresh RTCPeerConnection and wire up all its event handlers.
   * Call this once at startup and again after a call ends to reset state.
   */
  const createPeerConnection = localMediaStream => {
    // Close any existing connection first
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to the connection
    if (localMediaStream) {
      localMediaStream.getTracks().forEach(track => {
        pc.addTrack(track, localMediaStream);
      });
    }

    // Receive remote stream
    pc.ontrack = event => {
      console.log('🎥 Remote track received');
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Deprecated but kept as fallback for older react-native-webrtc versions
    pc.onaddstream = event => {
      console.log('🎥 Remote stream added (legacy)');
      setRemoteStream(event.stream);
    };

    // ICE candidate — use ref to always get the latest target user id
    pc.onicecandidate = event => {
      if (event.candidate) {
        const targetId = otherUserIdRef.current;
        console.log('🧊 ICE candidate, sending to:', targetId);
        socketRef.current?.emit('ICEcandidate', {
          calleeId: targetId,
          rtcMessage: {
            type: 'candidate',
            candidate: event.candidate,
          },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // Get local media stream (once), then create the initial peer connection
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

        console.log('🎤 Local stream obtained');
        setLocalStream(stream);
        // Create connection with local stream already added
        createPeerConnection(stream);
      } catch (error) {
        console.error('❌ Error accessing media devices:', error);
      }
    };

    init();

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to reset call state and peer connection after a call ends
  const resetCall = currentLocalStream => {
    setCallType('JOIN');
    setOtherUserId(null);
    setCallStatus(null);
    setRemoteStream(null);
    // Recreate peer connection ready for next call
    createPeerConnection(currentLocalStream);
  };

  // Handle all socket events (once socket is ready)
  useEffect(() => {
    if (!socketRef.current) {
      return;
    }

    console.log('🔌 Setting up socket event listeners...');

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected with ID:', socketRef.current.id);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    /**
     * Server event: "newCall"  (server emits this when someone calls us)
     * Payload: { callerId, rtcMessage }   where rtcMessage is the SDP offer
     */
    socketRef.current.on('newCall', async data => {
      console.log('📞 Incoming call from:', data.callerId);
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
      } catch (error) {
        console.error('❌ Error setting remote description from offer:', error);
      }

      // Navigate AFTER remote description is set
      setCallType('INCOMING');
    });

    /**
     * Server event: "callAnswered"  (callee answered our outgoing call)
     * Payload: { callee, rtcMessage }   where rtcMessage is the SDP answer
     */
    socketRef.current.on('callAnswered', async data => {
      console.log('✅ Call answered by:', data.callee);
      setCallStatus('answered');

      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.rtcMessage),
          );
          console.log('✅ Remote description set from answer');
        }
      } catch (error) {
        console.error('❌ Error setting remote description from answer:', error);
      }

      setCallType('WEBRTC_ROOM');
    });

    /**
     * Server event: "ICEcandidate"
     * Payload: { sender, rtcMessage }  where rtcMessage contains the candidate
     */
    socketRef.current.on('ICEcandidate', async data => {
      try {
        if (peerConnectionRef.current && data.rtcMessage?.candidate) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.rtcMessage.candidate),
          );
          console.log('✅ ICE candidate added');
        }
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    });

    // Call rejected by callee
    socketRef.current.on('callRejected', () => {
      console.log('❌ Call rejected');
      setCallType('JOIN');
      setOtherUserId(null);
      setCallStatus(null);
    });

    // Remote side ended the call
    socketRef.current.on('endCall', () => {
      console.log('📞 Call ended by remote');
      resetCall(localStream);
    });

    return () => {
      socketRef.current?.off('connect');
      socketRef.current?.off('disconnect');
      socketRef.current?.off('newCall');
      socketRef.current?.off('callAnswered');
      socketRef.current?.off('callRejected');
      socketRef.current?.off('ICEcandidate');
      socketRef.current?.off('endCall');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

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
    resetCall,
    localStreamRef: localStream,
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
