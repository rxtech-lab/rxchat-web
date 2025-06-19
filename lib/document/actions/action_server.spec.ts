jest.mock('@/app/(auth)/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/ai/providers', () => ({
  getModelProvider: jest.fn(),
}));

jest.mock('@/lib/document/markitdown', () => ({
  createMarkitdownClient: jest.fn(),
}));

jest.mock('@/lib/document/vector_store', () => ({
  createVectorStoreClient: jest.fn(),
}));

jest.mock('@/lib/s3/index', () => ({
  createS3Client: jest.fn(),
}));

jest.mock('@/lib/utils.server', () => ({
  calculateSha256FromUrl: jest.fn(),
}));

jest.mock('@vercel/analytics/server', () => ({
  track: jest.fn(),
}));

jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

import { auth } from '@/app/(auth)/auth';
import { getModelProvider } from '@/lib/ai/providers';
import { createMarkitdownClient } from '@/lib/document/markitdown';
import { createVectorStoreClient } from '@/lib/document/vector_store';
import { createS3Client } from '@/lib/s3/index';
import { calculateSha256FromUrl } from '@/lib/utils.server';
import { track } from '@vercel/analytics/server';
import { generateText } from 'ai';
import {
  getPresignedUploadUrl,
  listDocuments,
  searchDocuments,
  searchDocumentsById,
  completeDocumentUpload,
  deleteDocument,
  renameDocument,
  getPresignedDownloadUrl,
  getDocumentContent,
  toggleDocumentVisibility,
} from './action_server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetModelProvider = getModelProvider as jest.MockedFunction<
  typeof getModelProvider
>;
const mockCreateMarkitdownClient =
  createMarkitdownClient as jest.MockedFunction<typeof createMarkitdownClient>;
const mockCreateVectorStoreClient =
  createVectorStoreClient as jest.MockedFunction<
    typeof createVectorStoreClient
  >;
const mockCreateS3Client = createS3Client as jest.MockedFunction<
  typeof createS3Client
>;
const mockCalculateSha256FromUrl =
  calculateSha256FromUrl as jest.MockedFunction<typeof calculateSha256FromUrl>;
const mockTrack = track as jest.MockedFunction<typeof track>;
const mockGenerateText = generateText as jest.MockedFunction<
  typeof generateText
>;

// Mock session object
const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
  },
};

// Mock S3 client
const mockS3Client = {
  generatePresignedUrl: jest.fn(),
  deleteObject: jest.fn(),
};

// Mock markitdown client
const mockMarkitdownClient = {
  convertUrl: jest.fn(),
};

// Mock vector store client
const mockVectorStoreClient = {
  similaritySearch: jest.fn(),
  addDocuments: jest.fn(),
  delete: jest.fn(),
};

