import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from '@/lib/artifacts/server';
import { generateUUID } from '@/lib/utils';
import { type DataStreamWriter, tool } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';
import type { ProviderType } from '../models';

interface CreateDocumentProps {
  session: Session;
  selectedChatModelProvider: ProviderType;
  selectedChatModel: string;
  dataStream: DataStreamWriter;
}

export const createDocument = ({
  session,
  selectedChatModelProvider,
  selectedChatModel,
  dataStream,
}: CreateDocumentProps) =>
  tool({
    description: `Create a document for a writing or content creation activities. 
    This tool will call other functions that will generate the contents of the document based on the title and kind. 
    When user asking about build a workflow, use the flowchart kind.
    
    IMPORTANT: For flowcharts/workflows, always provide the original user query in the 'context' parameter to give the workflow agent full context about what the user wants to build. The title should be short and descriptive, while the context should contain the complete user request with all details, requirements, and specifications.`,
    parameters: z.object({
      title: z.string().describe('A short, descriptive title for the document'),
      kind: z.enum(artifactKinds),
      context: z
        .string()
        .optional()
        .describe(
          'The complete original user query/request with all details and context. For flowcharts, this should contain the full user message describing what workflow they want to build, including specific requirements, tools, triggers, conditions, and expected outcomes.',
        ),
    }),
    execute: async ({ title, kind, context }) => {
      const id = generateUUID();

      dataStream.writeData({
        type: 'kind',
        content: kind,
      });

      dataStream.writeData({
        type: 'id',
        content: id,
      });

      dataStream.writeData({
        type: 'title',
        content: title,
      });

      dataStream.writeData({
        type: 'clear',
        content: '',
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind(
            selectedChatModel,
            selectedChatModelProvider,
          ).kind === kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler(
        selectedChatModel,
        selectedChatModelProvider,
      ).onCreateDocument({
        id,
        title,
        context: context || '',
        dataStream,
        session,
      });

      dataStream.writeData({ type: 'finish', content: '' });

      return {
        id,
        title,
        kind,
        content: 'A document was created and is now visible to the user.',
      };
    },
  });
