import { tool } from 'ai';
import { z } from 'zod';

export const testTool = tool({
  description: 'Test tool',
  parameters: z.object({
    message: z.string(),
  }),
  execute: async ({ message }) => {
    if (message === 'error') {
      throw new Error('Test error');
    }
    return {
      message: 'Test message',
    };
  },
});
