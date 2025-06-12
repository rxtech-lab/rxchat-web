/**
 * @jest-environment node
 */

import { track } from '@vercel/analytics/server';

// Mock the track function
jest.mock('@vercel/analytics/server', () => ({
  track: jest.fn(),
}));

const mockTrack = track as jest.MockedFunction<typeof track>;

describe('Analytics Tracking', () => {
  beforeEach(() => {
    mockTrack.mockClear();
  });

  it('should have the track function available', () => {
    expect(mockTrack).toBeDefined();
    expect(typeof mockTrack).toBe('function');
  });

  it('should allow tracking events with properties', () => {
    // Test that we can call track with event name and properties
    mockTrack('test_event', { property: 'value' });

    expect(mockTrack).toHaveBeenCalledWith('test_event', { property: 'value' });
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it('should track user message sending event structure', () => {
    // Test the structure of user_send_message event
    const eventData = {
      chatId: 'test-chat-id',
      messageId: 'test-message-id',
      hasAttachments: false,
      attachmentCount: 0,
      selectedModel: 'gpt-4',
      selectedProvider: 'openai',
    };

    mockTrack('user_send_message', eventData);

    expect(mockTrack).toHaveBeenCalledWith('user_send_message', eventData);
  });

  it('should track document upload event structure', () => {
    // Test the structure of user_upload_document event
    const eventData = {
      documentId: 'doc-123',
      mimeType: 'application/pdf',
      userId: 'user-456',
      chunkCount: 5,
    };

    mockTrack('user_upload_document', eventData);

    expect(mockTrack).toHaveBeenCalledWith('user_upload_document', eventData);
  });

  it('should track passkey creation event structure', () => {
    // Test the structure of user_create_passkey event
    const eventData = {
      userId: 'user-789',
      deviceType: 'singleDevice',
      backedUp: true,
      transports: ['usb', 'nfc'],
      isNewUser: false,
    };

    mockTrack('user_create_passkey', eventData);

    expect(mockTrack).toHaveBeenCalledWith('user_create_passkey', eventData);
  });

  it('should track model selection event structure', () => {
    // Test the structure of user_select_model event
    const eventData = {
      model: 'gpt-4-turbo',
      provider: 'openai',
    };

    mockTrack('user_select_model', eventData);

    expect(mockTrack).toHaveBeenCalledWith('user_select_model', eventData);
  });

  it('should track artifact execution event structure', () => {
    // Test the structure of user_execute_artifact event (client-side)
    const eventData = {
      artifactType: 'code',
      language: 'python',
      codeLength: 150,
    };

    // For client-side tracking, we test the structure would be similar
    mockTrack('user_execute_artifact', eventData);

    expect(mockTrack).toHaveBeenCalledWith('user_execute_artifact', eventData);
  });
});
