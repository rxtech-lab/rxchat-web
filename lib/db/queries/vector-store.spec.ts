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
  createVectorStoreDocument,
  getDocumentsByUserId,
  getDocumentsByIds,
  deleteDocumentsByIds,
  deleteDocumentById,
} from './vector-store';
import { createUser, deleteUserAccount } from './queries';
import { ChatSDKError } from '@/lib/errors';
import type { VectorStoreDocument } from '../schema';
import { generateRandomTestUser } from '@/tests/helpers';

/**
 * Test utilities for creating mock data
 */
const createMockVectorStoreDocument = (
  userId: string,
  overrides: Partial<VectorStoreDocument> = {},
): VectorStoreDocument => ({
  content: 'This is a test document content for vector store.',
  userId,
  key: `test-key-${generateId()}`,
  originalFileName: 'test-document.txt',
  mimeType: 'text/plain',
  size: 1024,
  id: crypto.randomUUID(),
  createdAt: new Date(),
  status: 'completed',
  sha256: null, // Add the new SHA256 field as nullable
  ...overrides,
});

describe('Vector Store Queries', () => {
  let testUserId: string;

  /**
   * Creates a test user before each test
   */
  beforeEach(async () => {
    const user = generateRandomTestUser();
    const [testUser] = await createUser(user.email, user.password);
    testUserId = testUser.id;
  });

  /**
   * Cleans up test user and associated data after each test
   */
  afterEach(async () => {
    if (testUserId) {
      await deleteUserAccount({ id: testUserId });
    }
  });

  afterAll(() => {
    // Cleanup database connections or any global state if needed
    jest.clearAllMocks();
    db.$client.end();
  });

  describe('createVectorStoreDocument', () => {
    test('should create a vector store document successfully', async () => {
      const mockDoc = createMockVectorStoreDocument(testUserId);

      const result = await createVectorStoreDocument(mockDoc);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toBe(mockDoc.content);
      expect(result.userId).toBe(testUserId);
      expect(result.key).toBe(mockDoc.key);
      expect(result.originalFileName).toBe(mockDoc.originalFileName);
      expect(result.mimeType).toBe(mockDoc.mimeType);
      expect(result.size).toBe(mockDoc.size);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    test('should create a document with unique key', async () => {
      const mockDoc1 = createMockVectorStoreDocument(testUserId, {
        key: 'unique-key-1',
      });
      const mockDoc2 = createMockVectorStoreDocument(testUserId, {
        key: 'unique-key-2',
      });

      const result1 = await createVectorStoreDocument(mockDoc1);
      const result2 = await createVectorStoreDocument(mockDoc2);

      expect(result1.key).toBe('unique-key-1');
      expect(result2.key).toBe('unique-key-2');
      expect(result1.id).not.toBe(result2.id);
    });

    test('should throw ChatSDKError when database operation fails', async () => {
      // Create document with invalid userId (non-existent user)
      const mockDoc = createMockVectorStoreDocument('invalid-user-id');

      await expect(createVectorStoreDocument(mockDoc)).rejects.toThrow(
        ChatSDKError,
      );
      await expect(createVectorStoreDocument(mockDoc)).rejects.toThrow(
        'An error occurred while executing a database query.',
      );
    });
  });

  describe('getDocumentsByUserId', () => {
    let documentIds: string[] = [];

    beforeEach(async () => {
      // Create multiple test documents with slight delays to ensure ordering
      const doc1 = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {}),
      );
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const doc2 = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Second document',
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 10));

      const doc3 = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Third document',
        }),
      );

      // Store document IDs for later cleanup
      documentIds = [doc1.id, doc2.id, doc3.id];
    });

    // Clean up created documents after each test
    afterEach(async () => {
      if (documentIds.length > 0) {
        await deleteDocumentsByIds({ ids: documentIds });
        documentIds = [];
      }
    });

    test('should get all documents for a user without pagination', async () => {
      const result = await getDocumentsByUserId({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.docs).toHaveLength(3);
      expect(result.hasMore).toBe(false);
      expect(result.docs[0].userId).toBe(testUserId);
      // Documents should be ordered by createdAt DESC
      expect(result.docs[0].content).toBe('Third document'); // Latest created
    });

    test('should limit results correctly', async () => {
      const result = await getDocumentsByUserId({
        userId: testUserId,
        limit: 2,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.docs).toHaveLength(2);
      expect(result.hasMore).toBe(true);
    });

    test('should handle pagination with endingBefore', async () => {
      // Get the first document (most recent)
      const firstResult = await getDocumentsByUserId({
        userId: testUserId,
        limit: 1,
        startingAfter: null,
        endingBefore: null,
      });

      // Get documents before the first one
      const secondResult = await getDocumentsByUserId({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: firstResult.docs[0].id,
      });

      expect(secondResult.docs.length).toBeGreaterThan(0);
      expect(
        secondResult.docs.every((doc) => doc.id !== firstResult.docs[0].id),
      ).toBe(true);
    });

    test('should return empty result for non-existent user', async () => {
      // Use a valid UUID format for non-existent user to avoid database format errors
      const validNonExistentUserId = '550e8400-e29b-41d4-a716-446655440000';
      const result = await getDocumentsByUserId({
        userId: validNonExistentUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.docs).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    test('should throw error for invalid endingBefore document id', async () => {
      await expect(
        getDocumentsByUserId({
          userId: testUserId,
          limit: 10,
          startingAfter: null,
          endingBefore: 'invalid-document-id',
        }),
      ).rejects.toThrow(ChatSDKError);
    });
  });

  describe('getDocumentsByIds', () => {
    let documentIds: string[] = [];
    let doc3: VectorStoreDocument;

    beforeEach(async () => {
      // Create test documents
      const doc1 = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Document 1',
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 10));

      const doc2 = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Document 2',
        }),
      );

      doc3 = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Document 3',
          status: 'pending',
        }),
      );

      documentIds = [doc1.id, doc2.id];
    });

    // Clean up created documents after each test
    afterEach(async () => {
      if (documentIds.length > 0) {
        await deleteDocumentsByIds({ ids: documentIds });
        documentIds = [];
      }
    });

    test('should get documents by their IDs', async () => {
      const result = await getDocumentsByIds({ ids: documentIds });

      expect(result).toHaveLength(2);
      expect(result.map((doc) => doc.id)).toEqual(
        expect.arrayContaining(documentIds),
      );
      expect(result[0].content).toMatch(/Document [12]/);
    });

    test('should return empty array for empty ids array', async () => {
      const result = await getDocumentsByIds({ ids: [] });

      expect(result).toEqual([]);
    });

    test('should return only complete docs', async () => {
      const result = await getDocumentsByIds({
        ids: [...documentIds, doc3.id],
        status: 'completed',
      });

      expect(result).toHaveLength(2);
    });

    test('should return only existing documents for mixed valid/invalid IDs', async () => {
      // Use valid UUID format for non-existent IDs to avoid database format errors
      const mixedIds = [
        ...documentIds,
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
      ];
      const result = await getDocumentsByIds({ ids: mixedIds });

      expect(result).toHaveLength(2);
      expect(result.map((doc) => doc.id)).toEqual(
        expect.arrayContaining(documentIds),
      );
    });

    test('should return empty array for all invalid IDs', async () => {
      // Use valid UUID format for non-existent IDs to avoid database format errors
      const result = await getDocumentsByIds({
        ids: [
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
        ],
      });

      expect(result).toEqual([]);
    });

    test('should order results by createdAt DESC', async () => {
      const result = await getDocumentsByIds({ ids: documentIds });

      expect(result).toHaveLength(2);
      // First result should be more recent (Document 2)
      expect(result[0].content).toBe('Document 2');
      expect(result[1].content).toBe('Document 1');
    });
  });

  describe('deleteDocumentsByIds', () => {
    let documentIds: string[] = [];

    beforeEach(async () => {
      // Create test documents
      const docs = await Promise.all([
        createVectorStoreDocument(createMockVectorStoreDocument(testUserId)),
        createVectorStoreDocument(createMockVectorStoreDocument(testUserId)),
        createVectorStoreDocument(createMockVectorStoreDocument(testUserId)),
      ]);
      documentIds = docs.map((doc) => doc.id);
    });

    test('should delete documents by their IDs', async () => {
      const idsToDelete = documentIds.slice(0, 2);

      await deleteDocumentsByIds({ ids: idsToDelete });

      // Verify documents were deleted
      const remainingDocs = await getDocumentsByIds({ ids: documentIds });
      expect(remainingDocs).toHaveLength(1);
      expect(remainingDocs[0].id).toBe(documentIds[2]);
    });

    test('should handle empty ids array gracefully', async () => {
      await expect(deleteDocumentsByIds({ ids: [] })).resolves.toBeUndefined();

      // Verify no documents were deleted
      const allDocs = await getDocumentsByIds({ ids: documentIds });
      expect(allDocs).toHaveLength(3);
    });

    test('should handle non-existent IDs gracefully', async () => {
      // Use valid UUID format for non-existent IDs to avoid database format errors
      const mixedIds = [
        documentIds[0],
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
      ];

      await expect(
        deleteDocumentsByIds({ ids: mixedIds }),
      ).resolves.toBeDefined();

      // Verify only the valid document was deleted
      const remainingDocs = await getDocumentsByIds({ ids: documentIds });
      expect(remainingDocs).toHaveLength(2);
      expect(remainingDocs.map((doc) => doc.id)).not.toContain(documentIds[0]);
    });

    test('should delete all documents when all IDs provided', async () => {
      await deleteDocumentsByIds({ ids: documentIds });

      // Verify all documents were deleted
      const remainingDocs = await getDocumentsByIds({ ids: documentIds });
      expect(remainingDocs).toHaveLength(0);
    });
  });

  describe('deleteDocumentById', () => {
    let documentId: string;

    beforeEach(async () => {
      const doc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId),
      );
      documentId = doc.id;
    });

    test('should delete a document by its ID', async () => {
      await deleteDocumentById({ id: documentId });

      // Verify document was deleted
      const docs = await getDocumentsByIds({ ids: [documentId] });
      expect(docs).toHaveLength(0);
    });

    test('should handle non-existent document ID gracefully', async () => {
      // Use valid UUID format for non-existent ID to avoid database format errors
      await expect(
        deleteDocumentById({
          id: '550e8400-e29b-41d4-a716-446655440000',
        }),
      ).resolves.toBeUndefined();

      // Verify original document still exists
      const docs = await getDocumentsByIds({ ids: [documentId] });
      expect(docs).toHaveLength(1);
    });

    test('should verify document deletion completely', async () => {
      // First verify document exists
      const beforeDeletion = await getDocumentsByIds({ ids: [documentId] });
      expect(beforeDeletion).toHaveLength(1);

      // Delete the document
      await deleteDocumentById({ id: documentId });

      // Verify document no longer exists
      const afterDeletion = await getDocumentsByIds({ ids: [documentId] });
      expect(afterDeletion).toHaveLength(0);

      // Also verify via user query
      const userDocs = await getDocumentsByUserId({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });
      expect(userDocs.docs).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      // Note: This would require mocking the database connection
      // For now, we test the error types that are actually thrown
      const mockDoc = createMockVectorStoreDocument('invalid-user-id');

      await expect(createVectorStoreDocument(mockDoc)).rejects.toThrow(
        ChatSDKError,
      );
    });

    test('should throw appropriate error types', async () => {
      try {
        await createVectorStoreDocument(
          createMockVectorStoreDocument('invalid-user-id'),
        );
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
      // Create a document
      const mockDoc = createMockVectorStoreDocument(testUserId, {
        content: 'Consistency test document',
        key: 'consistency-test-key',
      });

      const createdDoc = await createVectorStoreDocument(mockDoc);

      // Retrieve by user ID
      const userDocs = await getDocumentsByUserId({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });
      expect(userDocs.docs).toHaveLength(1);
      expect(userDocs.docs[0].id).toBe(createdDoc.id);

      // Retrieve by ID
      const docsById = await getDocumentsByIds({ ids: [createdDoc.id] });
      expect(docsById).toHaveLength(1);
      expect(docsById[0]).toEqual(createdDoc);

      // Delete and verify consistency
      await deleteDocumentById({ id: createdDoc.id });

      const afterDeletion = await getDocumentsByUserId({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });
      expect(afterDeletion.docs).toHaveLength(0);
    });

    test('should handle concurrent operations safely', async () => {
      const mockDocs = Array.from({ length: 5 }, (_, i) =>
        createMockVectorStoreDocument(testUserId, {
          content: `Concurrent document ${i}`,
          key: `concurrent-key-${i}`,
        }),
      );

      // Create documents concurrently
      const createdDocs = await Promise.all(
        mockDocs.map((doc) => createVectorStoreDocument(doc)),
      );

      expect(createdDocs).toHaveLength(5);
      expect(new Set(createdDocs.map((doc) => doc.id)).size).toBe(5); // All unique IDs

      // Query all documents
      const allDocs = await getDocumentsByUserId({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });
      expect(allDocs.docs).toHaveLength(5);

      // Delete some documents concurrently
      const idsToDelete = createdDocs.slice(0, 3).map((doc) => doc.id);
      await Promise.all([
        deleteDocumentById({ id: idsToDelete[0] }),
        deleteDocumentById({ id: idsToDelete[1] }),
        deleteDocumentById({ id: idsToDelete[2] }),
      ]);

      // Verify correct number remaining
      const remainingDocs = await getDocumentsByUserId({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });
      expect(remainingDocs.docs).toHaveLength(2);
    });
  });
});
