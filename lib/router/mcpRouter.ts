import { z } from 'zod';
import type { McpRouterInterface } from './types';

// Zod schemas for API response validation
const SuccessResponseSchema = z.object({
  exists: z.boolean(),
});

const BadRequestResponseSchema = z.object({
  error: z.string(),
  missingIds: z.array(z.string()).optional(),
});

const ServerErrorResponseSchema = z.object({
  error: z.string(),
});

export class McpRouter implements McpRouterInterface {
  private readonly baseUrl: string;

  constructor(
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    url: string = process.env.MCP_ROUTER_SERVER_URL!,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    private readonly apiKey: string = process.env.MCP_ROUTER_SERVER_API_KEY!,
  ) {
    // Extract base URL (protocol + host + port) from the provided URL
    const parsedUrl = new URL(url);
    this.baseUrl = parsedUrl.origin;
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
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 400) {
          // Validate 400 response with Zod
          const validatedData = BadRequestResponseSchema.parse(responseData);
          // 400 error contains missingIds array with missing tool identifiers
          return { missingTools: validatedData.missingIds || tools };
        }

        if (response.status === 500) {
          // Validate 500 response with Zod
          ServerErrorResponseSchema.parse(responseData);
        }

        // For other errors, assume all tools are missing
        return { missingTools: tools };
      }

      // Validate 200 response with Zod
      const validatedData = SuccessResponseSchema.parse(responseData);

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
