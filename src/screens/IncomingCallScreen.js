import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { WebRTCContext } from '../../App';
import Ionicons from '@react-native-vector-icons/ionicons';

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
      activeCallRef?.update({ status: 'answered' });

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
          <Image
            source={{ uri: activeCallPeerImage }}
            style={styles.callerAvatar}
          />
        ) : (
          <View style={styles.callerAvatarPlaceholder}>
            <Text style={styles.callerAvatarLetter}>
              {activeCallPeerName
                ? activeCallPeerName.charAt(0).toUpperCase()
                : '?'}
            </Text>
          </View>
        )}

        <Text style={styles.callerName}>
          {activeCallPeerName || otherUserId}
        </Text>

        <Text style={styles.callingText}>is calling you...</Text>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={handleRejectCall}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={26} color="#fff" />
          <Text style={styles.actionText}>Reject</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.answerButton]}
          onPress={handleAnswerCall}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={26} color="#fff" />
          <Text style={styles.actionText}>Answer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0b5ed7',
    marginBottom: 35,
    letterSpacing: 0.5,
  },

  callerAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#0b5ed7',

    shadowColor: '#0b5ed7',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 12,
  },

  callerAvatarPlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#0b5ed7',
    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: '#0b5ed7',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 12,
  },

  callerAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 60,
    fontWeight: '700',
  },

  callerName: {
    marginTop: 28,
    fontSize: 30,
    fontWeight: '700',
    color: '#0b5ed7',
    textAlign: 'center',
  },

  callingText: {
    marginTop: 8,
    fontSize: 17,
    color: '#6B7280',
    textAlign: 'center',
  },

  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',

    paddingTop: 25,
    paddingBottom: 50,
    width: '100%',

    backgroundColor: '#FFFFFF',

    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },

  button: {
    width: 70,
    height: 70,
    borderRadius: 50,

    justifyContent: 'center',
    alignItems: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },

  answerButton: {
    backgroundColor: '#0b5ed7',
  },

  rejectButton: {
    backgroundColor: '#FF5D5D',
  },

  actionText: {
    color: '#FFFFFF',
    marginTop: 6,
    fontWeight: '600',
    fontSize: 10,
  },
});

export default IncomingCallScreen;
