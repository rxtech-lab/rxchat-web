import { experimental_createMCPClient as createMCPClientSDK } from 'ai';

import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const createMCPClient = () => {
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const url = new URL(process.env.MCP_ROUTER_SERVER_URL!);
  // add x-api-key to the url
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  url.searchParams.set('x-api-key', process.env.MCP_ROUTER_SERVER_API_KEY!);

  const transport = new StreamableHTTPClientTransport(url, {});
  return createMCPClientSDK({
    transport,
  });
};
