import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';
import { getDocumentById } from '@/lib/db/queries';
import { type DataStreamWriter, tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';
import type { ProviderType } from '../models';

interface UpdateDocumentProps {
  session: Session;
  dataStream: DataStreamWriter;
  selectedChatModelProvider: ProviderType;
  selectedChatModel: string;
}

export const updateDocument = ({
  session,
  dataStream,
  selectedChatModelProvider,
  selectedChatModel,
}: UpdateDocumentProps) =>
  tool({
    description: 'Update a document with the given description.',
    parameters: z.object({
      id: z.string().describe('The ID of the document to update'),
      description: z
        .string()
        .describe('The description of changes that need to be made'),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      dataStream.writeData({
        type: 'clear',
        content: document.title,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind(
            selectedChatModel,
            selectedChatModelProvider,
          ).kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler(
        selectedChatModel,
        selectedChatModelProvider,
      ).onUpdateDocument({
        document,
        description,
        dataStream,
        session,
      });

      dataStream.writeData({ type: 'finish', content: '' });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content: 'The document has been updated successfully.',
      };
    },
  });
