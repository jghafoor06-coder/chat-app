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

const App = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callerId] = useState(Math.floor(100000 + Math.random() * 900000).toString());
  const [otherUserId, setOtherUserId] = useState(null);
  const [callType, setCallType] = useState('JOIN'); // JOIN, OUTGOING, INCOMING, WEBRTC_ROOM
  const [callStatus, setCallStatus] = useState(null); // ringing, answered, rejected, ended

  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);

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
    let isFront = false;

    mediaDevices.enumerateDevices().then(sourceInfos => {
      let videoSourceId;
      for (let i = 0; i < sourceInfos.length; i++) {
        const sourceInfo = sourceInfos[i];
        if (
          sourceInfo.kind === 'videoinput' &&
          sourceInfo.facing === (isFront ? 'user' : 'environment')
        ) {
          videoSourceId = sourceInfo.deviceId;
        }
      }

      mediaDevices
        .getUserMedia({
          audio: true,
          video: {
            mandatory: {
              minWidth: 500,
              minHeight: 300,
              minFrameRate: 30,
            },
            facingMode: isFront ? 'user' : 'environment',
            optional: videoSourceId ? [{ sourceId: videoSourceId }] : [],
          },
        })
        .then(stream => {
          setLocalStream(stream);
          if (peerConnectionRef.current) {
            peerConnectionRef.current.addStream(stream);
          }
        })
        .catch(error => {
          console.error('Error accessing media devices:', error);
        });
    });
  }, []);

  // Handle socket events
  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.on('newCall', async data => {
      setOtherUserId(data.from);
      setCallStatus('ringing');
      setCallType('INCOMING');

      // Create and send offer
      try {
        const offer = await peerConnectionRef.current.createOffer();
        await peerConnectionRef.current.setLocalDescription(offer);
        socketRef.current.emit('callUser', {
          to: data.from,
          signalData: offer,
          callerName: callerId,
        });
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    });

    socketRef.current.on('callAnswered', async data => {
      setCallStatus('answered');
      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.signalData)
        );
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    });

    socketRef.current.on('ICEcandidate', data => {
      try {
        peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });

    socketRef.current.on('callEnded', () => {
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
      socketRef.current?.off('newCall');
      socketRef.current?.off('callAnswered');
      socketRef.current?.off('ICEcandidate');
      socketRef.current?.off('callEnded');
    };
  }, [callerId, localStream, remoteStream]);

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
      <NavigationContainer>
        <Root />
      </NavigationContainer>
    </WebRTCContext.Provider>
  );
};

export default App;

const styles = StyleSheet.create({});
