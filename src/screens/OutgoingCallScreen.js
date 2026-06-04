import React, { useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { WebRTCContext } from '../../App';

const OutgoingCallScreen = ({ navigation }) => {
  const {
    otherUserId,
    callStatus,
    setCallType,
    setOtherUserId,
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

  // Navigation to WebRTCRoom happens automatically in App.jsx
  // when the "callAnswered" socket event is received.


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