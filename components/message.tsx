'use client';

import type { Vote } from '@/lib/db/schema';
import { cn, sanitizeText } from '@/lib/utils';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import cx from 'classnames';
import equal from 'fast-deep-equal';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState } from 'react';
import { CodeView } from './code-view';
import { DocumentToolCall, DocumentToolResult } from './document';
import { DocumentPreview } from './document-preview';
import { DocumentSearchResult } from './document-search-result';
import { WebSearchResult } from './web-search-result';
import { PencilEditIcon, SparklesIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { MessageEditor } from './message-editor';
import { MessageReasoning } from './message-reasoning';
import { PreviewAttachment } from './preview-attachment';
import { ToolInvocationHeader } from './tool-invocation-header';
import { Button } from './ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  McpToolResultSchema,
  parseMcpContent,
} from '@/components/message.utils';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  requiresScrollPadding,
  append,
  status,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  append: UseChatHelpers['append'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  status: UseChatHelpers['status'];
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
              <div className="translate-y-px">
                <SparklesIcon size={14} />
              </div>
            </div>
          )}

          <div
            className={cn('flex flex-col gap-4 w-full', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            })}
          >
            {message.experimental_attachments &&
              message.experimental_attachments.length > 0 && (
                <div
                  data-testid={`message-attachments`}
                  className="flex flex-row justify-end gap-2"
                >
                  {message.experimental_attachments.map((attachment) => (
                    <PreviewAttachment
                      key={attachment.url}
                      attachment={attachment}
                    />
                  ))}
                </div>
              )}

            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.reasoning}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      {message.role === 'user' && !isReadonly && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              data-testid="message-edit-button"
                              variant="ghost"
                              className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                              onClick={() => {
                                setMode('edit');
                              }}
                            >
                              <PencilEditIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit message</TooltipContent>
                        </Tooltip>
                      )}

                      <div
                        data-testid="message-content"
                        className={cn('flex flex-col gap-4', {
                          'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                            message.role === 'user',
                        })}
                      >
                        <Markdown>{sanitizeText(part.text)}</Markdown>
                      </div>
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <div className="size-8" />

                      <MessageEditor
                        key={message.id}
                        message={message}
                        setMode={setMode}
                        setMessages={setMessages}
                        reload={reload}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-invocation') {
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                const renderCallContent = () => {
                  const { args } = toolInvocation;

                  if (toolName === 'createDocument') {
                    return (
                      <DocumentPreview isReadonly={isReadonly} args={args} />
                    );
                  } else if (toolName === 'updateDocument') {
                    return (
                      <DocumentToolCall
                        type="update"
                        args={args}
                        isReadonly={isReadonly}
                      />
                    );
                  } else if (toolName === 'requestSuggestions') {
                    return (
                      <DocumentToolCall
                        type="request-suggestions"
                        args={args}
                        isReadonly={isReadonly}
                      />
                    );
                  } else {
                    return (
                      <CodeView
                        code={JSON.stringify(args, null, 4)}
                        language="json"
                        maxHeight={400}
                      />
                    );
                  }
                };

                const result =
                  state === 'result' ? toolInvocation.result : null;
                const parsedResult = result ? parseMcpContent(result) : null;
                const parsedMcpResult = parsedResult
                  ? McpToolResultSchema.safeParse(parsedResult)
                  : { success: false };

                const renderResultContent = () => {
                  if (state !== 'result' || !result)
                    return (
                      <div className="text-muted-foreground p-4">
                        No result data available
                      </div>
                    );

                  if (toolName === 'createDocument') {
                    return (
                      <DocumentPreview
                        isReadonly={isReadonly}
                        result={result}
                      />
                    );
                  } else if (toolName === 'updateDocument') {
                    return (
                      <DocumentToolResult
                        type="update"
                        result={result}
                        isReadonly={isReadonly}
                      />
                    );
                  } else if (toolName === 'requestSuggestions') {
                    return (
                      <DocumentToolResult
                        type="request-suggestions"
                        result={result}
                        isReadonly={isReadonly}
                      />
                    );
                  } else if (toolName === 'searchDocuments') {
                    return (
                      <DocumentSearchResult
                        result={result}
                        isReadonly={isReadonly}
                      />
                    );
                  } else if (toolName === 'searchWeb') {
                    return (
                      <WebSearchResult
                        result={result}
                        isReadonly={isReadonly}
                      />
                    );
                  } else {
                    return (
                      <CodeView
                        code={JSON.stringify(parsedResult, null, 2)}
                        language="json"
                        maxHeight={400}
                      />
                    );
                  }
                };

                const isValidMcpResult =
                  state === 'result' &&
                  parsedMcpResult.success &&
                  (parsedMcpResult as any).data[0]?.url?.length > 0;

                const iframeUrl = isValidMcpResult
                  ? (parsedMcpResult as any).data[0]?.url
                  : undefined;

                return (
                  <Collapsible
                    key={toolCallId}
                    defaultOpen={
                      isValidMcpResult ||
                      toolName === 'createDocument' ||
                      toolName === 'updateDocument'
                    }
                  >
                    {toolName !== 'createDocument' &&
                      toolName !== 'updateDocument' && (
                        <CollapsibleTrigger className="flex items-center gap-3 p-4 hover:bg-muted/50 rounded-lg border w-full text-left transition-colors">
                          <ToolInvocationHeader
                            toolName={toolName}
                            toolInvocation={toolInvocation}
                            status={status}
                            iframeUrl={iframeUrl}
                            append={append}
                            suggestionHeight={
                              (parsedMcpResult as any).data?.[0]?.suggestHeight
                            }
                            suggestions={
                              (parsedMcpResult as any).data?.[0]?.suggestions
                            }
                          />
                        </CollapsibleTrigger>
                      )}
                    <CollapsibleContent className="mt-2">
                      {!isValidMcpResult &&
                        toolName !== 'createDocument' &&
                        toolName !== 'updateDocument' && (
                          <Tabs defaultValue={state} className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                              <TabsTrigger value="call">Call</TabsTrigger>
                              <TabsTrigger value="result">Result</TabsTrigger>
                            </TabsList>
                            <TabsContent
                              value="call"
                              className="mt-4 min-w-0 w-full"
                            >
                              {renderCallContent()}
                            </TabsContent>
                            <TabsContent
                              value="result"
                              className="mt-4 min-w-0 w-full"
                            >
                              {renderResultContent()}
                            </TabsContent>
                          </Tabs>
                        )}
                      {(toolName === 'createDocument' ||
                        toolName === 'updateDocument') && (
                        <div className="mt-4">
                          {state === 'call'
                            ? renderCallContent()
                            : renderResultContent()}
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message min-h-96"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Hmm...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
