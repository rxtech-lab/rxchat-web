import { filterDocumentAttachments, filterUIDocumentAttachments } from './utils';
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
    expect(result[0].experimental_attachments?.[0].contentType).toBe('application/pdf');
    expect(result[0].experimental_attachments?.[1].contentType).toBe('image/jpeg');
  });

  test('should filter out document attachments for openAI provider', () => {
    const result = filterDocumentAttachments(mockMessages, 'openAI');
    
    expect(result[0].experimental_attachments).toHaveLength(1);
    expect(result[0].experimental_attachments?.[0].contentType).toBe('image/jpeg');
  });

  test('should filter out document attachments for azure provider', () => {
    const result = filterDocumentAttachments(mockMessages, 'azure');
    
    expect(result[0].experimental_attachments).toHaveLength(1);
    expect(result[0].experimental_attachments?.[0].contentType).toBe('image/jpeg');
  });

  test('should handle messages without attachments', () => {
    const messagesWithoutAttachments: Message[] = [
      {
        id: '2',
        role: 'user',
        content: 'Test message without attachments',
      },
    ];

    const result = filterDocumentAttachments(messagesWithoutAttachments, 'openAI');
    
    expect(result[0].experimental_attachments).toBeUndefined();
  });
});

describe('filterUIDocumentAttachments', () => {
  const mockAttachments: Attachment[] = [
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
    {
      name: 'text.txt',
      contentType: 'text/plain',
      url: 'https://example.com/text.txt',
    },
  ];

  test('should keep all attachments for openRouter provider', () => {
    const result = filterUIDocumentAttachments(mockAttachments, 'openRouter');
    
    expect(result).toHaveLength(3);
    expect(result.map(a => a.contentType)).toEqual([
      'application/pdf',
      'image/jpeg',
      'text/plain',
    ]);
  });

  test('should filter out document attachments for openAI provider', () => {
    const result = filterUIDocumentAttachments(mockAttachments, 'openAI');
    
    expect(result).toHaveLength(1);
    expect(result[0].contentType).toBe('image/jpeg');
  });

  test('should handle empty attachment array', () => {
    const result = filterUIDocumentAttachments([], 'openAI');
    
    expect(result).toHaveLength(0);
  });

  test('should handle attachments with undefined contentType', () => {
    const attachmentsWithUndefined: Attachment[] = [
      {
        name: 'unknown',
        url: 'https://example.com/unknown',
      },
    ];

    const result = filterUIDocumentAttachments(attachmentsWithUndefined, 'openAI');
    
    expect(result).toHaveLength(0);
  });
});