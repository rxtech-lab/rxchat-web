import { z } from 'zod';
import { streamObject } from 'ai';
import { getModelProvider } from '@/lib/ai/providers';
import { codePrompt, updateDocumentPrompt } from '@/lib/ai/prompts';
import { createDocumentHandler } from '@/lib/artifacts/server';
import type { ProviderType } from '@/lib/ai/models';
import { getTextContentFromUserMessage } from '@/lib/utils.server';

export const codeDocumentHandler = (
  selectedChatModel: string,
  selectedChatModelProvider: ProviderType,
) =>
  createDocumentHandler<'code'>({
    kind: 'code',
    selectedChatModelProvider,
    selectedChatModel,
    onCreateDocument: async ({ title, context, dataStream }) => {
      let draftContent = '';

      const prompt = getTextContentFromUserMessage(context);

      const { fullStream } = streamObject({
        model: getModelProvider(
          selectedChatModel,
          selectedChatModelProvider,
        ).languageModel('artifact-model'),
        system: codePrompt,
        prompt,
        schema: z.object({
          code: z.string(),
        }),
      });

      for await (const delta of fullStream) {
        const { type } = delta;

        if (type === 'object') {
          const { object } = delta;
          const { code } = object;

          if (code) {
            dataStream.writeData({
              type: 'code-delta',
              content: code ?? '',
            });

            draftContent = code;
          }
        }
      }

      return draftContent;
    },
    onUpdateDocument: async ({ document, description, dataStream }) => {
      let draftContent = '';

      const { fullStream } = streamObject({
        model: getModelProvider(
          selectedChatModel,
          selectedChatModelProvider,
        ).languageModel('artifact-model'),
        system: updateDocumentPrompt(document.content, 'code'),
        prompt: description,
        schema: z.object({
          code: z.string(),
        }),
      });

      for await (const delta of fullStream) {
        const { type } = delta;

        if (type === 'object') {
          const { object } = delta;
          const { code } = object;

          if (code) {
            dataStream.writeData({
              type: 'code-delta',
              content: code ?? '',
            });

            draftContent = code;
          }
        }
      }

      return draftContent;
    },
  });
