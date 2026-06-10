import database from '@react-native-firebase/database';

/**
 * Updates denormalized chat summaries for both sender and receiver when a message is sent.
 * Stores at /userChats/${uid}/${chatId} so Home.jsx can use a single listener.
 */

export const updateChatSummaryOnSend = async (
  chatId,
  senderUid,
  receiverUid,
  messageText,
  timestamp,
) => {
  const updates = {};

  // Sender's summary — unreadCount is 0 since they sent the message
  updates[`/userChats/${senderUid}/${chatId}/lastMessage`] = messageText;
  updates[`/userChats/${senderUid}/${chatId}/lastSender`] = senderUid;
  updates[`/userChats/${senderUid}/${chatId}/lastTimestamp`] = timestamp;
  updates[`/userChats/${senderUid}/${chatId}/unreadCount`] = 0;

  // Receiver's summary — keep existing unreadCount, just update last message info
  updates[`/userChats/${receiverUid}/${chatId}/lastMessage`] = messageText;
  updates[`/userChats/${receiverUid}/${chatId}/lastSender`] = senderUid;
  updates[`/userChats/${receiverUid}/${chatId}/lastTimestamp`] = timestamp;

  // Atomically increment receiver's unread count FIRST
  // This ensures the counter is already incremented BEFORE the update() below
  // triggers the receiver's messages listener. Otherwise the receiver's
  // updateChatSummaryOnSeen (set to 0) could race with this transaction.
  await database()
    .ref(`/userChats/${receiverUid}/${chatId}/unreadCount`)
    .transaction(current => (current || 0) + 1);

  // THEN write the summary fields (triggers receiver's listener)
  await database().ref().update(updates);
};

/**
 * Resets unread count for the current user's chat summary after messages are seen.
 */
export const updateChatSummaryOnSeen = async (chatId, uid) => {
  await database()
    .ref(`/userChats/${uid}/${chatId}/unreadCount`)
    .set(0);
};

/**
 * Refreshes the chat summary after a message is deleted or edited.
 * Fetches the new last message from Firebase and updates both users' summaries.
 */
export const refreshChatSummary = async (chatId, userUid, otherUid) => {
  try {
    const chatRef = database().ref(`/chats/${chatId}/messages`);
    const snapshot = await chatRef
      .orderByChild('createdAt')
      .limitToLast(1)
      .once('value');

    const data = snapshot.val();

    if (!data) {
      // No messages left — clear summaries for both users
      const updates = {};
      updates[`/userChats/${userUid}/${chatId}/lastMessage`] = '';
      updates[`/userChats/${userUid}/${chatId}/lastSender`] = null;
      updates[`/userChats/${userUid}/${chatId}/lastTimestamp`] = null;
      updates[`/userChats/${otherUid}/${chatId}/lastMessage`] = '';
      updates[`/userChats/${otherUid}/${chatId}/lastSender`] = null;
      updates[`/userChats/${otherUid}/${chatId}/lastTimestamp`] = null;
      await database().ref().update(updates);
      return;
    }

    const lastMsg = Object.values(data)[0];
    const lastMessage = lastMsg.text || lastMsg.fileName || (lastMsg.imageUrl ? '📷 Photo' : '');
    const lastSender = lastMsg.senderId || null;
    const lastTimestamp = lastMsg.createdAt || null;

    const updates = {};
    updates[`/userChats/${userUid}/${chatId}/lastMessage`] = lastMessage;
    updates[`/userChats/${userUid}/${chatId}/lastSender`] = lastSender;
    updates[`/userChats/${userUid}/${chatId}/lastTimestamp`] = lastTimestamp;
    updates[`/userChats/${otherUid}/${chatId}/lastMessage`] = lastMessage;
    updates[`/userChats/${otherUid}/${chatId}/lastSender`] = lastSender;
    updates[`/userChats/${otherUid}/${chatId}/lastTimestamp`] = lastTimestamp;
    await database().ref().update(updates);
  } catch (error) {
    // Silently handle — summary will be stale but app still works
  }
};
