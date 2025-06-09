import { getDocumentPrompt, getMemoryContext } from './prompts';
import { createMarkitdownClient } from '../document/markitdown';
import type { Attachment } from 'ai';

// Mock the markitdown module
jest.mock('../document/markitdown', () => ({
  createMarkitdownClient: jest.fn(),
}));

// Mock the memory module
jest.mock('@/lib/memory', () => ({
  createMemoryClient: jest.fn(),
}));

import { createMemoryClient } from '@/lib/memory';

const mockCreateMarkitdownClient =
  createMarkitdownClient as jest.MockedFunction<typeof createMarkitdownClient>;

const mockCreateMemoryClient = createMemoryClient as jest.MockedFunction<
  typeof createMemoryClient
>;

describe('getDocumentPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty document prompt when no attachments are provided', async () => {
    // Mock the markitdown client
    const mockMarkitdownClient = {
      convertToMarkdown: jest.fn(),
    };
    mockCreateMarkitdownClient.mockReturnValue(mockMarkitdownClient);

    const result = await getDocumentPrompt([]);

    expect(result).toBe(`
  The user has attached the following documents:
  
  `);
    expect(mockMarkitdownClient.convertToMarkdown).not.toHaveBeenCalled();
  });

  it('should filter out image attachments and process only document attachments', async () => {
    const mockMarkitdownClient = {
      convertToMarkdown: jest
        .fn()
        .mockResolvedValue('Converted document content'),
    };
    mockCreateMarkitdownClient.mockReturnValue(mockMarkitdownClient);

    const attachments: Attachment[] = [
      {
        name: 'image.jpg',
        contentType: 'image/jpeg',
        url: 'https://example.com/image.jpg',
      },
      {
        name: 'document.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/document.pdf',
      },
      {
        name: 'photo.png',
        contentType: 'image/png',
        url: 'https://example.com/photo.png',
      },
    ];

    const result = await getDocumentPrompt(attachments);

    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenCalledTimes(1);
    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenCalledWith(
      'https://example.com/document.pdf',
    );
    expect(result).toBe(`
  The user has attached the following documents:
  Converted document content
  `);
  });

  it('should process multiple document attachments and join them with double newlines', async () => {
    const mockMarkitdownClient = {
      convertToMarkdown: jest
        .fn()
        .mockResolvedValueOnce('First document content')
        .mockResolvedValueOnce('Second document content')
        .mockResolvedValueOnce('Third document content'),
    };
    mockCreateMarkitdownClient.mockReturnValue(mockMarkitdownClient);

    const attachments: Attachment[] = [
      {
        name: 'doc1.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/doc1.pdf',
      },
      {
        name: 'doc2.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        url: 'https://example.com/doc2.docx',
      },
      {
        name: 'doc3.txt',
        contentType: 'text/plain',
        url: 'https://example.com/doc3.txt',
      },
    ];

    const result = await getDocumentPrompt(attachments);

    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenCalledTimes(3);
    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenNthCalledWith(
      1,
      'https://example.com/doc1.pdf',
    );
    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenNthCalledWith(
      2,
      'https://example.com/doc2.docx',
    );
    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenNthCalledWith(
      3,
      'https://example.com/doc3.txt',
    );

    expect(result).toBe(`
  The user has attached the following documents:
  First document content

Second document content

Third document content
  `);
  });

  it('should handle attachments without contentType', async () => {
    const mockMarkitdownClient = {
      convertToMarkdown: jest
        .fn()
        .mockResolvedValue('Document without content type'),
    };
    mockCreateMarkitdownClient.mockReturnValue(mockMarkitdownClient);

    const attachments: Attachment[] = [
      {
        name: 'unknown-file',
        url: 'https://example.com/unknown-file',
        // contentType is undefined
      },
    ];

    const result = await getDocumentPrompt(attachments);

    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenCalledTimes(1);
    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenCalledWith(
      'https://example.com/unknown-file',
    );
    expect(result).toBe(`
  The user has attached the following documents:
  Document without content type
  `);
  });

  it('should handle mixed attachments with some having undefined contentType', async () => {
    const mockMarkitdownClient = {
      convertToMarkdown: jest
        .fn()
        .mockResolvedValueOnce('PDF content')
        .mockResolvedValueOnce('Unknown file content'),
    };
    mockCreateMarkitdownClient.mockReturnValue(mockMarkitdownClient);

    const attachments: Attachment[] = [
      {
        name: 'image.gif',
        contentType: 'image/gif',
        url: 'https://example.com/image.gif',
      },
      {
        name: 'document.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/document.pdf',
      },
      {
        name: 'unknown-file',
        url: 'https://example.com/unknown-file',
        // contentType is undefined
      },
    ];

    const result = await getDocumentPrompt(attachments);

    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenCalledTimes(2);
    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenNthCalledWith(
      1,
      'https://example.com/document.pdf',
    );
    expect(mockMarkitdownClient.convertToMarkdown).toHaveBeenNthCalledWith(
      2,
      'https://example.com/unknown-file',
    );

    expect(result).toBe(`
  The user has attached the following documents:
  PDF content

Unknown file content
  `);
  });

  it('should handle conversion errors gracefully', async () => {
    const mockMarkitdownClient = {
      convertToMarkdown: jest
        .fn()
        .mockResolvedValueOnce('Successful conversion')
        .mockRejectedValueOnce(new Error('Conversion failed'))
        .mockResolvedValueOnce('Another successful conversion'),
    };
    mockCreateMarkitdownClient.mockReturnValue(mockMarkitdownClient);

    const attachments: Attachment[] = [
      {
        name: 'doc1.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/doc1.pdf',
      },
      {
        name: 'doc2.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/doc2.pdf',
      },
      {
        name: 'doc3.pdf',
        contentType: 'application/pdf',
        url: 'https://example.com/doc3.pdf',
      },
    ];

    // The function should propagate the error since it doesn't handle errors internally
    await expect(getDocumentPrompt(attachments)).rejects.toThrow(
      'Conversion failed',
    );
  });

  it('should return only filtered non-image attachments when all are images', async () => {
    const mockMarkitdownClient = {
      convertToMarkdown: jest.fn(),
    };
    mockCreateMarkitdownClient.mockReturnValue(mockMarkitdownClient);

    const attachments: Attachment[] = [
      {
        name: 'image1.jpg',
        contentType: 'image/jpeg',
        url: 'https://example.com/image1.jpg',
      },
      {
        name: 'image2.png',
        contentType: 'image/png',
        url: 'https://example.com/image2.png',
      },
      {
        name: 'image3.svg',
        contentType: 'image/svg+xml',
        url: 'https://example.com/image3.svg',
      },
    ];

    const result = await getDocumentPrompt(attachments);

    expect(mockMarkitdownClient.convertToMarkdown).not.toHaveBeenCalled();
    expect(result).toBe(`
  The user has attached the following documents:
  
  `);
  });
});

