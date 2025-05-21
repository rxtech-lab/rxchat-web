import { xai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

const openRouterProvider = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': openRouterProvider('google/gemini-2.5-pro-preview'),
        'chat-model-reasoning': wrapLanguageModel({
          model: openRouterProvider('google/gemini-2.5-pro-preview'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': openRouterProvider('google/gemini-2.5-flash-preview-05-20'),
        'artifact-model': openRouterProvider('google/gemini-2.5-pro-preview'),
      },
      imageModels: {
        'small-model': xai.image('grok-2-image'),
      },
    });
