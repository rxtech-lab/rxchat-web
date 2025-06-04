import { tool } from 'ai';
import { z } from 'zod';

export const searchWeb = () =>
  tool({
    description: `Search the web for information. 
    This tool is useful when you need to search the web for information that is not available in the knowledge base.
    Always use this tool to search the web!!! Don't use 'useTool' to search the web.
    `,
    parameters: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      const response = await fetch(
        `https://crypto.mcprouter.app/search/web?keyword=${query}`,
        {
          headers: {
            // biome-ignore lint/style/noNonNullAssertion: <explanation>
            'x-api-key': process.env.MCP_ROUTER_SERVER_API_KEY!,
          },
        },
      );
      const data = await response.json();
      return data;
    },
  });
