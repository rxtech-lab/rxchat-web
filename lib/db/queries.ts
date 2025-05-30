import 'server-only';

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  type SQL,
} from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { ArtifactKind } from '@/components/artifact';
import type { VisibilityType } from '@/components/visibility-selector';
import { isTestEnvironment } from '../constants';
import { ChatSDKError } from '../errors';
import { generateUUID } from '../utils';
import {
  chat,
  document,
  message,
  prompt,
  stream,
  suggestion,
  user,
  userPrompt,
  vote,
  passkeyAuthenticator,
  type Chat,
  type DBMessage,
  type Prompt,
  type Suggestion,
  type User,
  type PasskeyAuthenticator,
} from './schema';
import { generateHashedPassword } from './utils';

const client = postgres(
  isTestEnvironment
    ? // biome-ignore lint: Forbidden non-null assertion.
      process.env.POSTGRES_URL_TEST!
    : // biome-ignore lint: Forbidden non-null assertion.
      process.env.POSTGRES_URL!,
);
const db = drizzle(client);

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user by email',
    );
  }
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const [result] = await db.select().from(user).where(eq(user.id, id));
    if (result) {
      if (isTestEnvironment) {
        result.availableModelProviders = [
          ...result.availableModelProviders,
          'test',
        ];
      }
    }
    return result;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get user by id');
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create user');
  }
}

