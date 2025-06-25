import type {
  StateClient,
  SetStateOptions,
  GetStateOptions,
  DeleteStateOptions,
  ClearStateOptions,
  GetAllStateOptions,
} from './state';
import { Redis } from '@upstash/redis';

export class UpStashStateClient implements StateClient {
  private readonly client: Redis;

  constructor(private readonly namespace: string = 'default') {
    this.client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
      token:
        process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
    });
  }
  async getAllState(
    _options?: GetAllStateOptions,
  ): Promise<Record<string, any>> {
    const keys = await this.client.keys(`${this.namespace}:*`);
    if (keys.length === 0) {
      return {};
    }
    const values = await this.client.mget(keys);
    return keys.reduce(
      (acc, key, index) => {
        acc[key.replace(`${this.namespace}:`, '')] = values[index];
        return acc;
      },
      {} as Record<string, any>,
    );
  }

  async setState<T>(
    key: string,
    value: T,
    _options?: SetStateOptions,
  ): Promise<void> {
    await this.client.set(`${this.namespace}:${key}`, value);
  }

  async getState<T>(
    key: string,
    _options?: GetStateOptions,
  ): Promise<T | null> {
    const value = await this.client.get(`${this.namespace}:${key}`);
    return value as T | null;
  }

  async deleteState(key: string, _options?: DeleteStateOptions): Promise<void> {
    await this.client.del(`${this.namespace}:${key}`);
  }

  async clearState(_options?: ClearStateOptions): Promise<void> {
    const keys = await this.client.keys(`${this.namespace}:*`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
