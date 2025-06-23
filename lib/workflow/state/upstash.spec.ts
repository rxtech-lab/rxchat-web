import { UpStashStateClient } from './upstash';

describe('UpStashStateClient', () => {
  let client: UpStashStateClient;
  let testNamespace: string;

  beforeAll(() => {
    // Configure environment variables for the serverless-redis-http service from docker-compose
    process.env.UPSTASH_REDIS_REST_URL = 'http://localhost:8079';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'example_token';
  });

  beforeEach(() => {
    // Use unique namespace for each test to prevent interference
    testNamespace = `test-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    client = new UpStashStateClient(testNamespace);
  });

  afterEach(async () => {
    // Clean up test data after each test
    await client.clearState();
  });

  describe('setState and getState', () => {
    it('should set and get string value', async () => {
      const key = 'test-string';
      const value = 'test value';

      await client.setState(key, value);
      const result = await client.getState<string>(key);

      expect(result).toBe(value);
    });

    it('should set and get object value', async () => {
      const key = 'test-object';
      const value = { name: 'test', count: 42, active: true };

      await client.setState(key, value);
      const result = await client.getState<typeof value>(key);

      expect(result).toEqual(value);
    });

    it('should set and get array value', async () => {
      const key = 'test-array';
      const value = [1, 2, 3, 'test', { nested: true }];

      await client.setState(key, value);
      const result = await client.getState<typeof value>(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const result = await client.getState('non-existent-key');
      expect(result).toBeNull();
    });

    it('should overwrite existing value', async () => {
      const key = 'test-overwrite';
      const firstValue = 'first';
      const secondValue = 'second';

      await client.setState(key, firstValue);
      await client.setState(key, secondValue);
      const result = await client.getState<string>(key);

      expect(result).toBe(secondValue);
    });
  });

  describe('deleteState', () => {
    it('should delete existing key', async () => {
      const key = 'test-delete';
      const value = 'to be deleted';

      await client.setState(key, value);
      expect(await client.getState(key)).toBe(value);

      await client.deleteState(key);
      expect(await client.getState(key)).toBeNull();
    });

    it('should not throw error when deleting non-existent key', async () => {
      await expect(client.deleteState('non-existent')).resolves.not.toThrow();
    });
  });

  describe('getAllState', () => {
    it('should return empty object when no state exists', async () => {
      const result = await client.getAllState();
      expect(result).toEqual({});
    });

    it('should return all state values without namespace prefix', async () => {
      const testData = {
        key1: 'value1',
        key2: { count: 42 },
        key3: [1, 2, 3],
      };

      for (const [key, value] of Object.entries(testData)) {
        await client.setState(key, value);
      }

      const result = await client.getAllState();
      expect(result).toEqual(testData);
    });

    it('should only return state from current namespace', async () => {
      const otherNamespace = `other-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const otherClient = new UpStashStateClient(otherNamespace);

      await client.setState('key1', 'value1');
      await otherClient.setState('key2', 'value2');

      const result = await client.getAllState();
      const otherResult = await otherClient.getAllState();

      expect(result).toEqual({ key1: 'value1' });
      expect(otherResult).toEqual({ key2: 'value2' });

      // Clean up other namespace
      await otherClient.clearState();
    });
  });

  describe('clearState', () => {
    it('should clear all state in namespace', async () => {
      await client.setState('key1', 'value1');
      await client.setState('key2', 'value2');
      await client.setState('key3', 'value3');

      expect(Object.keys(await client.getAllState())).toHaveLength(3);

      await client.clearState();
      const result = await client.getAllState();

      expect(result).toEqual({});
    });

    it('should only clear state from current namespace', async () => {
      const otherNamespace = `other-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const otherClient = new UpStashStateClient(otherNamespace);

      await client.setState('key1', 'value1');
      await otherClient.setState('key2', 'value2');

      await client.clearState();

      expect(await client.getAllState()).toEqual({});
      expect(await otherClient.getAllState()).toEqual({ key2: 'value2' });

      // Clean up other namespace
      await otherClient.clearState();
    });
  });

  describe('namespace isolation', () => {
    it('should isolate state between different namespaces', async () => {
      const namespace1 = `ns1-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const namespace2 = `ns2-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      const client1 = new UpStashStateClient(namespace1);
      const client2 = new UpStashStateClient(namespace2);
      const key = 'same-key';
      const value1 = 'value-from-namespace1';
      const value2 = 'value-from-namespace2';

      await client1.setState(key, value1);
      await client2.setState(key, value2);

      expect(await client1.getState(key)).toBe(value1);
      expect(await client2.getState(key)).toBe(value2);

      // Clean up
      await client1.clearState();
      await client2.clearState();
    });

    it('should use default namespace when none provided', async () => {
      const defaultClient = new UpStashStateClient();
      const namedClient = new UpStashStateClient('default');
      const key = 'test-key';
      const value = 'test-value';

      await defaultClient.setState(key, value);
      const result = await namedClient.getState(key);

      expect(result).toBe(value);

      // Clean up
      await defaultClient.clearState();
    });
  });
});
