'use client';

import type { Attachment, UIMessage } from 'ai';
import type { Prompt } from '@/lib/db/schema';
import cx from 'classnames';
import type React from 'react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import { getMCPTools } from '@/app/(chat)/actions';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import type { UseChatHelpers } from '@ai-sdk/react';
import equal from 'fast-deep-equal';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import useSWR from 'swr';
import { PreviewAttachment } from '../preview-attachment';
import { SuggestedActions } from '../suggested-actions';
import { Button } from '../ui/button';
import { MarkdownView } from '../markdown-view';
import type { VisibilityType } from '../visibility-selector';
import { AttachmentsButton } from './attachment-button';
import { MCPButton } from './mcp-button';
import { PromptDialog } from './prompt-dialog';
import { SendButton, StopButton } from './send-button';

// Add document interface
interface UploadedDocument {
  id: string;
  filename: string;
  originalFileName: string;
  size: number;
}

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
}: {
  chatId: string;
  input: UseChatHelpers['input'];
  setInput: UseChatHelpers['setInput'];
  status: UseChatHelpers['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers['setMessages'];
  append: UseChatHelpers['append'];
  handleSubmit: UseChatHelpers['handleSubmit'];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedPrompt: Prompt | null;
}) {
  const { width } = useWindowSize();

  // Add state for uploaded documents
  const [uploadedDocuments, setUploadedDocuments] = useState<
    Array<UploadedDocument>
  >([]);

  const handleInputChange = useCallback((content: string) => {
    setInput(content);
  }, [setInput]);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    // Prefer input value over localStorage to handle hydration
    const finalValue = input || localStorageInput || '';
    setInput(finalValue);
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    handleSubmit(undefined, {
      experimental_attachments: attachments,
    });

    setAttachments([]);
    setUploadedDocuments([]); // Clear uploaded documents on submit
    setLocalStorageInput('');

    if (width && width > 768) {
      // Focus will be handled by MarkdownView component
    }
  }, [
    attachments,
    handleSubmit,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  const uploadFile = async (file: File) => {
    const uploadPromise = async () => {
      // Step 1: Get presigned URL from our API
      const metadataResponse = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          mimeType: file.type,
        }),
      });

      if (!metadataResponse.ok) {
        const { error } = await metadataResponse.json();
        throw new Error(error || 'Failed to get upload URL');
      }

      const uploadData = await metadataResponse.json();

      // Step 2: Upload directly to S3 using presigned URL
      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      // Step 3: Handle completion based on file type
      if (uploadData.type === 'image') {
        // For images, return the public URL
        return {
          type: 'image',
          url: uploadData.publicUrl,
          name: uploadData.filename,
          contentType: uploadData.contentType,
        };
      } else if (uploadData.type === 'document') {
        // For documents, complete the upload process
        const completeResponse = await fetch('/api/documents/complete-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: uploadData.documentId,
          }),
        });

        if (!completeResponse.ok) {
          const { error } = await completeResponse.json();
          throw new Error(error || 'Failed to complete document upload');
        }

        // Return document data for tracking
        return {
          type: 'document',
          id: uploadData.documentId,
          filename: uploadData.filename,
          originalFileName: file.name,
          size: file.size,
        };
      } else {
        throw new Error('Unknown upload type');
      }
    };

    try {
      const toastPromise = toast.promise(uploadPromise(), {
        loading: `Uploading ${file.name}...`,
        success: (data) => {
          if (data.type === 'document') {
            return `Document "${data.filename}" uploaded successfully`;
          }
          return `${file.name} uploaded successfully`;
        },
        error: (error) =>
          error.message || 'Failed to upload file, please try again!',
      });

      const result = await toastPromise.unwrap();

      return result;
    } catch (error) {
      return null;
    }
  };

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadResults = await Promise.all(uploadPromises);

        // Separate images and documents
        const images = uploadResults.filter(
          (
            result,
          ): result is {
            type: 'image';
            url: string;
            name: string;
            contentType: string;
          } => result !== null && result.type === 'image',
        );

        const documents = uploadResults.filter(
          (result): result is UploadedDocument & { type: 'document' } =>
            result !== null && result.type === 'document',
        );

        // Add images to attachments
        if (images.length > 0) {
          setAttachments((currentAttachments) => [
            ...currentAttachments,
            ...images.map((img) => ({
              url: img.url,
              name: img.name,
              contentType: img.contentType,
            })),
          ]);
        }

        // Add documents to uploadedDocuments
        if (documents.length > 0) {
          setUploadedDocuments((currentDocuments) => [
            ...currentDocuments,
            ...documents.map((doc) => ({
              id: doc.id,
              filename: doc.filename,
              originalFileName: doc.originalFileName,
              size: doc.size,
            })),
          ]);
        }
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  // Add delete functions
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

  const deleteDocument = useCallback(async (documentId: string) => {
    try {
      const confirm = window.confirm(
        'Are you sure you want to delete this document?',
      );
      if (!confirm) {
        return;
      }
      const promise = async () => {
        const response = await fetch(`/api/documents/${documentId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete document');
        }

        setUploadedDocuments((currentDocuments) =>
          currentDocuments.filter((doc) => doc.id !== documentId),
        );
      };

      toast.promise(promise, {
        loading: 'Deleting document...',
        success: 'Document deleted successfully',
        error: 'Failed to delete document',
      });
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  }, []);

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  useEffect(() => {
    if (status === 'submitted') {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);

  const { data: mcpTools } = useSWR('/api/mcp-tools', getMCPTools, {
    revalidateOnFocus: false,
  });

  const InputArea = useMemo(() => {
    return (
      <div className="relative w-full flex flex-col gap-4">
        <AnimatePresence>
          {!isAtBottom && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="absolute left-1/2 bottom-28 -translate-x-1/2 z-50"
            >
              <Button
                data-testid="scroll-to-bottom-button"
                className="rounded-full"
                size="icon"
                variant="outline"
                onClick={(event) => {
                  event.preventDefault();
                  scrollToBottom();
                }}
              >
                <ArrowDown />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <input
          type="file"
          className="fixed -top-4 -left-4 size-0.5 opacity-0 pointer-events-none"
          ref={fileInputRef}
          multiple
          onChange={handleFileChange}
          accept="image/*,.pdf,.txt,.md,.html,.css,.js,.jsx,.ts,.tsx,.json,.py,.java,.cs,.php,.rb,.go,.rs,.swift,.kt,.scala,.sh,.yml,.yaml,.toml,.c,.cpp,.h,.hpp,.sql,.r,.m,.vim,.dockerfile,.gitignore,.env,.csv,.xml"
          tabIndex={-1}
        />

        {(attachments.length > 0 ||
          uploadedDocuments.length > 0 ||
          uploadQueue.length > 0) && (
          <div
            data-testid="attachments-preview"
            className="flex flex-row gap-2 overflow-x-scroll items-end py-2"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                key={attachment.url}
                attachment={attachment}
                onDelete={() => deleteAttachment(attachment.url)}
                type="attachment"
              />
            ))}

            {uploadedDocuments.map((document) => (
              <PreviewAttachment
                key={document.id}
                attachment={{
                  url: '',
                  name: document.originalFileName,
                  contentType: 'document',
                }}
                onDelete={() => deleteDocument(document.id)}
                type="document"
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                key={filename}
                attachment={{
                  url: '',
                  name: filename,
                  contentType: '',
                }}
                isUploading={true}
                type="uploading"
              />
            ))}
          </div>
        )}

        <MarkdownView
          data-testid="multimodal-input"
          value={input}
          readOnly={false}
          onChange={handleInputChange}
          placeholder="Send a message..."
          className={cx(
            'resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700 focus-visible:outline-none focus:outline-none focus-visible:ring-0 focus:ring-0 focus-visible:ring-offset-0 focus:ring-offset-0 border-l border-r border-b border-zinc-200',
            className,
          )}
          minHeight={24}
          maxHeight="calc(75dvh)"
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !(event as any).isComposing
            ) {
              event.preventDefault();

              if (status !== 'ready') {
                toast.error(
                  'Please wait for the model to finish its response!',
                );
              } else {
                submitForm();
              }
            }
          }}
        />

        <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start gap-2 items-center">
          <AttachmentsButton fileInputRef={fileInputRef} status={status} />
          <MCPButton mcpTools={mcpTools ?? []} />
        </div>

        <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
          {status === 'submitted' ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <SendButton
              input={input}
              submitForm={submitForm}
              uploadQueue={uploadQueue}
            />
          )}
        </div>
      </div>
    );
  }, [
    isAtBottom,
    handleFileChange,
    attachments,
    uploadedDocuments,
    uploadQueue,
    input,
    handleInputChange,
    className,
    status,
    mcpTools,
    stop,
    setMessages,
    submitForm,
    scrollToBottom,
    deleteAttachment,
    deleteDocument,
  ]);

  const hasAttachments =
    attachments.length > 0 ||
    uploadedDocuments.length > 0 ||
    uploadQueue.length > 0;

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
        {InputArea}
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

    return true;
  },
);
