export interface Markitdown {
  /**
   * Convert a URL content to Markdown
   * @param url - The URL content to convert to Markdown
   * @returns The Markdown content
   */
  convertToMarkdown(url: string): Promise<string>;
}
