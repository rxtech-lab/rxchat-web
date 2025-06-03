import { z } from 'zod';
import type { Entitlements } from './entitlements';
import type { User } from '../db/schema';

export const DEFAULT_CHAT_MODEL: string =
  'google/gemini-2.5-flash-preview-05-20';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const ProviderTypeSchema = z.enum([
  'openAI',
  'openRouter',
  'gemini',
  'test',
  'anthropic',
  'azure',
  'google',
]);
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

export interface TestModel {
  id: string;
  name: string;
  description: string;
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
  test: {
    id: 'test',
    provider: 'test',
    models: [],
  },
  anthropic: {
    id: 'anthropic',
    provider: 'anthropic',
    models: [],
  },
  azure: {
    id: 'azure',
    provider: 'azure',
    models: [],
  },
  google: {
    id: 'google',
    provider: 'google',
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

export function getTestModels(): Array<TestModel> {
  return [
    {
      id: 'chat-model-reasoning',
      name: 'Test reasoning Model',
      description: 'Test reasoning Model Description',
    },
    {
      id: 'chat-model',
      name: 'Test Model',
      description: 'Test Model Description',
    },
  ];
}

/**
 * Get OpenAI models (currently placeholder as there are no pricing constraints)
 * @param userEntitlements - User entitlements for filtering
 * @returns Array of OpenAI models
 */
export function getOpenAIModels(
  userEntitlements: Entitlements,
): Array<ChatModel> {
  // For now, return a simple set of OpenAI models
  // In a real implementation, you'd fetch from OpenAI API and apply pricing filters
  return [];
}

/**
 * Get Gemini models (currently placeholder)
 * @param userEntitlements - User entitlements for filtering
 * @returns Array of Gemini models
 */
export function getGeminiModels(
  userEntitlements: Entitlements,
): Array<ChatModel> {
  // Placeholder implementation
  return [];
}

export function getAnthropicModels(
  userEntitlements: Entitlements,
): Array<ChatModel> {
  // Placeholder implementation
  return [];
}

export function getAzureModels(
  userEntitlements: Entitlements,
): Array<ChatModel> {
  // Placeholder implementation
  return [
    {
      id: 'o3-mini',
      name: 'o3-mini',
      description: 'o3-mini',
    },
    {
      id: 'o4-mini',
      name: 'o4-mini',
      description: 'o4-mini',
    },
    {
      id: 'gpt-4.1',
      name: 'gpt-4.1',
      description: 'gpt-4.1',
    },
  ];
}

/**
 * Filter providers based on user's available providers and populate with models
 * @param user - User data from database containing role and availableModelProviders
 * @param userEntitlements - Calculated entitlements based on user role
 * @param isTestEnvironment - Whether we're in test environment
 * @returns Filtered providers with models
 */
/**
 * Check if a provider and model combination supports document/file uploads
 * @param providerType - The type of provider to check
 * @param modelId - The specific model ID within the provider
 * @returns boolean indicating if the provider/model supports document uploads
 */
export function providerSupportsDocuments(providerType: ProviderType, modelId?: string): boolean {
  // Currently, only openRouter provider supports document uploads for all models
  // Other providers don't support it for now
  switch (providerType) {
    case 'openRouter':
      // All openRouter models currently support document uploads
      return true;
    case 'openAI':
    case 'anthropic':
    case 'azure':
    case 'google':
    case 'gemini':
    case 'test':
    default:
      // Future implementation could check specific models within providers
      // For now, all other providers don't support document uploads
      return false;
  }
}

export async function getFilteredProviders(
  user: User,
  userEntitlements: Entitlements,
  isTestEnvironment = false,
): Promise<Providers> {
  const filteredProviders: Providers = {
    openAI: { ...providers.openAI, models: [] },
    openRouter: { ...providers.openRouter, models: [] },
    gemini: { ...providers.gemini, models: [] },
    test: { ...providers.test, models: [] },
    anthropic: { ...providers.anthropic, models: [] },
    azure: { ...providers.azure, models: [] },
    google: { ...providers.google, models: [] },
  };

  // Create a set of providers to process, including test provider in test environment
  const providersToProcess = new Set(user.availableModelProviders);

  // Automatically add test provider when in test environment
  if (isTestEnvironment) {
    providersToProcess.add('test');
  }

  // Only include providers that the user has access to
  for (const providerType of providersToProcess) {
    switch (providerType) {
      case 'openAI':
        filteredProviders.openAI.models = getOpenAIModels(userEntitlements);
        break;
      case 'openRouter': {
        const openRouterModels = await getOpenRouterModels(userEntitlements);
        filteredProviders.openRouter.models = openRouterModels.map((model) => ({
          id: model.id,
          name: model.name,
          description: model.description,
        }));
        break;
      }
      case 'anthropic':
        filteredProviders.anthropic.models =
          getAnthropicModels(userEntitlements);
        break;
      case 'azure':
        filteredProviders.azure.models = getAzureModels(userEntitlements);
        break;
      case 'google':
        filteredProviders.google.models = getGeminiModels(userEntitlements);
        break;
      case 'gemini':
        filteredProviders.gemini.models = getGeminiModels(userEntitlements);
        break;
      case 'test': {
        if (isTestEnvironment) {
          const testModels = getTestModels();
          filteredProviders.test.models = testModels.map((model) => ({
            id: model.id,
            name: model.name,
            description: model.description,
          }));
        }
        break;
      }
    }
  }

  return filteredProviders;
}
