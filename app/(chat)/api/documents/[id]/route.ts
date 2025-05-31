import { auth } from '@/app/(auth)/auth';
import { deleteDocument } from '@/lib/document/actions/action_server';
import { ChatSDKError } from '@/lib/errors';
import type { NextRequest } from 'next/server';

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
