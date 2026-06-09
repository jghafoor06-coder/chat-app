import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

const AnimatedMessageItem = ({ children }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(animatedValue, {
        toValue: 1,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const animatedStyle = {
    opacity: animatedValue,
    transform: [
      {
        translateY: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [15, 0],
        }),
      },
      {
        scale: animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  };

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

const formatTime = timestamp => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

const MessageBubble = React.memo(({
  item,
  currentUid,
  isSelected,
  selectionMode,
  uploadProgress,
  onPress,
  onLongPress,
}) => {
  const isMe = item.senderId === currentUid;
  const hasImage =
    (item.imageUrl && item.imageUrl.trim() !== '') || !!item.localImage;
  const hasText = item.text && item.text.trim() !== '';
  const hasFile =
    (item.fileUrl && item.fileUrl.trim() !== '') ||
    item.fileName ||
    item.uploading;

  return (
    <AnimatedMessageItem>
      <Pressable
        style={[
          styles.messageRow,
          isMe ? styles.myMessageRow : styles.receiverMessageRow,
        ]}
        onPress={selectionMode ? onPress : undefined}
        onLongPress={onLongPress}
        delayLongPress={300}
      >
        <View
          style={[
            styles.messageWrapper,
            isMe ? styles.myMessageWrapper : styles.receiverMessageWrapper,
            isSelected && styles.selectedMessage,
          ]}
        >
          <View
            style={[
              styles.messageContainer,
              isMe ? styles.myMessage : styles.receiverMessage,
              hasImage && styles.imageMessageContainer,
              hasFile && styles.fileMessageContainer,
            ]}
          >
            {hasImage &&
              (() => {
                const imageUri = item.imageUrl || item.localImage;
                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={!selectionMode ? onPress : undefined}
                    style={styles.mediaTouchable}
                  >
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.messageImage}
                    />
                    {item.uploadingImage && (
                      <View
                        style={styles.uploadOverlay}
                      >
                        <ActivityIndicator size="large" color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })()}

            {hasFile && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={!selectionMode ? onPress : undefined}
                style={[styles.fileMessageBox, styles.mediaTouchable]}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name="document-outline"
                    size={32}
                    color={isMe ? '#fff' : '#0b5ed7'}
                  />
                </View>
                <View style={{ flexShrink: 1, marginLeft: 10 }}>
                  <Text
                    style={[
                      styles.fileLabel,
                      { color: isMe ? 'rgba(255,255,255,0.7)' : '#9ca3af' },
                    ]}
                  >
                    File
                  </Text>
                  <Text
                    style={[
                      styles.fileNameText,
                      { color: isMe ? '#fff' : '#111827' },
                    ]}
                    numberOfLines={2}
                  >
                    {item.fileName ? String(item.fileName) : 'File'}
                  </Text>
                  {item.uploading ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginTop: 4,
                      }}
                    >
                      <ActivityIndicator
                        size="small"
                        color={isMe ? '#fff' : '#0b5ed7'}
                      />
                      <Text
                        style={[
                          styles.fileSizeText,
                          {
                            marginLeft: 6,
                            color: isMe
                              ? 'rgba(255,255,255,0.7)'
                              : '#9ca3af',
                          },
                        ]}
                      >
                        {uploadProgress[item.id] !== undefined
                          ? `${uploadProgress[item.id]}%`
                          : 'Uploading...'}
                      </Text>
                    </View>
                  ) : item.fileSize > 0 ? (
                    <Text
                      style={[
                        styles.fileSizeText,
                        { color: isMe ? 'rgba(255,255,255,0.7)' : '#9ca3af' },
                      ]}
                    >
                      {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}

            {hasText && (
              <View>
                <Text
                  style={[
                    styles.messageText,
                    { color: isMe ? '#fff' : '#111827' },
                  ]}
                >
                  {item.text}
                </Text>
                {item.editedAt && (
                  <Text
                    style={[
                      styles.editedLabel,
                      { color: isMe ? 'rgba(255,255,255,0.6)' : '#9ca3af' },
                    ]}
                  >
                    Edited
                  </Text>
                )}
              </View>
            )}

            <Text
              style={[
                styles.timeTextInside,
                {
                  color: isMe
                    ? 'rgba(231, 229, 229, 0.7)'
                    : 'rgba(80, 78, 78, 0.7)',
                },
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </Pressable>
    </AnimatedMessageItem>
  );
});

export default MessageBubble;

const styles = StyleSheet.create({
  messageWrapper: {
    marginBottom: 8,
    maxWidth: '75%',
  },
  myMessageWrapper: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  receiverMessageWrapper: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  selectedMessage: {
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4488ee',
    width: '100%',
    maxWidth: '100%',
  },
  messageRow: {
    width: '100%',
  },
  messageContainer: {
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    borderRadius: 16,
    paddingVertical: 8,
  },
  imageMessageContainer: {
    padding: 0,
    flexDirection: 'column',
  },
  mediaTouchable: {
    alignSelf: 'flex-start',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myMessage: {
    backgroundColor: '#0b5ed7',
    borderTopRightRadius: 1,
    borderRadius: 22,
  },
  receiverMessage: {
    backgroundColor: '#f3f4f6',
    borderTopLeftRadius: 1,
    borderRadius: 22,
  },
  messageImage: {
    width: 250,
    height: 250,
    borderRadius: 18,
    marginBottom: 8,
  },
  fileMessageContainer: {
    padding: 12,
    flexDirection: 'column',
  },
  fileMessageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fileLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 3,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSizeText: {
    fontSize: 12,
    marginTop: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  editedLabel: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  timeTextInside: {
    fontSize: 10,
    marginTop: 10,
    fontWeight: '400',
    alignSelf: 'flex-end',
  },
});
