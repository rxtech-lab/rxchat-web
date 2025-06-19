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
  getDocumentsForUser,
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
  visibility: 'private',
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
      const result = await getDocumentsByIds({
        ids: documentIds,
        userId: testUserId,
      });

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
        userId: testUserId,
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
      const result = await getDocumentsByIds({
        ids: mixedIds,
        userId: testUserId,
      });

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
      const result = await getDocumentsByIds({
        ids: documentIds,
        userId: testUserId,
      });

      expect(result).toHaveLength(2);
      // First result should be more recent (Document 2)
      expect(result[0].content).toBe('Document 2');
      expect(result[1].content).toBe('Document 1');
    });
  });

  describe('getDocumentsByIds with visibility logic', () => {
    let testUser2Id: string;
    let ownPrivateDocId: string;
    let ownPublicDocId: string;
    let otherPrivateDocId: string;
    let otherPublicDocId: string;
    let allDocIds: string[] = [];

    beforeEach(async () => {
      // Create a second test user
      const user2 = generateRandomTestUser();
      const [testUser2] = await createUser(user2.email, user2.password);
      testUser2Id = testUser2.id;

      // Create own private document
      const ownPrivateDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Own Private Document',
          visibility: 'private',
        }),
      );
      ownPrivateDocId = ownPrivateDoc.id;

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create own public document
      const ownPublicDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Own Public Document',
          visibility: 'public',
        }),
      );
      ownPublicDocId = ownPublicDoc.id;

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create other user's private document
      const otherPrivateDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUser2Id, {
          content: 'Other Private Document',
          visibility: 'private',
        }),
      );
      otherPrivateDocId = otherPrivateDoc.id;

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create other user's public document
      const otherPublicDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUser2Id, {
          content: 'Other Public Document',
          visibility: 'public',
        }),
      );
      otherPublicDocId = otherPublicDoc.id;

      allDocIds = [
        ownPrivateDocId,
        ownPublicDocId,
        otherPrivateDocId,
        otherPublicDocId,
      ];
    });

    afterEach(async () => {
      // Clean up all created documents and users
      if (allDocIds.length > 0) {
        await deleteDocumentsByIds({ ids: allDocIds });
        allDocIds = [];
      }
      if (testUser2Id) {
        await deleteUserAccount({ id: testUser2Id });
      }
    });

    test('should return own documents (both private and public) when userId provided', async () => {
      const result = await getDocumentsByIds({
        ids: [ownPrivateDocId, ownPublicDocId],
        userId: testUserId,
      });

      expect(result).toHaveLength(2);
      const contents = result.map((doc) => doc.content);
      expect(contents).toContain('Own Private Document');
      expect(contents).toContain('Own Public Document');
    });

    test('should return only public documents from other users when userId provided', async () => {
      const result = await getDocumentsByIds({
        ids: [otherPrivateDocId, otherPublicDocId],
        userId: testUserId,
      });

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('Other Public Document');
      expect(result[0].visibility).toBe('public');
    });

    test('should return mix of own documents and public documents from others', async () => {
      const result = await getDocumentsByIds({
        ids: allDocIds,
        userId: testUserId,
      });

      expect(result).toHaveLength(3);
      const contents = result.map((doc) => doc.content).sort();
      expect(contents).toEqual([
        'Other Public Document',
        'Own Private Document',
        'Own Public Document',
      ]);
    });

    test('should return only public documents when no userId provided', async () => {
      const result = await getDocumentsByIds({
        ids: allDocIds,
      });

      expect(result).toHaveLength(2);
      const contents = result.map((doc) => doc.content).sort();
      expect(contents).toEqual([
        'Other Public Document',
        'Own Public Document',
      ]);
      expect(result.every((doc) => doc.visibility === 'public')).toBe(true);
    });

    test('should respect status filter along with visibility logic', async () => {
      // Create a pending public document
      const pendingPublicDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Pending Public Document',
          visibility: 'public',
          status: 'pending',
        }),
      );

      const testIds = [ownPublicDocId, otherPublicDocId, pendingPublicDoc.id];

      // Should only return completed documents
      const result = await getDocumentsByIds({
        ids: testIds,
        status: 'completed',
        userId: testUserId,
      });

      expect(result).toHaveLength(2);
      const contents = result.map((doc) => doc.content).sort();
      expect(contents).toEqual([
        'Other Public Document',
        'Own Public Document',
      ]);
      expect(result.every((doc) => doc.status === 'completed')).toBe(true);

      // Clean up
      await deleteDocumentById({ id: pendingPublicDoc.id });
    });

    test('should return empty array when user has no access to any documents', async () => {
      // Test with documents that belong to another user and are private
      const result = await getDocumentsByIds({
        ids: [otherPrivateDocId],
        userId: testUserId,
      });

      expect(result).toHaveLength(0);
    });

    test('should handle mixed scenarios with status and visibility filters', async () => {
      // Create additional test documents with different statuses
      const ownPendingPrivateDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Own Pending Private Document',
          visibility: 'private',
          status: 'pending',
        }),
      );

      const otherFailedPublicDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUser2Id, {
          content: 'Other Failed Public Document',
          visibility: 'public',
          status: 'failed',
        }),
      );

      const testIds = [
        ownPrivateDocId, // completed, private, own
        ownPublicDocId, // completed, public, own
        otherPublicDocId, // completed, public, other
        ownPendingPrivateDoc.id, // pending, private, own
        otherFailedPublicDoc.id, // failed, public, other
      ];

      // Test with completed status
      const completedResult = await getDocumentsByIds({
        ids: testIds,
        status: 'completed',
        userId: testUserId,
      });

      expect(completedResult).toHaveLength(3);
      expect(completedResult.every((doc) => doc.status === 'completed')).toBe(
        true,
      );

      // Test with pending status
      const pendingResult = await getDocumentsByIds({
        ids: testIds,
        status: 'pending',
        userId: testUserId,
      });

      expect(pendingResult).toHaveLength(1);
      expect(pendingResult[0].content).toBe('Own Pending Private Document');

      // Test with failed status
      const failedResult = await getDocumentsByIds({
        ids: testIds,
        status: 'failed',
        userId: testUserId,
      });

      expect(failedResult).toHaveLength(1);
      expect(failedResult[0].content).toBe('Other Failed Public Document');

      // Clean up additional documents
      await deleteDocumentsByIds({
        ids: [ownPendingPrivateDoc.id, otherFailedPublicDoc.id],
      });
    });

    test('should maintain proper ordering with visibility logic', async () => {
      // All documents should still be ordered by createdAt DESC
      const result = await getDocumentsByIds({
        ids: allDocIds,
        userId: testUserId,
      });

      expect(result).toHaveLength(3);
      // Should be ordered by creation time (newest first)
      expect(result[0].content).toBe('Other Public Document'); // Created last
      expect(result[1].content).toBe('Own Public Document');
      expect(result[2].content).toBe('Own Private Document'); // Created first
    });
  });

  describe('getDocumentsForUser', () => {
    let testUser2Id: string;
    let ownPrivateDocId: string;
    let ownPublicDocId: string;
    let ownPendingDocId: string;
    let otherPrivateDocId: string;
    let otherPublicDocId: string;
    let otherPendingDocId: string;
    let allDocIds: string[] = [];

    beforeEach(async () => {
      // Create a second test user
      const user2 = generateRandomTestUser();
      const [testUser2] = await createUser(user2.email, user2.password);
      testUser2Id = testUser2.id;

      // Create own private document
      const ownPrivateDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Own Private Document',
          visibility: 'private',
          status: 'completed',
        }),
      );
      ownPrivateDocId = ownPrivateDoc.id;

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create own public document
      const ownPublicDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Own Public Document',
          visibility: 'public',
          status: 'completed',
        }),
      );
      ownPublicDocId = ownPublicDoc.id;

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create own pending document (should be excluded)
      const ownPendingDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUserId, {
          content: 'Own Pending Document',
          visibility: 'public',
          status: 'pending',
        }),
      );
      ownPendingDocId = ownPendingDoc.id;

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create other user's private document (should be excluded)
      const otherPrivateDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUser2Id, {
          content: 'Other Private Document',
          visibility: 'private',
          status: 'completed',
        }),
      );
      otherPrivateDocId = otherPrivateDoc.id;

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create other user's public document (should be included)
      const otherPublicDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUser2Id, {
          content: 'Other Public Document',
          visibility: 'public',
          status: 'completed',
        }),
      );
      otherPublicDocId = otherPublicDoc.id;

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create other user's pending public document (should be excluded)
      const otherPendingDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUser2Id, {
          content: 'Other Pending Public Document',
          visibility: 'public',
          status: 'pending',
        }),
      );
      otherPendingDocId = otherPendingDoc.id;

      allDocIds = [
        ownPrivateDocId,
        ownPublicDocId,
        ownPendingDocId,
        otherPrivateDocId,
        otherPublicDocId,
        otherPendingDocId,
      ];
    });

    afterEach(async () => {
      // Clean up all created documents and users
      if (allDocIds.length > 0) {
        await deleteDocumentsByIds({ ids: allDocIds });
        allDocIds = [];
      }
      if (testUser2Id) {
        await deleteUserAccount({ id: testUser2Id });
      }
    });

    test('should return own documents and public documents from others', async () => {
      const result = await getDocumentsForUser({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      // Should include: own private, own public, other public
      // Should exclude: own pending, other private, other pending
      expect(result.docs).toHaveLength(3);
      expect(result.hasMore).toBe(false);

      const contents = result.docs.map((doc) => doc.content).sort();
      expect(contents).toEqual([
        'Other Public Document',
        'Own Private Document',
        'Own Public Document',
      ]);

      // Verify no pending documents are included
      expect(result.docs.every((doc) => doc.status !== 'pending')).toBe(true);
    });

    test('should order results by createdAt DESC', async () => {
      const result = await getDocumentsForUser({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.docs).toHaveLength(3);
      // Should be ordered by creation time (newest first)
      expect(result.docs[0].content).toBe('Other Public Document'); // Created last
      expect(result.docs[1].content).toBe('Own Public Document');
      expect(result.docs[2].content).toBe('Own Private Document'); // Created first
    });

    test('should limit results correctly', async () => {
      const result = await getDocumentsForUser({
        userId: testUserId,
        limit: 2,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.docs).toHaveLength(2);
      expect(result.hasMore).toBe(true);
      expect(result.docs[0].content).toBe('Other Public Document');
      expect(result.docs[1].content).toBe('Own Public Document');
    });

    test('should handle pagination with endingBefore', async () => {
      // Get the first document (most recent)
      const firstResult = await getDocumentsForUser({
        userId: testUserId,
        limit: 1,
        startingAfter: null,
        endingBefore: null,
      });

      expect(firstResult.docs).toHaveLength(1);
      expect(firstResult.docs[0].content).toBe('Other Public Document');

      // Get documents before the first one
      const secondResult = await getDocumentsForUser({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: firstResult.docs[0].id,
      });

      expect(secondResult.docs).toHaveLength(2);
      expect(secondResult.hasMore).toBe(false);
      expect(secondResult.docs[0].content).toBe('Own Public Document');
      expect(secondResult.docs[1].content).toBe('Own Private Document');
      expect(
        secondResult.docs.every((doc) => doc.id !== firstResult.docs[0].id),
      ).toBe(true);
    });

    test('should handle pagination with startingAfter', async () => {
      // Get the first document (newest)
      const firstResult = await getDocumentsForUser({
        userId: testUserId,
        limit: 1,
        startingAfter: null,
        endingBefore: null,
      });

      expect(firstResult.docs).toHaveLength(1);
      expect(firstResult.docs[0].content).toBe('Other Public Document');

      // Get documents after the first one (older documents)
      const afterResult = await getDocumentsForUser({
        userId: testUserId,
        limit: 10,
        startingAfter: firstResult.docs[0].id,
        endingBefore: null,
      });

      // Since startingAfter looks for documents created AFTER the specified doc,
      // and we're using the newest doc, there should be no newer documents
      expect(afterResult.docs).toHaveLength(0);
      expect(afterResult.hasMore).toBe(false);
    });

    test('should return only public documents for user with no own documents', async () => {
      // Create a third user with no documents
      const user3 = generateRandomTestUser();
      const [testUser3] = await createUser(user3.email, user3.password);

      const result = await getDocumentsForUser({
        userId: testUser3.id,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      // Should only see public documents from other users (at least 1, could be more from other tests)
      expect(result.docs.length).toBeGreaterThanOrEqual(1);
      expect(result.docs.every((doc) => doc.visibility === 'public')).toBe(
        true,
      );
      expect(result.docs.every((doc) => doc.userId !== testUser3.id)).toBe(
        true,
      );

      // Verify we can see our test public documents
      const contents = result.docs.map((doc) => doc.content);
      expect(contents).toContain('Other Public Document');

      // Clean up third user
      await deleteUserAccount({ id: testUser3.id });
    });

    test('should throw error for invalid endingBefore document id', async () => {
      await expect(
        getDocumentsForUser({
          userId: testUserId,
          limit: 10,
          startingAfter: null,
          endingBefore: 'invalid-document-id',
        }),
      ).rejects.toThrow(ChatSDKError);
    });

    test('should throw error for invalid startingAfter document id', async () => {
      await expect(
        getDocumentsForUser({
          userId: testUserId,
          limit: 10,
          startingAfter: 'invalid-document-id',
          endingBefore: null,
        }),
      ).rejects.toThrow(ChatSDKError);
    });

    test('should exclude all pending documents regardless of ownership', async () => {
      const result = await getDocumentsForUser({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.docs).toHaveLength(3);
      // Verify none of the pending documents are included
      const docIds = result.docs.map((doc) => doc.id);
      expect(docIds).not.toContain(ownPendingDocId);
      expect(docIds).not.toContain(otherPendingDocId);
      expect(result.docs.every((doc) => doc.status !== 'pending')).toBe(true);
    });

    test('should handle complex pagination scenarios', async () => {
      // Test pagination in the middle of results
      const firstResult = await getDocumentsForUser({
        userId: testUserId,
        limit: 1,
        startingAfter: null,
        endingBefore: null,
      });

      const middleResult = await getDocumentsForUser({
        userId: testUserId,
        limit: 1,
        startingAfter: null,
        endingBefore: firstResult.docs[0].id,
      });

      const lastResult = await getDocumentsForUser({
        userId: testUserId,
        limit: 1,
        startingAfter: null,
        endingBefore: middleResult.docs[0].id,
      });

      expect(firstResult.docs).toHaveLength(1);
      expect(middleResult.docs).toHaveLength(1);
      expect(lastResult.docs).toHaveLength(1);

      expect(firstResult.docs[0].content).toBe('Other Public Document');
      expect(middleResult.docs[0].content).toBe('Own Public Document');
      expect(lastResult.docs[0].content).toBe('Own Private Document');

      // All should have hasMore true except potentially the last one depending on total count
      expect(firstResult.hasMore).toBe(true);
      expect(middleResult.hasMore).toBe(true);
      expect(lastResult.hasMore).toBe(false);
    });

    test('should include documents from multiple users correctly', async () => {
      // Create a third user with public documents
      const user3 = generateRandomTestUser();
      const [testUser3] = await createUser(user3.email, user3.password);

      const user3PublicDoc = await createVectorStoreDocument(
        createMockVectorStoreDocument(testUser3.id, {
          content: 'User3 Public Document',
          visibility: 'public',
          status: 'completed',
        }),
      );

      const result = await getDocumentsForUser({
        userId: testUserId,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.docs).toHaveLength(4);
      const contents = result.docs.map((doc) => doc.content).sort();
      expect(contents).toEqual([
        'Other Public Document',
        'Own Private Document',
        'Own Public Document',
        'User3 Public Document',
      ]);

      // Clean up
      await deleteDocumentById({ id: user3PublicDoc.id });
      await deleteUserAccount({ id: testUser3.id });
    });

    test('should handle edge case with exact limit matching available documents', async () => {
      const result = await getDocumentsForUser({
        userId: testUserId,
        limit: 3, // Exactly the number of available documents
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.docs).toHaveLength(3);
      expect(result.hasMore).toBe(false);
    });

    test('should be consistent with visibility rules across different users', async () => {
      // Test from testUser2's perspective
      const user2Result = await getDocumentsForUser({
        userId: testUser2Id,
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      // Should include: testUser2's own documents (both private and public) + public docs from others
      // Should exclude: testUser's private documents, all pending documents
      expect(user2Result.docs.length).toBeGreaterThanOrEqual(2);

      // Filter to only our test documents to avoid interference from other tests
      const testDocuments = user2Result.docs.filter(
        (doc) =>
          [testUserId, testUser2Id].includes(doc.userId) &&
          [
            'Own Private Document',
            'Own Public Document',
            'Other Public Document',
            'Other Private Document',
          ].includes(doc.content || ''),
      );

      expect(testDocuments).toHaveLength(3);

      const contents = testDocuments.map((doc) => doc.content).sort();
      expect(contents).toEqual([
        'Other Private Document', // testUser2's own private document
        'Other Public Document', // testUser2's own public document
        'Own Public Document', // testUser's public document (visible to testUser2)
      ]);

      // Verify visibility rules: testUser2 can see own documents + public docs from others
      const ownDocs = testDocuments.filter((doc) => doc.userId === testUser2Id);
      const otherPublicDocs = testDocuments.filter(
        (doc) => doc.userId !== testUser2Id,
      );

      expect(ownDocs).toHaveLength(2); // Own private + own public
      expect(otherPublicDocs).toHaveLength(1); // Only public from testUser
      expect(otherPublicDocs.every((doc) => doc.visibility === 'public')).toBe(
        true,
      );
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
      const remainingDocs = await getDocumentsByIds({
        ids: documentIds,
        userId: testUserId,
      });
      expect(remainingDocs).toHaveLength(1);
      expect(remainingDocs[0].id).toBe(documentIds[2]);
    });

    test('should handle empty ids array gracefully', async () => {
      await expect(deleteDocumentsByIds({ ids: [] })).resolves.toBeUndefined();

      // Verify no documents were deleted
      const allDocs = await getDocumentsByIds({
        ids: documentIds,
        userId: testUserId,
      });
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
      const remainingDocs = await getDocumentsByIds({
        ids: documentIds,
        userId: testUserId,
      });
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
      const docs = await getDocumentsByIds({
        ids: [documentId],
        userId: testUserId,
      });
      expect(docs).toHaveLength(1);
    });

    test('should verify document deletion completely', async () => {
      // First verify document exists
      const beforeDeletion = await getDocumentsByIds({
        ids: [documentId],
        userId: testUserId,
      });
      expect(beforeDeletion).toHaveLength(1);

      // Delete the document
      await deleteDocumentById({ id: documentId });

      // Verify document no longer exists
      const afterDeletion = await getDocumentsByIds({
        ids: [documentId],
        userId: testUserId,
      });
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
      const docsById = await getDocumentsByIds({
        ids: [createdDoc.id],
        userId: testUserId,
      });
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
