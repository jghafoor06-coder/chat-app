import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useState, useRef, createContext } from 'react';
import Root from './src/navigation/Root';
import SocketIOClient from 'socket.io-client';

import {
  mediaDevices,
  RTCPeerConnection,
  RTCView,
  RTCIceCandidate,
  RTCSessionDescription,
} from 'react-native-webrtc';

// Create context for sharing WebRTC state across screens
export const WebRTCContext = createContext();

const navigationRef = React.createRef();

const App = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callerId] = useState(Math.floor(100000 + Math.random() * 900000).toString());
  const [otherUserId, setOtherUserId] = useState(null);
  const [callType, setCallType] = useState('JOIN'); // JOIN, OUTGOING, INCOMING, WEBRTC_ROOM
  const [callStatus, setCallStatus] = useState(null); // ringing, answered, rejected, ended

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);

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

  // Initialize socket connection
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

  // Initialize WebRTC
  useEffect(() => {
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    // Handle incoming remote stream
    peerConnectionRef.current.onaddstream = event => {
      setRemoteStream(event.stream);
    };

    // Handle ICE candidates
    peerConnectionRef.current.onicecandidate = event => {
      if (event.candidate) {
        socketRef.current?.emit('ICEcandidate', {
          to: otherUserId,
          candidate: event.candidate,
        });
      }
    };

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [otherUserId]);

  // Get media streams
  useEffect(() => {
    const getMediaStream = async () => {
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: {
            width: { min: 500, ideal: 720, max: 1280 },
            height: { min: 300, ideal: 720, max: 1280 },
            frameRate: { ideal: 30, max: 60 },
          },
        });

        setLocalStream(stream);
        if (peerConnectionRef.current) {
          peerConnectionRef.current.addStream(stream);
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
      }
    };

    getMediaStream();
  }, []);

  // Handle socket events
  useEffect(() => {
    if (!socketRef.current) return;

    console.log('🔌 Setting up socket event listeners...');

    socketRef.current.on('connect', () => {
      console.log('✅ Socket connected with ID:', socketRef.current.id);
    });

    socketRef.current.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    // Receive incoming call
    socketRef.current.on('callUser', async data => {
      console.log('📞 Incoming call from:', data.callerName);
      setOtherUserId(data.callerName);
      setCallStatus('ringing');
      setCallType('INCOMING');

      try {
        // Store the offer for later
        if (peerConnectionRef.current && !peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.signalData)
          );
          console.log('✅ Remote description set from offer');
        }
      } catch (error) {
        console.error('❌ Error setting remote description:', error);
      }
    });

    // Receive call answered
    socketRef.current.on('callAnswered', async data => {
      console.log('✅ Call answered by:', data.from);
      setCallStatus('answered');
      try {
        if (peerConnectionRef.current && !peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.signalData)
          );
          console.log('✅ Remote description set from answer');
        }
      } catch (error) {
        console.error('❌ Error setting remote description:', error);
      }
    });

    // Receive ICE candidates
    socketRef.current.on('ICEcandidate', data => {
      try {
        if (peerConnectionRef.current && data.candidate) {
          peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log('✅ ICE candidate added');
        }
      } catch (error) {
        console.error('❌ Error adding ICE candidate:', error);
      }
    });

    // Receive call rejected
    socketRef.current.on('callRejected', () => {
      console.log('❌ Call rejected');
      setCallType('JOIN');
      setOtherUserId(null);
      setCallStatus(null);
    });

    // Receive call ended
    socketRef.current.on('callEnded', () => {
      console.log('📞 Call ended');
      setCallType('JOIN');
      setOtherUserId(null);
      setCallStatus(null);
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
    });

    return () => {
      socketRef.current?.off('connect');
      socketRef.current?.off('disconnect');
      socketRef.current?.off('callUser');
      socketRef.current?.off('callAnswered');
      socketRef.current?.off('callRejected');
      socketRef.current?.off('ICEcandidate');
      socketRef.current?.off('callEnded');
    };
  }, [localStream, remoteStream]);

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
