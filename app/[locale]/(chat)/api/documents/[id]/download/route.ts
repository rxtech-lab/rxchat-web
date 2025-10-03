import { auth } from '@/app/(auth)/auth';
import { getPresignedDownloadUrl } from '@/lib/document/actions/action_server';
import { ChatSDKError } from '@/lib/errors';
import { z } from 'zod';

// Schema for download parameters
const DownloadDocumentSchema = z.object({
  id: z.string().uuid(),
});

// GET - Get presigned download URL for a document
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  try {
    const { id } = await params;
    const parsed = DownloadDocumentSchema.safeParse({ id });

    if (!parsed.success) {
      return new ChatSDKError(
        'bad_request:api',
        'Invalid document ID',
      ).toResponse();
    }

    const result = await getPresignedDownloadUrl({
      documentId: parsed.data.id,
    });

    if ('error' in result) {
      return new ChatSDKError('bad_request:api', result.error).toResponse();
    }

    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Failed to get download URL',
    ).toResponse();
  }
}
