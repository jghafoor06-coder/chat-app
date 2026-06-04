import React, { useContext, useState } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { WebRTCContext } from '../../App';
import TextInputContainer from '../components/TextInputContainer';

const JoinScreen = ({ navigation }) => {
  const {
    callerId,
    setOtherUserId,
    setCallStatus,
    setCallType,
    peerConnectionRef,
    socketRef,
  } = useContext(WebRTCContext);

  const [targetUserId, setTargetUserId] = useState('');

  const handleCallNow = async () => {
    if (!targetUserId.trim()) {
      alert('Please enter a caller ID');
      return;
    }

    try {
      setOtherUserId(targetUserId);
      setCallStatus('ringing');
      setCallType('OUTGOING');

      console.log('📞 Creating offer to call:', targetUserId);

      // Create offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);

      console.log('✅ Offer created, sending to:', targetUserId);

      // Send call to target user
      socketRef.current?.emit('callUser', {
        to: targetUserId,
        signalData: offer,
        callerName: callerId,
      });

      console.log('📤 Call emitted via socket.io');

      navigation.navigate('OutgoingCall');
    } catch (error) {
      console.error('❌ Error initiating call:', error);
      alert('Failed to initiate call: ' + error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.content}>
          <View style={styles.cardContainer}>
            <Text style={styles.cardLabel}>Your Caller ID</Text>
            <View style={styles.callerIdContainer}>
              <Text style={styles.callerId}>{callerId}</Text>
            </View>
          </View>

          <View style={styles.cardContainer}>
            <Text style={styles.cardLabel}>Enter call ID of another user</Text>
            <TextInputContainer
              placeholder={'Enter Caller ID'}
              value={targetUserId}
              setValue={setTargetUserId}
              keyboardType={'number-pad'}
            />
            <TouchableOpacity
              onPress={handleCallNow}
              style={styles.callButton}
            >
              <Text style={styles.callButtonText}>Call Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050A0E',
    justifyContent: 'center',
    paddingHorizontal: 42,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  cardContainer: {
    backgroundColor: '#1A1C22',
    padding: 40,
    marginVertical: 12.5,
    justifyContent: 'center',
    borderRadius: 14,
  },
  cardLabel: {
    fontSize: 18,
    color: '#D0D4DD',
    marginBottom: 15,
  },
  callerIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callerId: {
    fontSize: 32,
    color: '#fff',
    letterSpacing: 6,
  },
  callButton: {
    height: 50,
    backgroundColor: '#5568FE',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 16,
  },
  callButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default JoinScreen;