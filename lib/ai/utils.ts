import type { Attachment, Message } from 'ai';
import { providerSupportsDocuments, type ProviderType } from './models';

/**
 * Filter out document attachments from messages if the provider doesn't support them
 * @param messages - Array of messages that may contain attachments
 * @param provider - The provider type to check support for
 * @returns Messages with attachments filtered based on provider support
 */
export function filterDocumentAttachments(
  messages: Message[],
  provider: ProviderType,
): Message[] {
  // If provider supports documents, return messages as-is
  if (providerSupportsDocuments(provider)) {
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

/**
 * Filter out document attachments from UI attachments if the provider doesn't support them
 * @param attachments - Array of UI attachments
 * @param provider - The provider type to check support for
 * @returns Attachments filtered based on provider support
 */
export function filterUIDocumentAttachments(
  attachments: Attachment[],
  provider: ProviderType,
): Attachment[] {
  // If provider supports documents, return attachments as-is
  if (providerSupportsDocuments(provider)) {
    return attachments;
  }

  // Filter out document attachments, keeping only image attachments
  return attachments.filter((attachment) => {
    // Keep image attachments, filter out document attachments
    return attachment.contentType?.startsWith('image/');
  });
}