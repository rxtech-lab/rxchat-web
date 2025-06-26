'use server';

import { auth } from '@/app/(auth)/auth';
import { getMCPRouterClient } from '@/lib/api/mcp-router/api';
import type { Tool } from '@/lib/api/mcp-router/client';

export interface MCPTool {
  title: string;
  description: string;
  identifier: string;
}

export interface SearchMCPToolsResult {
  success: boolean;
  tools?: Tool[];
  error?: string;
}

/**
 * Search MCP tools with authentication check
 * @param query - Search query string (optional)
 * @param limit - Number of results to return (default: 10)
 */
export async function searchMCPTools(
  query?: string,
): Promise<SearchMCPToolsResult> {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return {
        success: false,
        error: 'Authentication required',
      };
    }

    // Get MCP router client
    const mcpClient = getMCPRouterClient();

    // Search tools using the MCP router API
    const response = await mcpClient.tool.listTools(
      {
        query: query ? (query.length > 0 ? query : undefined) : undefined,
        itemsPerPage: 10,
        page: 1,
      },
      {
        cache: 'force-cache',
        next: {
          revalidate: 60 * 10,
        },
      },
    );

    return {
      success: true,
      tools: response.data.data,
    };
  } catch (error) {
    console.error('Error searching MCP tools:', error);

    // Return generic error message to avoid exposing internal details
    return {
      success: false,
      error: 'Failed to search tools. Please try again.',
    };
  }
}
