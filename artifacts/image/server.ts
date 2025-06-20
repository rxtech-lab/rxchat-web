import type { ProviderType } from '@/lib/ai/models';
import { getModelProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { getTextContentFromUserMessage } from '@/lib/utils.server';
import { experimental_generateImage } from 'ai';

export const imageDocumentHandler = (
  selectedChatModel: string,
  selectedChatModelProvider: ProviderType,
) =>
  createDocumentHandler<'image'>({
    kind: 'image',
    selectedChatModel,
    selectedChatModelProvider,
    onCreateDocument: async ({ title, context, dataStream }) => {
      let draftContent = '';

      const provider = getModelProvider(
        selectedChatModel,
        selectedChatModelProvider,
      );

      const prompt = getTextContentFromUserMessage(context);

      const { image } = await experimental_generateImage({
        model: provider.imageModel('small-model'),
        prompt,
        n: 1,
      });

      draftContent = image.base64;

      dataStream.writeData({
        type: 'image-delta',
        content: image.base64,
      });

      return draftContent;
    },
    onUpdateDocument: async ({ description, dataStream }) => {
      let draftContent = '';

      const provider = getModelProvider(
        selectedChatModel,
        selectedChatModelProvider,
      );

      const { image } = await experimental_generateImage({
        model: provider.imageModel('small-model'),
        prompt: description,
        n: 1,
      });

      draftContent = image.base64;

      dataStream.writeData({
        type: 'image-delta',
        content: image.base64,
      });

      return draftContent;
    },
  });
