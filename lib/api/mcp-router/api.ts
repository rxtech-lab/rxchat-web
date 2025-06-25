import { Api } from './client';

export function getMCPRouterClient() {
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const url = new URL(process.env.MCP_ROUTER_SERVER_URL!);
  // delete the path
  url.pathname = '';

  return new Api({
    baseUrl: url.toString().replace(/\/$/, ''),
    securityWorker: async () => {
      // biome-ignore lint/style/noNonNullAssertion: <explanation>
      const apiKey = process.env.MCP_ROUTER_SERVER_API_KEY!;
      return {
        headers: {
          'x-api-key': apiKey,
        },
      };
    },
  });
}
