export interface McpRouterInterface {
  // check if the tools exist in the MCP router
  checkToolsExist: (tools: string[]) => Promise<{
    missingTools: string[];
  }>;
}
