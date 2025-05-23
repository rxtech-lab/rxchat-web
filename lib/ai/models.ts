import { z } from 'zod';
import type { Entitlements } from './entitlements';

export const DEFAULT_CHAT_MODEL: string =
  'google/gemini-2.5-flash-preview-05-20';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const ProviderTypeSchema = z.enum(['openAI', 'openRouter', 'gemini']);
export type ProviderType = z.infer<typeof ProviderTypeSchema>;

export interface ChatProvider {
  id: string;
  provider: ProviderType;
  models: Array<ChatModel>;
}

export interface OpenRouterPricing {
  prompt: number;
  completion: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  baseURL: string;
  apiKey: string;
  model: string;
  supported_parameters: Array<string>;
  pricing: OpenRouterPricing;
}

export type Providers = Record<ProviderType, ChatProvider>;

export const providers: Providers = {
  openAI: {
    id: 'openai',
    provider: 'openAI',
    models: [],
  },
  openRouter: {
    id: 'openrouter',
    provider: 'openRouter',
    models: [],
  },
  gemini: {
    id: 'gemini',
    provider: 'gemini',
    models: [],
  },
};

export async function getOpenRouterModels(
  userEntitlements: Entitlements,
): Promise<Array<OpenRouterModel>> {
  const modelResponse = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {},
    method: 'GET',
    cache: 'force-cache',
    next: {
      revalidate: 60 * 60 * 24, // 24 hours
    },
  });

  const data = await modelResponse.json();
  const models = data.data as Array<OpenRouterModel>;
  // only return models that support tools
  return models
    .filter((model) => model.supported_parameters.includes('tools'))
    .filter((model) => {
      return model.pricing.prompt <= userEntitlements.maximumModelPromptPrice;
    });
}
