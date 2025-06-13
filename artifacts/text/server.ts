import { smoothStream, streamText } from 'ai';
import { getModelProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { updateDocumentPrompt } from '@/lib/ai/prompts';
import type { ProviderType } from '@/lib/ai/models';

export const textDocumentHandler = (
  selectedChatModel: string,
  selectedChatModelProvider: ProviderType,
) =>
  createDocumentHandler<'text'>({
    kind: 'text',
    selectedChatModel,
    selectedChatModelProvider,
    onCreateDocument: async ({ title, context, dataStream }) => {
      let draftContent = '';
      const provider = getModelProvider(
        selectedChatModel,
        selectedChatModelProvider,
      );

      const prompt = title;

      const { fullStream } = streamText({
        model: provider.languageModel('artifact-model'),
        system:
          'Write about the given topic. Markdown is supported. Use headings wherever appropriate.',
        experimental_transform: smoothStream({ chunking: 'word' }),
        prompt,
      });

      for await (const delta of fullStream) {
        const { type } = delta;

        if (type === 'text-delta') {
          const { textDelta } = delta;

          draftContent += textDelta;

          dataStream.writeData({
            type: 'text-delta',
            content: textDelta,
          });
        }
      }

      return draftContent;
    },
    onUpdateDocument: async ({ document, description, dataStream }) => {
      let draftContent = '';
      const provider = getModelProvider(
        selectedChatModel,
        selectedChatModelProvider,
      );

      const { fullStream } = streamText({
        model: provider.languageModel('artifact-model'),
        system: updateDocumentPrompt(document.content, 'text'),
        experimental_transform: smoothStream({ chunking: 'word' }),
        prompt: description,
        experimental_providerMetadata: {
          openai: {
            prediction: {
              type: 'content',
              content: document.content,
            },
          },
        },
      });

      for await (const delta of fullStream) {
        const { type } = delta;

        if (type === 'text-delta') {
          const { textDelta } = delta;

          draftContent += textDelta;
          dataStream.writeData({
            type: 'text-delta',
            content: textDelta,
          });
        }
      }

      return draftContent;
    },
  });
