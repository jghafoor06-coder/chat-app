import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Linking,
  TouchableOpacity,
  Animated,
} from 'react-native';

import Ionicons from '@react-native-vector-icons/ionicons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pick } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import storage from '@react-native-firebase/storage';
import axios from 'axios';

import { updateChatSummaryOnSend, updateChatSummaryOnSeen, refreshChatSummary } from '../utils/chatSummary';
import ChatHeader from '../components/chat/ChatHeader';
import ChatInput from '../components/chat/ChatInput';
import MessageBubble from '../components/chat/MessageBubble';
import AttachmentMenu from '../components/chat/AttachmentMenu';
import MessageContextMenu from '../components/chat/MessageContextMenu';
import ImagePreviewModal from '../components/chat/ImagePreviewModal';

const ChatScreen = ({ route, navigation }) => {
  const { user } = route.params || {};
  const currentUser = auth().currentUser;

  if (!currentUser || !user) {
    return null;
  }

  const currentUid = currentUser.uid;

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [receiverData, setReceiverData] = useState(null);
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [token, setToken] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [openEmojiPicker, setOpenEmojiPicker] = useState(false);
  const [attachmentVisible, setAttachmentVisible] = useState(false);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState({});

  const menuAnimation = useRef(new Animated.Value(0)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const selectionMode = selectedMessages.length > 0;

  //EMOJI PICKER KEYBOARD INTEGRATION
  const handleEmojiSelect = emoji => {
    setMessage(prev => prev + emoji.emoji);
  };

  // Synchronized Keyboard Tracking Animation
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, event => {
      Animated.timing(keyboardHeight, {
        toValue: event.endCoordinates?.height || 0,
        duration: Platform.OS === 'ios' ? event.duration : 200,
        useNativeDriver: false,
      }).start();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 60);
    });

    const hideListener = Keyboard.addListener(hideEvent, event => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? event.duration : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const getSelectedMessage = () => {
    if (selectedMessages.length !== 1) return null;
    return messages.find(msg => msg.id === selectedMessages[0]);
  };

  const canEdit = () => {
    const messageToEdit = getSelectedMessage();
    return messageToEdit?.senderId === currentUid;
  };

  // OPEN CAMERA FROM ATTACMENT MENU
  const openCamera = async () => {
    setAttachmentVisible(false);
    const result = await launchCamera({
      mediaType: 'photo',
      saveToPhotos: true,
    });
    if (result?.assets?.length) {
      await sendImageMessage(result.assets[0]);
    }
  };

  // OPEN GALLERY FROM ATTACMENT MENU
  const openGallery = async () => {
    setAttachmentVisible(false);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });
    if (result?.assets?.length) {
      await sendImageMessage(result.assets[0]);
    }
  };

  // OPEN FILES FROM ATTACMENT MENU
  const openFiles = async () => {
    setAttachmentVisible(false);

    try {
      const [result] = await pick({
        mode: 'open',
      });

      if (!result) return;

      await sendFileMessage(result);
    } catch (err) {
      console.log(err);
    }
  };

  //GET TOKEN FOR IMAGE PERMISSIONS
  useEffect(() => {
    const getToken = async () => {
      try {
        const response = await axios.get(
          'https://gettoken-5xp4oqaw2a-uc.a.run.app/',
        );
        setToken(response?.data?.token);
      } catch (error) {
        console.log(error);
      }
    };
    getToken();
  }, []);

  const chatId =
    currentUid > user.uid
      ? `${currentUid}_${user.uid}`
      : `${user.uid}_${currentUid}`;

  // FETCH RECEIVER DATA
  useEffect(() => {
    const ref = database().ref(`/users/${user.uid}`);

    ref.on('value', snapshot => {
      const data = snapshot.val();
      if (data) setReceiverData(data);
    });

    return () => ref.off();
  }, [user.uid]);

  //ONLINE STATUS TRACKING
  useEffect(() => {
    const onlineRef = database().ref(`/users/${currentUid}`);
    onlineRef.update({ online: true });
    return () => {
      onlineRef.update({ online: false });
    };
  }, [currentUid]);

  //GET MESSAGES
  useEffect(() => {
    const ref = database().ref(`/chats/${chatId}/messages`);
    ref.off();
    ref.on('value', snapshot => {
      const data = snapshot.val();

      if (data) {
        const messageList = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        }));

        messageList.sort((a, b) => a.createdAt - b.createdAt);

        setMessages(messageList);
      } else {
        setMessages([]);
      }
    });

    return () => ref.off();
  }, [chatId]);

  //MARK UNSEEN MESSAGES AS SEEN (separate from listener to avoid re-entrant cascade)
  useEffect(() => {
    if (!messages.length) return;
    let hasUnseen = false;
    messages.forEach(msg => {
      if (msg.senderId !== currentUid && !msg.seen && !msg.uploading && !msg.uploadingImage) {
        hasUnseen = true;
        database()
          .ref(`/chats/${chatId}/messages/${msg.id}`)
          .update({ seen: true });
      }
    });
    if (hasUnseen) {
      updateChatSummaryOnSeen(chatId, currentUid);
    }
  }, [messages, chatId]);

  // SEND TEXT MESSAGE
  const sendMessage = async () => {
    if (!message.trim() || isSending) return;
    try {
      setIsSending(true);
      const textMessage = message.trim();
      const msgData = {
        text: textMessage,
        senderId: currentUid,
        createdAt: Date.now(),
        seen: false,
      };
      setMessage('');
      const ref = database().ref(`/chats/${chatId}/messages`);
      const newMessageRef = ref.push();
      const localMessage = { id: newMessageRef.key, ...msgData };

      setMessages(prev => [...prev, localMessage]);
      await newMessageRef.set(msgData);

      await updateChatSummaryOnSend(chatId, currentUid, user.uid, textMessage, msgData.createdAt);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      if (receiverData?.fcmToken && token) {
        try {
          await axios.post(
            'https://fcm.googleapis.com/v1/projects/chatapp-82761/messages:send',
            {
              message: {
                token: receiverData.fcmToken,
                notification: {
                  title: currentUser.displayName || 'New Message',
                  body: textMessage,
                },
              },
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            },
          );
        } catch (error) {
          console.log('Notification Error:', error.message);
        }
      }
    } catch (error) {
      console.log('SEND MESSAGE ERROR:', error);
    } finally {
      setIsSending(false);
    }
  };

  // SEND IMAGE MESSAGE
  const sendImageMessage = async imageAsset => {
    if (!imageAsset || isSending) return;

    try {
      setIsSending(true);

      let fileUri = imageAsset.uri;

      if (!fileUri) {
        throw new Error('Image URI is missing');
      }

      const ref = database().ref(`/chats/${chatId}/messages`);
      const newMessageRef = ref.push();
      const createdAt = Date.now();

      const pendingMessage = {
        id: newMessageRef.key,
        senderId: currentUid,
        createdAt: createdAt,
        seen: false,
        uploadingImage: true,
        localImage: fileUri,
      };

      setMessages(prev => [...prev, pendingMessage]);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      if (fileUri.startsWith('content://')) {
        const tempPath = `${RNFS.TemporaryDirectoryPath}/${Date.now()}_img.jpg`;
        await RNFS.copyFile(fileUri, tempPath);
        fileUri = tempPath;
      }

      const fileName = `${chatId}_${Date.now()}.jpg`;
      const storagePath = `chat_images/${fileName}`;
      const reference = storage().ref(storagePath);

      const uploadTask = reference.putFile(fileUri);

      await uploadTask;
      const imageUrl = await reference.getDownloadURL();

      const msgData = {
        imageUrl: imageUrl,
        senderId: currentUid,
        createdAt: createdAt,
        seen: false,
      };

      await newMessageRef.set(msgData);

      await updateChatSummaryOnSend(chatId, currentUid, user.uid, '📷 Photo', createdAt);

      setMessages(prev =>
        prev.map(msg =>
          msg.id === newMessageRef.key
            ? { ...msg, imageUrl: imageUrl, uploadingImage: false, localImage: undefined }
            : msg,
        ),
      );

      if (receiverData?.fcmToken && token) {
        try {
          await axios.post(
            'https://fcm.googleapis.com/v1/projects/chatapp-82761/messages:send',
            {
              message: {
                token: receiverData.fcmToken,
                notification: {
                  title: currentUser.displayName || 'New Message',
                  body: 'Sent an image',
                },
              },
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            },
          );
        } catch (error) {
          console.log('Notification Error:', error.message);
        }
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.uploadingImage));
      console.log('SEND IMAGE ERROR:', error);
    } finally {
      setIsSending(false);
    }
  };

  // SEND FILE MESSAGE
  const sendFileMessage = async file => {
    if (!file || isSending) return;

    try {
      setIsSending(true);
      setAttachmentVisible(false);

      let fileUri = file.uri || file.fileCopyUri || file.path;

      const fileName =
        file.name ||
        file.fileName ||
        (file.uri
          ? (() => {
              try {
                return (file.uri.includes('%')
                    ? decodeURIComponent(file.uri)
                    : file.uri
                  ).split('/').pop()?.split('?').shift() || '';
              } catch {
                return '';
              }
            })()
          : '') ||
        'Unknown file';
      const fileSize = file.size || 0;
      const fileType = file.type || 'application/octet-stream';

      if (!fileUri) {
        throw new Error('File URI is missing. File object: ' + JSON.stringify(file));
      }

      const ref = database().ref(`/chats/${chatId}/messages`);
      const newMessageRef = ref.push();
      const createdAt = Date.now();

      const pendingMessage = {
        id: newMessageRef.key,
        senderId: currentUid,
        createdAt: createdAt,
        seen: false,
        fileName: fileName,
        fileSize: fileSize,
        fileType: fileType,
        uploading: true,
      };

      setMessages(prev => [...prev, pendingMessage]);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      if (fileUri.startsWith('content://')) {
        const tempPath = `${RNFS.TemporaryDirectoryPath}/${Date.now()}_${fileName}`;
        await RNFS.copyFile(fileUri, tempPath);
        fileUri = tempPath;
      }

      const fileName_storage = `${chatId}_${Date.now()}_${fileName}`;
      const storagePath = `chat_files/${fileName_storage}`;
      const reference = storage().ref(storagePath);

      const uploadTask = reference.putFile(fileUri);

      uploadTask.on('state_changed', snapshot => {
        const progress =
          snapshot.totalBytes > 0
            ? Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
              )
            : 0;
        setUploadProgress(prev => ({ ...prev, [newMessageRef.key]: progress }));
      });

      await uploadTask;
      const fileUrl = await reference.getDownloadURL();

      const msgData = {
        fileUrl: fileUrl,
        fileName: fileName,
        fileType: fileType,
        fileSize: fileSize,
        senderId: currentUid,
        createdAt: createdAt,
        seen: false,
      };

      await newMessageRef.set(msgData);

      await updateChatSummaryOnSend(chatId, currentUid, user.uid, `📄 ${fileName}`, createdAt);

      setMessages(prev =>
        prev.map(msg =>
          msg.id === newMessageRef.key
            ? { ...msgData, id: newMessageRef.key }
            : msg,
        ),
      );

      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[newMessageRef.key];
        return next;
      });

      if (receiverData?.fcmToken && token) {
        try {
          await axios.post(
            'https://fcm.googleapis.com/v1/projects/chatapp-82761/messages:send',
            {
              message: {
                token: receiverData.fcmToken,
                notification: {
                  title: currentUser.displayName || 'New Message',
                  body: `Sent a file: ${fileName}`,
                },
              },
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            },
          );
        } catch (error) {
          console.log('Notification Error:', error.message);
        }
      }
    } catch (error) {
      setMessages(prev => prev.filter(msg => !msg.uploading));
      setUploadProgress({});
      console.log('SEND FILE ERROR:', error.message);
      console.log('Full error:', error);
    } finally {
      setIsSending(false);
    }
  };

  // DELETE MESSAGE
  const deleteMessage = async () => {
    if (!selectedMessages.length) return;
    const updates = {};
    selectedMessages.forEach(id => {
      updates[`/chats/${chatId}/messages/${id}`] = null;
    });
    await database().ref().update(updates);
    setMessages(prev => prev.filter(msg => !selectedMessages.includes(msg.id)));
    closeMenu();
    setSelectedMessages([]);

    // Refresh summary so home screen shows the correct last message
    await refreshChatSummary(chatId, currentUid, user.uid);
  };

  // START EDITING MESSAGE
  const startEdit = () => {
    if (!canEdit()) return;
    const messageToEdit = getSelectedMessage();
    setEditText(messageToEdit.text);
    setEditingMessageId(messageToEdit.id);
    setIsEditing(true);
    closeMenu();
  };

  // SAVE EDITED MESSAGE
  const saveEdit = async () => {
    if (!editingMessageId || !editText.trim()) return;
    await database()
      .ref(`/chats/${chatId}/messages/${editingMessageId}`)
      .update({ text: editText, editedAt: Date.now() });

    setMessages(prev =>
      prev.map(msg =>
        msg.id === editingMessageId
          ? { ...msg, text: editText, editedAt: Date.now() }
          : msg,
      ),
    );
    setIsEditing(false);
    setEditText('');
    setEditingMessageId(null);
    setSelectedMessages([]);

    // Refresh summary if the edited message was the last one
    await refreshChatSummary(chatId, currentUid, user.uid);
  };

  //CANCEL EDITING
  const cancelEdit = () => {
    setIsEditing(false);
    setEditText('');
    setEditingMessageId(null);
  };

  //OPEN MENU FOR SELECTED MESSAGE
  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(menuAnimation, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  // CLOSE MENU FOR SELECTED MESSAGE
  const closeMenu = () => {
    Animated.timing(menuAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setMenuVisible(false);
    });
  };

  //TOGGLE MESSAGE SELECTION
  const toggleSelection = itemId => {
    setSelectedMessages(prev => {
      const nextSelection = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      if (nextSelection.length === 0 && menuVisible) {
        closeMenu();
      }
      return nextSelection;
    });
  };

  const handleLongPress = item => {
    if (!selectionMode) {
      setSelectedMessages([item.id]);
    } else {
      toggleSelection(item.id);
    }
  };

  const openImagePreview = imageUrl => {
    setImagePreviewUrl(imageUrl);
    setImagePreviewVisible(true);
  };

  const openFileMessage = fileUrl => {
    Linking.openURL(fileUrl).catch(err =>
      console.log('OPEN FILE ERROR:', err.message),
    );
  };

  const handleMessagePress = item => {
    if (selectionMode) {
      toggleSelection(item.id);
    } else if (item.imageUrl && item.imageUrl.trim() !== '') {
      openImagePreview(item.imageUrl);
    } else if (item.fileUrl && item.fileUrl.trim() !== '') {
      openFileMessage(item.fileUrl);
    }
  };

  const clearSelection = () => {
    setSelectedMessages([]);
    closeMenu();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {/* HEADER */}
        <ChatHeader
          receiverData={receiverData}
          navigation={navigation}
          selectionMode={selectionMode}
          selectedMessages={selectedMessages}
          onClearSelection={clearSelection}
          onOpenMenu={openMenu}
        />

        {/* CHAT AREA */}
        <View style={styles.chatArea}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                item={item}
                currentUid={currentUid}
                isSelected={selectedMessages.includes(item.id)}
                uploadProgress={uploadProgress}
                onPress={() => handleMessagePress(item)}
                onLongPress={() => handleLongPress(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16 }}
            ListFooterComponent={<View style={{ height: 20 }} />}
            extraData={[selectedMessages, isEditing]}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={5}
            initialNumToRender={15}
          />
        </View>

        {/* EDIT BAR */}
        {isEditing && (
          <View style={styles.editBar}>
            <View style={styles.editBarContent}>
              <Ionicons name="create-outline" size={20} color="#0b5ed7" />

              <Text style={styles.editBarText} numberOfLines={1}>
                {editText}
              </Text>
            </View>

            <TouchableOpacity onPress={cancelEdit}>
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* INPUT PANEL */}
        <ChatInput
          isEditing={isEditing}
          message={message}
          editText={editText}
          isSending={isSending}
          openEmojiPicker={openEmojiPicker}
          keyboardHeight={keyboardHeight}
          onMessageChange={setMessage}
          onEditTextChange={setEditText}
          onEmojiSelect={handleEmojiSelect}
          onEmojiPickerOpen={() => setOpenEmojiPicker(true)}
          onEmojiPickerClose={() => setOpenEmojiPicker(false)}
          onSend={sendMessage}
          onSaveEdit={saveEdit}
          onAttachmentPress={() => {
            Keyboard.dismiss();
            setAttachmentVisible(true);
          }}
          onInputFocus={() => setAttachmentVisible(false)}
        />

        {/* ATTACHMENT MENU */}
        <AttachmentMenu
          visible={attachmentVisible}
          onClose={() => setAttachmentVisible(false)}
          onOpenCamera={openCamera}
          onOpenGallery={openGallery}
          onOpenFiles={openFiles}
        />

        {/* DROPDOWN MENU */}
        <MessageContextMenu
          visible={menuVisible}
          canEdit={canEdit()}
          menuAnimation={menuAnimation}
          onEdit={startEdit}
          onDelete={deleteMessage}
          onClose={closeMenu}
        />

        {/* IMAGE PREVIEW MODAL */}
        <ImagePreviewModal
          visible={imagePreviewVisible}
          imageUrl={imagePreviewUrl}
          onClose={() => setImagePreviewVisible(false)}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  chatArea: {
    flex: 1,
  },

  editBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  editBarContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },

  editBarText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
});
