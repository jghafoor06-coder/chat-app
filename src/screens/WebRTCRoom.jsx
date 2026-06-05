import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  StatusBar,
} from 'react-native';
import { RTCView, mediaDevices } from 'react-native-webrtc';
import Ionicons from '@react-native-vector-icons/ionicons';
import InCallManager from 'react-native-incall-manager';
import { WebRTCContext } from '../../App';

const WebRTCRoom = ({ navigation }) => {
  const {
    localStream,
    remoteStream,
    otherUserId,
    callStatus,
    socketRef,
    peerConnectionRef,
    activeCallPeerName,
    resetCall,
  } = useContext(WebRTCContext);

  // ── Call control states ──
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const durationIntervalRef = useRef(null);
  const hideControlsTimerRef = useRef(null);

  // ── Call duration timer ──
  useEffect(() => {
    durationIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    // Initialize InCallManager for audio routing
    try {
      InCallManager.start();
      InCallManager.setForceSpeakerphoneOn(true);
    } catch (err) {
      console.warn('InCallManager start error:', err);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      try {
        InCallManager.stop();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-hide controls after 6 seconds of inactivity ──
  const resetHideTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    setShowControls(true);
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 6000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, [resetHideTimer]);

  // ── Helpers ──
  const formatDuration = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ── End call ──
  const handleEndCall = () => {
    socketRef.current?.emit('endCall', {
      calleeId: otherUserId,
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
        const oldTrack = localStream.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          localStream.removeTrack(oldTrack);
        }

        localStream.addTrack(newVideoTrack);
        await sender.replaceTrack(newVideoTrack);
        setIsFrontCamera(prev => !prev);
      } else {
        newVideoTrack.stop();
      }
    } catch (err) {
      console.error('Camera switch error:', err);
    }
  }, [localStream, peerConnectionRef, isFrontCamera]);

  return (
    <View style={styles.container} onTouchStart={resetHideTimer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Remote video (fullscreen) ── */}
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
        />
      ) : (
        <View style={styles.remoteVideoPlaceholder}>
          <Ionicons name="videocam" size={48} color="#4B5563" />
          <Text style={styles.waitingText}>Waiting for video…</Text>
        </View>
      )}

      {/* ── Local video (PiP) ── */}
      {localStream && (
        <View style={styles.localVideoContainer}>
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
          />
        </View>
      )}

      {/* ── Top overlay: user info + call duration ── */}
      {showControls && (
        <View style={styles.topOverlay}>
          <View style={styles.userInfoContainer}>
            <Text style={styles.userName}>
              {activeCallPeerName || otherUserId}
            </Text>
            <Text style={styles.callTimer}>{formatDuration(callDuration)}</Text>
          </View>
        </View>
      )}

      {/* ── Bottom overlay: controls ── */}
      {showControls && (
        <View style={styles.bottomOverlay}>
          <View style={styles.controlsRow}>
            {/* Mute */}
            <View style={styles.controlItem}>
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  isMuted && styles.controlButtonActive,
                ]}
                onPress={handleToggleMute}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isMuted ? 'mic-off' : 'mic'}
                  size={22}
                  color={isMuted ? '#FF5D5D' : '#FFFFFF'}
                />
              </TouchableOpacity>
              <Text
                style={[
                  styles.controlLabel,
                  isMuted && styles.controlLabelActive,
                ]}
              >
                Mute
              </Text>
            </View>

            {/* Speaker */}
            <View style={styles.controlItem}>
              <TouchableOpacity
                style={[
                  styles.controlButton,
                  isSpeakerOn && styles.controlButtonSpeakerActive,
                ]}
                onPress={handleToggleSpeaker}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isSpeakerOn ? 'volume-high' : 'volume-low'}
                  size={22}
                  color={isSpeakerOn ? '#0b5ed7' : '#FFFFFF'}
                />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>Speaker</Text>
            </View>

            {/* Switch Camera */}
            <View style={styles.controlItem}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleSwitchCamera}
                activeOpacity={0.7}
              >
                <Ionicons name="camera-reverse" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.controlLabel}>Camera</Text>
            </View>

            {/* End Call */}
            <View style={styles.controlItem}>
              <TouchableOpacity
                style={[styles.controlButton, styles.endCallButton]}
                onPress={handleEndCall}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={26} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={[styles.controlLabel, styles.endCallLabel]}>
                End
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // ── Remote video ──
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  remoteVideoPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1A1C22',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  waitingText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },

  // ── Local video (PiP) ──
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },

  // ── Top overlay ──
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  userInfoContainer: {
    alignItems: 'center',
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  callTimer: {
    color: '#D1D5DB',
    fontSize: 15,
    fontWeight: '500',
    marginTop: 4,
  },

  // ── Bottom overlay ──
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 45,
    paddingTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255, 93, 93, 0.3)',
    borderColor: 'rgba(255, 93, 93, 0.5)',
  },
  controlButtonSpeakerActive: {
    backgroundColor: 'rgba(11, 94, 215, 0.3)',
    borderColor: 'rgba(11, 94, 215, 0.5)',
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF5D5D',
    borderWidth: 0,
    shadowColor: '#FF5D5D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── Labels ──
  controlLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  controlLabelActive: {
    color: '#FF5D5D',
  },
  endCallLabel: {
    color: '#FF5D5D',
    fontWeight: '600',
  },
});

export default WebRTCRoom;
