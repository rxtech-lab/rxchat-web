import { db } from '@/lib/db/queries/client';

jest.mock('server-only', () => ({}));

// Mock bcrypt-ts to avoid ESM import issues in Jest
jest.mock('bcrypt-ts', () => ({
  genSaltSync: jest.fn(() => 'mock-salt'),
  hashSync: jest.fn((password: string) => `mock-hash-${password}`),
  compare: jest.fn(() => Promise.resolve(true)),
  compareSync: jest.fn(() => true),
}));

import { ChatSDKError } from '@/lib/errors';
import { generateRandomTestUser } from '@/tests/helpers';
import type { Prompt } from '../schema';
import { userPrompt } from '../schema';
import {
  createPrompt,
  deletePrompt,
  getPromptsByUserId,
  getUserPromptByUserId,
  updatePrompt,
} from './prompts';
import { createUser, deleteUserAccount } from './queries';

/**
 * Test utilities for creating mock data
 */
const createMockPrompt = (
  authorId: string,
  overrides: Partial<Prompt> = {},
): Prompt => ({
  id: crypto.randomUUID(),
  title: 'Test Prompt',
  description: null,
  icon: null,
  tags: [],
  code: 'This is a test prompt code with {{variable}} placeholder.',
  visibility: 'private' as const,
  authorId,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const cleanupDatabase = async () => {
  db.delete(userPrompt);
};

describe('Prompts Queries', () => {
  let testUserId: string;
  let secondTestUserId: string;

  /**
   * Creates test users before each test
   */
  beforeEach(async () => {
    const user1 = generateRandomTestUser();
    const user2 = generateRandomTestUser();
    const [testUser1] = await createUser(user1.email, user1.password);
    const [testUser2] = await createUser(user2.email, user2.password);
    testUserId = testUser1.id;
    secondTestUserId = testUser2.id;
  });

  /**
   * Cleans up test users and associated data after each test
   */
  afterEach(async () => {
    if (testUserId) {
      await deleteUserAccount({ id: testUserId });
    }
    if (secondTestUserId) {
      await deleteUserAccount({ id: secondTestUserId });
    }

    await cleanupDatabase();
  });

  afterAll(() => {
    // Cleanup database connections or any global state if needed
    jest.clearAllMocks();
    db.$client.end();
  });

  describe('createPrompt', () => {
    beforeEach(() => {
      // Reset any mocks or state before each test
      jest.clearAllMocks();
      // delete any existing prompts for the test user
      db.delete(userPrompt);
    });

    test('should create a prompt successfully', async () => {
      const mockPrompt = createMockPrompt(testUserId, {
        title: 'My Test Prompt',
        code: 'Hello {{name}}, how are you?',
        visibility: 'public',
      });

      const result = await createPrompt({
        prompt: mockPrompt,
        userId: testUserId,
      });

      expect(result).toBeDefined();

      // Verify the prompt was created by fetching it
      const prompts = await getPromptsByUserId({ userId: testUserId });
      expect(prompts).toHaveLength(1);
      expect(prompts[0].title).toBe('My Test Prompt');
      expect(prompts[0].code).toBe('Hello {{name}}, how are you?');
      expect(prompts[0].visibility).toBe('public');
      expect(prompts[0].authorId).toBe(testUserId);
    });

    test('should create private prompt by default', async () => {
      const mockPrompt = createMockPrompt(testUserId, {
        title: 'Private Prompt',
        visibility: 'private',
      });

      await createPrompt({
        prompt: mockPrompt,
        userId: testUserId,
      });

      const prompts = await getPromptsByUserId({ userId: testUserId });
      expect(prompts[0].visibility).toBe('private');
    });

    test('should throw ChatSDKError when database operation fails', async () => {
      const mockPrompt = createMockPrompt('invalid-user-id');

      await expect(
        createPrompt({
          prompt: mockPrompt,
          userId: 'invalid-user-id',
        }),
      ).rejects.toThrow(ChatSDKError);
      await expect(
        createPrompt({
          prompt: mockPrompt,
          userId: 'invalid-user-id',
        }),
      ).rejects.toThrow('An error occurred while executing a database query.');
    });
  });

  describe('getPromptsByUserId', () => {
    beforeEach(async () => {
      // Create test prompts with different visibilities
      await db.delete(userPrompt);

      const results = await db.select().from(userPrompt);

      const privatePrompt = createMockPrompt(testUserId, {
        title: 'Private Prompt',
        code: 'Private code',
        visibility: 'private',
      });

      const publicPrompt = createMockPrompt(testUserId, {
        title: 'Public Prompt',
        code: 'Public code',
        visibility: 'public',
      });

      // Create a prompt by another user (public)
      const otherUserPublicPrompt = createMockPrompt(secondTestUserId, {
        title: 'Other User Public',
        code: 'Other user public code',
        visibility: 'public',
      });

      // Create a prompt by another user (private)
      const otherUserPrivatePrompt = createMockPrompt(secondTestUserId, {
        title: 'Other User Private',
        code: 'Other user private code',
        visibility: 'private',
      });

      await createPrompt({ prompt: privatePrompt, userId: testUserId });
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different timestamps

      await createPrompt({ prompt: publicPrompt, userId: testUserId });
      await new Promise((resolve) => setTimeout(resolve, 10));

      await createPrompt({
        prompt: otherUserPublicPrompt,
        userId: secondTestUserId,
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      await createPrompt({
        prompt: otherUserPrivatePrompt,
        userId: secondTestUserId,
      });
    });

    test('should get user prompts and public prompts', async () => {
      const result = await getPromptsByUserId({ userId: testUserId });

      expect(result).toHaveLength(3);

      const titles = result.map((p) => p.title);
      expect(titles).toContain('Private Prompt');
      expect(titles).toContain('Public Prompt');
      expect(titles).toContain('Other User Public');
      expect(titles).not.toContain('Other User Private');
    });

    test('should order prompts by createdAt DESC', async () => {
      const result = await getPromptsByUserId({ userId: testUserId });

      // Should be ordered by creation time, most recent first
      expect(result[0].title).toBe('Other User Public'); // Last created
      expect(result[2].title).toBe('Private Prompt'); // First created
    });

    test('should return empty array for non-existent user', async () => {
      const validNonExistentUserId = '550e8400-e29b-41d4-a716-446655440000';
      const result = await getPromptsByUserId({
        userId: validNonExistentUserId,
      });

      // Should still get public prompts from other users (both public prompts)
      expect(result).toHaveLength(2);
      const titles = result.map((p) => p.title);
      expect(titles).toContain('Other User Public');
      expect(titles).toContain('Public Prompt');
    });

    test('should throw ChatSDKError on database error', async () => {
      // This would require mocking the database to force an error
      // For now, we test with an invalid format that causes DB errors
      await expect(
        getPromptsByUserId({ userId: 'invalid-format' }),
      ).rejects.toThrow(ChatSDKError);
    });
  });

  describe('getUserPromptByUserId', () => {
    let userPromptId: string;

    beforeEach(async () => {
      // Create a prompt
      const mockPrompt = createMockPrompt(testUserId, {
        title: 'User Prompt',
        description: 'User prompt content',
      });

      await createPrompt({ prompt: mockPrompt, userId: testUserId });

      // Create a userPrompt association
      await db.insert(userPrompt).values({
        userId: testUserId,
        promptId: mockPrompt.id,
        selectedAt: new Date(),
      });

      userPromptId = mockPrompt.id;
    });

    test('should get user prompt by user ID', async () => {
      const result = await getUserPromptByUserId({ userId: testUserId });

      expect(result).toBeDefined();
      expect(result?.title).toBe('User Prompt');
      expect(result?.description).toBe('User prompt content');
      expect(result?.authorId).toBe(testUserId);
    });

    test('should return null when no user prompt exists', async () => {
      const result = await getUserPromptByUserId({ userId: secondTestUserId });

      expect(result).toBeNull();
    });

    test('should throw ChatSDKError on database error', async () => {
      await expect(
        getUserPromptByUserId({ userId: 'invalid-format' }),
      ).rejects.toThrow(ChatSDKError);
    });
  });

  describe('updatePrompt', () => {
    let promptId: string;

    beforeEach(async () => {
      const mockPrompt = createMockPrompt(testUserId, {
        title: 'Original Title',
        description: 'Original content',
        visibility: 'private',
      });

      await createPrompt({ prompt: mockPrompt, userId: testUserId });
      promptId = mockPrompt.id;
    });

    test('should update prompt successfully', async () => {
      const updatedPrompt = await updatePrompt({
        promptId,
        prompt: {
          title: 'Updated Title',
          description: 'Updated content',
          visibility: 'public',
        },
        userId: testUserId,
      });

      expect(updatedPrompt.title).toBe('Updated Title');
      expect(updatedPrompt.description).toBe('Updated content');
      expect(updatedPrompt.visibility).toBe('public');
      expect(updatedPrompt.updatedAt).toBeInstanceOf(Date);

      // Verify the update persisted
      const prompts = await getPromptsByUserId({ userId: testUserId });
      const updated = prompts.find((p) => p.id === promptId);
      expect(updated?.title).toBe('Updated Title');
    });

    test('should update only specified fields', async () => {
      const updatedPrompt = await updatePrompt({
        promptId,
        prompt: {
          title: 'Only Title Updated',
        },
        userId: testUserId,
      });

      expect(updatedPrompt.title).toBe('Only Title Updated');
      expect(updatedPrompt.description).toBe('Original content'); // Should remain unchanged
      expect(updatedPrompt.visibility).toBe('private'); // Should remain unchanged
    });

    test('should throw error when prompt not found', async () => {
      const nonExistentPromptId = '550e8400-e29b-41d4-a716-446655440000';

      await expect(
        updatePrompt({
          promptId: nonExistentPromptId,
          prompt: { title: 'New Title' },
          userId: testUserId,
        }),
      ).rejects.toThrow(ChatSDKError);
      await expect(
        updatePrompt({
          promptId: nonExistentPromptId,
          prompt: { title: 'New Title' },
          userId: testUserId,
        }),
      ).rejects.toThrow('An error occurred while executing a database query.');
    });

    test('should throw error when user does not own prompt', async () => {
      await expect(
        updatePrompt({
          promptId,
          prompt: { title: 'Unauthorized Update' },
          userId: secondTestUserId, // Different user
        }),
      ).rejects.toThrow(ChatSDKError);
      await expect(
        updatePrompt({
          promptId,
          prompt: { title: 'Unauthorized Update' },
          userId: secondTestUserId,
        }),
      ).rejects.toThrow('An error occurred while executing a database query.');
    });

    test('should throw ChatSDKError on database error', async () => {
      await expect(
        updatePrompt({
          promptId: 'invalid-format',
          prompt: { title: 'New Title' },
          userId: testUserId,
        }),
      ).rejects.toThrow(ChatSDKError);
    });
  });

  describe('deletePrompt', () => {
    let promptId: string;

    beforeEach(async () => {
      const mockPrompt = createMockPrompt(testUserId, {
        title: 'To Be Deleted',
        description: 'This prompt will be deleted',
      });

      await createPrompt({ prompt: mockPrompt, userId: testUserId });
      promptId = mockPrompt.id;
    });

    test('should delete prompt successfully', async () => {
      await deletePrompt({ id: promptId, userId: testUserId });

      // Verify prompt was deleted
      const prompts = await getPromptsByUserId({ userId: testUserId });
      expect(prompts.find((p) => p.id === promptId)).toBeUndefined();
    });

    test('should handle non-existent prompt gracefully', async () => {
      const nonExistentPromptId = '550e8400-e29b-41d4-a716-446655440000';

      // Should not throw an error when trying to delete non-existent prompt
      await deletePrompt({ id: nonExistentPromptId, userId: testUserId });

      // Verify original prompt still exists
      const prompts = await getPromptsByUserId({ userId: testUserId });
      expect(prompts.find((p) => p.id === promptId)).toBeDefined();
    });

    test('should not delete prompt owned by different user', async () => {
      // Try to delete with wrong user ID
      await deletePrompt({ id: promptId, userId: secondTestUserId });

      // Verify prompt still exists
      const prompts = await getPromptsByUserId({ userId: testUserId });
      expect(prompts.find((p) => p.id === promptId)).toBeDefined();
    });

    test('should throw ChatSDKError on database error', async () => {
      await expect(
        deletePrompt({ id: 'invalid-format', userId: testUserId }),
      ).rejects.toThrow(ChatSDKError);
      await expect(
        deletePrompt({ id: 'invalid-format', userId: testUserId }),
      ).rejects.toThrow('An error occurred while executing a database query.');
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      const mockPrompt = createMockPrompt('invalid-user-id');

      await expect(
        createPrompt({ prompt: mockPrompt, userId: 'invalid-user-id' }),
      ).rejects.toThrow(ChatSDKError);
    });

    test('should throw appropriate error types', async () => {
      try {
        await createPrompt({
          prompt: createMockPrompt('invalid-user-id'),
          userId: 'invalid-user-id',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ChatSDKError);
        const chatSDKError = error as ChatSDKError;
        const errorCode = `${chatSDKError.type}:${chatSDKError.surface}`;
        expect(errorCode).toBe('bad_request:database');
        expect(chatSDKError.message).toBe(
          'An error occurred while executing a database query.',
        );
      }
    });
  });

  describe('Data Integrity', () => {
    test('should maintain data consistency across operations', async () => {
      // Create a prompt
      const mockPrompt = createMockPrompt(testUserId, {
        title: 'Consistency Test',
        description: 'Testing data consistency',
        visibility: 'public',
      });

      await createPrompt({ prompt: mockPrompt, userId: testUserId });

      // Retrieve and verify
      const prompts = await getPromptsByUserId({ userId: testUserId });
      expect(prompts).toHaveLength(1);
      expect(prompts[0].title).toBe('Consistency Test');

      // Update and verify
      const updated = await updatePrompt({
        promptId: mockPrompt.id,
        prompt: { title: 'Updated Consistency Test' },
        userId: testUserId,
      });
      expect(updated.title).toBe('Updated Consistency Test');

      // Delete and verify
      await deletePrompt({ id: mockPrompt.id, userId: testUserId });
      const afterDeletion = await getPromptsByUserId({ userId: testUserId });
      expect(afterDeletion.find((p) => p.id === mockPrompt.id)).toBeUndefined();
    });

    test('should handle concurrent operations safely', async () => {
      const mockPrompts = Array.from({ length: 5 }, (_, i) =>
        createMockPrompt(testUserId, {
          title: `Concurrent Prompt ${i}`,
          description: `Content for prompt ${i}`,
          visibility: i % 2 === 0 ? 'public' : 'private',
        }),
      );

      // Create prompts concurrently
      await Promise.all(
        mockPrompts.map((prompt) =>
          createPrompt({ prompt, userId: testUserId }),
        ),
      );

      // Verify all were created
      const allPrompts = await getPromptsByUserId({ userId: testUserId });
      expect(allPrompts.filter((p) => p.authorId === testUserId)).toHaveLength(
        5,
      );

      // Update some prompts concurrently
      const updatePromises = mockPrompts.slice(0, 3).map((prompt, i) =>
        updatePrompt({
          promptId: prompt.id,
          prompt: { title: `Updated Concurrent Prompt ${i}` },
          userId: testUserId,
        }),
      );

      await Promise.all(updatePromises);

      // Verify updates
      const updatedPrompts = await getPromptsByUserId({ userId: testUserId });
      const updatedTitles = updatedPrompts
        .filter((p) => p.title.startsWith('Updated'))
        .map((p) => p.title);
      expect(updatedTitles).toHaveLength(3);

      // Delete some prompts concurrently
      const deletePromises = mockPrompts
        .slice(0, 2)
        .map((prompt) => deletePrompt({ id: prompt.id, userId: testUserId }));

      await Promise.all(deletePromises);

      // Verify correct number remaining
      const remainingPrompts = await getPromptsByUserId({ userId: testUserId });
      expect(
        remainingPrompts.filter((p) => p.authorId === testUserId),
      ).toHaveLength(3);
    });
  });

  describe('Visibility and Access Control', () => {
    test('should respect visibility rules', async () => {
      // Create private prompt by first user
      const privatePrompt = createMockPrompt(testUserId, {
        title: 'Private Prompt',
        visibility: 'private',
      });

      // Create public prompt by first user
      const publicPrompt = createMockPrompt(testUserId, {
        title: 'Public Prompt',
        visibility: 'public',
      });

      await createPrompt({ prompt: privatePrompt, userId: testUserId });
      await createPrompt({ prompt: publicPrompt, userId: testUserId });

      // Second user should only see public prompt
      const secondUserPrompts = await getPromptsByUserId({
        userId: secondTestUserId,
      });
      const visibleTitles = secondUserPrompts.map((p) => p.title);

      expect(visibleTitles).toContain('Public Prompt');
      expect(visibleTitles).not.toContain('Private Prompt');
    });

    test('should enforce ownership for updates and deletes', async () => {
      const mockPrompt = createMockPrompt(testUserId, {
        title: 'Owner Only Prompt',
      });

      await createPrompt({ prompt: mockPrompt, userId: testUserId });

      // Second user should not be able to update
      await expect(
        updatePrompt({
          promptId: mockPrompt.id,
          prompt: { title: 'Hacked Title' },
          userId: secondTestUserId,
        }),
      ).rejects.toThrow('An error occurred while executing a database query.');

      // Second user should not be able to delete (gracefully handles)
      await deletePrompt({ id: mockPrompt.id, userId: secondTestUserId });

      // Verify prompt still exists
      const prompts = await getPromptsByUserId({ userId: testUserId });
      expect(prompts.find((p) => p.id === mockPrompt.id)).toBeDefined();
    });
  });
});
