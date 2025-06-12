import { calculateSha256FromUrl, compressMessage } from './utils.server';
import type { DBMessage } from '@/lib/db/schema';
import { MAX_CONTEXT_TOKEN_COUNT } from '@/lib/constants';

// Mock fetch to avoid actual network requests
const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock('ai', () => ({
  generateText: jest.fn().mockResolvedValue({
    text: 'compressed message',
  }),
}));

jest.mock('tokenx', () => ({
  estimateTokenCount: jest.fn(),
}));

jest.mock('./ai/providers', () => ({
  openRouterProvider: jest.fn(() => ({
    languageModel: jest.fn(),
  })),
}));

describe('SHA256 Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateSha256FromUrl', () => {
    it('should calculate SHA256 hash from file URL', async () => {
      const testContent = 'Hello, World!';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from(testContent).buffer),
      });

      const result = await calculateSha256FromUrl(
        'https://example.com/test.txt',
      );

      expect(result).toHaveLength(64); // SHA256 hash should be 64 hex characters
      expect(result).toMatch(/^[a-f0-9]{64}$/); // Should be valid hex string
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/test.txt');
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(
        calculateSha256FromUrl('https://example.com/nonexistent.txt'),
      ).rejects.toThrow(
        'Failed to calculate SHA256: Failed to download file: Not Found',
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        calculateSha256FromUrl('https://example.com/test.txt'),
      ).rejects.toThrow('Failed to calculate SHA256: Network error');
    });

    it('should generate different hashes for different content', async () => {
      const content1 = 'Content 1';
      const content2 = 'Content 2';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from(content1).buffer),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from(content2).buffer),
        });

      const hash1 = await calculateSha256FromUrl(
        'https://example.com/file1.txt',
      );
      const hash2 = await calculateSha256FromUrl(
        'https://example.com/file2.txt',
      );

      expect(hash1).not.toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

