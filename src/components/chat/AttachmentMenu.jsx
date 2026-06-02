import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

const AttachmentItem = React.memo(({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.attachItem} onPress={onPress} activeOpacity={0.4}>
    <Ionicons name={icon} size={24} color="#0b5ed7" />
    <Text style={styles.attachText}>{label}</Text>
  </TouchableOpacity>
));

const AttachmentMenu = React.memo(({
  visible,
  onClose,
  onOpenCamera,
  onOpenGallery,
  onOpenFiles,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.overlayContainer}>
      <TouchableOpacity
        style={styles.attachmentOverlay}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={styles.attachmentSheet}>
        <Text style={styles.sheetTitle}>Attach</Text>
        <AttachmentItem
          icon="camera-outline"
          label="Camera"
          onPress={onOpenCamera}
        />
        <AttachmentItem
          icon="image-outline"
          label="Gallery"
          onPress={onOpenGallery}
        />
        <AttachmentItem
          icon="document-outline"
          label="Files"
          onPress={onOpenFiles}
        />
      </View>
    </View>
  );
});

export default AttachmentMenu;

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  attachmentOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  attachmentSheet: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingBottom: 30,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  sheetTitle: {
    position: 'absolute',
    top: 1,
    left: 16,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    color: '#0b5ed7',
  },
  attachItem: {
    alignItems: 'center',
    paddingTop: 16,
  },
  attachText: {
    marginTop: 6,
    fontSize: 13,
    color: '#0b5ed7',
    fontWeight: '500',
  },
});
