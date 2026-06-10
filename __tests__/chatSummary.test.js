/**
 * Tests for chatSummary utility functions.
 *
 * Validates the fix: transaction() for incrementing unreadCount runs
 * BEFORE update() for writing summary fields — preventing the race
 * condition where the receiver's set(0) gets overwritten.
 */

// Mock @react-native-firebase/database
const mockTransaction = jest.fn((callback) => {
  const result = callback(0);
  return Promise.resolve({ committed: true, snapshot: { val: () => result } });
});

const mockSet = jest.fn(() => Promise.resolve());

const mockUpdate = jest.fn(() => Promise.resolve());

const mockOnce = jest.fn(() =>
  Promise.resolve({ val: () => null }),
);

const mockOrderByChild = jest.fn(() => ({
  limitToLast: jest.fn(() => ({
    once: mockOnce,
  })),
}));

const mockChild = jest.fn(() => ({
  off: jest.fn(),
  on: jest.fn(),
}));

const mockRef = jest.fn((path) => {
  // Return different mock based on whether transaction/set or update is called
  const ref = {
    transaction: mockTransaction,
    set: mockSet,
    update: mockUpdate,
    once: mockOnce,
    orderByChild: mockOrderByChild,
    child: mockChild,
    off: jest.fn(),
    on: jest.fn(),
  };
  return ref;
});

jest.mock('@react-native-firebase/database', () => {
  const mockDb = {
    ref: mockRef,
  };
  return () => mockDb;
});

// Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateChatSummaryOnSend', () => {
  it('calls transaction BEFORE update', async () => {
    // Track call order
    const callOrder = [];

    // Override mocks for this test to track order
    mockTransaction.mockImplementation((callback) => {
      callOrder.push('transaction');
      const result = callback(0);
      return Promise.resolve({ committed: true, snapshot: { val: () => result } });
    });

    mockUpdate.mockImplementation(() => {
      callOrder.push('update');
      return Promise.resolve();
    });

    const { updateChatSummaryOnSend } = require('../src/utils/chatSummary');

    await updateChatSummaryOnSend(
      'chat1',
      'sender1',
      'receiver1',
      'Hello',
      Date.now(),
    );

    // transaction should be called before update
    expect(callOrder).toEqual(['transaction', 'update']);
  });

  it('increments receiver unreadCount via transaction', async () => {
    const transactionCallback = jest.fn((current) => (current || 0) + 1);

    mockTransaction.mockImplementation((callback) => {
      const result = callback(0);
      return Promise.resolve({ committed: true, snapshot: { val: () => result } });
    });

    const { updateChatSummaryOnSend } = require('../src/utils/chatSummary');

    await updateChatSummaryOnSend(
      'chat1',
      'sender1',
      'receiver1',
      'Hello',
      Date.now(),
    );

    // Verify transaction was called on the correct path
    expect(mockRef).toHaveBeenCalledWith(
      '/userChats/receiver1/chat1/unreadCount',
    );

    // Verify update writes the summary fields
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg).toHaveProperty('/userChats/receiver1/chat1/lastMessage', 'Hello');
    expect(updateArg).toHaveProperty('/userChats/receiver1/chat1/lastSender', 'sender1');
    expect(updateArg).toHaveProperty('/userChats/receiver1/chat1/lastTimestamp');
    expect(updateArg).toHaveProperty('/userChats/sender1/chat1/unreadCount', 0);
  });

  it('increment callback uses server current value (handles retry)', async () => {
    // Simulate transaction retry: transaction reads value after receiver's
    // updateChatSummaryOnSeen set it to 0. The callback should still
    // correctly increment from whatever the current server value is.
    let calledWith = [];

    mockTransaction.mockImplementation((callback) => {
      // Simulate two scenarios:
      // 1. Server current value is 1 (normal case - one unread message)
      const result1 = callback(1);
      calledWith.push({ current: 1, result: result1 });
      // 2. Server current value is 0 (e.g., after receiver cleared it)
      const result2 = callback(0);
      calledWith.push({ current: 0, result: result2 });
      return Promise.resolve({ committed: true, snapshot: { val: () => result2 } });
    });

    const { updateChatSummaryOnSend } = require('../src/utils/chatSummary');

    await updateChatSummaryOnSend(
      'chat1',
      'sender1',
      'receiver1',
      'Hello',
      Date.now(),
    );

    // When current is 1, result should be 2
    expect(calledWith[0].result).toBe(2);
    // When current is 0 (already cleared by receiver), result should be 1
    expect(calledWith[1].result).toBe(1);
  });

  it('writes sender unreadCount as 0', async () => {
    mockTransaction.mockImplementation((callback) => {
      const result = callback(0);
      return Promise.resolve({ committed: true, snapshot: { val: () => result } });
    });

    const { updateChatSummaryOnSend } = require('../src/utils/chatSummary');

    await updateChatSummaryOnSend(
      'chat1',
      'sender1',
      'receiver1',
      'Hello',
      Date.now(),
    );

    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg['/userChats/sender1/chat1/unreadCount']).toBe(0);
  });
});

describe('updateChatSummaryOnSeen', () => {
  it('sets unreadCount to 0', async () => {
    const { updateChatSummaryOnSeen } = require('../src/utils/chatSummary');

    await updateChatSummaryOnSeen('chat1', 'receiver1');

    expect(mockRef).toHaveBeenCalledWith(
      '/userChats/receiver1/chat1/unreadCount',
    );
    expect(mockSet).toHaveBeenCalledWith(0);
  });
});
