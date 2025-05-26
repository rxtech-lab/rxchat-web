import { z } from 'zod';

export const PromptSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  code: z.string().min(1),
});
