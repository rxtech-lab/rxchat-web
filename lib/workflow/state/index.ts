import type { StateClient } from './state';
import { UpStashStateClient } from './upstash';

export * from './state';
export * from './upstash';

export const createStateClient = (namespace?: string): StateClient => {
  return new UpStashStateClient(namespace);
};
