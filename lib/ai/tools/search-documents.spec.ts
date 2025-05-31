/**
 * @jest-environment node
 */
import { searchDocumentsTool } from './search-documents';
import type { Session } from 'next-auth';

// Mock the searchDocuments function
jest.mock('@/lib/document/actions/action_server', () => ({
  searchDocuments: jest.fn(),
}));

// Mock constants
jest.mock('@/lib/constants', () => ({
  MAX_K: 10,
}));

import { searchDocuments } from '@/lib/document/actions/action_server';

const mockSearchDocuments = searchDocuments as jest.MockedFunction<typeof searchDocuments>;

describe('searchDocumentsTool', () => {
  const mockSession: Session = {
    user: {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
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
      },
    ];

    mockSearchDocuments.mockResolvedValue(mockDocuments);

    const tool = searchDocumentsTool({ session: mockSession });
    const result = await tool.execute({ query: 'test query' });

    expect(mockSearchDocuments).toHaveBeenCalledWith({
      query: 'test query',
      limit: 10,
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

  it('should handle no results found', async () => {
    mockSearchDocuments.mockResolvedValue([]);

    const tool = searchDocumentsTool({ session: mockSession });
    const result = await tool.execute({ query: 'no results query' });

    expect(result).toEqual({
      message: 'No documents found matching your search query.',
      results: [],
    });
  });

  it('should handle search errors', async () => {
    mockSearchDocuments.mockRejectedValue(new Error('Search failed'));

    const tool = searchDocumentsTool({ session: mockSession });
    const result = await tool.execute({ query: 'error query' });

    expect(result).toEqual({
      error: 'Failed to search documents. Please try again.',
      message: 'An error occurred while searching for documents.',
      results: [],
    });
  });

  it('should truncate long content', async () => {
    const longContent = 'a'.repeat(600);
    const mockDocuments = [
      {
        id: 'doc-1',
        originalFileName: 'long.txt',
        mimeType: 'text/plain',
        size: 600,
        createdAt: new Date(),
        content: longContent,
        userId: 'user-123',
        key: 'test-key',
        status: 'completed' as const,
      },
    ];

    mockSearchDocuments.mockResolvedValue(mockDocuments);

    const tool = searchDocumentsTool({ session: mockSession });
    const result = await tool.execute({ query: 'long content query' });

    expect(result.results[0].content).toHaveLength(503); // 500 + '...'
    expect(result.results[0].content).toMatch(/\.\.\.$/);  // ends with '...'
  });

  it('should use custom limit when provided', async () => {
    mockSearchDocuments.mockResolvedValue([]);

    const tool = searchDocumentsTool({ session: mockSession });
    await tool.execute({ query: 'test query', limit: 5 });

    expect(mockSearchDocuments).toHaveBeenCalledWith({
      query: 'test query',
      limit: 5,
    });
  });
});