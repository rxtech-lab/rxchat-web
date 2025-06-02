import type { InferSelectModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  integer,
} from 'drizzle-orm/pg-core';
import type { ProviderType } from '../ai/models';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  role: varchar('role', { enum: ['admin', 'regular', 'premium', 'free'] })
    .notNull()
    .default('free'),
  availableModelProviders: jsonb('availableModelProviders')
    .$type<Array<ProviderType>>()
    .notNull()
    .default(sql`'["openRouter"]'::jsonb`),
});

export type User = InferSelectModel<typeof user>;

export const passkeyAuthenticator = pgTable('PasskeyAuthenticator', {
  credentialID: text('credentialID').primaryKey().notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  credentialPublicKey: text('credentialPublicKey').notNull(),
  counter: integer('counter').notNull().default(0),
  credentialDeviceType: varchar('credentialDeviceType', {
    enum: ['singleDevice', 'multiDevice'],
  }).notNull(),
  credentialBackedUp: boolean('credentialBackedUp').notNull(),
  transports: jsonb('transports')
    .$type<
      Array<
        'usb' | 'nfc' | 'ble' | 'smart-card' | 'hybrid' | 'internal' | 'cable'
      >
    >()
    .notNull()
    .default(sql`'[]'::jsonb`),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  lastUsed: timestamp('lastUsed'),
});

export type PasskeyAuthenticator = InferSelectModel<
  typeof passkeyAuthenticator
>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title').notNull(),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  visibility: varchar('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable('Message_v2', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId')
    .notNull()
    .references(() => chat.id, { onDelete: 'cascade' }),
  role: varchar('role').notNull(),
  parts: json('parts').notNull(),
  attachments: json('attachments').notNull(),
  createdAt: timestamp('createdAt').notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  'Vote',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    messageId: uuid('messageId')
      .notNull()
      .references(() => messageDeprecated.id, { onDelete: 'cascade' }),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  'Vote_v2',
  {
    chatId: uuid('chatId')
      .notNull()
      .references(() => chat.id, { onDelete: 'cascade' }),
    messageId: uuid('messageId')
      .notNull()
      .references(() => message.id, { onDelete: 'cascade' }),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', { enum: ['text', 'code', 'image', 'sheet'] })
      .notNull()
      .default('text'),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }).onDelete('cascade'),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  'Stream',
  {
    id: uuid('id').notNull().defaultRandom(),
    chatId: uuid('chatId').notNull(),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }).onDelete('cascade'),
  }),
);

export type Stream = InferSelectModel<typeof stream>;

export const prompt = pgTable('Prompt', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  code: text('code').notNull(),
  authorId: uuid('authorId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  visibility: varchar('visibility', { enum: ['private', 'public'] })
    .notNull()
    .default('private'),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});

export type Prompt = InferSelectModel<typeof prompt>;

export const userPrompt = pgTable(
  'UserPrompt',
  {
    userId: uuid('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' })
      .unique(),
    promptId: uuid('promptId')
      .notNull()
      .references(() => prompt.id, { onDelete: 'cascade' }),
    selectedAt: timestamp('selectedAt').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.userId, table.promptId] }),
    };
  },
);

export type UserPrompt = InferSelectModel<typeof userPrompt>;

export const vectorStoreDocument = pgTable('VectorStoreDocument', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  content: text('content'),
  userId: uuid('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  key: text('key').unique(),
  originalFileName: text('originalFileName').notNull(),
  mimeType: text('mimeType').notNull(),
  size: integer('size').notNull(),
  status: varchar('status', {
    enum: ['pending', 'completed', 'failed'],
  })
    .notNull()
    .default('pending'),
  // SHA256 hash of the file content for duplicate detection
  sha256: text('sha256').unique(),
});

export type VectorStoreDocument = InferSelectModel<typeof vectorStoreDocument>;
