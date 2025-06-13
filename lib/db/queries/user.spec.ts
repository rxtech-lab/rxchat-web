import { getUserContext } from './user';
import { db } from './client';
import { telegramUser } from '../schema';
import { generateRandomTestUser } from '@/tests/helpers';
import { createUser, deleteUserAccount } from './queries';

jest.mock('server-only', () => ({}));

// Mock bcrypt-ts to avoid ESM import issues in Jest
jest.mock('bcrypt-ts', () => ({
  genSaltSync: jest.fn(() => 'mock-salt'),
  hashSync: jest.fn((password: string) => `mock-hash-${password}`),
  compare: jest.fn(() => Promise.resolve(true)),
  compareSync: jest.fn(() => true),
}));

jest.retryTimes(3, {
  logErrorsBeforeRetry: true,
});

describe('User Context Queries', () => {
  let testUserId: string;
  let testTelegramId: number;

  /**
   * Creates a test user before each test
   */
  beforeEach(async () => {
    const user = generateRandomTestUser();
    const [testUser] = await createUser(user.email, user.password);
    testUserId = testUser.id;
    testTelegramId = Math.floor(Math.random() * 1e15);

    // Insert a test telegram user record
    await db.insert(telegramUser).values({
      userId: testUserId,
      tgId: testTelegramId,
    });
  });

  afterAll(() => {
    // Cleanup database connections or any global state if needed
    jest.clearAllMocks();
    db.$client.end();
  });

  /**
   * Cleans up test user and associated data after each test
   */
  afterEach(async () => {
    if (testUserId) {
      await deleteUserAccount({ id: testUserId });
    }
  });

  describe('getUserContext', () => {
    test('should get user context successfully', async () => {
      const result = await getUserContext(testUserId);

      expect(result).toBeDefined();
      expect(result.telegramId).toBe(testTelegramId);
    });

    test('should throw error for invalid user ID format', async () => {
      await expect(getUserContext('invalid-uuid-format')).rejects.toThrow();
    });

    test('should handle database connection errors gracefully', async () => {
      // Mock a database error by using an invalid connection
      jest.spyOn(db, 'select').mockImplementationOnce(() => {
        throw new Error('Database connection error');
      });

      await expect(getUserContext(testUserId)).rejects.toThrow();
    });

    test('should handle concurrent operations safely', async () => {
      // Create multiple users concurrently
      const users = await Promise.all(
        Array.from({ length: 3 }, async () => {
          const user = generateRandomTestUser();
          const [testUser] = await createUser(user.email, user.password);
          const tgId = Math.floor(Math.random() * 1e15);
          await db.insert(telegramUser).values({
            userId: testUser.id,
            tgId: tgId,
          });
          return { userId: testUser.id, tgId };
        }),
      );

      // Get user contexts concurrently
      const results = await Promise.all(
        users.map((user) => getUserContext(user.userId)),
      );

      // Verify all results are correct
      results.forEach((result, index) => {
        expect(result.telegramId).toBe(users[index].tgId);
      });

      // Clean up
      await Promise.all(
        users.map((user) => deleteUserAccount({ id: user.userId })),
      );
    });
  });
});
