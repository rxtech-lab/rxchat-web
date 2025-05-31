import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import { createS3Client } from '@/lib/s3';
import {
  isImageType,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
} from '@/lib/constants';
import { getPresignedUploadUrl } from '@/lib/document/actions/action_server';

// Schema for JSON body with file metadata
const FileMetadataSchema = z.object({
  filename: z.string().min(1),
  size: z.number().positive(),
  mimeType: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const validatedData = FileMetadataSchema.safeParse(body);

    if (!validatedData.success) {
      const errorMessage = validatedData.error.errors
        .map((error) => `${error.path.join('.')}: ${error.message}`)
        .join(', ');

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const { filename, size, mimeType } = validatedData.data;

    // Validate file size
    if (size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size ${Math.round(size / (1024 * 1024))}MB exceeds maximum allowed size of ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB`,
        },
        { status: 400 },
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(mimeType)) {
      return NextResponse.json(
        {
          error: `File type "${mimeType}" is not allowed. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
        },
        { status: 400 },
      );
    }

    try {
      // Check if the file is an image
      if (isImageType(mimeType)) {
        // Handle image upload using S3 presigned URL
        const s3Client = createS3Client();

        const result = await s3Client.getPresignedImageUploadUrl(
          filename,
          mimeType,
          {
            isPublic: true,
            pathPrefix: 'images',
          },
        );

        return NextResponse.json({
          type: 'image',
          uploadUrl: result.uploadUrl,
          publicUrl: result.publicUrl,
          key: result.key,
          filename,
          contentType: mimeType,
        });
      } else {
        // Handle document upload using existing document system
        const result = await getPresignedUploadUrl({
          fileName: filename,
          fileSize: size,
          mimeType: mimeType,
        });

        if ('error' in result) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
          type: 'document',
          uploadUrl: result.url,
          documentId: result.id,
          filename,
          contentType: mimeType,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Failed to generate upload URL',
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
