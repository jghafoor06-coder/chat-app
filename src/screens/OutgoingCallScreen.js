import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { mediaDevices, RTCView } from 'react-native-webrtc';
import Ionicons from '@react-native-vector-icons/ionicons';
import InCallManager from 'react-native-incall-manager';
import { WebRTCContext } from '../../App';

const OutgoingCallScreen = ({ navigation }) => {
  const {
    otherUserId,
    callStatus,
    socketRef,
    activeCallPeerName,
    activeCallPeerImage,
    localStream,
    peerConnectionRef,
    activeCallMode,
    resetCall,
  } = useContext(WebRTCContext);

  const isAudioOnly = activeCallMode === 'audio';

  // ── Call control states ──
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const durationIntervalRef = useRef(null);

  // ── Pulse animation ──
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  // Start pulse + ripple animation while calling
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    const ripple = Animated.loop(
      Animated.sequence([
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rippleAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    pulse.start();
    ripple.start();

    // Initialize InCallManager for audio routing
    try {
      InCallManager.start();
      InCallManager.setForceSpeakerphoneOn(true);
    } catch (err) {
      console.warn('InCallManager start error:', err);
    }

    return () => {
      pulse.stop();
      ripple.stop();
      pulseAnim.setValue(1);
      rippleAnim.setValue(0);
      try {
        InCallManager.stop();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Call duration timer ──
  useEffect(() => {
    if (callStatus === 'answered' || callStatus === 'connected') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callStatus]);

  // ── Helpers ──
  const formatDuration = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'ringing':
        return 'Ringing…';
      case 'answered':
      case 'connected':
        return formatDuration(callDuration);
      case 'connecting':
        return 'Connecting…';
      default:
        return 'Calling…';
    }
  };

  // ── End call ──
  const handleEndCall = () => {
    socketRef.current?.emit('endCall', {
      calleeId: otherUserId, // FIX (BUG 7): was 'to:', now matches WebRTCRoom and server expectation
    });
    try {
      InCallManager.stop();
    } catch (_) {}
    resetCall();
    navigation.goBack();
  };

  // ── Toggle mute ──
  const handleToggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
    setIsMuted(prev => !prev);
  }, [localStream]);

  // ── Toggle speaker ──
  const handleToggleSpeaker = useCallback(() => {
    setIsSpeakerOn(prev => {
      const next = !prev;
      try {
        InCallManager.setForceSpeakerphoneOn(next);
      } catch (err) {
        console.warn('Speaker toggle error:', err);
      }
      return next;
    });
  }, []);

  // ── Switch camera ──
  const handleSwitchCamera = useCallback(async () => {
    if (!localStream || !peerConnectionRef?.current) return;

    try {
      const newFacingMode = isFrontCamera ? 'environment' : 'front';
      const newStream = await mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacingMode } },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const sender = peerConnectionRef.current
        .getSenders()
        .find(s => s.track?.kind === 'video');

      if (sender) {
        // Stop the old video track
        const oldTrack = localStream.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          localStream.removeTrack(oldTrack);
        }

        // Add new track to local stream and replace on peer connection
        localStream.addTrack(newVideoTrack);
        await sender.replaceTrack(newVideoTrack);
        setIsFrontCamera(prev => !prev);
      } else {
        // No video sender yet (call not connected) — stop the new track to avoid leak
        newVideoTrack.stop();
      }
    } catch (err) {
      console.error('Camera switch error:', err);
    }
  }, [localStream, peerConnectionRef, isFrontCamera]);

  // ── Ripple scale interpolation ──
  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0],
  });

  // ── Render avatar ──
  const renderAvatar = () => {
    const avatarContent = activeCallPeerImage ? (
      <Animated.Image
        source={{ uri: activeCallPeerImage }}
        style={[styles.callerAvatar, { transform: [{ scale: pulseAnim }] }]}
      />
    ) : (
      <Animated.View
        style={[styles.callerAvatarPlaceholder, { transform: [{ scale: pulseAnim }] }]}
      >
        <Text style={styles.callerAvatarLetter}>
          {activeCallPeerName ? activeCallPeerName.charAt(0).toUpperCase() : '?'}
        </Text>
      </Animated.View>
    );

    return (
      <View style={styles.avatarContainer}>
        {/* Ripple ring behind avatar */}
        <Animated.View
          style={[styles.rippleRing, { transform: [{ scale: rippleScale }], opacity: rippleOpacity }]}
        />
        {avatarContent}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* FIX (BUG 1): Local camera PiP for video calls.
          The OutgoingCallScreen previously had no RTCView at all, so the
          caller never saw their own camera even during video calls. */}
      {!isAudioOnly && localStream && localStream.getVideoTracks().length > 0 && (
        <View style={styles.localVideoPreview}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideoPreviewView}
            objectFit="cover"
            mirror
          />
        </View>
      )}

      {/* Top: label */}
      <View style={styles.topSection}>
        <Text style={styles.label}>
          {isAudioOnly ? 'Outgoing Audio Call' : 'Outgoing Call'}
        </Text>
      </View>

      {/* Center: avatar + name + status */}
      <View style={styles.content}>
        {renderAvatar()}
        <Text style={styles.callerName}>
          {activeCallPeerName || otherUserId}
        </Text>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

      {/* Bottom: control panel */}
      <View style={styles.controlsContainer}>
        <View style={styles.controlsRow}>
          {/* Mute */}
          <View style={styles.controlItem}>
            <TouchableOpacity
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={handleToggleMute}
              activeOpacity={0.7}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color={isMuted ? '#FF5D5D' : '#FFFFFF'} />
            </TouchableOpacity>
            <Text style={[styles.controlLabel, isMuted && styles.controlLabelActive]}>Mute</Text>
          </View>

          {/* Speaker */}
          <View style={styles.controlItem}>
            <TouchableOpacity
              style={[styles.controlButton, isSpeakerOn && styles.controlButtonSpeakerActive]}
              onPress={handleToggleSpeaker}
              activeOpacity={0.7}
            >
              <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-low'} size={22} color={isSpeakerOn ? '#0b5ed7' : '#FFFFFF'} />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>Speaker</Text>
          </View>

          {!isAudioOnly && (
            <View style={styles.controlItem}>
              <TouchableOpacity style={styles.controlButton} onPress={handleSwitchCamera} activeOpacity={0.7}>
                <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>Camera</Text>
            </View>
          )}

          {/* End Call */}
          <View style={styles.controlItem}>
            <TouchableOpacity
              style={[styles.controlButton, styles.endCallButton]}
              onPress={handleEndCall}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={[styles.controlLabel, styles.endCallLabel]}>End</Text>
          </View>
        </View>
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

  // ── Local camera PiP (video calls only) ──
  localVideoPreview: {
    position: 'absolute',
    top: 20,
    right: 16,
    width: 100,
    height: 148,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#0b5ed7',
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  localVideoPreviewView: {
    width: '100%',
    height: '100%',
  },

  // ── Top section ──
  topSection: {
    paddingTop: 60,
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0b5ed7',
    letterSpacing: 0.5,
  },

  // ── Center content ──
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  // ── Avatar ──
  avatarContainer: {
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#0b5ed7',
  },
  callerAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#0b5ed7',
    shadowColor: '#0b5ed7',
    shadowOffset: { width: 0, height: 8 },
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 12,
  },
  callerAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 60,
    fontWeight: '700',
  },

  // ── Name & status ──
  callerName: {
    marginTop: 28,
    fontSize: 30,
    fontWeight: '700',
    color: '#0b5ed7',
    textAlign: 'center',
  },
  statusText: {
    marginTop: 8,
    fontSize: 17,
    color: '#6B7280',
    textAlign: 'center',
  },

  // ── Bottom controls ──
  controlsContainer: {
    paddingBottom: 50,
    paddingTop: 25,
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  controlItem: {
    alignItems: 'center',
  },
  controlButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  controlButtonActive: {
    backgroundColor: '#1F2937',
  },
  controlButtonSpeakerActive: {
    backgroundColor: '#DBEAFE',
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF5D5D',
    shadowColor: '#FF5D5D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── Labels ──
  controlLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  controlLabelActive: {
    color: '#FF5D5D',
  },
  endCallLabel: {
    color: '#FF5D5D',
    fontWeight: '600',
  },
});

export default OutgoingCallScreen;