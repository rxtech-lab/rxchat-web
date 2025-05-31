import { auth } from '@/app/(auth)/auth';
import {
  getPromptsByUserId,
  createPrompt,
  updatePrompt,
  deletePrompt,
} from '@/lib/db/queries/queries';
import { ChatSDKError } from '@/lib/errors';
import type { Prompt } from '@/lib/db/schema';
import { generateUUID } from '@/lib/utils';

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  try {
    const prompts = await getPromptsByUserId({ userId: session.user.id });
    return Response.json(prompts, { status: 200 });
  } catch (error) {
    return new ChatSDKError(
      'bad_request:database',
      'Failed to get prompts',
    ).toResponse();
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  try {
    const {
      title,
      description,
      code,
      visibility = 'private',
    }: {
      title: string;
      description?: string;
      code: string;
      visibility?: 'private' | 'public';
    } = await request.json();

    if (!title || !code) {
      return new ChatSDKError(
        'bad_request:api',
        'Title and code are required',
      ).toResponse();
    }

    const newPrompt: Prompt = {
      id: generateUUID(),
      title,
      description: description || null,
      code,
      authorId: session.user.id,
      visibility,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await createPrompt({
      prompt: newPrompt,
      userId: session.user.id,
    });

    return Response.json(newPrompt, { status: 201 });
  } catch (error) {
    return new ChatSDKError(
      'bad_request:database',
      'Failed to create prompt',
    ).toResponse();
  }
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  try {
    const {
      id,
      title,
      description,
      code,
      visibility,
    }: {
      id: string;
      title?: string;
      description?: string;
      code?: string;
      visibility?: 'private' | 'public';
    } = await request.json();

    if (!id) {
      return new ChatSDKError(
        'bad_request:api',
        'Prompt ID is required',
      ).toResponse();
    }

    await updatePrompt({
      promptId: id,
      prompt: {
        title,
        description,
        code,
        visibility,
      },
    });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return new ChatSDKError(
      'bad_request:database',
      'Failed to update prompt',
    ).toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError(
      'bad_request:api',
      'Prompt ID is required',
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  try {
    await deletePrompt({ id });

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    return new ChatSDKError(
      'bad_request:database',
      'Failed to delete prompt',
    ).toResponse();
  }
}
