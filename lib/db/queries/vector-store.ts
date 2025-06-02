import { ChatSDKError } from '@/lib/errors';
import { and, desc, eq, gt, inArray, lt, ne, type SQL } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { vectorStoreDocument, type VectorStoreDocument } from '../schema';
import { db } from './client';

type DatabaseConnection = typeof db | PgDatabase<any>;

export async function createVectorStoreDocument(
  doc: Omit<VectorStoreDocument, 'createdAt'>,
  dbConnection: DatabaseConnection = db,
) {
  try {
    const newDoc = await dbConnection
      .insert(vectorStoreDocument)
      .values({
        ...doc,
        createdAt: new Date(),
      })
      .returning();

    return newDoc[0];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while executing a database query.',
    );
  }
}

export async function getDocumentsByUserId({
  userId,
  limit,
  startingAfter,
  endingBefore,
  dbConnection = db,
}: {
  userId: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
  dbConnection?: DatabaseConnection;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      dbConnection
        .select()
        .from(vectorStoreDocument)
        .where(
          whereCondition
            ? and(
                whereCondition,
                eq(vectorStoreDocument.userId, userId),
                ne(vectorStoreDocument.status, 'pending'),
              )
            : and(
                eq(vectorStoreDocument.userId, userId),
                ne(vectorStoreDocument.status, 'pending'),
              ),
        )
        .orderBy(desc(vectorStoreDocument.createdAt))
        .limit(extendedLimit);

    let filteredDocs: Array<VectorStoreDocument> = [];

    if (startingAfter) {
      const [selectedVectorDocs] = await dbConnection
        .select()
        .from(vectorStoreDocument)
        .where(eq(vectorStoreDocument.id, startingAfter))
        .limit(1);

      if (!selectedVectorDocs) {
        throw new ChatSDKError(
          'not_found:database',
          'An error occurred while executing a database query.',
        );
      }

      filteredDocs = await query(
        gt(vectorStoreDocument.createdAt, selectedVectorDocs.createdAt),
      );
    } else if (endingBefore) {
      const [selectedVectorDocs] = await dbConnection
        .select()
        .from(vectorStoreDocument)
        .where(eq(vectorStoreDocument.id, endingBefore))
        .limit(1);

      if (!selectedVectorDocs) {
        throw new ChatSDKError(
          'not_found:database',
          'An error occurred while executing a database query.',
        );
      }

      filteredDocs = await query(
        lt(vectorStoreDocument.createdAt, selectedVectorDocs.createdAt),
      );
    } else {
      filteredDocs = await query();
    }

    const hasMore = filteredDocs.length > limit;

    return {
      docs: hasMore ? filteredDocs.slice(0, limit) : filteredDocs,
      hasMore,
    };
  } catch (error) {
    // If it's already a ChatSDKError, rethrow it
    if (error instanceof ChatSDKError) {
      throw error;
    }
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while executing a database query.',
    );
  }
}

// Added status filter to allow filtering by document status (pending, completed, failed)
export async function getDocumentsByIds({
  ids,
  status,
  dbConnection = db,
}: {
  ids: Array<string>;
  status?: 'pending' | 'completed' | 'failed';
  dbConnection?: DatabaseConnection;
}) {
  if (ids.length === 0) {
    return [];
  }

  try {
    const docs = await dbConnection
      .select()
      .from(vectorStoreDocument)
      .where(
        status
          ? and(
              inArray(vectorStoreDocument.id, ids),
              eq(vectorStoreDocument.status, status),
            )
          : inArray(vectorStoreDocument.id, ids),
      )
      .orderBy(desc(vectorStoreDocument.createdAt));

    return docs;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while executing a database query.',
    );
  }
}

export async function deleteDocumentsByIds({
  ids,
  dbConnection = db,
}: {
  ids: Array<string>;
  dbConnection?: DatabaseConnection;
}) {
  if (ids.length === 0) {
    return;
  }

  try {
    const deletedDocs = await dbConnection
      .delete(vectorStoreDocument)
      .where(inArray(vectorStoreDocument.id, ids));

    return deletedDocs;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while executing a database query.',
    );
  }
}

export async function deleteDocumentById({
  id,
  dbConnection = db,
}: {
  id: string;
  dbConnection?: DatabaseConnection;
}) {
  try {
    await dbConnection
      .delete(vectorStoreDocument)
      .where(eq(vectorStoreDocument.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while executing a database query.',
    );
  }
}

export async function updateVectorStoreDocument({
  id,
  updates,
  dbConnection = db,
}: {
  id: string;
  updates: Partial<Omit<VectorStoreDocument, 'id' | 'createdAt'>>;
  dbConnection?: DatabaseConnection;
}) {
  try {
    const updatedDoc = await dbConnection
      .update(vectorStoreDocument)
      .set(updates)
      .where(eq(vectorStoreDocument.id, id))
      .returning();

    return updatedDoc[0];
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while executing a database query.',
    );
  }
}

export async function getVectorStoreDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(vectorStoreDocument)
      .where(eq(vectorStoreDocument.id, id))
      .orderBy(desc(vectorStoreDocument.createdAt))
      .limit(1);

    return selectedDocument;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to get document by id',
    );
  }
}

/**
 * Check if a document with the given SHA256 hash already exists
 * @param sha256 - SHA256 hash to check for
 * @param dbConnection - Database connection to use
 * @returns Promise<VectorStoreDocument | null> - Existing document or null if not found
 */
export async function getDocumentBySha256({
  sha256,
  dbConnection = db,
}: {
  sha256: string;
  dbConnection?: DatabaseConnection;
}): Promise<VectorStoreDocument | null> {
  try {
    const [existingDocument] = await dbConnection
      .select()
      .from(vectorStoreDocument)
      .where(eq(vectorStoreDocument.sha256, sha256))
      .limit(1);

    return existingDocument || null;
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'Failed to check for duplicate document',
    );
  }
}
