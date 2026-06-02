import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';

const ChatHeader = React.memo(({
  receiverData,
  navigation,
  selectionMode,
  selectedMessages,
  onClearSelection,
  onOpenMenu,
}) => {
  return (
    <View style={styles.header}>
      {selectionMode ? (
        <>
          <TouchableOpacity
            onPress={onClearSelection}
            style={{ padding: 4 }}
            hitSlop={10}
          >
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>

          <Text style={styles.selectedCount}>
            {selectedMessages.length}
          </Text>

          <View style={styles.headerIcons}>
            <TouchableOpacity
              onPress={onOpenMenu}
              style={{ padding: 4 }}
              hitSlop={10}
            >
              <Ionicons name="ellipsis-vertical" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <View style={styles.userSection}>
            {receiverData?.profileImage &&
            receiverData.profileImage.trim() !== '' ? (
              <Image
                source={{ uri: receiverData.profileImage }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.letterAvatar}>
                <Text style={styles.letterText}>
                  {receiverData?.username
                    ? receiverData.username.charAt(0).toUpperCase()
                    : 'U'}
                </Text>
              </View>
            )}
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
  );
});

export default ChatHeader;

const styles = StyleSheet.create({
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
    width: 45,
    height: 45,
    borderRadius: 25,
  },
  letterAvatar: {
    width: 45,
    height: 45,
    borderRadius: 25,
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
});
