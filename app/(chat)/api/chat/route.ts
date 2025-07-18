import { auth } from '@/app/(auth)/auth';
import { createPromptRunner } from '@/lib/agent/prompt-runner/runner';
import { entitlementsByUserRole } from '@/lib/ai/entitlements';
import { createMCPClient } from '@/lib/ai/mcp';
import {
  getFilteredProviders,
  providerSupportsDocuments,
} from '@/lib/ai/models';
import {
  getMemoryContext,
  systemPrompt,
  type RequestHints,
} from '@/lib/ai/prompts';
import { getModelProvider } from '@/lib/ai/providers';
import { createDocument } from '@/lib/ai/tools/create-document';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { searchDocumentsTool } from '@/lib/ai/tools/search-documents';
import { searchWeb } from '@/lib/ai/tools/search-web';
import { testTool } from '@/lib/ai/tools/test-tool';
import { updateDocument } from '@/lib/ai/tools/update-document';
import {
  addToolResultToMessage,
  filterDocumentAttachments,
} from '@/lib/ai/utils';
import {
  isProductionEnvironment,
  isTestEnvironment,
  MAX_CONTEXT_TOKEN_COUNT,
} from '@/lib/constants';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  getUserById,
  saveChat,
  saveMessages,
} from '@/lib/db/queries/queries';
import { getUserPromptByUserId } from '@/lib/db/queries/prompts';
import type { Chat } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import { createMemoryClient } from '@/lib/memory';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { geolocation } from '@vercel/functions';
import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  NoSuchToolError,
  smoothStream,
  streamText,
  type UIMessage,
} from 'ai';
import { differenceInSeconds } from 'date-fns';
import { after } from 'next/server';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { generateTitleFromUserMessage } from '../../actions';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { track } from '@vercel/analytics/server';
import { compressMessage } from '@/lib/utils.server';

export const maxDuration = 800;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

