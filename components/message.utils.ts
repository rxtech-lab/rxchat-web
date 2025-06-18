import { z } from 'zod';

export const SuggestionSchema = z.object({
  type: z.literal('suggestion'),
  text: z.string(),
});

export const SuggestionListSchema = z.object({
  text: z.string(),
  value: z.string(),
  type: z.enum(['SUGGESTION_TYPE_CHAT']),
});

export const McpToolResultSchema = z
  .object({
    output: z.string().transform((str) => {
      try {
        return JSON.parse(str);
      } catch {
        return str; // If parsing fails, return the original string
      }
    }),
    url: z.string(),
    suggestions: z.array(SuggestionListSchema).nullable(),
    suggestHeight: z.number().nullable().optional(),
  })
  .array();

export function parseMcpContent(obj: any) {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }
  if ('content' in obj) {
    if (Array.isArray(obj.content)) {
      return obj.content.map((item: { type: string; text: string }) => {
        if (item.type === 'text') {
          return JSON.parse(item.text);
        }

        return item;
      });
    }
  }

  return false;
}
