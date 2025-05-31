import { auth } from '@/app/(auth)/auth';
import {
  listDocuments,
  searchDocuments,
} from '@/lib/document/actions/action_server';

import { ChatSDKError } from '@/lib/errors';
import { z } from 'zod';

// Schema for pagination parameters
const GetDocumentsSchema = z.object({
  limit: z.string().transform(Number).default('20'),
  startingAfter: z.string().optional().nullable(),
  endingBefore: z.string().optional().nullable(),
});

// Schema for search parameters
const SearchDocumentsSchema = z.object({
  query: z.string().min(1),
  limit: z.string().transform(Number).default('10'),
});

// Schema for delete parameters
const DeleteDocumentSchema = z.object({
  id: z.string().uuid(),
});

// GET - List documents with pagination or search
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:document').toResponse();
  }

  const { searchParams } = new URL(request.url);
  const isSearch = searchParams.has('query');

  try {
    if (isSearch) {
      // Handle search request
      const data = {
        query: searchParams.get('query'),
        limit: searchParams.get('limit') || '10',
      };
      const parsed = SearchDocumentsSchema.safeParse(data);

      if (!parsed.success) {
        return new ChatSDKError(
          'bad_request:api',
          'Invalid search parameters',
        ).toResponse();
      }

      const searchResults = await searchDocuments({
        query: parsed.data.query,
        limit: parsed.data.limit,
      });

      return Response.json(
        {
          documents: searchResults,
          hasMore: false,
        },
        { status: 200 },
      );
    } else {
      // Handle pagination request
      const data = {
        limit: searchParams.get('limit') || '20',
        startingAfter: searchParams.get('starting_after'),
        endingBefore: searchParams.get('ending_before'),
      };
      const parsed = GetDocumentsSchema.safeParse(data);

      if (!parsed.success) {
        return new ChatSDKError(
          'bad_request:api',
          'Invalid pagination parameters',
        ).toResponse();
      }

      const result = await listDocuments({
        limit: parsed.data.limit,
        startingAfter: parsed.data.startingAfter,
        endingBefore: parsed.data.endingBefore,
      });

      return Response.json(result, { status: 200 });
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new ChatSDKError(
      'bad_request:api',
      'Failed to fetch documents',
    ).toResponse();
  }
}
