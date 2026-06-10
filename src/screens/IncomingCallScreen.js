import React, { useContext, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { WebRTCContext } from '../../App';
import Ionicons from '@react-native-vector-icons/ionicons';

const POLL_INTERVAL = 200; // ms

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
    activeCallMode,
    prepareLocalStreamForMode,
    resetCall,
    isOfferReady,
  } = useContext(WebRTCContext);

  // Locally track signaling state by polling the peer connection directly.
  // This is more reliable than depending on context re-renders from App.jsx,
  // because the RTCPeerConnection signalingState is the single source of truth.
  const [signalingState, setSignalingState] = useState(
    peerConnectionRef.current?.signalingState || null
  );
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    const poll = () => {
      const pc = peerConnectionRef.current;
      const state = pc?.signalingState;
      console.log('[IncomingPoll] pc:', !!pc, 'signalingState:', state);
      setSignalingState(state || null);

      // Stop polling once we have a valid offer state
      if (state === 'have-remote-offer' || state === 'have-local-pranswer') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          console.log('[IncomingPoll] ✅ Offer detected, stopping poll');
        }
      }
    };

    // Check immediately first
    poll();

    // Then poll every POLL_INTERVAL ms
    pollIntervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [peerConnectionRef]);

  // Button is ready if EITHER the context says so OR the local signaling state says so
  const isLocallyReady =
    signalingState === 'have-remote-offer' ||
    signalingState === 'have-local-pranswer';
  const ready = isOfferReady || isLocallyReady;

  const handleAnswerCall = async () => {
    try {
      await prepareLocalStreamForMode(activeCallMode || 'audio');

      const signalingState = peerConnectionRef.current?.signalingState;
      if (signalingState !== 'have-remote-offer' && signalingState !== 'have-local-pranswer') {
        console.warn('Cannot answer — invalid signaling state:', signalingState);
        return;
      }

      setCallStatus('answered');

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Send SDP answer to caller via Socket.IO
      socketRef.current?.emit('answerCall', {
        callerId: otherUserId,
        rtcMessage: answer,
      });

      // Update Firebase call status and include the SDP answer as a fallback
      activeCallRef?.update({ 
        status: 'answered',
        answerMessage: JSON.stringify(answer)
      });

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
        <Text style={styles.label}>
          {activeCallMode === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call'}
        </Text>

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
          style={[
            styles.button,
            styles.answerButton,
            !ready && styles.disabledButton,
          ]}
          onPress={ready ? handleAnswerCall : undefined}
          activeOpacity={0.8}
        >
          <Ionicons name="call" size={26} color={!ready ? '#9ca3af' : '#fff'} />
          <Text style={[styles.actionText, !ready && styles.disabledText]}>
            {ready ? 'Answer' : 'Connecting...'}
          </Text>
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

  disabledButton: {
    backgroundColor: '#9CA3AF',
  },

  disabledText: {
    color: '#D1D5DB',
  },

  actionText: {
    color: '#FFFFFF',
    marginTop: 6,
    fontWeight: '600',
    fontSize: 10,
  },
});

export default IncomingCallScreen;
