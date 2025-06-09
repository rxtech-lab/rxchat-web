import { sheetPrompt, updateDocumentPrompt } from '@/lib/ai/prompts';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { streamObject } from 'ai';
import { z } from 'zod';
import type { ProviderType } from '@/lib/ai/models';
import { getModelProvider } from '@/lib/ai/providers';

export const sheetDocumentHandler = (
  selectedChatModel: string,
  selectedChatModelProvider: ProviderType,
) =>
  createDocumentHandler<'sheet'>({  
    kind: 'sheet',
    selectedChatModel,
    selectedChatModelProvider,
    onCreateDocument: async ({ title, dataStream }) => {
      let draftContent = '';
      const provider = getModelProvider(
        selectedChatModel,
        selectedChatModelProvider,
      );

      const { fullStream } = streamObject({
        model: provider.languageModel('artifact-model'),
        system: sheetPrompt,
        prompt: title,
        schema: z.object({
          csv: z.string().describe('CSV data'),
        }),
      });

      for await (const delta of fullStream) {
        const { type } = delta;

        if (type === 'object') {
          const { object } = delta;
          const { csv } = object;

          if (csv) {
            dataStream.writeData({
              type: 'sheet-delta',
              content: csv,
            });

            draftContent = csv;
          }
        }
      }

      dataStream.writeData({
        type: 'sheet-delta',
        content: draftContent,
      });

      return draftContent;
    },
    onUpdateDocument: async ({ document, description, dataStream }) => {
      let draftContent = '';
      const provider = getModelProvider(
        selectedChatModel,
        selectedChatModelProvider,
      );

      const { fullStream } = streamObject({
        model: provider.languageModel('artifact-model'),
        system: updateDocumentPrompt(document.content, 'sheet'),
        prompt: description,
        schema: z.object({
          csv: z.string(),
        }),
      });

      for await (const delta of fullStream) {
        const { type } = delta;

        if (type === 'object') {
          const { object } = delta;
          const { csv } = object;

          if (csv) {
            dataStream.writeData({
              type: 'sheet-delta',
              content: csv,
            });

            draftContent = csv;
          }
        }
      }

      return draftContent;
    },
  });
