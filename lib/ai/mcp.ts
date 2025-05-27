import { experimental_createMCPClient as createMCPClientSDK } from 'ai';

export const createMCPClient = () =>
  createMCPClientSDK({
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
