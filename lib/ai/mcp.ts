import { experimental_createMCPClient as createMCPClient } from 'ai';

export const mcpClient = await createMCPClient({
  transport: {
    type: 'sse',
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    url: process.env.MCP_ROUTER_SERVER_URL!,
    headers: {
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      'x-api-key': process.env.MCP_ROUTER_SERVER_API_KEY!,
    },
  },
});
