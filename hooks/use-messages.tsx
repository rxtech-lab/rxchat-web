import { useState, useEffect, useRef } from 'react';
import { useScrollToBottom } from './use-scroll-to-bottom';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';

export function useMessages({
  chatId,
  status,
  messages,
}: {
  chatId: string;
  status: UseChatHelpers['status'];
  messages?: Array<UIMessage>;
}) {
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  } = useScrollToBottom();

  const [hasSentMessage, setHasSentMessage] = useState(false);
  const lastMessagePartsRef = useRef<string>('');

  useEffect(() => {
    if (chatId) {
      scrollToBottom('instant');
      setHasSentMessage(false);
      lastMessagePartsRef.current = '';
    }
  }, [chatId, scrollToBottom]);

  useEffect(() => {
    if (status === 'submitted') {
      setHasSentMessage(true);
    }
  }, [status]);

  // Auto-scroll to bottom when streaming if user is already at bottom
  useEffect(() => {
    if (
      status === 'streaming' &&
      isAtBottom &&
      messages &&
      messages.length > 0
    ) {
      const lastMessage = messages[messages.length - 1];

      // Only scroll if this is an assistant message and content has changed
      if (lastMessage?.role === 'assistant') {
        // Serialize the parts to detect changes
        const currentParts = JSON.stringify(lastMessage.parts || []);

        if (currentParts !== lastMessagePartsRef.current) {
          lastMessagePartsRef.current = currentParts;

          // Use a small delay to ensure DOM has updated with new content
          const timeoutId = setTimeout(() => {
            scrollToBottom('smooth');
          }, 50);

          return () => clearTimeout(timeoutId);
        }
      }
    }
  }, [status, isAtBottom, messages, scrollToBottom]);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    hasSentMessage,
  };
}
