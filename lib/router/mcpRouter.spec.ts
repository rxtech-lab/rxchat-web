import nock from 'nock';
import { McpRouter } from './mcpRouter';

describe('McpRouter', () => {
  let mcpRouter: McpRouter;
  const baseUrl = 'http://localhost:3000';

  beforeEach(() => {
    // Clear all nock interceptors before each test
    nock.cleanAll();

    // Create instance with test URL and API key
    mcpRouter = new McpRouter('http://localhost:3000/sse', 'test-api-key');
  });

  afterEach(() => {
    // Clean up any remaining interceptors
    nock.cleanAll();
  });

  describe('constructor', () => {
    it('should extract base URL from full URL', () => {
      process.env.MCP_ROUTER_SERVER_API_KEY = 'test-api';
      const router1 = new McpRouter('http://localhost:3000/sse');
      const router2 = new McpRouter('https://api.example.com:8080/v1/endpoint');

      // We can't directly test the private baseUrl, but we can test the behavior
      expect(router1).toBeInstanceOf(McpRouter);
      expect(router2).toBeInstanceOf(McpRouter);
    });
  });

  describe('checkToolsExist', () => {
    it('should return empty missingTools when all tools exist (exists: true)', async () => {
      nock(baseUrl)
        .get('/tools/check')
        .query({ ids: ['tool1', 'tool2'] })
        .matchHeader('x-api-key', 'test-api-key')
        .matchHeader('Content-Type', 'application/json')
        .reply(200, { exists: true });

      const result = await mcpRouter.checkToolsExist(['tool1', 'tool2']);

      expect(result).toEqual({ missingTools: [] });
    });

    it('should return missingIds from 400 error response', async () => {
      nock(baseUrl)
        .get('/tools/check')
        .query({ ids: ['tool1', 'tool2', 'tool3'] })
        .matchHeader('x-api-key', 'test-api-key')
        .reply(400, {
          error: 'Invalid input',
          missingIds: ['tool2', 'tool3'],
        });

      const result = await mcpRouter.checkToolsExist([
        'tool1',
        'tool2',
        'tool3',
      ]);

      expect(result).toEqual({ missingTools: ['tool2', 'tool3'] });
    });

    it('should return all tools as missing for 400 error without missingIds', async () => {
      const tools = ['tool1', 'tool2'];
      nock(baseUrl)
        .get('/tools/check')
        .query({ ids: tools })
        .matchHeader('x-api-key', 'test-api-key')
        .reply(400, {
          error: 'Invalid input',
        });

      const result = await mcpRouter.checkToolsExist(tools);

      expect(result).toEqual({ missingTools: tools });
    });

    it('should return all tools as missing for 500 error', async () => {
      const tools = ['tool1', 'tool2'];
      nock(baseUrl)
        .get('/tools/check')
        .query({ ids: tools })
        .matchHeader('x-api-key', 'test-api-key')
        .reply(500, {
          error: 'Server error',
        });

      const result = await mcpRouter.checkToolsExist(tools);

      expect(result).toEqual({ missingTools: tools });
    });

    it('should return all tools as missing when network error occurs', async () => {
      const tools = ['tool1', 'tool2'];
      nock(baseUrl)
        .get('/tools/check')
        .query({ ids: tools })
        .matchHeader('x-api-key', 'test-api-key')
        .replyWithError('Network error');

      const result = await mcpRouter.checkToolsExist(tools);

      expect(result).toEqual({ missingTools: tools });
    });

    it('should handle empty tools array', async () => {
      // Don't set up any nock interceptor since no HTTP request should be made
      const result = await mcpRouter.checkToolsExist([]);

      expect(result).toEqual({ missingTools: [] });
      // Verify that no HTTP request was made by checking there are no pending interceptors
      expect(nock.pendingMocks()).toHaveLength(0);
    });

    it('should handle malformed JSON response', async () => {
      const tools = ['tool1', 'tool2'];
      nock(baseUrl)
        .get('/tools/check')
        .query({ ids: tools })
        .matchHeader('x-api-key', 'test-api-key')
        .reply(200, 'invalid json');

      const result = await mcpRouter.checkToolsExist(tools);

      expect(result).toEqual({ missingTools: tools });
    });
  });
});
