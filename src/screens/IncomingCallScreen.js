import React, { useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { WebRTCContext } from '../../App';

const IncomingCallScreen = ({ navigation }) => {
  const {
    otherUserId,
    setCallType,
    setCallStatus,
    peerConnectionRef,
    socketRef,
    activeCallRef,
    activeCallPeerName,
    activeCallPeerImage,
    resetCall,
  } = useContext(WebRTCContext);

  const handleAnswerCall = async () => {
    try {
      setCallStatus('answered');

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Send SDP answer to caller via Socket.IO
      socketRef.current?.emit('answerCall', {
        callerId: otherUserId,
        rtcMessage: answer,
      });

      // Update Firebase call status
      activeCallRef?.update({status: 'answered'});

      setCallType('WEBRTC_ROOM');
      navigation.navigate('WebRTCRoom');
    } catch (error) {
      console.error('Error answering call:', error);
    }
  };

  const handleRejectCall = () => {
    // Notify caller via Socket.IO
    socketRef.current?.emit('callRejected', {
      calleeId: otherUserId,
    });
    // Mark call as rejected in Firebase and clean up
    resetCall('rejected');
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Incoming Call</Text>
        {activeCallPeerImage ? (
          <Image source={{ uri: activeCallPeerImage }} style={styles.callerAvatar} />
        ) : (
          <View style={styles.callerAvatarPlaceholder}>
            <Text style={styles.callerAvatarLetter}>
              {activeCallPeerName ? activeCallPeerName.charAt(0).toUpperCase() : '?'}
            </Text>
          </View>
        )}
        <Text style={styles.callerId}>{activeCallPeerName || otherUserId} is calling...</Text>
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
    marginTop: 15,
  },
  callerAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginTop: 10,
  },
  callerAvatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#5568FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  callerAvatarLetter: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
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