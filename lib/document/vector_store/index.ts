'server-only';

import type { VectorStore } from './types';
import { UpstashVectorStore } from './upstash-vector';

export function createVectorStoreClient(): VectorStore {
  return new UpstashVectorStore();
}
