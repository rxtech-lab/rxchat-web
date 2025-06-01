'use client';

import type { UIMessage } from 'ai';
import { Button } from './ui/button';
import {
  type Dispatch,
  type SetStateAction,
  useState,
} from 'react';
import { MarkdownView } from './markdown-view';
import { deleteTrailingMessages } from '@/app/(chat)/actions';
import type { UseChatHelpers } from '@ai-sdk/react';

export type MessageEditorProps = {
  message: UIMessage;
  setMode: Dispatch<SetStateAction<'view' | 'edit'>>;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
};

export function MessageEditor({
  message,
  setMode,
  setMessages,
  reload,
}: MessageEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const initialContent =
    message.parts?.find((part) => part.type === 'text')?.text ||
    message.content ||
    '';
  const [draftContent, setDraftContent] = useState<string>(initialContent);

  const handleContentChange = (content: string) => {
    setDraftContent(content);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Replace Textarea with MarkdownView in editable mode */}
      <MarkdownView
        data-testid="message-editor"
        value={draftContent}
        readOnly={false}
        onChange={handleContentChange}
        placeholder="Edit your message..."
        className="bg-transparent outline-none resize-none !text-base rounded-xl w-full border border-input px-3 py-2"
        minHeight={80}
      />

      <div className="flex flex-row gap-2 justify-end">
        <Button
          variant="outline"
          className="h-fit py-2 px-3"
          onClick={() => {
            setMode('view');
          }}
        >
          Cancel
        </Button>
        <Button
          data-testid="message-editor-send-button"
          variant="default"
          className="h-fit py-2 px-3"
          disabled={isSubmitting}
          onClick={async () => {
            setIsSubmitting(true);

            await deleteTrailingMessages({
              id: message.id,
            });

            // @ts-expect-error todo: support UIMessage in setMessages
            setMessages((messages) => {
              const index = messages.findIndex((m) => m.id === message.id);

              if (index !== -1) {
                const updatedMessage = {
                  ...message,
                  content: draftContent,
                  parts: [{ type: 'text', text: draftContent }],
                };

                return [...messages.slice(0, index), updatedMessage];
              }

              return messages;
            });

            setMode('view');
            reload();
          }}
        >
          {isSubmitting ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
