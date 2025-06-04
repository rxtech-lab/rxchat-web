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
  createPrompt,
  updatePrompt,
} from './queries';
import { generateRandomTestUser } from '@/tests/helpers';
import type { Prompt } from '../schema';

/**
 * Test utilities for creating mock prompt data
 */
const createMockPrompt = (
  authorId: string,
  overrides: Partial<Prompt> = {},
): Prompt => ({
  id: crypto.randomUUID(),
  title: `Test Prompt ${generateId()}`,
  description: 'A test prompt for unit testing',
  code: 'console.log("Hello, World!");',
  authorId,
  visibility: 'private',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Prompt Queries', () => {
  let testUserId: string;
  let testPromptId: string;

  /**
   * Creates a test user and prompt before each test
   */
  beforeEach(async () => {
    const user = generateRandomTestUser();
    const [testUser] = await createUser(user.email, user.password);
    testUserId = testUser.id;

    // Create a test prompt
    const mockPrompt = createMockPrompt(testUserId);
    await createPrompt({
      prompt: mockPrompt,
      userId: testUserId,
    });
    testPromptId = mockPrompt.id;
  });

  /**
   * Cleans up test user and associated data after each test
   */
  afterEach(async () => {
    if (testUserId) {
      await deleteUserAccount({ id: testUserId });
    }
  });

  describe('updatePrompt', () => {
    test('should update a prompt and return the updated prompt object', async () => {
      const updateData = {
        title: 'Updated Test Prompt',
        description: 'Updated description for testing',
        code: 'console.log("Updated code");',
        visibility: 'public' as const,
      };

      const result = await updatePrompt({
        promptId: testPromptId,
        prompt: updateData,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(testPromptId);
      expect(result.title).toBe(updateData.title);
      expect(result.description).toBe(updateData.description);
      expect(result.code).toBe(updateData.code);
      expect(result.visibility).toBe(updateData.visibility);
      expect(result.authorId).toBe(testUserId);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test('should update only specified fields and keep others unchanged', async () => {
      const partialUpdate = {
        title: 'Partially Updated Title',
      };

      const result = await updatePrompt({
        promptId: testPromptId,
        prompt: partialUpdate,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(testPromptId);
      expect(result.title).toBe(partialUpdate.title);
      expect(result.description).toBe('A test prompt for unit testing'); // Should remain unchanged
      expect(result.code).toBe('console.log("Hello, World!");'); // Should remain unchanged
      expect(result.visibility).toBe('private'); // Should remain unchanged
      expect(result.authorId).toBe(testUserId);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    test('should update the updatedAt timestamp', async () => {
      const beforeUpdate = new Date();

      // Wait a small amount to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await updatePrompt({
        promptId: testPromptId,
        prompt: { title: 'Time Test Update' },
      });

      expect(result.updatedAt.getTime()).toBeGreaterThan(
        beforeUpdate.getTime(),
      );
    });

    test('should throw ChatSDKError when prompt does not exist', async () => {
      const nonExistentPromptId = crypto.randomUUID();

      await expect(
        updatePrompt({
          promptId: nonExistentPromptId,
          prompt: { title: 'Should Fail' },
        }),
      ).rejects.toThrow('An error occurred while executing a database query.');
    });
  });
});
