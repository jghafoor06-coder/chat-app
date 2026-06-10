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

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import Header from '../components/Header';
import Ionicons from '@react-native-vector-icons/ionicons';

import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

// FORMAT TIMESTAMP TO RELATIVE TIME LABEL
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

// MEMOIZED CHAT ROW — only re-renders when its specific props change
const ChatRow = React.memo(({ item, currentUid, summary, onNavigate }) => {
  const s = summary || {};
  const chatId =
    currentUid && currentUid > item.id
      ? `${currentUid}_${item.id}`
      : `${item.id}_${currentUid}`;

  const lastMessageText = s.lastMessage?.trim()
    ? s.lastSender === currentUid
      ? `You: ${s.lastMessage}`
      : s.lastMessage
    : `Start chatting with ${item.username}`;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.userRow}
      onPress={() => onNavigate(chatId, item.id)}
    >
      {/* LEFT */}
      <View style={styles.leftSection}>
        {item.profileImage ? (
          <Image source={{ uri: item.profileImage }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.username?.charAt(0)?.toUpperCase()}
            </Text>
          </View>
        )}

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
        {s.unreadCount > 0 ? (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText} numberOfLines={1}>
              {s.unreadCount}
            </Text>
          </View>
        ) : (
          <Text style={styles.timeText}>
            {getChatTimeLabel(s.lastTimestamp)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const Home = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [chatSummaries, setChatSummaries] = useState({});

  const currentUser = auth().currentUser;
  const currentUid = currentUser?.uid;

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

  // Single listener on denormalized chat summaries (replaces N per-chat listeners)
  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    const currentUid = currentUser.uid;
    const ref = database().ref(`/userChats/${currentUid}`);

    ref.on('value', snapshot => {
      const data = snapshot.val();
      if (data) {
        setChatSummaries(data);
      } else {
        setChatSummaries({});
      }
    });

    return () => ref.off();
  }, []);

  // One-time migration: populate summaries for existing chats that lack them
  const migratedRef = useRef(new Set());

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser || users.length === 0) return;

    const currentUid = currentUser.uid;

    users.forEach(item => {
      const chatId =
        currentUid > item.id
          ? `${currentUid}_${item.id}`
          : `${item.id}_${currentUid}`;

      // Skip if already migrated or summary already exists
      if (migratedRef.current.has(chatId) || chatSummaries[chatId]) return;
      migratedRef.current.add(chatId);

      // Fetch last message from existing chat to build summary
      const chatRef = database().ref(`/chats/${chatId}/messages`);
      chatRef
        .orderByChild('createdAt')
        .limitToLast(1)
        .once('value')
        .then(snapshot => {
          const data = snapshot.val();
          if (!data) return;

          const lastMsg = Object.values(data)[0];
          if (!lastMsg) return;

          const summaryData = {
            lastMessage: lastMsg.text || lastMsg.fileName || (lastMsg.imageUrl ? '📷 Photo' : ''),
            lastSender: lastMsg.senderId || null,
            lastTimestamp: lastMsg.createdAt || null,
          };

          // Count unread messages
          chatRef
            .orderByChild('seen')
            .equalTo(false)
            .once('value')
            .then(unreadSnapshot => {
              const unreadData = unreadSnapshot.val();
              const unreadCount = unreadData
                ? Object.values(unreadData).filter(
                    msg => msg.senderId !== currentUid,
                  ).length
                : 0;

              summaryData.unreadCount = unreadCount;

              // Write summary for current user
              database()
                .ref(`/userChats/${currentUid}/${chatId}`)
                .set(summaryData);

              // Also write summary for the other user
              database()
                .ref(`/userChats/${item.id}/${chatId}`)
                .set({
                  ...summaryData,
                  unreadCount: 0,
                });
            });
        })
        .catch(() => {}); // silently handle errors for chats with no data
    });
  }, [users, chatSummaries]);

  // Sort users by most recent message timestamp (descending)
  const sortedUsers = useMemo(() => {
    if (!currentUid) return filteredUsers;

    return [...filteredUsers].sort((a, b) => {
      const chatIdA =
        currentUid > a.id ? `${currentUid}_${a.id}` : `${a.id}_${currentUid}`;
      const chatIdB =
        currentUid > b.id ? `${currentUid}_${b.id}` : `${b.id}_${currentUid}`;

      const timestampA = chatSummaries[chatIdA]?.lastTimestamp || 0;
      const timestampB = chatSummaries[chatIdB]?.lastTimestamp || 0;

      return timestampB - timestampA;
    });
  }, [filteredUsers, chatSummaries, currentUid]);

  // SEARCH FUNCTION WITH 500MS DEBOUNCE
  const debounceRef = useRef(null);
  const usersRef = useRef(users);
  usersRef.current = users;

  const handleSearch = useCallback(text => {
    setSearch(text);

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // If empty, clear filter immediately
    if (text.trim() === '') {
      setFilteredUsers(usersRef.current);
      return;
    }

    // Set debounce timer
    debounceRef.current = setTimeout(() => {
      const filtered = usersRef.current.filter(item =>
        item.username?.toLowerCase().includes(text.toLowerCase()),
      );
      setFilteredUsers(filtered);
    }, 500);
  }, []); // stable reference — never recreated

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // STABLE NAVIGATE CALLBACK — never changes, so ChatRow's React.memo works
  const handleNavigate = useCallback(
    (chatId, userId) => {
      setChatSummaries(prev => ({
        ...prev,
        [chatId]: {
          ...prev[chatId],
          unreadCount: 0,
        },
      }));

      navigation.navigate('Chatscreen', {
        user: {
          uid: userId,
        },
      });
    },
    [navigation],
  );

  // RENDER ITEM — passes stable props to memoized ChatRow
  const renderItem = ({ item }) => {
    const chatId =
      currentUid && currentUid > item.id
        ? `${currentUid}_${item.id}`
        : `${item.id}_${currentUid}`;

    return (
      <ChatRow
        item={item}
        currentUid={currentUid}
        summary={chatSummaries[chatId]}
        onNavigate={handleNavigate}
      />
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <View>
          <Header title="Messages" />
        </View>

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

        {/* USERS LIST — OR — CENTERED 'USER NOT FOUND' */}
        {filteredUsers.length === 0 && search.trim() !== '' ? (
          <View style={styles.notFoundContainer}>
            <Ionicons name="search-outline" size={48} color="#d1d5db" />
            <Text style={styles.notFoundText}>User not found</Text>
          </View>
        ) : (
          <FlatList
            data={sortedUsers}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={7}
            initialNumToRender={8}
          />
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
    marginTop: 200,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
  },

  notFoundText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },
});
