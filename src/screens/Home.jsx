import {
  StyleSheet,
  View,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  FlatList,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';

import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import Ionicons from '@react-native-vector-icons/ionicons';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

const Home = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [chatSummaries, setChatSummaries] = useState({});

  useEffect(() => {
    const currentUser = auth().currentUser;

    // IF USER NOT LOGGED IN
    if (!currentUser) return;

    const currentUid = currentUser.uid;

    const usersRef = database().ref('/users');

    const onValueChange = usersRef.on('value', snapshot => {
      const data = snapshot.val();

      if (data) {
        const formattedUsers = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        }));

        // REMOVE CURRENT USER FROM LIST
        const filtered = formattedUsers.filter(user => user.id !== currentUid);

        setUsers(filtered);
        setFilteredUsers(filtered);
      } else {
        setUsers([]);
        setFilteredUsers([]);
      }
    });

    return () => usersRef.off('value', onValueChange);
  }, []);

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser || users.length === 0) return;

    const currentUid = currentUser.uid;
    const listeners = [];

    users.forEach(item => {
      const chatId =
        currentUid > item.id
          ? `${currentUid}_${item.id}`
          : `${item.id}_${currentUid}`;

      const ref = database().ref(`/chats/${chatId}/messages`);
      const listener = ref.on('value', snapshot => {
        const data = snapshot.val();
        if (!data) {
          setChatSummaries(prev => ({
            ...prev,
            [chatId]: { lastMessage: '', unreadCount: 0 },
          }));
          return;
        }

        const messageList = Object.values(data);
        const sortedMessages = messageList.sort(
          (a, b) => b.createdAt - a.createdAt,
        );

        const lastMessage = sortedMessages[0]?.text || '';
        const lastSender = sortedMessages[0]?.senderId || null;
        const unreadCount = sortedMessages.filter(
          msg => msg.senderId !== currentUid,
        ).length;

        const lastTimestamp = sortedMessages[0]?.createdAt || null;

        setChatSummaries(prev => ({
          ...prev,
          [chatId]: {
            lastMessage,
            lastSender,
            unreadCount,
            lastTimestamp,
          },
        }));
      });

      listeners.push(ref);
    });

    return () => {
      listeners.forEach(ref => ref.off());
    };
  }, [users]);

  // SEARCH FUNCTION
  const handleSearch = text => {
    setSearch(text);

    if (text.trim() === '') {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(item =>
      item.username?.toLowerCase().includes(text.toLowerCase()),
    );

    setFilteredUsers(filtered);
  };

  // RENDER AVATAR
  const renderAvatar = item => {
    // IF USER HAS IMAGE
    if (item.profileImage) {
      return (
        <Image source={{ uri: item.profileImage }} style={styles.avatarImage} />
      );
    }

    // FIRST LETTER AVATAR
    return (
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.username?.charAt(0)?.toUpperCase()}
        </Text>
      </View>
    );
  };

  //GET DAY WHEN MEASSAGE IS SENT
  const getChatTimeLabel = timestamp => {
    if (!timestamp) return '';

    const messageDate = new Date(timestamp);
    const now = new Date();

    const diffTime = now - messageDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // TODAY
    if (diffDays === 0) {
      return messageDate.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    // YESTERDAY
    if (diffDays === 1) {
      return 'Yesterday';
    }

    // LAST 7 DAYS → weekday name
    if (diffDays <= 7) {
      return messageDate.toLocaleDateString([], {
        weekday: 'long',
      });
    }

    // OLDER → date
    return messageDate.toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
    });
  };

  // USER ROW
  const renderItem = ({ item }) => {
    const currentUser = auth().currentUser;
    const currentUid = currentUser?.uid;
    const chatId =
      currentUid && currentUid > item.id
        ? `${currentUid}_${item.id}`
        : `${item.id}_${currentUid}`;
    const summary = chatSummaries[chatId] || {};
    const lastMessageText = summary.lastMessage?.trim()
      ? summary.lastSender === currentUid
        ? `You: ${summary.lastMessage}`
        : summary.lastMessage
      : `Start chatting with ${item.username}`;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.userRow}
        onPress={() => {
          navigation.navigate('Chatscreen', {
            user: {
              uid: item.id,
            },
          });
        }}
      >
        {/* LEFT */}
        <View style={styles.leftSection}>
          {renderAvatar(item)}

          {/* ONLINE DOT */}
          {item.online && <View style={styles.onlineDot} />}
        </View>

        {/* CENTER */}
        <View style={styles.middleSection}>
          <Text style={styles.username} numberOfLines={1}>
            {item.username || 'Unknown User'}
          </Text>

          <Text style={styles.message} numberOfLines={1}>
            {lastMessageText}
          </Text>
        </View>

        {/* RIGHT */}
        <View style={styles.rightSection}>
          {summary.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText} numberOfLines={1}>
                {summary.unreadCount}
              </Text>
            </View>
          ) : (
            <Text style={styles.timeText}>
              {getChatTimeLabel(summary.lastTimestamp)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <Header title="Messages" />

        {/* SEARCH */}
        <View style={styles.inputcontainer}>
          <View style={styles.searchBox}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#9ca3af"
              style={styles.icon}
            />

            <TextInput
              placeholder="Search"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              value={search}
              onChangeText={handleSearch}
            />
          </View>
        </View>

        {/* USERS LIST */}
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />

        {/* USER NOT FOUND */}
        {filteredUsers.length === 0 && search.trim() !== '' && (
          <View style={styles.notFoundContainer}>
            <Text style={styles.notFoundText}>User not found</Text>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

export default Home;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  inputcontainer: {
    marginTop: 18,
    alignItems: 'center',
    marginBottom: 10,
  },

  searchBox: {
    width: '90%',
    height: 50,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },

  icon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
  },

  listContainer: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 20,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  leftSection: {
    position: 'relative',
    marginRight: 14,
  },

  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2253e7',
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarImage: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },

  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },

  onlineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    position: 'absolute',
    bottom: 1,
    right: 1,
    borderWidth: 2,
    borderColor: '#fff',
  },

  middleSection: {
    flex: 1,
    justifyContent: 'center',
  },

  username: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },

  message: {
    fontSize: 14,
    color: '#6b7280',
  },

  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  timeText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },

  unreadBadge: {
    backgroundColor: '#0b5ed7',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },

  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  notFoundContainer: {
    alignItems: 'center',
    marginBottom: 300,
  },

  notFoundText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
  },
});
