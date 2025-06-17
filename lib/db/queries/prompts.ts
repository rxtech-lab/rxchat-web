import { and, desc, eq, or } from 'drizzle-orm';

import { ChatSDKError } from '../../errors';
import { prompt, userPrompt, type Prompt } from '../schema';
import { db } from './client';

export async function getPromptsByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(prompt)
      .where(
        or(
          and(eq(prompt.authorId, userId), eq(prompt.visibility, 'private')),
          eq(prompt.visibility, 'public'),
        ),
      )
      .orderBy(desc(prompt.createdAt));
  } catch (error) {
    console.error('Get prompts error:', error);
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
    console.error('Get user prompt error:', error);
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
    console.error('Create prompt error:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to create prompt');
  }
}

export async function updatePrompt({
  promptId,
  prompt: newPrompt,
  userId,
}: {
  promptId: string;
  prompt: Partial<Prompt>;
  userId: string;
}) {
  try {
    const updatedPrompts = await db
      .update(prompt)
      .set({ ...newPrompt, updatedAt: new Date() })
      .where(and(eq(prompt.id, promptId), eq(prompt.authorId, userId)))
      .returning();

    if (updatedPrompts.length === 0) {
      throw new ChatSDKError(
        'bad_request:database',
        'Prompt not found or access denied',
      );
    }

    return updatedPrompts[0];
  } catch (error) {
    if (error instanceof ChatSDKError) {
      throw error;
    }
    console.error('Update prompt error:', error);
    throw new ChatSDKError('bad_request:database', 'Failed to update prompt');
  }
}

export async function deletePrompt({
  id,
  userId,
}: { id: string; userId: string }) {
  try {
    return await db
      .delete(prompt)
      .where(and(eq(prompt.id, id), eq(prompt.authorId, userId)));
  } catch (error) {
    throw new ChatSDKError('bad_request:database', 'Failed to delete prompt');
  }
}
