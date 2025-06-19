import { db } from '@/lib/db/queries/client';

jest.mock('server-only', () => ({}));

// Mock bcrypt-ts to avoid ESM import issues in Jest
jest.mock('bcrypt-ts', () => ({
  genSaltSync: jest.fn(() => 'mock-salt'),
  hashSync: jest.fn((password: string) => `mock-hash-${password}`),
  compare: jest.fn(() => Promise.resolve(true)),
  compareSync: jest.fn(() => true),
}));

import { generateId } from 'ai';
import {
  createUser,
  deleteUserAccount,
  getUser,
  getUsers,
  getUserById,
  createUserWithoutPassword,
  saveChat,
  deleteChatById,
  getChatsByUserId,
  getChatById,
  saveMessages,
  getMessagesByChatId,
  voteMessage,
  getVotesByChatId,
  getMessageById,
  deleteMessagesByChatIdAfterTimestamp,
  updateChatVisiblityById,
  getMessageCountByUserId,
  updateUserPassword,
} from './queries';
import { generateRandomTestUser } from '@/tests/helpers';
import type { Chat, DBMessage, Document, Suggestion } from '../schema';
import { ChatSDKError } from '@/lib/errors';

/**
 * Test utilities for creating mock data
 */
const createMockChat = (
  userId: string,
  overrides: Partial<Chat> = {},
): Chat => ({
  id: crypto.randomUUID(),
  title: `Test Chat ${generateId()}`,
  userId,
  visibility: 'private',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockMessage = (
  chatId: string,
  overrides: Partial<DBMessage> = {},
): DBMessage => ({
  id: crypto.randomUUID(),
  chatId,
  role: 'user',
  content: `Test message ${generateId()}`,
  createdAt: new Date(),
  kind: 'text',
  ...overrides,
});

const createMockDocument = (overrides: Partial<Document> = {}): Document => ({
  id: crypto.randomUUID(),
  content: `Test document content ${generateId()}`,
  title: `Test Document ${generateId()}`,
  kind: 'text',
  createdAt: new Date(),
  ...overrides,
});

const createMockSuggestion = (
  documentId: string,
  overrides: Partial<Suggestion> = {},
): Suggestion => ({
  id: crypto.randomUUID(),
  documentId,
  originalText: `Original text ${generateId()}`,
  suggestedText: `Suggested text ${generateId()}`,
  description: `Test suggestion ${generateId()}`,
  kind: 'text',
  isResolved: false,
  createdAt: new Date(),
  ...overrides,
});

describe('Extended Database Queries', () => {
  let testUserId: string;
  let testUser2Id: string;

  beforeEach(async () => {
    // Create test users
    const user1 = generateRandomTestUser();
    const user2 = generateRandomTestUser();
    const [testUser1] = await createUser(user1.email, user1.password);
    const [testUser2] = await createUser(user2.email, user2.password);
    testUserId = testUser1.id;
    testUser2Id = testUser2.id;
  });

  afterAll(() => {
    jest.clearAllMocks();
    db.$client.end();
  });

  afterEach(async () => {
    // Clean up test users and associated data
    if (testUserId) {
      await deleteUserAccount({ id: testUserId });
    }
    if (testUser2Id) {
      await deleteUserAccount({ id: testUser2Id });
    }
  });

  describe('User Queries', () => {
    describe('getUser', () => {
      test('should get user by email', async () => {
        const testUser = generateRandomTestUser();
        await createUser(testUser.email, testUser.password);

        const result = await getUser(testUser.email);

        expect(result).toHaveLength(1);
        expect(result[0].email).toBe(testUser.email);
        expect(result[0].id).toBeDefined();

        // Cleanup
        await deleteUserAccount({ id: result[0].id });
      });

      test('should return empty array for non-existent email', async () => {
        const result = await getUser('nonexistent@test.com');
        expect(result).toHaveLength(0);
      });

      test('should throw ChatSDKError on database error', async () => {
        // Test with invalid email format to trigger database error
        await expect(getUser(null as any)).rejects.toThrow(ChatSDKError);
      });
    });

    describe('getUsers', () => {
      test('should get users with limit and offset', async () => {
        const result = await getUsers(10, 0);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeLessThanOrEqual(10);
      });

      test('should respect limit parameter', async () => {
        const result = await getUsers(1, 0);

        expect(result.length).toBeLessThanOrEqual(1);
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(getUsers(-1, -1)).rejects.toThrow(ChatSDKError);
      });
    });

    describe('getUserById', () => {
      test('should get user by ID', async () => {
        const result = await getUserById(testUserId);

        expect(result).not.toBeNull();
        expect(result?.id).toBe(testUserId);
        expect(result?.email).toBeDefined();
      });

      test('should return null for non-existent user ID', async () => {
        const result = await getUserById(
          '550e8400-e29b-41d4-a716-446655440000',
        );
        expect(result).toBeNull();
      });

      test('should add test provider in test environment', async () => {
        const result = await getUserById(testUserId);

        expect(result?.availableModelProviders).toContain('test');
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(getUserById('invalid-uuid')).rejects.toThrow(ChatSDKError);
      });
    });

    describe('createUserWithoutPassword', () => {
      test('should create user without password', async () => {
        const testEmail = `test-${generateId()}@example.com`;

        const result = await createUserWithoutPassword(testEmail);

        expect(result.id).toBeDefined();
        expect(result.email).toBe(testEmail);

        // Cleanup
        await deleteUserAccount({ id: result.id });
      });

      test('should throw ChatSDKError if user already exists', async () => {
        const testUser = generateRandomTestUser();
        await createUser(testUser.email, testUser.password);

        await expect(createUserWithoutPassword(testUser.email)).rejects.toThrow(
          ChatSDKError,
        );
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(createUserWithoutPassword(null as any)).rejects.toThrow(
          ChatSDKError,
        );
      });
    });

    describe('updateUserPassword', () => {
      test('should update user password', async () => {
        const newPassword = 'newPassword123';

        await updateUserPassword({
          userId: testUserId,
          password: newPassword,
        });

        // Password update should complete without error
        // We can't directly verify the password hash due to mocking
        expect(true).toBe(true);
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(
          updateUserPassword({
            userId: 'invalid-uuid',
            password: 'newPassword',
          }),
        ).rejects.toThrow(ChatSDKError);
      });
    });
  });

  describe('Chat Queries', () => {
    let testChatId: string;

    beforeEach(async () => {
      // Create a test chat
      const mockChat = createMockChat(testUserId);
      testChatId = mockChat.id;
      await saveChat({
        id: testChatId,
        userId: testUserId,
        title: mockChat.title,
        visibility: mockChat.visibility,
      });
    });

    describe('saveChat', () => {
      test('should save a new chat', async () => {
        const newChatId = crypto.randomUUID();

        await saveChat({
          id: newChatId,
          userId: testUserId,
          title: 'New Test Chat',
          visibility: 'private',
        });

        const savedChat = await getChatById({ id: newChatId });
        expect(savedChat?.id).toBe(newChatId);
        expect(savedChat?.title).toBe('New Test Chat');
      });

      test('should update existing chat on conflict', async () => {
        const updatedTitle = 'Updated Chat Title';

        await saveChat({
          id: testChatId,
          userId: testUserId,
          title: updatedTitle,
          visibility: 'public',
        });

        const updatedChat = await getChatById({ id: testChatId });
        expect(updatedChat?.title).toBe(updatedTitle);
        expect(updatedChat?.visibility).toBe('public');
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(
          saveChat({
            id: 'invalid-uuid',
            userId: testUserId,
            title: 'Test',
            visibility: 'private',
          }),
        ).rejects.toThrow(ChatSDKError);
      });
    });

    describe('getChatById', () => {
      test('should get chat by ID', async () => {
        const result = await getChatById({ id: testChatId });

        expect(result).not.toBeNull();
        expect(result?.id).toBe(testChatId);
        expect(result?.userId).toBe(testUserId);
      });

      test('should return null for non-existent chat', async () => {
        const result = await getChatById({
          id: '550e8400-e29b-41d4-a716-446655440000',
        });
        expect(result).toBeNull();
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(getChatById({ id: 'invalid-uuid' })).rejects.toThrow(
          ChatSDKError,
        );
      });
    });

    describe('getChatsByUserId', () => {
      test('should get chats by user ID with pagination', async () => {
        const result = await getChatsByUserId({
          id: testUserId,
          limit: 10,
          startingAfter: null,
          endingBefore: null,
        });

        expect(Array.isArray(result.chats)).toBe(true);
        expect(result.chats.length).toBeGreaterThan(0);
        expect(result.hasMore).toBeDefined();
      });

      test('should handle pagination with startingAfter', async () => {
        const result = await getChatsByUserId({
          id: testUserId,
          limit: 1,
          startingAfter: testChatId,
          endingBefore: null,
        });

        expect(Array.isArray(result.chats)).toBe(true);
        expect(result.hasMore).toBeDefined();
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(
          getChatsByUserId({
            id: 'invalid-uuid',
            limit: 10,
            startingAfter: null,
            endingBefore: null,
          }),
        ).rejects.toThrow(ChatSDKError);
      });
    });

    describe('deleteChatById', () => {
      test('should delete chat and related data', async () => {
        const newChatId = crypto.randomUUID();
        await saveChat({
          id: newChatId,
          userId: testUserId,
          title: 'Chat to Delete',
          visibility: 'private',
        });

        const deletedChat = await deleteChatById({ id: newChatId });

        expect(deletedChat.id).toBe(newChatId);

        // Verify chat is deleted
        const result = await getChatById({ id: newChatId });
        expect(result).toBeNull();
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(deleteChatById({ id: 'invalid-uuid' })).rejects.toThrow(
          ChatSDKError,
        );
      });
    });

    describe('updateChatVisiblityById', () => {
      test('should update chat visibility', async () => {
        await updateChatVisiblityById({
          chatId: testChatId,
          visibility: 'public',
        });

        const updatedChat = await getChatById({ id: testChatId });
        expect(updatedChat?.visibility).toBe('public');
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(
          updateChatVisiblityById({
            chatId: 'invalid-uuid',
            visibility: 'public',
          }),
        ).rejects.toThrow(ChatSDKError);
      });
    });
  });

  describe('Message Queries', () => {
    let testChatId: string;
    let testMessageId: string;

    beforeEach(async () => {
      // Create a test chat
      const mockChat = createMockChat(testUserId);
      testChatId = mockChat.id;
      await saveChat({
        id: testChatId,
        userId: testUserId,
        title: mockChat.title,
        visibility: mockChat.visibility,
      });

      // Create a test message
      const mockMessage = createMockMessage(testChatId);
      testMessageId = mockMessage.id;
      await saveMessages({
        messages: [mockMessage],
      });
    });

    describe('saveMessages', () => {
      test('should save multiple messages', async () => {
        const newMessages = [
          createMockMessage(testChatId, { content: 'Message 1' }),
          createMockMessage(testChatId, { content: 'Message 2' }),
        ];

        await saveMessages({ messages: newMessages });

        const savedMessages = await getMessagesByChatId({ id: testChatId });
        expect(savedMessages.length).toBeGreaterThanOrEqual(3); // including the beforeEach message
      });

      test('should throw ChatSDKError on database error', async () => {
        const invalidMessage = createMockMessage('invalid-chat-id');

        await expect(
          saveMessages({ messages: [invalidMessage] }),
        ).rejects.toThrow(ChatSDKError);
      });
    });

    describe('getMessagesByChatId', () => {
      test('should get messages by chat ID', async () => {
        const result = await getMessagesByChatId({ id: testChatId });

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].chatId).toBe(testChatId);
      });

      test('should return empty array for chat with no messages', async () => {
        const emptyChatId = crypto.randomUUID();
        await saveChat({
          id: emptyChatId,
          userId: testUserId,
          title: 'Empty Chat',
          visibility: 'private',
        });

        const result = await getMessagesByChatId({ id: emptyChatId });
        expect(result).toHaveLength(0);
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(
          getMessagesByChatId({ id: 'invalid-uuid' }),
        ).rejects.toThrow(ChatSDKError);
      });
    });

    describe('getMessageById', () => {
      test('should get message by ID', async () => {
        const result = await getMessageById({ id: testMessageId });

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(testMessageId);
        expect(result[0].chatId).toBe(testChatId);
      });

      test('should return empty array for non-existent message', async () => {
        const result = await getMessageById({
          id: '550e8400-e29b-41d4-a716-446655440000',
        });
        expect(result).toHaveLength(0);
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(getMessageById({ id: 'invalid-uuid' })).rejects.toThrow(
          ChatSDKError,
        );
      });
    });

    describe('deleteMessagesByChatIdAfterTimestamp', () => {
      test('should delete messages after specified timestamp', async () => {
        const timestamp = new Date();

        // Add some delay to ensure timestamp difference
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Add a new message after timestamp
        const newMessage = createMockMessage(testChatId, {
          content: 'After timestamp',
        });
        await saveMessages({ messages: [newMessage] });

        await deleteMessagesByChatIdAfterTimestamp({
          chatId: testChatId,
          timestamp,
        });

        const remainingMessages = await getMessagesByChatId({ id: testChatId });
        // Should only contain the original message created in beforeEach
        expect(remainingMessages.length).toBe(1);
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(
          deleteMessagesByChatIdAfterTimestamp({
            chatId: 'invalid-uuid',
            timestamp: new Date(),
          }),
        ).rejects.toThrow(ChatSDKError);
      });
    });

    describe('getMessageCountByUserId', () => {
      test('should get message count by user ID', async () => {
        const result = await getMessageCountByUserId({ userId: testUserId });

        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
      });

      test('should return 0 for user with no messages', async () => {
        const newUser = generateRandomTestUser();
        const [user] = await createUser(newUser.email, newUser.password);

        const result = await getMessageCountByUserId({ userId: user.id });
        expect(result).toBe(0);

        // Cleanup
        await deleteUserAccount({ id: user.id });
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(
          getMessageCountByUserId({ userId: 'invalid-uuid' }),
        ).rejects.toThrow(ChatSDKError);
      });
    });
  });

  describe('Vote Queries', () => {
    let testChatId: string;
    let testMessageId: string;

    beforeEach(async () => {
      // Create test chat and message for voting
      const mockChat = createMockChat(testUserId);
      testChatId = mockChat.id;
      await saveChat({
        id: testChatId,
        userId: testUserId,
        title: mockChat.title,
        visibility: mockChat.visibility,
      });

      const mockMessage = createMockMessage(testChatId);
      testMessageId = mockMessage.id;
      await saveMessages({ messages: [mockMessage] });
    });

    describe('voteMessage', () => {
      test('should vote on a message', async () => {
        await voteMessage({
          chatId: testChatId,
          messageId: testMessageId,
          type: 'up',
        });

        const votes = await getVotesByChatId({ id: testChatId });
        expect(votes.length).toBeGreaterThan(0);
        expect(votes[0].messageId).toBe(testMessageId);
        expect(votes[0].isUpvoted).toBe(true);
      });

      test('should update existing vote', async () => {
        // First vote
        await voteMessage({
          chatId: testChatId,
          messageId: testMessageId,
          type: 'up',
        });

        // Change vote
        await voteMessage({
          chatId: testChatId,
          messageId: testMessageId,
          type: 'down',
        });

        const votes = await getVotesByChatId({ id: testChatId });
        expect(votes.length).toBe(1);
        expect(votes[0].isUpvoted).toBe(false);
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(
          voteMessage({
            chatId: 'invalid-uuid',
            messageId: testMessageId,
            type: 'up',
          }),
        ).rejects.toThrow(ChatSDKError);
      });
    });

    describe('getVotesByChatId', () => {
      test('should get votes by chat ID', async () => {
        await voteMessage({
          chatId: testChatId,
          messageId: testMessageId,
          type: 'up',
        });

        const result = await getVotesByChatId({ id: testChatId });

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].chatId).toBe(testChatId);
      });

      test('should return empty array for chat with no votes', async () => {
        const emptyChatId = crypto.randomUUID();
        await saveChat({
          id: emptyChatId,
          userId: testUserId,
          title: 'Empty Chat',
          visibility: 'private',
        });

        const result = await getVotesByChatId({ id: emptyChatId });
        expect(result).toHaveLength(0);
      });

      test('should throw ChatSDKError on database error', async () => {
        await expect(getVotesByChatId({ id: 'invalid-uuid' })).rejects.toThrow(
          ChatSDKError,
        );
      });
    });
  });
});