describe('Document Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockAuth.mockResolvedValue(mockSession as any);
    mockCreateS3Client.mockReturnValue(mockS3Client as any);
    mockCreateMarkitdownClient.mockReturnValue(mockMarkitdownClient as any);
    mockCreateVectorStoreClient.mockReturnValue(mockVectorStoreClient as any);
    mockGetModelProvider.mockReturnValue({
      model: jest.fn(),
    } as any);
    mockGenerateText.mockResolvedValue({
      text: 'Generated summary',
    } as any);
    mockCalculateSha256FromUrl.mockResolvedValue('mock-sha256-hash');
  });

  describe('getPresignedUploadUrl', () => {
    test('should generate presigned upload URL successfully', async () => {
      const mockUploadUrl = 'https://s3.amazonaws.com/presigned-upload-url';
      mockS3Client.generatePresignedUrl.mockResolvedValue(mockUploadUrl);

      const result = await getPresignedUploadUrl(
        'test.pdf',
        'application/pdf',
        1024,
      );

      expect(result.error).toBeUndefined();
      expect(result.uploadUrl).toBe(mockUploadUrl);
      expect(result.documentId).toBeDefined();
      expect(result.key).toBeDefined();
      expect(mockS3Client.generatePresignedUrl).toHaveBeenCalled();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await getPresignedUploadUrl(
        'test.pdf',
        'application/pdf',
        1024,
      );

      expect(result.error).toBe(
        'Unauthorized: You must be logged in to upload documents.',
      );
      expect(result.uploadUrl).toBeUndefined();
    });

    test('should validate file parameters', async () => {
      const result = await getPresignedUploadUrl('', '', -1);

      expect(result.error).toBe('Bad Request: Invalid file upload parameters.');
    });

    test('should handle S3 errors', async () => {
      mockS3Client.generatePresignedUrl.mockRejectedValue(
        new Error('S3 Error'),
      );

      const result = await getPresignedUploadUrl(
        'test.pdf',
        'application/pdf',
        1024,
      );

      expect(result.error).toBe(
        'Internal Server Error: Failed to generate presigned URL.',
      );
    });
  });

  describe('listDocuments', () => {
    test('should list documents with pagination', async () => {
      const result = await listDocuments({
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.error).toBeUndefined();
      expect(result.documents).toBeDefined();
      expect(result.hasMore).toBeDefined();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await listDocuments({
        limit: 10,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.error).toBe(
        'Unauthorized: You must be logged in to list documents.',
      );
    });

    test('should validate pagination parameters', async () => {
      const result = await listDocuments({
        limit: -1,
        startingAfter: null,
        endingBefore: null,
      });

      expect(result.error).toBe(
        'Bad Request: Invalid document listing parameters.',
      );
    });
  });

  describe('searchDocuments', () => {
    test('should search documents successfully', async () => {
      mockVectorStoreClient.similaritySearch.mockResolvedValue([
        { id: 'doc1', content: 'test content', score: 0.9 },
      ]);

      const result = await searchDocuments({
        query: 'test query',
        limit: 10,
        visibility: 'private',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc1');
      expect(mockVectorStoreClient.similaritySearch).toHaveBeenCalledWith(
        'test query',
        10,
        expect.objectContaining({
          filter: expect.any(Object),
        }),
      );
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      await expect(
        searchDocuments({
          query: 'test query',
          limit: 10,
          visibility: 'private',
        }),
      ).rejects.toThrow(
        'Unauthorized: You must be logged in to search documents.',
      );
    });

    test('should handle vector store errors', async () => {
      mockVectorStoreClient.similaritySearch.mockRejectedValue(
        new Error('Vector store error'),
      );

      await expect(
        searchDocuments({
          query: 'test query',
          limit: 10,
          visibility: 'private',
        }),
      ).rejects.toThrow('Internal Server Error: Failed to search documents.');
    });
  });

  describe('searchDocumentsById', () => {
    test('should search documents by document ID successfully', async () => {
      mockVectorStoreClient.similaritySearch.mockResolvedValue([
        { id: 'doc1', content: 'test content', score: 0.9 },
      ]);

      const result = await searchDocumentsById({
        documentId: 'test-doc-id',
        query: 'test query',
        limit: 10,
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('doc1');
      expect(mockVectorStoreClient.similaritySearch).toHaveBeenCalledWith(
        'test query',
        10,
        expect.objectContaining({
          filter: expect.any(Object),
        }),
      );
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      await expect(
        searchDocumentsById({
          documentId: 'test-doc-id',
          query: 'test query',
          limit: 10,
        }),
      ).rejects.toThrow(
        'Unauthorized: You must be logged in to search documents.',
      );
    });
  });

  describe('completeDocumentUpload', () => {
    test('should complete document upload successfully', async () => {
      mockMarkitdownClient.convertUrl.mockResolvedValue({
        title: 'Test Document',
        content: 'Test content',
      });

      const result = await completeDocumentUpload({
        documentId: 'test-doc-id',
      });

      expect(result.error).toBeUndefined();
      expect(mockMarkitdownClient.convertUrl).toHaveBeenCalled();
      expect(mockVectorStoreClient.addDocuments).toHaveBeenCalled();
      expect(mockTrack).toHaveBeenCalledWith('document_uploaded');
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await completeDocumentUpload({
        documentId: 'test-doc-id',
      });

      expect(result.error).toBe(
        'Unauthorized: You must be logged in to complete document uploads.',
      );
    });

    test('should validate document ID parameter', async () => {
      const result = await completeDocumentUpload({
        documentId: 'invalid-id',
      });

      expect(result.error).toBe(
        'Bad Request: Invalid document upload parameters.',
      );
    });

    test('should handle markitdown conversion errors', async () => {
      mockMarkitdownClient.convertUrl.mockRejectedValue(
        new Error('Conversion failed'),
      );

      const result = await completeDocumentUpload({
        documentId: 'test-doc-id',
      });

      expect(result.error).toBe(
        'Internal Server Error: Failed to process document.',
      );
    });
  });

  describe('deleteDocument', () => {
    test('should delete document successfully', async () => {
      const result = await deleteDocument({ id: 'test-doc-id' });

      expect(result.error).toBeUndefined();
      expect(mockS3Client.deleteObject).toHaveBeenCalled();
      expect(mockVectorStoreClient.delete).toHaveBeenCalled();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await deleteDocument({ id: 'test-doc-id' });

      expect(result.error).toBe(
        'Unauthorized: You must be logged in to delete documents.',
      );
    });

    test('should validate document ID parameter', async () => {
      const result = await deleteDocument({ id: 'invalid-id' });

      expect(result.error).toBe('Bad Request: Invalid document ID.');
    });

    test('should handle deletion errors', async () => {
      mockS3Client.deleteObject.mockRejectedValue(
        new Error('S3 deletion failed'),
      );

      const result = await deleteDocument({ id: 'test-doc-id' });

      expect(result.error).toBe(
        'Internal Server Error: Failed to delete document.',
      );
    });
  });

  describe('renameDocument', () => {
    test('should rename document successfully', async () => {
      const result = await renameDocument({
        id: 'test-doc-id',
        title: 'New Document Title',
      });

      expect(result.error).toBeUndefined();
      expect(result.document).toBeDefined();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await renameDocument({
        id: 'test-doc-id',
        title: 'New Document Title',
      });

      expect(result.error).toBe(
        'Unauthorized: You must be logged in to rename documents.',
      );
    });

    test('should validate rename parameters', async () => {
      const result = await renameDocument({
        id: 'invalid-id',
        title: '',
      });

      expect(result.error).toBe(
        'Bad Request: Invalid document rename parameters.',
      );
    });
  });

  describe('getPresignedDownloadUrl', () => {
    test('should generate presigned download URL successfully', async () => {
      const mockDownloadUrl = 'https://s3.amazonaws.com/presigned-download-url';
      mockS3Client.generatePresignedUrl.mockResolvedValue(mockDownloadUrl);

      const result = await getPresignedDownloadUrl({ id: 'test-doc-id' });

      expect(result.error).toBeUndefined();
      expect(result.downloadUrl).toBe(mockDownloadUrl);
      expect(mockS3Client.generatePresignedUrl).toHaveBeenCalled();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await getPresignedDownloadUrl({ id: 'test-doc-id' });

      expect(result.error).toBe(
        'Unauthorized: You must be logged in to download documents.',
      );
    });

    test('should validate document ID parameter', async () => {
      const result = await getPresignedDownloadUrl({ id: 'invalid-id' });

      expect(result.error).toBe('Bad Request: Invalid document ID.');
    });
  });

  describe('getDocumentContent', () => {
    test('should get document content successfully', async () => {
      const result = await getDocumentContent({ id: 'test-doc-id' });

      expect(result.error).toBeUndefined();
      expect(result.document).toBeDefined();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await getDocumentContent({ id: 'test-doc-id' });

      expect(result.error).toBe(
        'Unauthorized: You must be logged in to access document content.',
      );
    });

    test('should validate document ID parameter', async () => {
      const result = await getDocumentContent({ id: 'invalid-id' });

      expect(result.error).toBe('Bad Request: Invalid document ID.');
    });
  });

  describe('toggleDocumentVisibility', () => {
    test('should toggle document visibility successfully', async () => {
      const result = await toggleDocumentVisibility({
        id: 'test-doc-id',
        visibility: 'public',
      });

      expect(result.error).toBeUndefined();
      expect(result.document).toBeDefined();
    });

    test('should return error when user not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const result = await toggleDocumentVisibility({
        id: 'test-doc-id',
        visibility: 'public',
      });

      expect(result.error).toBe(
        'Unauthorized: You must be logged in to change document visibility.',
      );
    });

    test('should validate toggle parameters', async () => {
      const result = await toggleDocumentVisibility({
        id: 'invalid-id',
        visibility: 'invalid' as any,
      });

      expect(result.error).toBe(
        'Bad Request: Invalid document visibility parameters.',
      );
    });
  });
});
