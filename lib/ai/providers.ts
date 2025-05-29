import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { customProvider, type Provider } from 'ai';
import { isTestEnvironment } from '../constants';
import type { ProviderType } from './models';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel as titleModelTest,
} from './models.test';

/**
 * Get a provider for a given model and provider type
 * @param modelId - The ID of the model to use
 * @param providerType - The type of provider to use
 * @returns A provider for the given model and provider type
 */
export function getModelProvider(
  modelId: string,
  providerType: ProviderType,
): Provider {
  if (isTestEnvironment) {
    return customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModelTest,
        'artifact-model': artifactModel,
      },
    });
  }

  switch (providerType) {
    case 'openAI': {
      const openAIProvider = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      return customProvider({
        languageModels: {
          'chat-model': openAIProvider(modelId),
          'title-model': openAIProvider(modelId),
          'artifact-model': openAIProvider(modelId),
        },
      });
    }
    case 'openRouter': {
      const openRouterProvider = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
      });

      const titleModel = openRouterProvider(
        'google/gemini-2.5-flash-preview-05-20',
      );
      return customProvider({
        languageModels: {
          'chat-model': openRouterProvider(modelId),
          'title-model': titleModel,
          'artifact-model': openRouterProvider(modelId),
          [modelId]: openRouterProvider(modelId),
        },
      });
    }
    case 'gemini':
      throw new Error('Gemini is not supported yet');
    case 'test':
      throw new Error('Test provider is not supported yet');
  }
}
