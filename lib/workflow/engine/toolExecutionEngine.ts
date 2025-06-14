import type { ToolExecutionEngine } from '../workflow-engine';

export class McpToolExecutionEngine implements ToolExecutionEngine {
  private readonly mcpRouterServerUrl: string;
  private readonly mcpRouterApiKey: string;

  constructor(
    mcpRouterServerUrl: string | undefined = process.env.MCP_ROUTER_SERVER_URL,
    mcpRouterApiKey: string | undefined = process.env.MCP_ROUTER_SERVER_API_KEY,
  ) {
    if (!mcpRouterServerUrl) {
      throw new Error('MCP_ROUTER_SERVER_URL is not set');
    }
    if (!mcpRouterApiKey) {
      throw new Error('MCP_ROUTER_SERVER_API_KEY is not set');
    }
    this.mcpRouterServerUrl = mcpRouterServerUrl;
    this.mcpRouterApiKey = mcpRouterApiKey;
  }

  async execute(
    tool: string,
    input: any,
    inputSchema: Record<string, any> = {},
    outputSchema: Record<string, any> = {},
  ): Promise<any> {
    const url = new URL(this.mcpRouterServerUrl);
    url.pathname = `/tool/${tool}/use`;

    const response = await fetch(url.toString(), {
      method: 'POST',
      body: JSON.stringify({ input }),
      headers: {
        'x-api-key': this.mcpRouterApiKey,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error executing tool ${tool}: ${errorText}`);
      throw new Error('Failed to execute tool');
    }

    const data = await response.json();
    if (
      !('output' in data) ||
      data.output === undefined ||
      data.output === null
    ) {
      throw new Error('No output from tool');
    }
    return data.output;
  }
}

export const createToolExecutionEngine = (): ToolExecutionEngine => {
  return new McpToolExecutionEngine();
};
