import { z } from 'zod';
import type { Markitdown } from './types';

/**
 * Response schema for the markitdown API
 */
const MarkitdownResponseSchema = z.object({
  content: z.string(),
});

/**
 * Implementation of the Markitdown interface that converts content to Markdown
 * using the markitdown.mcprouter.app service
 */
export class MarkitdownService implements Markitdown {
  private readonly apiUrl = 'https://markitdown.mcprouter.app/convert';
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.MARKITDOWN_ADMIN_API_KEY || '';
    if (!this.apiKey) {
      throw new Error(
        'MARKITDOWN_ADMIN_API_KEY environment variable is required',
      );
    }
  }

  /**
   * Convert a URL content to Markdown
   * @param url - The URL content to convert to Markdown
   * @returns The Markdown content
   */
  async convertToMarkdown(url: string): Promise<string> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          file: url,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Validate the response using zod
      const validatedData = MarkitdownResponseSchema.parse(data);

      return validatedData.content;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid response format: ${error.message}`);
      }
      throw error;
    }
  }
}

/**
 * Create a new instance of the MarkitdownService
 * @returns A new MarkitdownService instance
 */
export const createMarkitdownService = (): Markitdown => {
  return new MarkitdownService();
};
