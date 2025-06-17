jest.mock('server-only', () => ({}));

// Mock bcrypt-ts to avoid ESM import issues in Jest
jest.mock('bcrypt-ts', () => ({
  genSaltSync: jest.fn(() => 'mock-salt'),
  hashSync: jest.fn((password: string) => `mock-hash-${password}`),
  compare: jest.fn(() => Promise.resolve(true)),
  compareSync: jest.fn(() => true),
}));

// Mock next auth
jest.mock('@/app/(auth)/auth', () => ({
  auth: jest.fn(),
}));

import { PATCH } from './route';
import { auth } from '@/app/(auth)/auth';
import { createUser, deleteUserAccount } from '@/lib/db/queries/queries';
import { createPrompt } from '@/lib/db/queries/prompts';
import { generateRandomTestUser } from '@/tests/helpers';
import type { Prompt } from '@/lib/db/schema';

const mockAuth = auth as jest.MockedFunction<typeof auth>;

/**
 * Test utilities for creating mock prompt data
 */
const createMockPrompt = (
  authorId: string,
  overrides: Partial<Prompt> = {},
): Prompt => ({
  id: crypto.randomUUID(),
  title: 'Test Prompt for API',
  description: 'A test prompt for API integration testing',
  code: 'console.log("Test API");',
  authorId,
  visibility: 'private',
  createdAt: new Date(),
  updatedAt: new Date(),
  icon: null,
  tags: [],
  ...overrides,
});

describe('PATCH /api/prompts', () => {
  let testUserId: string;
  let testPromptId: string;

  beforeEach(async () => {
    // Create test user
    const user = generateRandomTestUser();
    const [testUser] = await createUser(user.email, user.password);
    testUserId = testUser.id;

    // Create test prompt
    const mockPrompt = createMockPrompt(testUserId);
    await createPrompt({
      prompt: mockPrompt,
      userId: testUserId,
    });
    testPromptId = mockPrompt.id;

    // Mock auth to return test user
    // @ts-ignore
    mockAuth.mockResolvedValue({
      user: { id: testUserId, email: user.email },
      session: { user: { id: testUserId, email: user.email } },
    } as any);
  });

  afterEach(async () => {
    if (testUserId) {
      await deleteUserAccount({ id: testUserId });
    }
    jest.clearAllMocks();
  });

  test('should return updated prompt object instead of just success', async () => {
    const updateData = {
      id: testPromptId,
      title: 'Updated API Test Prompt',
      description: 'Updated description via API',
      code: 'console.log("Updated via API");',
      visibility: 'public' as const,
    };

    const mockRequest = new Request('http://localhost/api/prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });

    const response = await PATCH(mockRequest);
    expect(response.status).toBe(200);

    const responseData = await response.json();

    // Should return the updated prompt object, not just { success: true }
    expect(responseData).toHaveProperty('id', testPromptId);
    expect(responseData).toHaveProperty('title', updateData.title);
    expect(responseData).toHaveProperty('description', updateData.description);
    expect(responseData).toHaveProperty('code', updateData.code);
    expect(responseData).toHaveProperty('visibility', updateData.visibility);
    expect(responseData).toHaveProperty('authorId', testUserId);
    expect(responseData).toHaveProperty('updatedAt');

    // Should NOT be the old format
    expect(responseData).not.toEqual({ success: true });
  });

  test('should handle partial updates correctly', async () => {
    const partialUpdate = {
      id: testPromptId,
      title: 'Partially Updated Title',
    };

    const mockRequest = new Request('http://localhost/api/prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partialUpdate),
    });

    const response = await PATCH(mockRequest);
    expect(response.status).toBe(200);

    const responseData = await response.json();

    expect(responseData).toHaveProperty('id', testPromptId);
    expect(responseData).toHaveProperty('title', partialUpdate.title);
    expect(responseData).toHaveProperty(
      'description',
      'A test prompt for API integration testing',
    ); // Should remain unchanged
    expect(responseData).toHaveProperty('code', 'console.log("Test API");'); // Should remain unchanged
    expect(responseData).toHaveProperty('visibility', 'private'); // Should remain unchanged
  });

  test('should return error when prompt ID is missing', async () => {
    const invalidData = {
      title: 'Missing ID',
    };

    const mockRequest = new Request('http://localhost/api/prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData),
    });

    const response = await PATCH(mockRequest);
    expect(response.status).toBe(400);

    const errorData = await response.json();
    expect(errorData.message).toBe(
      "The request couldn't be processed. Please check your input and try again.",
    );
  });

  test('should require authentication', async () => {
    // Mock auth to return null (unauthenticated)
    // @ts-ignore
    mockAuth.mockResolvedValue(null);

    const updateData = {
      id: testPromptId,
      title: 'Should Fail',
    };

    const mockRequest = new Request('http://localhost/api/prompts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData),
    });

    await expect(PATCH(mockRequest)).rejects.toThrow('Unauthorized');
  });
});
