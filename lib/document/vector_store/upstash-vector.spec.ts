import { UpstashVectorStore } from './upstash-vector';
import type { VectorStoreDocument } from './types';

// Mock the @upstash/vector module
jest.mock('@upstash/vector', () => ({
  Index: jest.fn().mockImplementation(() => ({
    upsert: jest.fn(),
    query: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe('UpstashVectorStore', () => {
  let vectorStore: UpstashVectorStore;
  let mockIndex: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    vectorStore = new UpstashVectorStore();
    mockIndex = (vectorStore as any).index;
  });

  describe('addDocument', () => {
    test('should generate unique vector store ID and store original document ID in metadata', async () => {
      const document: VectorStoreDocument = {
        id: 'doc-123',
        content: 'Test document content',
        metadata: {
          userId: 'user-456',
          key: 'test-key',
          uploadTimestamp: '2023-01-01T00:00:00Z',
          mimeType: 'text/plain',
        },
      };

      mockIndex.upsert.mockResolvedValue(undefined);

      await vectorStore.addDocument(document);

      expect(mockIndex.upsert).toHaveBeenCalledTimes(1);
      const upsertCall = mockIndex.upsert.mock.calls[0];

      // Verify that a unique ID was generated (not the same as document.id)
      expect(upsertCall[0].id).toBeDefined();
      expect(upsertCall[0].id).not.toBe(document.id);
      expect(typeof upsertCall[0].id).toBe('string');

      // Verify content is preserved
      expect(upsertCall[0].data).toBe(document.content);

      // Verify metadata includes original document ID
      expect(upsertCall[0].metadata).toEqual({
        ...document.metadata,
      });

      // Verify namespace is used
      expect(upsertCall[1]).toEqual({
        namespace: 'document',
      });
    });
  });

  describe('deleteDocument', () => {
    test('should use filter to delete by documentId metadata instead of direct ID', async () => {
      const documentId = 'doc-123';

      mockIndex.delete.mockResolvedValue(undefined);

      await vectorStore.deleteDocument(documentId);

      expect(mockIndex.delete).toHaveBeenCalledTimes(1);
      expect(mockIndex.delete).toHaveBeenCalledWith(
        {
          filter: `documentId = "${documentId}"`,
        },
        {
          namespace: 'document',
        },
      );
    });
  });

  describe('searchDocument', () => {
    test('should return documents with original document IDs from metadata', async () => {
      const query = 'test query';
      const mockResults = [
        {
          id: 'vector-id-1',
          data: 'Test content 1',
          metadata: {
            userId: 'user-456',
            key: 'test-key-1',
            uploadTimestamp: '2023-01-01T00:00:00Z',
            mimeType: 'text/plain',
            documentId: 'doc-123',
          },
        },
        {
          id: 'vector-id-2',
          data: 'Test content 2',
          metadata: {
            userId: 'user-456',
            key: 'test-key-2',
            uploadTimestamp: '2023-01-02T00:00:00Z',
            mimeType: 'text/plain',
            documentId: 'doc-456',
          },
        },
      ];

      mockIndex.query.mockResolvedValue(mockResults);

      const results = await vectorStore.searchDocument(query, { limit: 10 });

      expect(mockIndex.query).toHaveBeenCalledTimes(1);
      expect(mockIndex.query).toHaveBeenCalledWith(
        {
          data: query,
          topK: 10,
          includeMetadata: true,
          includeData: true,
        },
        {
          namespace: 'document',
        },
      );

      // Verify results contain original document IDs from metadata
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('doc-123'); // Original document ID from metadata
      expect(results[0].content).toBe('Test content 1');
      expect(results[1].id).toBe('doc-456'); // Original document ID from metadata
      expect(results[1].content).toBe('Test content 2');
    });

    test('should handle search with userId filter', async () => {
      const query = 'test query';
      const userId = 'user-456';

      mockIndex.query.mockResolvedValue([]);

      await vectorStore.searchDocument(query, { limit: 5, userId });

      expect(mockIndex.query).toHaveBeenCalledWith(
        {
          data: query,
          topK: 5,
          includeMetadata: true,
          includeData: true,
          filter: `userId = "${userId}"`,
        },
        {
          namespace: 'document',
        },
      );
    });
  });
});
