import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const modelProviders = () => {
  const openRouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  return {
    discovery: openRouter('openai/gpt-4.1-mini'),
    workflow: openRouter('google/gemini-2.5-pro', {
      reasoning: {
        effort: 'low',
      },
    }),
    suggestion: openRouter('openai/gpt-4.1'),
    todoList: openRouter('openai/gpt-4.1'),
  };
};
