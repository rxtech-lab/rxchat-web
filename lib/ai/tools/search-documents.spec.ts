/**
 * @jest-environment node
 */
import { searchDocumentsTool } from './search-documents';
import type { Session } from 'next-auth';

// Mock the searchDocuments and searchDocumentsById functions
jest.mock('@/lib/document/actions/action_server', () => ({
  searchDocuments: jest.fn(),
  searchDocumentsById: jest.fn(),
}));

// Mock constants
jest.mock('@/lib/constants', () => ({
  MAX_K: 10,
}));

import {
  searchDocuments,
  searchDocumentsById,
} from '@/lib/document/actions/action_server';

const mockSearchDocuments = searchDocuments as jest.MockedFunction<
  typeof searchDocuments
>;
const mockSearchDocumentsById = searchDocumentsById as jest.MockedFunction<
  typeof searchDocumentsById
>;

describe('searchDocumentsTool', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      type: 'free',
    },
    expires: '2024-12-31',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should search documents successfully', async () => {
    const mockDocuments = [
      {
        id: 'doc-1',
        originalFileName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        createdAt: new Date(),
        content: 'This is a test document content',
        userId: 'user-123',
        key: 'test-key',
        status: 'completed' as const,
        sha256: null,
        visibility: 'private' as const,
      },
    ];

    mockSearchDocuments.mockResolvedValue(mockDocuments);

    const tool = searchDocumentsTool({ session: mockSession });
    const result = await tool.execute(
      { query: 'test query' },
      {
        toolCallId: '',
        messages: [],
      },
    );

    expect(mockSearchDocuments).toHaveBeenCalledWith({
      query: 'test query',
      limit: 10,
      includePublic: false,
    });

    expect(result).toEqual({
      message: 'Found 1 document(s) matching your search query.',
      results: [
        {
          id: 'doc-1',
          originalFileName: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          createdAt: mockDocuments[0].createdAt,
          content: 'This is a test document content',
        },
      ],
    });
  });

  it('should search documents by ID successfully', async () => {
    const mockDocuments = [
      {
        id: 'doc-1',
        originalFileName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        createdAt: new Date(),
        content: 'This is specific document content',
        userId: 'user-123',
        key: 'test-key',
        status: 'completed' as const,
        sha256: null,
        visibility: 'private' as const,
      },
    ];

    mockSearchDocumentsById.mockResolvedValue(mockDocuments);

    const tool = searchDocumentsTool({ session: mockSession });
    const result = await tool.execute(
      { query: 'test query', documentId: 'doc-1' },
      {
        toolCallId: '',
        messages: [],
      },
    );

    expect(mockSearchDocumentsById).toHaveBeenCalledWith({
      documentId: 'doc-1',
      query: 'test query',
      limit: 10,
    });

    expect(result).toEqual({
      message:
        'Found 1 relevant section(s) in the document matching your search query.',
      results: [
        {
          id: 'doc-1',
          originalFileName: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          createdAt: mockDocuments[0].createdAt,
          content: 'This is specific document content',
        },
      ],
    });
  });

  it('should handle no results found for general search', async () => {
    mockSearchDocuments.mockResolvedValue([]);

    const tool = searchDocumentsTool({ session: mockSession });
    const result = await tool.execute(
      { query: 'no results query' },
      {
        toolCallId: '',
        messages: [],
      },
    );

    expect(result).toEqual({
      message: 'No documents found matching your search query.',
      results: [],
    });
  });

  it('should handle no results found for document ID search', async () => {
    mockSearchDocumentsById.mockResolvedValue([]);

    const tool = searchDocumentsTool({ session: mockSession });
    const result = await tool.execute(
      { query: 'no results query', documentId: 'doc-1' },
      {
        toolCallId: '',
        messages: [],
      },
    );

    expect(result).toEqual({
      message:
        'No content found in the specified document matching your search query.',
      results: [],
    });
  });

  it('should handle search errors', async () => {
    mockSearchDocuments.mockRejectedValue(new Error('Search failed'));

    const tool = searchDocumentsTool({ session: mockSession });
    const result = await tool.execute(
      { query: 'error query' },
      {
        toolCallId: '',
        messages: [],
      },
    );

    expect(result).toEqual({
      error: 'Failed to search documents. Please try again.',
      message: 'An error occurred while searching for documents.',
      results: [],
    });
  });

  it('should use custom limit when provided', async () => {
    mockSearchDocuments.mockResolvedValue([]);

    const tool = searchDocumentsTool({ session: mockSession });
    await tool.execute(
      { query: 'test query', limit: 5 },
      {
        toolCallId: '',
        messages: [],
      },
    );

    expect(mockSearchDocuments).toHaveBeenCalledWith({
      query: 'test query',
      limit: 5,
      includePublic: false,
    });
  });

  it('should use custom limit for document ID search', async () => {
    mockSearchDocumentsById.mockResolvedValue([]);

    const tool = searchDocumentsTool({ session: mockSession });
    await tool.execute(
      { query: 'test query', documentId: 'doc-1', limit: 3 },
      {
        toolCallId: '',
        messages: [],
      },
    );

    expect(mockSearchDocumentsById).toHaveBeenCalledWith({
      documentId: 'doc-1',
      query: 'test query',
      limit: 3,
    });
  });

  it('should include public documents when includePublic is true', async () => {
    mockSearchDocuments.mockResolvedValue([]);

    const tool = searchDocumentsTool({ session: mockSession });
    await tool.execute(
      { query: 'test query', includePublic: true },
      {
        toolCallId: '',
        messages: [],
      },
    );

    expect(mockSearchDocuments).toHaveBeenCalledWith({
      query: 'test query',
      limit: 10,
      includePublic: true,
    });
  });

  it('should default to excluding public documents when includePublic is not specified', async () => {
    mockSearchDocuments.mockResolvedValue([]);

    const tool = searchDocumentsTool({ session: mockSession });
    await tool.execute(
      { query: 'test query' },
      {
        toolCallId: '',
        messages: [],
      },
    );

    expect(mockSearchDocuments).toHaveBeenCalledWith({
      query: 'test query',
      limit: 10,
      includePublic: false,
    });
  });
});
