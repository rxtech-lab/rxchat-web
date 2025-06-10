'server-only';

import type { MemoryClient } from './types';
import { Mem0AIClient } from './mem0ai-client';
import { isTestEnvironment } from '../constants';
import { MockClient } from './mcok-client';

export function createMemoryClient(): MemoryClient {
  if (isTestEnvironment) {
    return new MockClient();
  }
  return new Mem0AIClient();
}

export * from './types';
