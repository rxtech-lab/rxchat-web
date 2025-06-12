jest.mock('server-only', () => ({}));

// Mock bcrypt-ts to avoid ESM import issues in Jest
jest.mock('bcrypt-ts', () => ({
  genSaltSync: jest.fn(() => 'mock-salt'),
  hashSync: jest.fn((password: string) => `mock-hash-${password}`),
  compare: jest.fn(() => Promise.resolve(true)),
  compareSync: jest.fn(() => true),
}));

import { generateRandomTestUser } from '@/tests/helpers';
import { createUser, deleteUserAccount } from '../queries';
import {
  getUserTelegramLink,
  linkTelegramToUser,
  unlinkTelegramFromUser,
  updateTelegramLastUsed,
} from './telegram';

/**
 * Test utilities for creating mock Telegram data
 */
const createMockTelegramData = (
  overrides: Partial<{
    tgId: number;
    username: string;
  }> = {},
) => ({
  tgId: Math.floor(Math.random() * 1000000) + 100000, // Random 6-digit number
  username: `test_user_${Math.random().toString(36).substring(7)}`,
  ...overrides,
});

describe('Telegram Link Queries', () => {
  let testUserId: string;
  let testTelegramData: { tgId: number; username: string };

  /**
   * Creates a test user before each test
   */
  beforeEach(async () => {
    const user = generateRandomTestUser();
    const [testUser] = await createUser(user.email, user.password);
    testUserId = testUser.id;
    testTelegramData = createMockTelegramData();
  });

  /**
   * Cleans up test user and associated data after each test
   */
  afterEach(async () => {
    if (testUserId) {
      await deleteUserAccount({ id: testUserId });
    }
  });

  describe('getUserTelegramLink', () => {
    test('should return null when user has no Telegram link', async () => {
      const result = await getUserTelegramLink(testUserId);
      expect(result).toBeNull();
    });

    test('should return TelegramUser when user has a Telegram link', async () => {
      // First link a Telegram account
      await linkTelegramToUser(
        testUserId,
        testTelegramData.tgId,
        testTelegramData.username,
      );

      const result = await getUserTelegramLink(testUserId);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.userId).toBe(testUserId);
        expect(result.tgId).toBe(testTelegramData.tgId);
        expect(result.username).toBe(testTelegramData.username);
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.lastUsed).toBeInstanceOf(Date);
      }
    });

    test('should return null for non-existent user', async () => {
      const nonExistentUserId = crypto.randomUUID();
      const result = await getUserTelegramLink(nonExistentUserId);
      expect(result).toBeNull();
    });
  });

  describe('linkTelegramToUser', () => {
    test('should successfully link Telegram account with username', async () => {
      const result = await linkTelegramToUser(
        testUserId,
        testTelegramData.tgId,
        testTelegramData.username,
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.tgId).toBe(testTelegramData.tgId);
      expect(result.username).toBe(testTelegramData.username);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.lastUsed).toBeInstanceOf(Date);
    });

    test('should successfully link Telegram account without username', async () => {
      const result = await linkTelegramToUser(
        testUserId,
        testTelegramData.tgId,
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.tgId).toBe(testTelegramData.tgId);
      expect(result.username).toBeNull();
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.lastUsed).toBeInstanceOf(Date);
    });

    test('should set createdAt and lastUsed to current time', async () => {
      const beforeLink = new Date();

      const result = await linkTelegramToUser(
        testUserId,
        testTelegramData.tgId,
        testTelegramData.username,
      );

      const afterLink = new Date();

      expect(result.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeLink.getTime(),
      );
      expect(result.createdAt.getTime()).toBeLessThanOrEqual(
        afterLink.getTime(),
      );
      if (result.lastUsed) {
        expect(result.lastUsed.getTime()).toBeGreaterThanOrEqual(
          beforeLink.getTime(),
        );
        expect(result.lastUsed.getTime()).toBeLessThanOrEqual(
          afterLink.getTime(),
        );
      }
    });

    test('should allow linking different Telegram accounts to different users', async () => {
      // Create another test user
      const anotherUser = generateRandomTestUser();
      const [anotherTestUser] = await createUser(
        anotherUser.email,
        anotherUser.password,
      );
      const anotherUserId = anotherTestUser.id;
      const anotherTelegramData = createMockTelegramData();

      try {
        // Link first user
        const result1 = await linkTelegramToUser(
          testUserId,
          testTelegramData.tgId,
          testTelegramData.username,
        );

        // Link second user
        const result2 = await linkTelegramToUser(
          anotherUserId,
          anotherTelegramData.tgId,
          anotherTelegramData.username,
        );

        expect(result1.userId).toBe(testUserId);
        expect(result1.tgId).toBe(testTelegramData.tgId);
        expect(result2.userId).toBe(anotherUserId);
        expect(result2.tgId).toBe(anotherTelegramData.tgId);
      } finally {
        // Clean up the additional user
        await deleteUserAccount({ id: anotherUserId });
      }
    });
  });

  describe('unlinkTelegramFromUser', () => {
    test('should successfully unlink existing Telegram account', async () => {
      // First link a Telegram account
      await linkTelegramToUser(
        testUserId,
        testTelegramData.tgId,
        testTelegramData.username,
      );

      // Verify it exists
      const linkedAccount = await getUserTelegramLink(testUserId);
      expect(linkedAccount).not.toBeNull();

      // Unlink it
      await unlinkTelegramFromUser(testUserId);

      // Verify it's gone
      const unlinkedAccount = await getUserTelegramLink(testUserId);
      expect(unlinkedAccount).toBeNull();
    });

    test('should not throw error when unlinking non-existent link', async () => {
      // Should not throw an error even if no link exists
      await expect(unlinkTelegramFromUser(testUserId)).resolves.not.toThrow();
    });

    test('should not throw error for non-existent user', async () => {
      const nonExistentUserId = crypto.randomUUID();
      await expect(
        unlinkTelegramFromUser(nonExistentUserId),
      ).resolves.not.toThrow();
    });
  });

  describe('updateTelegramLastUsed', () => {
    test('should update lastUsed timestamp for existing Telegram link', async () => {
      // First link a Telegram account
      const linkedAccount = await linkTelegramToUser(
        testUserId,
        testTelegramData.tgId,
        testTelegramData.username,
      );

      const originalLastUsed = linkedAccount.lastUsed;

      // Wait a small amount to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update last used
      await updateTelegramLastUsed(testTelegramData.tgId);

      // Verify the timestamp was updated
      const updatedAccount = await getUserTelegramLink(testUserId);
      expect(updatedAccount).not.toBeNull();
      if (updatedAccount?.lastUsed && originalLastUsed) {
        expect(updatedAccount.lastUsed.getTime()).toBeGreaterThan(
          originalLastUsed.getTime(),
        );
      }
    });

    test('should not throw error for non-existent Telegram ID', async () => {
      const nonExistentTgId = 999999999;
      await expect(
        updateTelegramLastUsed(nonExistentTgId),
      ).resolves.not.toThrow();
    });

    test('should update lastUsed to current time', async () => {
      // First link a Telegram account
      await linkTelegramToUser(
        testUserId,
        testTelegramData.tgId,
        testTelegramData.username,
      );

      const beforeUpdate = new Date();
      await updateTelegramLastUsed(testTelegramData.tgId);
      const afterUpdate = new Date();

      const updatedAccount = await getUserTelegramLink(testUserId);
      expect(updatedAccount).not.toBeNull();
      if (updatedAccount?.lastUsed) {
        expect(updatedAccount.lastUsed.getTime()).toBeGreaterThanOrEqual(
          beforeUpdate.getTime(),
        );
        expect(updatedAccount.lastUsed.getTime()).toBeLessThanOrEqual(
          afterUpdate.getTime(),
        );
      }
    });
  });

  describe('Integration scenarios', () => {
    test('should handle complete Telegram link lifecycle', async () => {
      // 1. Initially no link should exist
      let telegramLink = await getUserTelegramLink(testUserId);
      expect(telegramLink).toBeNull();

      // 2. Link Telegram account
      const linkedAccount = await linkTelegramToUser(
        testUserId,
        testTelegramData.tgId,
        testTelegramData.username,
      );
      expect(linkedAccount).toBeDefined();

      // 3. Verify link exists
      telegramLink = await getUserTelegramLink(testUserId);
      expect(telegramLink).not.toBeNull();
      if (telegramLink) {
        expect(telegramLink.tgId).toBe(testTelegramData.tgId);

        // 4. Update last used
        const originalLastUsed = telegramLink.lastUsed;
        await new Promise((resolve) => setTimeout(resolve, 10));
        await updateTelegramLastUsed(testTelegramData.tgId);

        // 5. Verify last used was updated
        telegramLink = await getUserTelegramLink(testUserId);
        if (telegramLink?.lastUsed && originalLastUsed) {
          expect(telegramLink.lastUsed.getTime()).toBeGreaterThan(
            originalLastUsed.getTime(),
          );
        }
      }

      // 6. Unlink account
      await unlinkTelegramFromUser(testUserId);

      // 7. Verify link is gone
      telegramLink = await getUserTelegramLink(testUserId);
      expect(telegramLink).toBeNull();
    });
  });
});