describe('getMemoryContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return formatted memory context when memories are found', async () => {
    const mockMemoryClient = {
      search: jest.fn().mockResolvedValue({
        results: [
          {
            id: '1',
            text: 'User prefers Italian food',
            score: 0.9,
            metadata: { type: 'preference' },
          },
          {
            id: '2',
            text: 'User is allergic to nuts',
            score: 0.8,
            metadata: { type: 'health' },
          },
        ],
      }),
    };

    mockCreateMemoryClient.mockReturnValue(mockMemoryClient as any);

    const result = await getMemoryContext('What should I eat for dinner?', 'user123');

    expect(mockMemoryClient.search).toHaveBeenCalledWith('What should I eat for dinner?', {
      user_id: 'user123',
      limit: 5,
      version: 'v2',
      filters: {
        AND: [
          {
            user_id: 'user123',
          },
        ],
      },
    });

    expect(result).toBe(`

Based on your previous conversations, here are some relevant memories:
User prefers Italian food
User is allergic to nuts

Please consider this context when responding to the user.`);
  });

  it('should return empty string when no memories are found', async () => {
    const mockMemoryClient = {
      search: jest.fn().mockResolvedValue({
        results: [],
      }),
    };

    mockCreateMemoryClient.mockReturnValue(mockMemoryClient as any);

    const result = await getMemoryContext('Random query', 'user123');

    expect(mockMemoryClient.search).toHaveBeenCalledWith('Random query', {
      user_id: 'user123',
      limit: 5,
      version: 'v2',
      filters: {
        AND: [
          {
            user_id: 'user123',
          },
        ],
      },
    });

    expect(result).toBe('');
  });

  it('should return empty string when memory client throws an error', async () => {
    const mockMemoryClient = {
      search: jest.fn().mockRejectedValue(new Error('Memory service unavailable')),
    };

    mockCreateMemoryClient.mockReturnValue(mockMemoryClient as any);

    // Spy on console.error to check if error is logged
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getMemoryContext('Any query', 'user123');

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to retrieve memory context:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it('should return empty string when createMemoryClient throws an error', async () => {
    mockCreateMemoryClient.mockImplementation(() => {
      throw new Error('MEM_ZERO_AI_API_KEY environment variable is required');
    });

    // Spy on console.error to check if error is logged
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await getMemoryContext('Any query', 'user123');

    expect(result).toBe('');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to retrieve memory context:',
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
