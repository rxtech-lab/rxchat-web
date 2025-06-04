import type { Message } from 'ai';
import { providerSupportsDocuments, type ProviderType } from './models';

/**
 * Filter out document attachments from messages if the provider doesn't support them
 * @param messages - Array of messages that may contain attachments
 * @param provider - The provider type to check support for
 * @param model - The specific model ID within the provider (optional)
 * @returns Messages with attachments filtered based on provider support
 */
export function filterDocumentAttachments(
  messages: Message[],
  provider: ProviderType,
  model?: string,
): Message[] {
  // If provider supports documents, return messages as-is
  if (providerSupportsDocuments(provider, model)) {
    return messages;
  }

  // Filter out document attachments, keeping only image attachments
  return messages.map((message) => ({
    ...message,
    experimental_attachments: message.experimental_attachments?.filter(
      (attachment) => {
        // Keep image attachments, filter out document attachments
        return attachment.contentType?.startsWith('image/');
      },
    ),
  }));
}
