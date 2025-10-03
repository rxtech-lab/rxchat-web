import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import { completeDocumentUpload } from '@/lib/document/actions/action_server';

const CompleteUploadSchema = z.object({
  documentId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const validatedData = CompleteUploadSchema.safeParse(body);

    if (!validatedData.success) {
      const errorMessage = validatedData.error.errors
        .map((error) => `${error.path.join('.')}: ${error.message}`)
        .join(', ');

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { documentId } = validatedData.data;

    try {
      const result = await completeDocumentUpload({ documentId });

      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        documentId: documentId,
        message: 'Document upload completed successfully',
      });
    } catch (error) {
      console.error('Complete upload error:', error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to complete upload',
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error('Request processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 },
    );
  }
}
