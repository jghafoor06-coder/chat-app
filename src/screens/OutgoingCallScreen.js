import React, { useContext, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { RTCSessionDescription } from 'react-native-webrtc';
import { WebRTCContext } from '../../App';

const OutgoingCallScreen = ({ navigation }) => {
  const {
    otherUserId,
    callStatus,
    setCallType,
    setOtherUserId,
    peerConnectionRef,
    socketRef,
  } = useContext(WebRTCContext);

  const handleEndCall = () => {
    socketRef.current?.emit('endCall', {
      to: otherUserId,
    });
    setCallType('JOIN');
    setOtherUserId(null);
    navigation.goBack();
  };

  useEffect(() => {
    // Listen for call answered
    const handleCallAnswered = async data => {
      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.signalData)
        );
        setCallType('WEBRTC_ROOM');
        navigation.navigate('WebRTCRoom');
      } catch (error) {
        console.error('Error handling call answered:', error);
      }
    };

    socketRef.current?.on('callAnswered', handleCallAnswered);

    return () => {
      socketRef.current?.off('callAnswered', handleCallAnswered);
    };
  }, [otherUserId]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Calling to...</Text>
        <Text style={styles.callerId}>{otherUserId}</Text>
        <Text style={styles.statusText}>
          {callStatus === 'ringing' ? 'Ringing...' : callStatus}
        </Text>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Text style={styles.buttonText}>End Call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050A0E',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    color: '#D0D4DD',
    marginBottom: 15,
  },
  callerId: {
    fontSize: 36,
    color: '#fff',
    fontWeight: 'bold',
    letterSpacing: 6,
    marginBottom: 20,
  },
  statusText: {
    fontSize: 14,
    color: '#D0D4DD',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  button: {
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    backgroundColor: '#FF5D5D',
  },
  buttonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default OutgoingCallScreen;