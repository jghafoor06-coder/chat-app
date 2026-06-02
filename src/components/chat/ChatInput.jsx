import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import EmojiPicker from 'rn-emoji-keyboard';

const ChatInput = React.memo(({
  isEditing,
  message,
  editText,
  isSending,
  openEmojiPicker,
  keyboardHeight,
  onMessageChange,
  onEditTextChange,
  onEmojiSelect,
  onEmojiPickerOpen,
  onEmojiPickerClose,
  onSend,
  onSaveEdit,
  onAttachmentPress,
  onInputFocus,
}) => {
  return (
    <Animated.View
      style={[
        styles.inputContainer,
        {
          marginBottom: keyboardHeight.interpolate({
            inputRange: [0, 1000],
            outputRange: [Platform.OS === 'ios' ? 0 : 0, 1000],
          }),
        },
      ]}
    >
      <TouchableOpacity onPress={onAttachmentPress}>
        <Ionicons name="add-circle-outline" size={28} color="#0b5ed7" />
      </TouchableOpacity>

      <View style={styles.inputBox}>
        <TextInput
          placeholder={isEditing ? 'Edit message...' : 'Message...'}
          placeholderTextColor="#9ca3af"
          value={isEditing ? editText : message}
          onChangeText={isEditing ? onEditTextChange : onMessageChange}
          style={styles.input}
          multiline
          onFocus={onInputFocus}
        />
        <TouchableOpacity onPress={onEmojiPickerOpen}>
          <Ionicons name="happy-outline" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
        onPress={isEditing ? onSaveEdit : onSend}
        disabled={isSending}
      >
        <Ionicons
          name={isEditing ? 'checkmark' : 'send'}
          size={18}
          color="#fff"
        />
      </TouchableOpacity>
      <EmojiPicker
        open={openEmojiPicker}
        onClose={onEmojiPickerClose}
        onEmojiSelected={onEmojiSelect}
        enableSearchBar
        enableRecentlyUsed
        categoryPosition="bottom"
      />
    </Animated.View>
  );
});

export default ChatInput;

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 30,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  inputBox: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#f3f4f6',
    borderRadius: 22,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 8,
    maxHeight: 90,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0b5ed7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
