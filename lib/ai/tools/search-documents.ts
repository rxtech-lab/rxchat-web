import { searchDocuments } from '@/lib/document/actions/action_server';
import { MAX_K } from '@/lib/constants';
import { tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';

interface SearchDocumentsProps {
  session: Session;
}

export const searchDocumentsTool = ({ session }: SearchDocumentsProps) =>
  tool({
    description:
      'Search for documents using vector similarity search based on query text. Returns document metadata and content for AI to analyze.',
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .describe('The search query to find relevant documents'),
      limit: z
        .number()
        .min(1)
        .max(MAX_K)
        .optional()
        .describe(`Maximum number of documents to return (default: ${MAX_K})`),
    }),
    execute: async ({ query, limit = MAX_K }) => {
      try {
        const documents = await searchDocuments({
          query,
          limit,
        });

        if (documents.length === 0) {
          return {
            message: 'No documents found matching your search query.',
            results: [],
          };
        }

        return {
          message: `Found ${documents.length} document(s) matching your search query.`,
          results: documents.map((doc) => ({
            id: doc.id,
            originalFileName: doc.originalFileName,
            mimeType: doc.mimeType,
            size: doc.size,
            createdAt: doc.createdAt,
            content: doc.content,
          })),
        };
      } catch (error) {
        return {
          error: 'Failed to search documents. Please try again.',
          message: 'An error occurred while searching for documents.',
          results: [],
        };
      }
    },
  });
