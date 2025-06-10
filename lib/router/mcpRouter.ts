import { z } from 'zod';
import type { McpRouterInterface } from './types';

// Zod schemas for API response validation
const SuccessCheckExistingResponseSchema = z.object({
  exists: z.boolean(),
});

const BadRequestCheckExistingResponseSchema = z.object({
  error: z.string(),
  missingIds: z.array(z.string()).optional(),
});

const ServerCheckExistingResponseSchema = z.object({
  error: z.string(),
});

const ToolInfoResponseSchema = z.object({
  description: z.string(),
  inputSchema: z.any(),
  outputSchema: z.any(),
});

export class McpRouter implements McpRouterInterface {
  private readonly baseUrl: string;

  constructor(
    url: string = (() => {
      const envUrl = process.env.MCP_ROUTER_SERVER_URL;
      if (!envUrl || envUrl.trim() === '') {
        throw new Error(
          'MCP_ROUTER_SERVER_URL environment variable is required but not set or empty. Please configure this environment variable.',
        );
      }
      return envUrl;
    })(),
    private readonly apiKey: string = (() => {
      const envApiKey = process.env.MCP_ROUTER_SERVER_API_KEY;
      if (!envApiKey || envApiKey.trim() === '') {
        throw new Error(
          'MCP_ROUTER_SERVER_API_KEY environment variable is required but not set or empty. Please configure this environment variable.',
        );
      }
      return envApiKey;
    })(),
  ) {
    // Extract base URL (protocol + host + port) from the provided URL
    const parsedUrl = new URL(url);
    this.baseUrl = parsedUrl.origin;
  }

  async getToolInfo(identifier: string): Promise<{
    description: string;
    inputSchema: any;
    outputSchema: any;
  }> {
    const url = new URL(`${this.baseUrl}/tool/${identifier}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          `Failed to get tool info for ${identifier}: ${responseData.error}`,
        );
      }

      const validatedData = ToolInfoResponseSchema.safeParse(responseData);
      if (!validatedData.success) {
        throw new Error(
          `Failed to get tool info for ${identifier}: ${validatedData.error}`,
        );
      }

      return {
        description: responseData.description,
        inputSchema: responseData.inputSchema,
        outputSchema: responseData.outputSchema,
      };
    } catch (error) {
      throw new Error(`Failed to get tool info for ${identifier}: ${error}`);
    }
  }
  async checkToolsExist(tools: string[]): Promise<{ missingTools: string[] }> {
    try {
      const url = new URL(`${this.baseUrl}/tools/check`);

      // Add all tool IDs as query parameters
      for (const tool of tools) {
        url.searchParams.append('ids', tool);
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 400) {
          // Validate 400 response with Zod
          const validatedData =
            BadRequestCheckExistingResponseSchema.parse(responseData);
          // 400 error contains missingIds array with missing tool identifiers
          return { missingTools: validatedData.missingIds || tools };
        }

        if (response.status === 500) {
          // Validate 500 response with Zod
          ServerCheckExistingResponseSchema.parse(responseData);
        }

        // For other errors, assume all tools are missing
        return { missingTools: tools };
      }

      // Validate 200 response with Zod
      const validatedData =
        SuccessCheckExistingResponseSchema.parse(responseData);

      // For successful response (200), if exists is true, no tools are missing
      if (validatedData.exists) {
        return { missingTools: [] };
      }

      // If exists is false, all tools are missing
      return { missingTools: tools };
    } catch (error) {
      // If there's a network error, parsing error, or Zod validation error, assume all tools are missing
      return { missingTools: tools };
    }
  }
}
