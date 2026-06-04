import React, { useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { WebRTCContext } from '../../App';

const IncomingCallScreen = ({ navigation }) => {
  const {
    otherUserId,
    setCallType,
    setCallStatus,
    setOtherUserId,
    peerConnectionRef,
    socketRef,
  } = useContext(WebRTCContext);

  const handleAnswerCall = async () => {
    try {
      setCallStatus('answered');

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Server expects: "answerCall" event with { callerId, rtcMessage }
      socketRef.current?.emit('answerCall', {
        callerId: otherUserId,
        rtcMessage: answer,
      });

      // Navigation to WebRTCRoom is handled by App.jsx when "callAnswered" is received
      // but since we are the callee, we navigate directly
      setCallType('WEBRTC_ROOM');
      navigation.navigate('WebRTCRoom');
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  const handleRejectCall = () => {
    socketRef.current?.emit('callRejected', {
      to: otherUserId,
    });
    setCallType('JOIN');
    setOtherUserId(null);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Incoming Call</Text>
        <Text style={styles.callerId}>{otherUserId} is calling...</Text>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={handleRejectCall}
        >
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.answerButton]}
          onPress={handleAnswerCall}
        >
          <Text style={styles.buttonText}>Answer</Text>
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
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    paddingBottom: 40,
  },
  button: {
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerButton: {
    backgroundColor: 'green',
  },
  rejectButton: {
    backgroundColor: '#FF5D5D',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default IncomingCallScreen;