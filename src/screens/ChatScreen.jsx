import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Image,
  Modal,
  Animated,
} from 'react-native';

import Ionicons from '@react-native-vector-icons/ionicons';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

const ChatScreen = ({ route, navigation }) => {
  const { user } = route.params || {};

  const currentUser = auth().currentUser;

  // PREVENT NULL ERROR
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
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const menuAnimation = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const selectionMode = selectedMessages.length > 0;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showListener = Keyboard.addListener(showEvent, event => {
      setKeyboardOffset(event.endCoordinates?.height || 0);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    });

    const hideListener = Keyboard.addListener(hideEvent, () => {
      setKeyboardOffset(0);
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

  // UNIQUE CHAT ID
  const chatId =
    currentUid > user.uid
      ? `${currentUid}_${user.uid}`
      : `${user.uid}_${currentUid}`;

  // FETCH RECEIVER DATA
  useEffect(() => {
    const ref = database().ref(`/users/${user.uid}`);

    ref.on('value', snapshot => {
      const data = snapshot.val();

      if (data) {
        setReceiverData(data);
      }
    });

    return () => ref.off();
  }, [user.uid]);

  // ONLINE STATUS
  useEffect(() => {
    const onlineRef = database().ref(`/users/${currentUid}`);

    onlineRef.update({
      online: true,
    });

    return () => {
      onlineRef.update({
        online: false,
      });
    };
  }, [currentUid]);



  // GET MESSAGES
  useEffect(() => {
    const ref = database().ref(`/chats/${chatId}/messages`);

    ref.on('value', snapshot => {
      const data = snapshot.val();

      if (data) {
        const messageList = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        }));

        // SORT NEWEST FIRST
        messageList.sort((a, b) => a.createdAt - b.createdAt);

        setMessages(messageList);
      } else {
        setMessages([]);
      }
    });

    return () => ref.off();
  }, [chatId]);

  // SEND MESSAGE
  const sendMessage = async () => {
    if (!message.trim()) return;

    const msgData = {
      text: message,
      senderId: currentUid,
      createdAt: Date.now(),
    };

    const ref = database().ref(`/chats/${chatId}/messages`);
    const newMessageRef = ref.push();

    await newMessageRef.set(msgData);

    setMessages(prev => [...prev, { id: newMessageRef.key, ...msgData }]);
    setMessage('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // DELETE MESSAGE(S)
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
  };

  // START EDIT
  const startEdit = () => {
    if (!canEdit()) return;

    const messageToEdit = getSelectedMessage();
    setEditText(messageToEdit.text);
    setEditingMessageId(messageToEdit.id);
    setIsEditing(true);
    closeMenu();
  };

  // SAVE EDIT
  const saveEdit = async () => {
    if (!editingMessageId || !editText.trim()) return;

    await database()
      .ref(`/chats/${chatId}/messages/${editingMessageId}`)
      .update({
        text: editText,
        editedAt: Date.now(),
      });

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
  };

  // CANCEL EDIT
  const cancelEdit = () => {
    setIsEditing(false);
    setEditText('');
    setEditingMessageId(null);
  };

  // OPEN MENU
  const openMenu = () => {
    setMenuVisible(true);
    Animated.spring(menuAnimation, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  // CLOSE MENU
  const closeMenu = () => {
    Animated.timing(menuAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setMenuVisible(false);
    });
  };

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

  // HANDLE LONG PRESS
  const handleLongPress = item => {
    if (!selectionMode) {
      setSelectedMessages([item.id]);
    } else {
      toggleSelection(item.id);
    }
  };

  const handleMessagePress = item => {
    if (selectionMode) {
      toggleSelection(item.id);
    }
  };

  const clearSelection = () => {
    setSelectedMessages([]);
    closeMenu();
  };

  // RENDER AVATAR
  const renderAvatar = () => {
    // SHOW IMAGE IF EXISTS
    if (receiverData?.profileImage && receiverData.profileImage.trim() !== '') {
      return (
        <Image
          source={{ uri: receiverData.profileImage }}
          style={styles.avatar}
        />
      );
    }

    // SHOW FIRST LETTER IF NO IMAGE
    return (
      <View style={styles.letterAvatar}>
        <Text style={styles.letterText}>
          {receiverData?.username
            ? receiverData.username.charAt(0).toUpperCase()
            : 'U'}
        </Text>
      </View>
    );
  };

  // FORMAT TIME
  const formatTime = timestamp => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  // RENDER MESSAGE
  const renderItem = ({ item }) => {
    const isMe = item.senderId === currentUid;
    const isSelected = selectedMessages.includes(item.id);

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => handleMessagePress(item)}
        onLongPress={() => handleLongPress(item)}
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
            ]}
          >
            <Text
              style={[
                styles.messageText,
                {
                  color: isMe ? '#fff' : '#111827',
                },
              ]}
            >
              {item.text}
            </Text>

            {item.editedAt && (
              <Text
                style={[
                  styles.editedLabel,
                  {
                    color: isMe ? 'rgba(255,255,255,0.6)' : '#9ca3af',
                  },
                ]}
              >
                Edited
              </Text>
            )}

            <Text
              style={[
                styles.timeTextInside,
                {
                  color: isMe ? 'rgba(255,255,255,0.7)' : '#9ca3af',
                },
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          {selectionMode ? (
            <>
              <TouchableOpacity
                onPress={clearSelection}
                style={{ padding: 4 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons name="close" size={24} color="#111827" />
                </View>
              </TouchableOpacity>

              <Text style={styles.selectedCount}>
                {selectedMessages.length}
              </Text>

              <View style={styles.headerIcons}>
                <TouchableOpacity
                  onPress={openMenu}
                  style={{ padding: 4 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Ionicons
                      name="ellipsis-vertical"
                      size={24}
                      color="#111827"
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#111827" />
              </TouchableOpacity>

              <View style={styles.userSection}>
                {renderAvatar()}

                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.username}>
                    {receiverData?.username || 'User'}
                  </Text>

                  {receiverData?.online && (
                    <Text style={styles.online}>Online</Text>
                  )}
                </View>
              </View>

              <View style={styles.headerIcons}>
                <Ionicons
                  name="videocam-outline"
                  size={24}
                  color="#111827"
                  style={{ marginRight: 16 }}
                />

                <Ionicons name="call-outline" size={22} color="#111827" />
              </View>
            </>
          )}
        </View>

        {/* CHAT AREA */}
        <View style={styles.chatArea}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 16,
            }}
            ListFooterComponent={<View style={{ height: 90 }} />}
            extraData={[selectedMessages, isEditing]}
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

        {/* INPUT */}
        <View
          style={[
            styles.inputContainer,
            Platform.OS === 'android' && keyboardOffset > 0
              ? { marginBottom: keyboardOffset }
              : null,
          ]}
        >
          <TouchableOpacity>
            <Ionicons name="add-circle-outline" size={28} color="#0b5ed7" />
          </TouchableOpacity>

          <View style={styles.inputBox}>
            <TextInput
              placeholder={isEditing ? 'Edit message...' : 'Message...'}
              placeholderTextColor="#9ca3af"
              value={isEditing ? editText : message}
              onChangeText={isEditing ? setEditText : setMessage}
              style={styles.input}
              multiline
            />

            <Ionicons name="happy-outline" size={24} color="#6b7280" />
          </View>

          <TouchableOpacity
            style={styles.sendButton}
            onPress={isEditing ? saveEdit : sendMessage}
          >
            <Ionicons
              name={isEditing ? 'checkmark' : 'send'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* MENU */}
        {menuVisible && (
          <>
            <TouchableOpacity
              style={styles.menuOverlay}
              activeOpacity={1}
              onPress={closeMenu}
            />

            <Animated.View
              style={[
                styles.menuContainer,
                {
                  opacity: menuAnimation,
                  transform: [
                    {
                      scale: menuAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                style={[styles.menuItem, !canEdit() && styles.menuItemDisabled]}
                onPress={startEdit}
                disabled={!canEdit()}
              >
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={canEdit() ? '#111827' : '#9ca3af'}
                />

                <Text
                  style={[
                    styles.menuText,
                    !canEdit() && styles.menuTextDisabled,
                  ]}
                >
                  Edit
                </Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity
                style={[styles.menuItem, styles.menuItemDanger]}
                onPress={deleteMessage}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />

                <Text style={[styles.menuText, styles.menuTextDanger]}>
                  Delete
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </>
        )}
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

  header: {
    height: 90,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingTop: 20,
  },

  userSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 14,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },

  letterAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0b5ed7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  letterText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  username: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  online: {
    color: '#22c55e',
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },

  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  selectedCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 20,
    flex: 1,
  },

  chatArea: {
    flex: 1,
  },

  messageWrapper: {
    marginBottom: 10,
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

  messageContainer: {
    padding: 14,
    borderRadius: 16,
  },

  myMessage: {
    backgroundColor: '#0b5ed7',
    borderBottomRightRadius: 4,
  },

  receiverMessage: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
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
    fontSize: 11,
    marginTop: 4,
    fontWeight: '400',
    alignSelf: 'flex-end',
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

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 25 : 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#fff',
  },

  inputBox: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 12,
    maxHeight: 100,
  },

  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0b5ed7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },

  menuContainer: {
    position: 'absolute',
    top: 90,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  menuText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },

  menuTextDanger: {
    color: '#ef4444',
  },

  menuItemDisabled: {
    opacity: 0.55,
  },

  menuTextDisabled: {
    color: '#9ca3af',
  },

  menuDivider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
});
