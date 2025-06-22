'use client';

import type { Prompt } from '@/lib/db/schema';
import type { Attachment, UIMessage } from 'ai';
import type React from 'react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { UseChatHelpers } from '@ai-sdk/react';
import equal from 'fast-deep-equal';
import useSWR from 'swr';
import {
  getMCPTools,
  saveWebSearchPreferenceAsCookie,
} from '@/app/(chat)/actions';
import { SuggestedActions } from '../suggested-actions';
import { AttachmentsPreview } from './attachments-preview';
import { useDocumentManager } from './document-manager';
import { useFileUpload } from './file-upload-handler';
import { InputArea } from './input-area';
import { PromptDialog } from './prompt-dialog';
import { ScrollToBottom } from './scroll-to-bottom';
import type { UploadedDocument } from './types';
import type { VisibilityType } from '../visibility-selector';
import { toast } from 'sonner';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  append,
  handleSubmit,
  className,
  selectedVisibilityType,
  selectedPrompt,
  initialWebSearchEnabled = false,
}: {
  chatId: string;
  input: UseChatHelpers['input'];
  setInput: UseChatHelpers['setInput'];
  status: UseChatHelpers['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: React.Dispatch<React.SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  append: UseChatHelpers['append'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedPrompt: Prompt | null;
  initialWebSearchEnabled?: boolean;
}) {
  // State for file uploads and documents
  const [uploadedDocuments, setUploadedDocuments] = useState<
    Array<UploadedDocument>
  >([]);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);
  // WebSearch state managed with cookies
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(
    initialWebSearchEnabled,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom hooks for functionality
  const { handleFileChange } = useFileUpload({
    setAttachments,
    setUploadedDocuments,
    setUploadQueue,
    uploadQueue,
  });

  const { deleteDocument } = useDocumentManager({
    uploadedDocuments,
    setUploadedDocuments,
    setAttachments,
  });

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  // Handle attachment deletion
  const deleteAttachment = useCallback(
    (attachmentUrl: string) => {
      setAttachments((currentAttachments) =>
        currentAttachments.filter(
          (attachment) => attachment.url !== attachmentUrl,
        ),
      );
    },
    [setAttachments],
  );

  // Submit form handler with websearch flag
  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    try {
      // Store the websearch flag in a temporary way that can be accessed during request preparation
      (window as any).__webSearchEnabled = isWebSearchEnabled;

      handleSubmit(undefined, {
        experimental_attachments: attachments,
      });

      setAttachments([]);
      setUploadedDocuments([]);
      // Note: websearch state will be reset when status returns to 'ready'
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
      console.error('Error submitting form:', error);
    }
  }, [attachments, handleSubmit, setAttachments, chatId, isWebSearchEnabled]);

  // Handle websearch toggle
  const handleWebSearchToggle = useCallback(() => {
    setIsWebSearchEnabled((prev) => {
      const newValue = !prev;
      // Save to cookie using startTransition
      startTransition(() => {
        saveWebSearchPreferenceAsCookie(newValue);
      });
      return newValue;
    });
  }, []);

  // Scroll to bottom when message is submitted
  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  // Get MCP tools
  const { data: mcpTools } = useSWR('/api/mcp-tools', getMCPTools, {
    revalidateOnFocus: false,
  });

  // Check if there are any attachments/uploads
  const hasAttachments =
    attachments.length > 0 ||
    uploadedDocuments.length > 0 ||
    uploadQueue.length > 0;

  // Input area component
  const InputAreaComponent = useMemo(
    () => (
      <div className="relative w-full flex flex-col gap-4">
        <ScrollToBottom
          isAtBottom={isAtBottom}
          onScrollToBottom={scrollToBottom}
        />

        <input
          type="file"
          className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
          ref={fileInputRef}
          multiple
          onChange={handleFileChange}
          accept="image/*,.pdf,.txt,.md,.html,.css,.js,.jsx,.ts,.tsx,.json,.py,.java,.cs,.php,.rb,.go,.rs,.swift,.kt,.scala,.sh,.yml,.yaml,.toml,.c,.cpp,.h,.hpp,.sql,.r,.m,.vim,.dockerfile,.gitignore,.env,.csv,.xml"
          tabIndex={-1}
        />

        <AttachmentsPreview
          attachments={attachments}
          uploadedDocuments={uploadedDocuments}
          uploadQueue={uploadQueue}
          onDeleteAttachment={deleteAttachment}
          onDeleteDocument={deleteDocument}
        />

        <InputArea
          input={input}
          setInput={setInput}
          status={status}
          setMessages={setMessages}
          stop={stop}
          onSubmit={submitForm}
          fileInputRef={fileInputRef}
          uploadQueue={uploadQueue}
          className={className}
          mcpTools={mcpTools ?? []}
          isWebSearchEnabled={isWebSearchEnabled}
          onWebSearchToggle={handleWebSearchToggle}
        />
      </div>
    ),
    [
      isAtBottom,
      scrollToBottom,
      handleFileChange,
      attachments,
      uploadedDocuments,
      uploadQueue,
      deleteAttachment,
      deleteDocument,
      input,
      setInput,
      status,
      setMessages,
      stop,
      submitForm,
      className,
      mcpTools,
      isWebSearchEnabled,
      handleWebSearchToggle,
    ],
  );

  return (
    <div className="relative w-full flex flex-col gap-4">
      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadedDocuments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            append={append}
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}
      {messages.length === 0 && <div className="h-12" />}
      <div className="relative w-full flex flex-col gap-4">
        <div
          className={`flex flex-row gap-2 ${hasAttachments ? 'h-44 -top-10' : 'h-32 -top-12'} absolute bg-white dark:bg-zinc-900 w-full rounded-t-2xl shadow-t-lg border-t border-x border-zinc-200 dark:border-zinc-700 p-2`}
        >
          <PromptDialog currentPrompt={selectedPrompt || undefined} />
        </div>
        {InputAreaComponent}
      </div>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.selectedPrompt !== nextProps.selectedPrompt) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;
    if (prevProps.initialWebSearchEnabled !== nextProps.initialWebSearchEnabled)
      return false;

    return true;
  },
);
