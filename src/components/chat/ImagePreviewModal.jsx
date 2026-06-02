import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal } from 'react-native';

const ImagePreviewModal = React.memo(({ visible, imageUrl, onClose }) => {
  return (
    <Modal visible={visible} transparent={true} onRequestClose={onClose}>
      <View style={styles.imagePreviewOverlay}>
        <TouchableOpacity
          style={styles.imagePreviewCloseBtn}
          onPress={onClose}
        >
          <Text style={{ color: 'white', fontSize: 25 }}>✕</Text>
        </TouchableOpacity>
        <Image
          source={{ uri: imageUrl }}
          style={styles.imagePreviewContent}
        />
      </View>
    </Modal>
  );
});

export default ImagePreviewModal;

const styles = StyleSheet.create({
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  imagePreviewContent: {
    width: '100%',
    height: '80%',
    resizeMode: 'contain',
  },
});
