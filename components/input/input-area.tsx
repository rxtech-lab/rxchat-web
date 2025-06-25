'use client';

import type { UseChatHelpers } from '@ai-sdk/react';
import cx from 'classnames';
import type React from 'react';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useLocalStorage } from 'usehooks-ts';
import { AttachmentsButton } from './attachment-button';
import { LexicalEditor } from './lexical-editor';
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
  // WebSearch props with defaults
  isWebSearchEnabled = false,
  onWebSearchToggle = () => {},
}: InputAreaProps) {
  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
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
  }, [status, onSubmit, setLocalStorageInput]);

  // Initialize with localStorage value
  useEffect(() => {
    const finalValue = localStorageInput || '';
    setInput(finalValue);
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync input with localStorage
  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  return (
    <div
      className={cx(
        'flex flex-col w-full rounded-2xl bg-muted border border-zinc-200 dark:border-zinc-700',
        className,
      )}
    >
      {/* Input Editor Area */}
      <div className="flex-1 min-h-[24px] max-h-[calc(75dvh)] overflow-hidden">
        <LexicalEditor
          value={input}
          onChange={setInput}
          onSubmit={submitForm}
          className="h-full"
        />
      </div>

      {/* Toolbar Area */}
      <div className="flex items-center justify-between p-2 border-zinc-200/50 dark:border-zinc-700/50 bg-muted/50 rounded-b-2xl">
        {/* Left side tools */}
        <div className="flex items-center gap-2">
          <AttachmentsButton fileInputRef={fileInputRef} status={status} />
          <WebSearchButton
            isWebSearchEnabled={isWebSearchEnabled}
            onToggle={onWebSearchToggle}
            status={status}
          />
        </div>

        {/* Right side send/stop button */}
        <div className="flex items-center">
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
    </div>
  );
}
