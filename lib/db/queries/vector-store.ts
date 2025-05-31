import { ChatSDKError } from '@/lib/errors';
import { vectorStoreDocument, type VectorStoreDocument } from '../schema';
import { db } from './client';
import { desc, and, eq, type SQL, gt, lt, inArray } from 'drizzle-orm';

export async function createVectorStoreDocument(
  doc: Omit<VectorStoreDocument, 'id' | 'createdAt'>,
) {
  try {
    const newDoc = await db
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
}: {
  userId: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(vectorStoreDocument)
        .where(
          whereCondition
            ? and(whereCondition, eq(vectorStoreDocument.userId, userId))
            : eq(vectorStoreDocument.userId, userId),
        )
        .orderBy(desc(vectorStoreDocument.createdAt))
        .limit(extendedLimit);

    let filteredDocs: Array<VectorStoreDocument> = [];

    if (startingAfter) {
      const [selectedVectorDocs] = await db
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
      const [selectedVectorDocs] = await db
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

export async function getDocumentsByIds({
  ids,
}: {
  ids: Array<string>;
}) {
  if (ids.length === 0) {
    return [];
  }

  try {
    const docs = await db
      .select()
      .from(vectorStoreDocument)
      .where(inArray(vectorStoreDocument.id, ids))
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
}: {
  ids: Array<string>;
}) {
  if (ids.length === 0) {
    return;
  }

  try {
    const deletedDocs = await db
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
}: {
  id: string;
}) {
  try {
    await db.delete(vectorStoreDocument).where(eq(vectorStoreDocument.id, id));
  } catch (error) {
    throw new ChatSDKError(
      'bad_request:database',
      'An error occurred while executing a database query.',
    );
  }
}
