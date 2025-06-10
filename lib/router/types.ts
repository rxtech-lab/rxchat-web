export interface McpRouterInterface {
  // check if the tools exist in the MCP router
  checkToolsExist: (tools: string[]) => Promise<{
    missingTools: string[];
  }>;
  getToolInfo: (identifier: string) => Promise<{
    description: string;
    inputSchema: any;
    outputSchema: any;
  }>;
}
