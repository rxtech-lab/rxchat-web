'server-only';

import {
  MAX_CONTEXT_TOKEN_COUNT,
  MESSAGE_COMPRESSION_MODEL,
} from '@/lib/constants';

import type { DBMessage } from './db/schema';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  generateText,
  type TextPart,
  type ToolCallPart,
  type ToolResultPart,
} from 'ai';
import { estimateTokenCount } from 'tokenx';

/**
 * Calculate SHA256 hash from file content downloaded from URL
 * @param fileUrl - URL to download the file from
 * @returns Promise<string> - SHA256 hash in hexadecimal format
 */
export async function calculateSha256FromUrl(fileUrl: string): Promise<string> {
  const crypto = await import('node:crypto');

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  } catch (error) {
    throw new Error(
      `Failed to calculate SHA256: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Estimate the message size, if over, then compress the message using llm
 */
export async function compressMessage(
  messages: Array<DBMessage>,
  messageContextSizeLimit: number = MAX_CONTEXT_TOKEN_COUNT,
  onCompress?: (tokenCountBefore: number, tokenCountAfter: number) => void,
): Promise<Array<DBMessage>> {
  if (messages.length === 0) return messages;

  const openRouterProvider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  const model = openRouterProvider(MESSAGE_COMPRESSION_MODEL);
  const userMessage: DBMessage = messages.at(-1) as DBMessage;

  // compress the user message
  function getMessageContent(message: DBMessage | undefined) {
    if (!message) return '';
    const parts: Array<ToolCallPart | ToolResultPart | TextPart> =
      message.parts as Array<ToolCallPart | ToolResultPart | TextPart>;
    const content = parts
      .map((part) => {
        if (part.type === 'text') {
          return part.text;
        } else if (part.type === 'tool-call') {
          // ToolCallPart: return a stringified version of the tool call arguments for context
          return JSON.stringify(part.args);
        } else if (part.type === 'tool-result') {
          // ToolResultPart: return a stringified version of the tool result for context
          return JSON.stringify(part.result);
        }
      })
      .join('\n');
    return content;
  }
  const totalMessageCount = messages.reduce((acc, message) => {
    return acc + estimateTokenCount(getMessageContent(message));
  }, 0);

  const userMessageCount = estimateTokenCount(getMessageContent(userMessage));
  // if there is no message, then the limit is the max context token count
  // if there is a message, then the limit is half of the max context token count
  const userMessageContentSizeLimit = Math.max(
    Math.abs(messageContextSizeLimit - totalMessageCount),
    messageContextSizeLimit / 2,
  );
  if (userMessageCount > userMessageContentSizeLimit) {
    const result = await generateText({
      model,
      system:
        'You are a helpful assistant that compresses messages to fit within the context window of a model. You will be given a message and you will need to compress it to fit within the context window. You will return the compressed message.',
      prompt: getMessageContent(userMessage),
    });

    onCompress?.(userMessageCount, result.usage?.totalTokens);

    // find user message's text part and replace it with the compressed message
    const textPartIndex = (
      userMessage.parts as Array<ToolCallPart | ToolResultPart | TextPart>
    ).findIndex((part) => part.type === 'text');
    if (textPartIndex !== -1) {
      (userMessage.parts as Array<TextPart>)[textPartIndex].text = result.text;
    }
    // update the message
    messages[messages.length - 1] = userMessage;
  }

  // Check if the total message count (excluding user's latest message) exceeds the limit
  const totalMessageWithoutUser = messages
    .slice(0, -1)
    .reduce((acc, message) => {
      return acc + estimateTokenCount(getMessageContent(message));
    }, 0);

  if (totalMessageWithoutUser > messageContextSizeLimit) {
    // Implement rolling window: drop older messages to stay within limit
    // CRITICAL: Always preserve the user's latest message without any modification
    const messagesToKeep = [userMessage]; // User's latest message is never affected
    let currentTokenCount = userMessageCount; // Start with user message token count

    // Work backwards from the second-to-last message (excluding user's latest message)
    // Only consider older messages for removal - never touch the user's latest message
    for (let i = messages.length - 2; i >= 0; i--) {
      const messageTokenCount = estimateTokenCount(
        getMessageContent(messages[i]),
      );

      // Check if adding this older message would exceed the token limit
      // if the current token count + the message token count is less than the limit, then add the message to the messages to keep
      // if the current token count + the message token count is greater than the limit, then stop adding messages
      if (currentTokenCount + messageTokenCount <= messageContextSizeLimit) {
        messagesToKeep.unshift(messages[i]); // Add to beginning to maintain chronological order
        currentTokenCount += messageTokenCount;
      } else {
        // Stop adding messages - we've reached the token limit
        // The user's latest message remains untouched
        break;
      }
    }

    onCompress?.(totalMessageWithoutUser, currentTokenCount);
    return messagesToKeep; // Always contains user's latest message as the last element
  }

  return messages;
}
