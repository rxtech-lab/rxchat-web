'server-only';

import type { MemoryClient } from './types';
import { Mem0AIClient } from './mem0ai-client';

export function createMemoryClient(): MemoryClient {
  return new Mem0AIClient();
}

export * from './types';
