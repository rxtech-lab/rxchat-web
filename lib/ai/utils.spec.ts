import { filterDocumentAttachments } from './utils';
import type { Message, Attachment } from 'ai';

describe('filterDocumentAttachments', () => {
  const mockMessages: Message[] = [
    {
      id: '1',
      role: 'user',
      content: 'Test message',
      experimental_attachments: [
        {
          name: 'document.pdf',
          contentType: 'application/pdf',
          url: 'https://example.com/document.pdf',
        },
        {
          name: 'image.jpg',
          contentType: 'image/jpeg',
          url: 'https://example.com/image.jpg',
        },
      ],
    },
  ];

  test('should keep all attachments for openRouter provider', () => {
    const result = filterDocumentAttachments(mockMessages, 'openRouter');

    expect(result[0].experimental_attachments).toHaveLength(2);
    expect(result[0].experimental_attachments?.[0].contentType).toBe(
      'application/pdf',
    );
    expect(result[0].experimental_attachments?.[1].contentType).toBe(
      'image/jpeg',
    );
  });

  test('should keep all attachments for openRouter provider with model', () => {
    const result = filterDocumentAttachments(
      mockMessages,
      'openRouter',
      'some-model',
    );

    expect(result[0].experimental_attachments).toHaveLength(2);
    expect(result[0].experimental_attachments?.[0].contentType).toBe(
      'application/pdf',
    );
    expect(result[0].experimental_attachments?.[1].contentType).toBe(
      'image/jpeg',
    );
  });

  test('should filter out document attachments for openAI provider', () => {
    const result = filterDocumentAttachments(mockMessages, 'openAI');

    expect(result[0].experimental_attachments).toHaveLength(1);
    expect(result[0].experimental_attachments?.[0].contentType).toBe(
      'image/jpeg',
    );
  });

  test('should filter out document attachments for openAI provider with model', () => {
    const result = filterDocumentAttachments(mockMessages, 'openAI', 'gpt-4');

    expect(result[0].experimental_attachments).toHaveLength(1);
    expect(result[0].experimental_attachments?.[0].contentType).toBe(
      'image/jpeg',
    );
  });

  test('should filter out document attachments for azure provider', () => {
    const result = filterDocumentAttachments(mockMessages, 'azure');

    expect(result[0].experimental_attachments).toHaveLength(1);
    expect(result[0].experimental_attachments?.[0].contentType).toBe(
      'image/jpeg',
    );
  });

  test('should handle messages without attachments', () => {
    const messagesWithoutAttachments: Message[] = [
      {
        id: '2',
        role: 'user',
        content: 'Test message without attachments',
      },
    ];

    const result = filterDocumentAttachments(
      messagesWithoutAttachments,
      'openAI',
    );

    expect(result[0].experimental_attachments).toBeUndefined();
  });
});
