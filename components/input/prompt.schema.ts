import { z } from 'zod';

export const PromptSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  code: z.string().min(1),
  visibility: z.enum(['public', 'private']).default('private'),
  tags: z.array(z.string()).default([]),
  icon: z.string().optional(),
});
