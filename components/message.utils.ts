import { z } from 'zod';

export const mcpToolResultSchema = z
  .object({
    output: z.string().transform((str) => {
      try {
        return JSON.parse(str);
      } catch {
        return str; // If parsing fails, return the original string
      }
    }),
    url: z.string(),
    suggestions: z.array(z.string()).nullable(),
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