describe('compressMessage', () => {
  const mockEstimateTokenCount = require('tokenx')
    .estimateTokenCount as jest.MockedFunction<
    typeof import('tokenx').estimateTokenCount
  >;
  const mockGenerateText = require('ai').generateText as jest.MockedFunction<
    typeof import('ai').generateText
  >;

  // Helper function to create test messages
  const createMessage = (
    role: 'user' | 'assistant',
    text: string,
    id: string = crypto.randomUUID(),
    chatId: string = crypto.randomUUID(),
  ): DBMessage => ({
    id,
    chatId,
    role,
    parts: [{ type: 'text', text }],
    attachments: [],
    createdAt: new Date(),
    usage: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateText.mockResolvedValue({
      text: 'compressed message',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      finishReason: 'stop',
      request: {} as any,
      response: {} as any,
      warnings: undefined,
    } as any);
  });

  it('should compress the first message when it exceeds the limit', async () => {
    const messages = [
      createMessage(
        'user',
        'This is a very long message that exceeds the token limit',
      ),
    ];

    // Mock token count: user message exceeds limit
    mockEstimateTokenCount
      .mockReturnValueOnce(MAX_CONTEXT_TOKEN_COUNT + 1000) // Total message count
      .mockReturnValueOnce(MAX_CONTEXT_TOKEN_COUNT + 1000); // User message count

    const result = await compressMessage(messages, 10000);

    expect(mockGenerateText).toHaveBeenCalledWith({
      model: expect.any(Object),
      system:
        'You are a helpful assistant that compresses messages to fit within the context window of a model. You will be given a message and you will need to compress it to fit within the context window. You will return the compressed message.',
      prompt: 'This is a very long message that exceeds the token limit',
    });

    expect(result).toHaveLength(1);
    expect((result[0].parts as any)[0]).toEqual({
      type: 'text',
      text: 'compressed message',
    });
  });

  it('should not compress the first message when it is within the limit', async () => {
    const messages = [createMessage('user', 'Short message')];

    // Mock token count: user message is within limit
    mockEstimateTokenCount
      .mockReturnValueOnce(100) // Total message count
      .mockReturnValueOnce(100); // User message count

    const result = await compressMessage(messages, 10000);

    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(result).toEqual(messages);
  });

  it('should apply rolling window when first message is within limit but total exceeds limit with few messages', async () => {
    const messages = [
      createMessage('user', 'First user message'),
      createMessage('assistant', 'Assistant response'),
      createMessage('user', 'Second user message'),
    ];

    // Mock token counts
    mockEstimateTokenCount
      .mockReturnValueOnce(10000) // First user message count (for total calculation)
      .mockReturnValueOnce(500) // Assistant message count (for total calculation)
      .mockReturnValueOnce(1000) // Second user message count (for total calculation)
      .mockReturnValueOnce(1000) // Second user message count (user message size check)
      .mockReturnValueOnce(10000) // First user message count (for totalMessageWithoutUser)
      .mockReturnValueOnce(500) // Assistant message count (for totalMessageWithoutUser)
      .mockReturnValueOnce(500) // Assistant message count (for rolling window)
      .mockReturnValueOnce(10000); // First user message count (for rolling window - exceeds limit)

    const result = await compressMessage(messages, 10000);

    // Should keep only the assistant message and the latest user message
    expect(result).toHaveLength(2);
    expect((result[0].parts as any)[0]).toEqual({
      type: 'text',
      text: 'Assistant response',
    });
    expect((result[1].parts as any)[0]).toEqual({
      type: 'text',
      text: 'Second user message',
    });
  });

  it('should drop multiple messages when needed to stay within limit', async () => {
    const messages = [
      createMessage('user', 'Message 1'),
      createMessage('assistant', 'Response 1'),
      createMessage('user', 'Message 2'),
      createMessage('assistant', 'Response 2'),
      createMessage('user', 'Message 3'),
      createMessage('assistant', 'Response 3'),
      createMessage('user', 'Latest message'),
    ];

    // Mock token counts for the total calculation first
    mockEstimateTokenCount
      .mockReturnValueOnce(2000) // Message 1 count (for total calculation)
      .mockReturnValueOnce(2000) // Response 1 count (for total calculation)
      .mockReturnValueOnce(2000) // Message 2 count (for total calculation)
      .mockReturnValueOnce(2000) // Response 2 count (for total calculation)
      .mockReturnValueOnce(2000) // Message 3 count (for total calculation)
      .mockReturnValueOnce(2000) // Response 3 count (for total calculation)
      .mockReturnValueOnce(1000) // Latest message count (for total calculation)
      .mockReturnValueOnce(1000) // Latest message count (user message size check)
      // totalMessageWithoutUser calculation (all messages except last)
      .mockReturnValueOnce(2000) // Message 1 count
      .mockReturnValueOnce(2000) // Response 1 count
      .mockReturnValueOnce(2000) // Message 2 count
      .mockReturnValueOnce(2000) // Response 2 count
      .mockReturnValueOnce(2000) // Message 3 count
      .mockReturnValueOnce(2000) // Response 3 count
      // Rolling window - working backwards from index 5 (Response 3)
      .mockReturnValueOnce(2000) // Response 3 count (fits: 1000 + 2000 = 3000 <= 10000)
      .mockReturnValueOnce(2000) // Message 3 count (fits: 3000 + 2000 = 5000 <= 10000)
      .mockReturnValueOnce(2000) // Response 2 count (fits: 5000 + 2000 = 7000 <= 10000)
      .mockReturnValueOnce(8000); // Message 2 count (exceeds limit: 7000 + 8000 = 15000 > 10000)

    const result = await compressMessage(messages, 10000);

    // Should keep only the last few messages that fit within the limit
    expect(result).toHaveLength(4);
    expect((result[0].parts as any)[0]).toEqual({
      type: 'text',
      text: 'Response 2',
    });
    expect((result[1].parts as any)[0]).toEqual({
      type: 'text',
      text: 'Message 3',
    });
    expect((result[2].parts as any)[0]).toEqual({
      type: 'text',
      text: 'Response 3',
    });
    expect((result[3].parts as any)[0]).toEqual({
      type: 'text',
      text: 'Latest message',
    });
  });

  it('should return all messages when they are all within the limit', async () => {
    const messages = [
      createMessage('user', 'Message 1'),
      createMessage('assistant', 'Response 1'),
      createMessage('user', 'Message 2'),
    ];

    // Mock token counts: all within limit
    mockEstimateTokenCount
      .mockReturnValueOnce(5000) // Total message count
      .mockReturnValueOnce(1000) // User message count
      .mockReturnValueOnce(4000); // Total without user message

    const result = await compressMessage(messages, 10000);

    expect(mockGenerateText).not.toHaveBeenCalled();
    expect(result).toEqual(messages);
  });

  it('should handle empty messages array', async () => {
    const messages: DBMessage[] = [];

    const result = await compressMessage(messages);

    expect(result).toEqual([]);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('should handle messages with tool calls and results', async () => {
    const messagesWithTools = [
      {
        ...createMessage('user', 'Call a tool'),
        parts: [
          { type: 'text', text: 'Please search for something' },
          {
            type: 'tool-call',
            toolCallId: 'call_123',
            toolName: 'search',
            args: { query: 'test query' },
          },
        ],
      } as DBMessage,
      {
        ...createMessage('assistant', ''),
        parts: [
          {
            type: 'tool-result',
            toolCallId: 'call_123',
            result: { data: 'search results' },
          },
          { type: 'text', text: 'Here are the results' },
        ],
      } as DBMessage,
    ];

    // Mock token counts: within limit
    mockEstimateTokenCount
      .mockReturnValueOnce(5000) // Total message count
      .mockReturnValueOnce(2000) // User message count
      .mockReturnValueOnce(3000); // Total without user message

    const result = await compressMessage(messagesWithTools, 10000);

    expect(result).toEqual(messagesWithTools);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('should compress user message with mixed content types', async () => {
    const messageWithMixedContent = [
      {
        ...createMessage('user', ''),
        parts: [
          {
            type: 'text',
            text: 'This is a very long text that needs compression',
          },
          {
            type: 'tool-call',
            toolCallId: 'call_456',
            toolName: 'analyze',
            args: { data: 'lots of data that makes this message very long' },
          },
        ],
      } as DBMessage,
    ];

    // Mock token count: exceeds limit
    mockEstimateTokenCount
      .mockReturnValueOnce(10000) // Total message count
      .mockReturnValueOnce(10000); // User message count

    const result = await compressMessage(messageWithMixedContent, 10000);

    expect(mockGenerateText).toHaveBeenCalled();
    expect((result[0].parts as any)[0]).toEqual({
      type: 'text',
      text: 'compressed message',
    });
  });

  it('should never affect user latest message during rolling window compression', async () => {
    const userLatestMessage = createMessage(
      'user',
      'User latest message - must be preserved exactly',
    );
    const messages = [
      createMessage('user', 'Old user message 1'),
      createMessage('assistant', 'Assistant response 1'),
      createMessage('user', 'Old user message 2'),
      createMessage('assistant', 'Assistant response 2'),
      userLatestMessage,
    ];

    // Mock token counts to trigger rolling window compression
    mockEstimateTokenCount
      .mockReturnValueOnce(3000) // Old user message 1 (for total calculation)
      .mockReturnValueOnce(3000) // Assistant response 1 (for total calculation)
      .mockReturnValueOnce(3000) // Old user message 2 (for total calculation)
      .mockReturnValueOnce(3000) // Assistant response 2 (for total calculation)
      .mockReturnValueOnce(1000) // User latest message (for total calculation)
      .mockReturnValueOnce(1000) // User latest message (user message size check)
      // totalMessageWithoutUser calculation (all messages except last) - should exceed 10000
      .mockReturnValueOnce(3000) // Old user message 1
      .mockReturnValueOnce(3000) // Assistant response 1
      .mockReturnValueOnce(3000) // Old user message 2
      .mockReturnValueOnce(3000) // Assistant response 2 (total = 12000 > 10000)
      // Rolling window - working backwards from index 3
      .mockReturnValueOnce(3000) // Assistant response 2 (fits: 1000 + 3000 = 4000 <= 10000)
      .mockReturnValueOnce(3000) // Old user message 2 (fits: 4000 + 3000 = 7000 <= 10000)
      .mockReturnValueOnce(5000); // Assistant response 1 (exceeds limit: 7000 + 5000 = 12000 > 10000)

    const result = await compressMessage(messages, 10000);

    // Verify that the user's latest message is preserved exactly as-is
    const resultUserMessage = result[result.length - 1]; // Should be the last message
    expect(resultUserMessage.id).toBe(userLatestMessage.id);
    expect(resultUserMessage.chatId).toBe(userLatestMessage.chatId);
    expect(resultUserMessage.role).toBe(userLatestMessage.role);
    expect(resultUserMessage.parts).toEqual(userLatestMessage.parts);
    expect(resultUserMessage.attachments).toEqual(
      userLatestMessage.attachments,
    );
    expect(resultUserMessage.usage).toBe(userLatestMessage.usage);
    expect((resultUserMessage.parts as any)[0].text).toBe(
      'User latest message - must be preserved exactly',
    );

    // Verify that the user's latest message was never modified during compression
    expect(result).toHaveLength(3); // Should keep: Old user message 2, Assistant response 2, User latest
    expect((result[2].parts as any)[0].text).toBe(
      'User latest message - must be preserved exactly',
    );

    // Verify the rolling window kept the right messages in the right order
    expect((result[0].parts as any)[0].text).toBe('Old user message 2');
    expect((result[1].parts as any)[0].text).toBe('Assistant response 2');
  });
});
