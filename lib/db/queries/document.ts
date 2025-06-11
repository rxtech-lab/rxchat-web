import { desc, eq, and, sql } from 'drizzle-orm';
import { db } from './client';
import { document, type Document } from '../schema';

export type DocumentInsert = {
  title: string;
  content?: string;
  kind?: 'text' | 'code' | 'image' | 'sheet' | 'flowchart';
  userId: string;
};

export type DocumentUpdate = {
  title?: string;
  content?: string;
  kind?: 'text' | 'code' | 'image' | 'sheet' | 'flowchart';
};

/**
 * Create a new document
 */
export async function createDocument(data: DocumentInsert): Promise<Document> {
  const [newDocument] = await db
    .insert(document)
    .values({
      ...data,
      createdAt: new Date(),
    })
    .returning();

  return newDocument;
}

/**
 * Get a document by id and createdAt (composite primary key)
 */
export async function getDocumentById(
  id: string,
  createdAt: Date,
): Promise<Document | null> {
  const [result] = await db
    .select()
    .from(document)
    .where(and(eq(document.id, id), eq(document.createdAt, createdAt)))
    .limit(1);

  return result || null;
}

/**
 * Get all documents for a specific user
 */
export async function getDocumentsByUserId(
  userId: string,
  limit = 50,
  offset = 0,
): Promise<Document[]> {
  return await db
    .select()
    .from(document)
    .where(eq(document.userId, userId))
    .orderBy(desc(document.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get documents by kind for a specific user
 */
export async function getDocumentsByKind(
  userId: string,
  kind: 'text' | 'code' | 'image' | 'sheet' | 'flowchart',
  limit = 50,
  offset = 0,
): Promise<Document[]> {
  return await db
    .select()
    .from(document)
    .where(and(eq(document.userId, userId), eq(document.kind, kind)))
    .orderBy(desc(document.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Update a document by id and createdAt
 */
export async function updateDocument(
  id: string,
  createdAt: Date,
  userId: string,
  data: DocumentUpdate,
): Promise<Document | null> {
  // Ensure the user owns the document before updating
  const [updatedDocument] = await db
    .update(document)
    .set(data)
    .where(
      and(
        eq(document.id, id),
        eq(document.createdAt, createdAt),
        eq(document.userId, userId),
      ),
    )
    .returning();

  return updatedDocument || null;
}

/**
 * Delete a document by id and createdAt
 */
export async function deleteDocument(
  id: string,
  createdAt: Date,
  userId: string,
): Promise<Document[]> {
  return await db
    .delete(document)
    .where(
      and(
        eq(document.id, id),
        eq(document.createdAt, createdAt),
        eq(document.userId, userId),
      ),
    )
    .returning();
}

/**
 * Get all documents with pagination
 */
export async function listAllDocuments(
  limit = 50,
  offset = 0,
): Promise<Document[]> {
  return await db
    .select()
    .from(document)
    .orderBy(desc(document.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Search documents by title for a specific user
 */
export async function searchDocumentsByTitle(
  userId: string,
  searchTerm: string,
  limit = 50,
  offset = 0,
): Promise<Document[]> {
  return await db
    .select()
    .from(document)
    .where(
      and(
        eq(document.userId, userId),
        // Using ILIKE for case-insensitive search
        sql`${document.title} ILIKE ${`%${searchTerm}%`}`,
      ),
    )
    .orderBy(desc(document.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Count total documents for a user
 */
export async function countDocumentsByUserId(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(document)
    .where(eq(document.userId, userId));

  return result.count;
}

/**
 * Get recent documents for a user (last 10)
 */
export async function getRecentDocuments(userId: string): Promise<Document[]> {
  return await db
    .select()
    .from(document)
    .where(eq(document.userId, userId))
    .orderBy(desc(document.createdAt))
    .limit(10);
}
