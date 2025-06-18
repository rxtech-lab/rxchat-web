import { auth } from '@/app/(auth)/auth';
import {
  deleteDocument,
  renameDocument,
  updateDocumentVisibility,
} from '@/lib/document/actions/action_server';
import { ChatSDKError } from '@/lib/errors';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

// Schema for rename request body
const RenameDocumentSchema = z.object({
  newName: z.string().min(1).max(255),
});

// Schema for visibility update request body
const UpdateVisibilitySchema = z.object({
  visibility: z.enum(['private', 'public']),
});

// DELETE - Delete a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  try {
    const { id } = await params;

    await deleteDocument({ id });
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Failed to delete document',
    ).toResponse();
  }
}

// PATCH - Rename a document
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = RenameDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return new ChatSDKError(
        'bad_request:api',
        'Invalid request body. newName is required and must be between 1-255 characters.',
      ).toResponse();
    }

    const result = await renameDocument({
      id,
      newName: parsed.data.newName,
    });

    if ('error' in result) {
      return new ChatSDKError('bad_request:api', result.error).toResponse();
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Failed to rename document',
    ).toResponse();
  }
}

// PUT - Update document visibility
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = UpdateVisibilitySchema.safeParse(body);

    if (!parsed.success) {
      return new ChatSDKError(
        'bad_request:api',
        'Invalid request body. visibility must be either "private" or "public".',
      ).toResponse();
    }

    const result = await updateDocumentVisibility({
      id,
      visibility: parsed.data.visibility,
    });

    if ('error' in result) {
      return new ChatSDKError('bad_request:api', result.error).toResponse();
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Failed to update document visibility',
    ).toResponse();
  }
}
