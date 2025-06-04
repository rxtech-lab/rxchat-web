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

/**
 * Sometimes, when a message missing tool result, most likely it is failed, we need to add a failed result to the message
 * @param message
 * @returns Messages with tool result added
 */
export function addToolResultToMessage(message: Message): Message {
  const newMessage = { ...message };

  if (newMessage.role === 'assistant' && newMessage.parts) {
    // if last part is tool invocation and state is call, we need to add a failed result to the message
    const lastPart = newMessage.parts[newMessage.parts.length - 1] as any;
    if (
      lastPart.type === 'tool-invocation' &&
      lastPart.toolInvocation.state === 'call' &&
      lastPart.toolInvocation.result === undefined
    ) {
      newMessage.parts[newMessage.parts.length - 1] = {
        ...lastPart,
        toolInvocation: {
          ...lastPart.toolInvocation,
          state: 'failed',
          result: {
            type: 'error',
            error: {
              message: 'Tool invocation failed',
              code: 'tool_invocation_failed',
            },
          },
        },
      };
    }
  }

  return newMessage;
}
