'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import cx from 'classnames';
import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';
import { Textarea } from '../ui/textarea';
import { AttachmentsButton } from './attachment-button';
import { MCPButton } from './mcp-button';
import { SendButton, StopButton } from './send-button';
import { WebSearchButton } from './websearch-button';

interface InputAreaProps {
  input: UseChatHelpers['input'];
  setInput: UseChatHelpers['setInput'];
  status: UseChatHelpers['status'];
  setMessages: UseChatHelpers['setMessages'];
  stop: () => void;
  onSubmit: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  uploadQueue: Array<string>;
  className?: string;
  mcpTools?: any[];
  // WebSearch functionality props
  isWebSearchEnabled?: boolean;
  onWebSearchToggle?: () => void;
}

/**
 * Component for the main input textarea and its controls
 * @param props - Props containing input state and handlers
 * @returns JSX element with the input area
 */
export function InputArea({
  input,
  setInput,
  status,
  setMessages,
  stop,
  onSubmit,
  fileInputRef,
  uploadQueue,
  className,
  mcpTools = [],
  // WebSearch props with defaults
  isWebSearchEnabled = false,
  onWebSearchToggle = () => {},
}: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  /**
   * Adjust textarea height based on content
   */
  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  }, []);

  /**
   * Reset textarea height to default
   */
  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = '98px';
    }
  }, []);

  /**
   * Handle input changes in textarea
   */
  const handleInput = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
      adjustHeight();
    },
    [setInput, adjustHeight],
  );

  /**
   * Handle form submission
   */
  const submitForm = useCallback(() => {
    if (status !== 'ready' && status !== 'error') {
      toast.error('Please wait for the model to finish its response!');
      return;
    }

    onSubmit();
    setLocalStorageInput('');
    resetHeight();

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [status, onSubmit, setLocalStorageInput, resetHeight, width]);

  // Initialize textarea height and value
  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  // Initialize with localStorage value
  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync input with localStorage
  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  return (
    <div className="relative w-full">
      <Textarea
        data-testid="multimodal-input"
        ref={textareaRef}
        placeholder="Send a message..."
        value={input}
        onChange={handleInput}
        className={cx(
          'min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700 focus-visible:outline-none focus:outline-none focus-visible:ring-0 focus:ring-0 focus-visible:ring-offset-0 focus:ring-offset-0 border-l border-r border-b border-zinc-200',
          className,
        )}
        rows={2}
        autoFocus
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submitForm();
          }
        }}
      />

      <div className="absolute bottom-0 p-2 w-fit flex flex-row justify-start gap-2 items-center">
        <AttachmentsButton fileInputRef={fileInputRef} status={status} />
        <MCPButton mcpTools={mcpTools} />
        <WebSearchButton
          isWebSearchEnabled={isWebSearchEnabled}
          onToggle={onWebSearchToggle}
          status={status}
        />
      </div>

      <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row justify-end">
        {status === 'submitted' || status === 'streaming' ? (
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
}