export async function createUserWithoutPassword(email: string) {
  try {
    // Check if user already exists
    const existingUsers = await getUser(email);
    if (existingUsers.length > 0) {
      throw new ChatSDKError(
        'bad_request:auth',
        'User with this email already exists',
      );
    }

    const [newUser] = await db.insert(user).values({ email }).returning();
    return newUser;
  } catch (error) {
    // Re-throw ChatSDKError as is
    if (error instanceof ChatSDKError) {
      throw error;
    }

    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create user without password',
    );
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create guest user',
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db
      .insert(chat)
      .values({
        id,
        createdAt: new Date(),
        userId,
        title,
        visibility,
      })
      .onConflictDoUpdate({
        target: [chat.id],
        set: {
          title,
          visibility,
        },
      });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save chat');
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete chat by id',
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id),
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Array<Chat> = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${startingAfter} not found`,
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          'not_found:database',
          `Chat with id ${endingBefore} not found`,
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get chats by user id',
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    return selectedChat;
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to get chat by id');
  }
}

export async function saveMessages({
  messages,
}: {
  messages: Array<DBMessage>;
}) {
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save messages');
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get messages by chat id',
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to vote message');
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get votes by chat id',
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning();
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to save document');
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get documents by id',
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete documents by id after timestamp',
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to save suggestions',
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get suggestions by document id',
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message by id',
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );

    const messageIds = messagesToDelete.map((message) => message.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
        );
    }
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete messages by chat id after timestamp',
    );
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update chat visibility by id',
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: { id: string; differenceInHours: number }) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000,
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, 'user'),
        ),
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get message count by user id',
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create stream id',
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get stream ids by chat id',
    );
  }
}

export async function getPromptsByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(prompt)
      .where(eq(prompt.authorId, userId))
      .orderBy(desc(prompt.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get prompts by user id',
    );
  }
}

export async function getUserPromptByUserId({
  userId,
}: { userId: string }): Promise<Prompt | null> {
  try {
    const prompts = await db
      .select()
      .from(userPrompt)
      .innerJoin(prompt, eq(userPrompt.promptId, prompt.id))
      .where(eq(userPrompt.userId, userId))
      .limit(1);

    if (prompts.length === 0) {
      return null;
    }

    return prompts[0].Prompt;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get user prompts by user id',
    );
  }
}

export async function createPrompt({
  prompt: createdPrompt,
  userId,
}: {
  prompt: Prompt;
  userId: string;
}) {
  try {
    return await db.insert(prompt).values({
      ...createdPrompt,
      authorId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to create prompt');
  }
}

export async function updatePrompt({
  promptId,
  prompt: newPrompt,
}: {
  promptId: string;
  prompt: Partial<Prompt>;
}) {
  try {
    return await db
      .update(prompt)
      .set(newPrompt)
      .where(eq(prompt.id, promptId));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to update prompt');
  }
}

export async function deletePrompt({ id }: { id: string }) {
  try {
    return await db.delete(prompt).where(eq(prompt.id, id));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete prompt');
  }
}

/**
 * Selects a prompt for a user. If the user already has a selected prompt,
 * it updates the selection to the new prompt. If not, it creates a new selection.
 * Uses upsert pattern with unique constraint on userId for efficient database operation.
 *
 * @param id - The ID of the prompt to select
 * @param userId - The ID of the user selecting the prompt
 * @returns The result of the database operation
 */
export async function selectPromptById({
  id,
  userId,
}: { id: string; userId: string }) {
  try {
    const result = await db
      .insert(userPrompt)
      .values({
        promptId: id,
        userId,
        selectedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userPrompt.userId],
        set: {
          promptId: id,
          selectedAt: new Date(),
        },
      })
      .returning();

    return result;
  } catch (error) {
    console.error(error);
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to select prompt by id',
    );
  }
}

/**
 * Updates a user's password
 * @param id - The user ID
 * @param password - The new password (will be hashed)
 * @returns The updated user record
 */
export async function updateUserPassword({
  id,
  password,
}: { id: string; password: string }) {
  const hashedPassword = generateHashedPassword(password);

  try {
    const [updatedUser] = await db
      .update(user)
      .set({ password: hashedPassword })
      .where(eq(user.id, id))
      .returning();

    return updatedUser;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update user password',
    );
  }
}

/**
 * Deletes a user account and all associated data
 * @param id - The user ID to delete
 * @returns The deleted user record
 */
export async function deleteUserAccount({ id }: { id: string }) {
  try {
    // The database schema has CASCADE constraints, so deleting the user
    // will automatically delete all associated data (chats, messages, etc.)
    const [deletedUser] = await db
      .delete(user)
      .where(eq(user.id, id))
      .returning();

    return deletedUser;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete user account',
    );
  }
}

// Passkey Authenticator Functions

/**
 * Create a new passkey authenticator for a user
 */
export async function createPasskeyAuthenticator({
  credentialID,
  userId,
  credentialPublicKey,
  counter,
  credentialDeviceType,
  credentialBackedUp,
  transports,
  name,
}: {
  credentialID: string;
  userId: string;
  credentialPublicKey: string;
  counter: number;
  credentialDeviceType: 'singleDevice' | 'multiDevice';
  credentialBackedUp: boolean;
  transports: Array<
    'usb' | 'nfc' | 'ble' | 'smart-card' | 'hybrid' | 'internal' | 'cable'
  >;
  name?: string;
}): Promise<PasskeyAuthenticator> {
  try {
    const [authenticator] = await db
      .insert(passkeyAuthenticator)
      .values({
        credentialID,
        userId,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports,
        name,
        lastUsed: new Date(),
      })
      .returning();

    return authenticator;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to create passkey authenticator',
    );
  }
}

/**
 * Get all passkey authenticators for a user
 */
export async function getPasskeyAuthenticatorsByUserId(
  userId: string,
): Promise<Array<PasskeyAuthenticator>> {
  try {
    const authenticators = await db
      .select()
      .from(passkeyAuthenticator)
      .where(eq(passkeyAuthenticator.userId, userId))
      .orderBy(desc(passkeyAuthenticator.createdAt));

    return authenticators;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to fetch passkey authenticators',
    );
  }
}

/**
 * Get a specific passkey authenticator by credential ID
 */
export async function getPasskeyAuthenticatorByCredentialId(
  credentialID: string,
): Promise<PasskeyAuthenticator | null> {
  try {
    const [authenticator] = await db
      .select()
      .from(passkeyAuthenticator)
      .where(eq(passkeyAuthenticator.credentialID, credentialID))
      .limit(1);

    return authenticator || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to fetch passkey authenticator',
    );
  }
}

/**
 * Update the counter and last used timestamp for a passkey authenticator
 */
export async function updatePasskeyAuthenticatorCounter({
  credentialID,
  counter,
}: {
  credentialID: string;
  counter: number;
}): Promise<PasskeyAuthenticator> {
  try {
    const [authenticator] = await db
      .update(passkeyAuthenticator)
      .set({
        counter,
        lastUsed: new Date(),
      })
      .where(eq(passkeyAuthenticator.credentialID, credentialID))
      .returning();

    return authenticator;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to update passkey authenticator',
    );
  }
}

/**
 * Delete a passkey authenticator
 */
export async function deletePasskeyAuthenticator(
  credentialID: string,
): Promise<PasskeyAuthenticator> {
  try {
    const [authenticator] = await db
      .delete(passkeyAuthenticator)
      .where(eq(passkeyAuthenticator.credentialID, credentialID))
      .returning();

    return authenticator;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to delete passkey authenticator',
    );
  }
}

/**
 * Get all passkey authenticators for a user by email
 */
export async function getPasskeyAuthenticatorsByEmail(
  email: string,
): Promise<Array<PasskeyAuthenticator>> {
  try {
    // First get the user by email
    const users = await getUser(email);
    if (users.length === 0) {
      return [];
    }

    const user = users[0];

    // Then get their authenticators
    const authenticators = await db
      .select()
      .from(passkeyAuthenticator)
      .where(eq(passkeyAuthenticator.userId, user.id))
      .orderBy(desc(passkeyAuthenticator.createdAt));

    return authenticators;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to fetch passkey authenticators by email',
    );
  }
}