async function getMCPTools() {
  if (isTestEnvironment) {
    return { tools: {}, client: null };
  }

  const mcpClient = await createMCPClient();
  const mcpTools = await mcpClient.tools();

  return { tools: mcpTools, client: mcpClient };
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (error) {
    console.error(error);
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedChatModel,
      selectedVisibilityType,
      selectedChatModelProvider,
      useWebSearch = false,
    } = requestBody;

    const provider = getModelProvider(
      selectedChatModel,
      selectedChatModelProvider,
    );
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // Get user data from database to validate permissions
    const user = await getUserById(session.user.id);
    if (!user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
        titleModel: provider.languageModel('title-model'),
      });

      // Update chat with generated title
      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    // Validate that user has access to the selected provider
    if (!user.availableModelProviders.includes(selectedChatModelProvider)) {
      return new ChatSDKError(
        'forbidden:chat',
        'Provider not available for user',
      ).toResponse();
    }

    // Get user entitlements and available models to validate the selected model
    const userEntitlements = entitlementsByUserRole[user.role];
    const availableProviders = await getFilteredProviders(
      user,
      userEntitlements,
      isTestEnvironment,
    );

    // Check if the selected model is available to this user
    const selectedProvider = availableProviders[selectedChatModelProvider];
    const isModelAvailable = selectedProvider?.models.some(
      (model) => model.id === selectedChatModel,
    );

    if (!isModelAvailable) {
      return new ChatSDKError(
        'forbidden:chat',
        'Model not available for user',
      ).toResponse();
    }

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    // Use user role-based entitlements for rate limiting
    if (messageCount > userEntitlements.maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    // Save user message immediately to ensure correct message ordering
    const currentTime = new Date();

    after(async () => {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: 'user',
            parts: message.parts,
            attachments: message.experimental_attachments ?? [],
            createdAt: currentTime,
            usage: null,
          },
        ],
      });

      // Track user message sending event
      track('user_send_message', {
        chatId: id,
        messageId: message.id,
        hasAttachments: (message.experimental_attachments ?? []).length > 0,
        attachmentCount: (message.experimental_attachments ?? []).length,
        selectedModel: selectedChatModel,
        selectedProvider: selectedChatModelProvider,
      });
    });

    const previousMessages = await getMessagesByChatId({ id });

    // Filter document attachments from messages if provider doesn't support them
    const messages = filterDocumentAttachments(
      appendClientMessage({
        // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
        messages: previousMessages,
        message,
      }),
      selectedChatModelProvider,
      selectedChatModel,
    );

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
      time: new Date().toISOString(),
    };

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // Use cached MCP tools for better performance
    const { tools: mcpTools, client: mcpClient } = await getMCPTools();

    let defaultSystemPrompt = await systemPrompt({
      selectedChatModel,
      requestHints,
      isModelSupportedForDocuments: providerSupportsDocuments(
        selectedChatModelProvider,
        selectedChatModel,
      ),
      documentAttachments: message.experimental_attachments ?? [],
      useWebSearch,
    });

    const userPrompt = await getUserPromptByUserId({
      userId: session.user.id,
    });

    if (userPrompt) {
      const userPromptResult = await createPromptRunner(userPrompt.code);
      defaultSystemPrompt = `
      ${defaultSystemPrompt}

      User also provided the following prompt:
      ${userPromptResult}
      `;
    }

    // Determine if memory should be loaded based on optimization conditions:
    // 1. First conversation (no previous messages), OR
    // 2. Current chat has more than 10k tokens
    const compressedMessages: Array<UIMessage> = (await compressMessage(
      messages as any,
      MAX_CONTEXT_TOKEN_COUNT,
      (tokenCountBefore, tokenCountAfter) => {
        track('compress_message', {
          tokenCountBefore,
          tokenCountAfter,
        });
      },
    )) as any as UIMessage[];

    // Search memory for relevant context to enhance the system prompt
    const memoryContext = await getMemoryContext(
      message.content,
      session.user.id,
      true,
    );

    // Add memory context to system prompt if available
    if (memoryContext) {
      defaultSystemPrompt = `${defaultSystemPrompt}${memoryContext}`;
    }

    const model = provider.languageModel(selectedChatModel);
    const testingTools: Record<string, any> = {};
    if (isTestEnvironment) {
      testingTools.testTool = testTool;
    }

    const stream = createDataStream({
      execute: (dataStream) => {
        const result = streamText({
          model,
          system: defaultSystemPrompt,
          messages: compressedMessages,
          maxSteps: 30,
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_repairToolCall: async ({
            toolCall,
            tools,
            parameterSchema,
            error,
          }) => {
            if (NoSuchToolError.isInstance(error)) {
              return null;
            }

            if (toolCall.toolName === 'useTool') {
              if (Object.is(toolCall.args, '')) {
                const args = toolCall.args as unknown as Record<string, any>;
                if (typeof args.input === 'string') {
                  return {
                    ...toolCall,
                    args: {
                      ...args,
                      input: JSON.parse(args.input),
                    } as any,
                  };
                }
              }
            }
            return toolCall;
          },
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({
              session,
              dataStream,
              selectedChatModelProvider,
              selectedChatModel,
              userMessage: message,
            }),
            updateDocument: updateDocument({
              session,
              dataStream,
              selectedChatModelProvider,
              selectedChatModel,
            }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
              selectedChatModelProvider,
              selectedChatModel,
            }),
            searchDocuments: searchDocumentsTool({
              session,
            }),
            searchWeb: searchWeb(),
            ...mcpTools,
            ...testingTools,
          },
          onFinish: async ({ response, usage }) => {
            mcpClient?.close();
            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: response.messages.filter(
                    (message) => message.role === 'assistant',
                  ),
                });

                if (!assistantId) {
                  throw new Error('No assistant message found!');
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [message],
                  responseMessages: response.messages,
                });

                await saveMessages({
                  messages: [
                    addToolResultToMessage({
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: assistantMessage.parts,
                      attachments:
                        assistantMessage.experimental_attachments ?? [],
                      createdAt: new Date(),
                      usage,
                    } as any) as any,
                  ],
                });

                // Add conversation to memory for future context
                try {
                  const memoryClient = createMemoryClient();

                  // Extract assistant response content from parts
                  const assistantContent =
                    assistantMessage.parts
                      ?.filter((part: any) => part.type === 'text')
                      ?.map((part: any) => part.text)
                      ?.join(' ') || '';

                  if (assistantContent.trim()) {
                    const conversationMessages = [
                      {
                        role: 'user' as const,
                        content: message.content,
                      },
                      {
                        role: 'assistant' as const,
                        content: assistantContent,
                      },
                    ];

                    await memoryClient.add(conversationMessages, {
                      user_id: session.user.id,
                    });
                  }
                } catch (memoryError) {
                  console.error(
                    'Failed to add conversation to memory:',
                    memoryError,
                  );
                  // Don't throw here to avoid breaking the main chat flow
                }
              } catch (_) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: (error) => {
        console.log('error', error);
        if ('name' in (error as any)) {
          return (error as any).message;
        }
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () => stream),
      );
    } else {
      return new Response(stream);
    }
  } catch (error) {
    console.error('Error in chat route:', error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new Response(
      JSON.stringify({
        code: 500,
        message: 'Oops, an error occurred!',
      }),
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  const stream = await streamContext.resumableStream(
    recentStreamId,
    () => emptyDataStream,
  );

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createDataStream({
      execute: (buffer) => {
        buffer.writeData({
          type: 'append-message',
          message: JSON.stringify(mostRecentMessage),
        });
      },
    });

    return new Response(restoredStream, { status: 200 });
  }

  return new Response(stream, { status: 200 });
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return new ChatSDKError('bad_request:api').toResponse();
    }

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new ChatSDKError('forbidden:chat').toResponse();
    }

    const deletedChat = await deleteChatById({ id });

    return Response.json(deletedChat, { status: 200 });
  } catch (error) {
    console.error('Error in chat delete route:', error);
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return new Response(
      JSON.stringify({
        code: 500,
        message: 'Oops, an error occurred!',
      }),
      { status: 500 },
    );
  }
}
