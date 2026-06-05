import React, { useContext } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  Dimensions,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { WebRTCContext } from '../../App';
import Icon from '@react-native-vector-icons/ionicons';

const WebRTCRoom = ({ navigation }) => {
  const {
    localStream,
    remoteStream,
    otherUserId,
    callStatus,
    setCallType,
    setOtherUserId,
    socketRef,
    activeCallPeerName,
    activeCallPeerImage,
    resetCall,
  } = useContext(WebRTCContext);

  const handleEndCall = () => {
    socketRef.current?.emit('endCall', {
      calleeId: otherUserId,
    });
    resetCall();
    navigation.goBack();
  };

  const handleMuteAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  };

  const handleMuteVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
    }
  };

  return (
    <View style={styles.container}>
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
        />
      ) : (
        <View style={styles.remoteVideoPlaceholder}>
          <Text style={styles.waitingText}>
            {callStatus === 'ringing' ? 'Calling...' : 'Waiting for video...'}
          </Text>
        </View>
      )}

      {localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
        />
      )}

      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton} onPress={handleMuteAudio}>
          <Icon name="mic" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={handleMuteVideo}>
          <Icon name="videocam" size={24} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, styles.endCallButton]}
          onPress={handleEndCall}
        >
          <Icon name="call" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.userInfoContainer}>
        <Text style={styles.userIdText}>{activeCallPeerName || otherUserId}</Text>
        <Text style={styles.statusText}>{callStatus}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050A0E',
    justifyContent: 'flex-end',
  },
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
  },
  waitingText: {
    color: '#D0D4DD',
    fontSize: 18,
  },
  localVideo: {
    position: 'absolute',
    bottom: 120,
    right: 15,
    width: 100,
    height: 150,
    borderRadius: 10,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 30,
    gap: 30,
  },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    backgroundColor: '#FF5D5D',
  },
  userInfoContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
  },
  userIdText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#D0D4DD',
    fontSize: 12,
    marginTop: 5,
  },
});

export default WebRTCRoom;
