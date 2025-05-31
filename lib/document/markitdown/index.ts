import type { Markitdown } from './types';
import { MarkitdownService } from './markitdown';

export function createMarkitdownClient(): Markitdown {
  return new MarkitdownService();
}
