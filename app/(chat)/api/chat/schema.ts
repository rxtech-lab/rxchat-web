import { ProviderTypeSchema } from '@/lib/ai/models';
import { z } from 'zod';

const textPartSchema = z.object({
  text: z.string().min(1).max(2000),
  type: z.enum(['text']),
});

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid(),
    createdAt: z.coerce.date(),
    role: z.enum(['user']),
    content: z.string().min(1).max(2000),
    parts: z.array(textPartSchema),
    experimental_attachments: z
      .array(
        z.object({
          url: z.string().url(),
          name: z.string().min(1).max(2000),
          contentType: z.string(),
        }),
      )
      .optional(),
  }),
  selectedChatModel: z.string(),
  selectedChatModelProvider: ProviderTypeSchema,
  selectedVisibilityType: z.enum(['public', 'private']),
  useWebSearch: z.boolean().optional().default(false),
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
