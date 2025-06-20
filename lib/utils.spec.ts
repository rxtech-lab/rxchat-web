/**
 * @jest-environment jsdom
 */

import { addToolResultToMessage } from './ai/utils';
import { ChatSDKError } from './errors';
import {
  getBrandName,
  cn,
  fetcher,
  fetchWithErrorHandlers,
  getLocalStorage,
  generateUUID,
  getMostRecentUserMessage,
  getDocumentTimestampByIndex,
  getTrailingMessageId,
  sanitizeText,
} from './utils';
import type { Document } from '@/lib/db/schema';
import type { CoreAssistantMessage, CoreToolMessage, UIMessage } from 'ai';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock console.error
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('getBrandName', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return the environment variable value when NEXT_PUBLIC_BRAND_NAME is set', () => {
    process.env.NEXT_PUBLIC_BRAND_NAME = 'CustomBrand';
    expect(getBrandName()).toBe('CustomBrand');
  });

  it('should return "RxChat" as fallback when NEXT_PUBLIC_BRAND_NAME is not set', () => {
    process.env.NEXT_PUBLIC_BRAND_NAME = undefined;
    expect(getBrandName()).toBe('RxChat');
  });

  it('should return "RxChat" as fallback when NEXT_PUBLIC_BRAND_NAME is empty string', () => {
    process.env.NEXT_PUBLIC_BRAND_NAME = '';
    expect(getBrandName()).toBe('RxChat');
  });

  it('should handle different brand names correctly', () => {
    const testBrands = ['MyChat', 'SuperChat', 'AI Assistant', 'ChatBot Pro'];

    testBrands.forEach((brand) => {
      process.env.NEXT_PUBLIC_BRAND_NAME = brand;
      expect(getBrandName()).toBe(brand);
    });
  });
});

describe('cn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should merge class names using clsx and tailwind-merge', () => {
    const result = cn('px-2 py-1', 'bg-red-500', 'px-4'); // px-4 should override px-2
    expect(result).toBe('py-1 bg-red-500 px-4');
  });

  test('should handle conditional classes', () => {
    const result = cn(
      'base-class',
      true && 'conditional-class',
      false && 'hidden-class',
    );
    expect(result).toBe('base-class conditional-class');
  });

  test('should handle arrays of classes', () => {
    const result = cn(['class1', 'class2'], 'class3');
    expect(result).toBe('class1 class2 class3');
  });

  test('should handle empty input', () => {
    const result = cn();
    expect(result).toBe('');
  });

  test('should handle undefined and null values', () => {
    const result = cn('valid-class', undefined, null, 'another-class');
    expect(result).toBe('valid-class another-class');
  });
});

describe('fetcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  test('should return parsed JSON on successful response', async () => {
    const mockData = { message: 'success' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockData),
    } as any);

    const result = await fetcher('/api/test');

    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledWith('/api/test');
  });

  test('should throw ChatSDKError on unsuccessful response', async () => {
    const errorResponse = { code: 'bad_request:api', cause: 'Invalid input' };
    mockFetch.mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue(errorResponse),
    } as any);

    await expect(fetcher('/api/test')).rejects.toThrow(ChatSDKError);
    await expect(fetcher('/api/test')).rejects.toThrow('The request couldn\'t be processed. Please check your input and try again.');
  });

  test('should handle fetch errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(fetcher('/api/test')).rejects.toThrow('Network error');
  });
});

describe('fetchWithErrorHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    (navigator as any).onLine = true;
  });

  test('should return response on successful fetch', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ data: 'success' }),
    };
    mockFetch.mockResolvedValue(mockResponse as any);

    const result = await fetchWithErrorHandlers('/api/test');

    expect(result).toBe(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith('/api/test', undefined);
  });

  test('should throw offline error when navigator is offline', async () => {
    (navigator as any).onLine = false;
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(fetchWithErrorHandlers('/api/test')).rejects.toThrow(
      ChatSDKError,
    );
  });

  test('should throw stream error when online but fetch fails', async () => {
    (navigator as any).onLine = true;
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(fetchWithErrorHandlers('/api/test')).rejects.toThrow(
      ChatSDKError,
    );
  });
});

describe('getLocalStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
  });

  test('should return parsed data from localStorage when window is defined', () => {
    const testData = ['item1', 'item2'];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(testData));

    const result = getLocalStorage('test-key');

    expect(result).toEqual(testData);
    expect(localStorageMock.getItem).toHaveBeenCalledWith('test-key');
  });

  test('should return empty array when localStorage item is null', () => {
    localStorageMock.getItem.mockReturnValue(null);

    const result = getLocalStorage('test-key');

    expect(result).toEqual([]);
  });

  test('should return empty array when localStorage item is empty string', () => {
    localStorageMock.getItem.mockReturnValue('');

    const result = getLocalStorage('test-key');

    expect(result).toEqual([]);
  });
});

describe('generateUUID', () => {
  test('should generate valid UUID format', () => {
    const uuid = generateUUID();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    expect(uuid).toMatch(uuidRegex);
  });

  test('should generate different UUIDs on multiple calls', () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();

    expect(uuid1).not.toBe(uuid2);
  });

  test('should have correct length', () => {
    const uuid = generateUUID();
    expect(uuid.length).toBe(36);
  });

  test('should always have 4 as the version number', () => {
    const uuid = generateUUID();
    const versionChar = uuid.charAt(14); // Version is at position 14

    expect(versionChar).toBe('4');
  });
});

describe('getMostRecentUserMessage', () => {
  test('should return the most recent user message', () => {
    const messages: UIMessage[] = [
      { id: '1', role: 'user', content: 'First message' },
      { id: '2', role: 'assistant', content: 'Assistant response' },
      { id: '3', role: 'user', content: 'Second message' },
      { id: '4', role: 'user', content: 'Most recent message' },
    ];

    const result = getMostRecentUserMessage(messages);

    expect(result).toEqual({
      id: '4',
      role: 'user',
      content: 'Most recent message',
    });
  });

  test('should return undefined when there are no user messages', () => {
    const messages: UIMessage[] = [
      { id: '1', role: 'assistant', content: 'Assistant message' },
      { id: '2', role: 'system', content: 'System message' },
    ];

    const result = getMostRecentUserMessage(messages);

    expect(result).toBeUndefined();
  });

  test('should return undefined when messages array is empty', () => {
    const result = getMostRecentUserMessage([]);

    expect(result).toBeUndefined();
  });
});

describe('getDocumentTimestampByIndex', () => {
  const mockDocuments: Document[] = [
    {
      id: '1',
      createdAt: new Date('2023-01-01'),
      content: 'Doc 1',
      title: 'Title 1',
      kind: 'text',
    },
    {
      id: '2',
      createdAt: new Date('2023-01-02'),
      content: 'Doc 2',
      title: 'Title 2',
      kind: 'text',
    },
    {
      id: '3',
      createdAt: new Date('2023-01-03'),
      content: 'Doc 3',
      title: 'Title 3',
      kind: 'text',
    },
  ];

  test('should return timestamp of document at given index', () => {
    const result = getDocumentTimestampByIndex(mockDocuments, 1);

    expect(result).toEqual(new Date('2023-01-02'));
  });

  test('should return first document timestamp for index 0', () => {
    const result = getDocumentTimestampByIndex(mockDocuments, 0);

    expect(result).toEqual(new Date('2023-01-01'));
  });

  test('should return current date when documents is null', () => {
    const beforeCall = new Date();
    const result = getDocumentTimestampByIndex(null as any, 0);
    const afterCall = new Date();

    expect(result.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });

  test('should return current date when index is greater than documents length', () => {
    const beforeCall = new Date();
    const result = getDocumentTimestampByIndex(mockDocuments, 10);
    const afterCall = new Date();

    expect(result.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(result.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });
});

describe('getTrailingMessageId', () => {
  type ResponseMessage = (CoreToolMessage | CoreAssistantMessage) & {
    id: string;
  };

  test('should return ID of the last message', () => {
    const messages: ResponseMessage[] = [
      { id: '1', role: 'assistant', content: 'First message' },
      { id: '2', role: 'assistant', content: 'Second message' },
      { id: '3', role: 'assistant', content: 'Last message' },
    ];

    const result = getTrailingMessageId({ messages });

    expect(result).toBe('3');
  });

  test('should return null when messages array is empty', () => {
    const result = getTrailingMessageId({ messages: [] });

    expect(result).toBeNull();
  });

  test('should handle single message', () => {
    const messages: ResponseMessage[] = [
      { id: '1', role: 'assistant', content: 'Only message' },
    ];

    const result = getTrailingMessageId({ messages });

    expect(result).toBe('1');
  });
});

describe('sanitizeText', () => {
  test('should remove function call marker from text', () => {
    const text = 'This is some text <has_function_call> with a marker';
    const result = sanitizeText(text);

    expect(result).toBe('This is some text  with a marker');
  });

  test('should handle multiple function call markers', () => {
    const text = 'Start <has_function_call> middle <has_function_call> end';
    const result = sanitizeText(text);

    expect(result).toBe('Start  middle <has_function_call> end');
  });

  test('should return original text when no markers present', () => {
    const text = 'This is clean text without any markers';
    const result = sanitizeText(text);

    expect(result).toBe(text);
  });

  test('should handle empty string', () => {
    const result = sanitizeText('');

    expect(result).toBe('');
  });

  test('should handle text that only contains the marker', () => {
    const result = sanitizeText('<has_function_call>');

    expect(result).toBe('');
  });
});

describe('addToolResultToMessage', () => {
  const errorMessage = {
    id: '35111926-91a1-4d57-b2d7-a40e9d548d8b',
    chatId: 'f77ecd2c-892f-424a-886b-7832a59b354f',
    role: 'assistant',
    parts: [
      {
        type: 'step-start',
      },
      {
        type: 'text',
        text: '我来为您分析当前比特币的投资时机。让我先获取一些关键信息来给您一个全面的分析。',
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          step: 0,
          args: {
            query: 'current market index greed fear index bitcoin price',
          },
          toolCallId: 'toolu_vrtx_019Dq5arEkoTDmwiJT8YoThh',
          toolName: 'query',
          result: {
            content: [
              {
                type: 'text',
                text: '[{"createdAt":"2025-05-29T07:06:56.001884Z","description":"\\n\\t\\t\\tAccess pumpfun cryptocurrency data, trending tokens, and structured website data. Sometimes, the\\n\\t\\t\\ttrending tokens are not available, use search tokens order by created_time to get the latest tokens.\\n\\t\\t\\tID is the token address for the token, you can then go https://pump.fun/coin/:ID to get the token detail.\\n\\t\\t\\tWhen user ask for certain token\'s detail, then use web search to get the new about the token.\\n\\t\\t\\tYou can also use structured_web_data to get the structured data from a website to analyze the website.\\n\\t\\t","identifier":"crypto-data","inputSchema":{"$id":"https://github.com/wyt-labs/mcp-router/plugins/crypto-data/crypto-data/crypto-data-input","$schema":"https://json-schema.org/draft/2020-12/schema","additionalProperties":false,"properties":{"bitcoin_market_sentiment":{"additionalProperties":false,"description":"Input for BITCOIN_MARKET_SENTIMENT endpoint","properties":{"end_date":{"description":"The end date to get the sentiment for. Default is today","type":"string"},"start_date":{"description":"The start date to get the sentiment for. Default is today","type":"string"}},"required":["start_date","end_date"],"type":"object"},"endpoint":{"enum":["HEALTH","TRENDING_TOKENS","SEARCH_TOKENS","GITHUB_REPOSITORY","SEARCH_WEB","STRUCTURED_WEB_DATA","BITCOIN_MARKET_SENTIMENT"],"type":"string"},"github_repository":{"additionalProperties":false,"description":"Input for GITHUB_REPOSITORY endpoint","properties":{"owner":{"description":"Repository owner","type":"string"},"repo":{"description":"Repository name","type":"string"}},"required":["owner","repo"],"type":"object"},"health":{"additionalProperties":false,"description":"Input for HEALTH endpoint","properties":{},"type":"object"},"search_tokens":{"additionalProperties":false,"description":"Input for SEARCH_TOKENS endpoint","properties":{"limit":{"default":10,"description":"Maximum number of tokens to return","type":"integer"},"order":{"default":["swap_count"],"description":"Order results by fields. Can be multiple fields but please remember to include created_time when make a search!!!!!","items":{"enum":["swap_count","created_time","volume24h","price","market_cap"],"type":"string"},"type":"array"},"sort_direction":{"default":"desc","description":"Sort direction","enum":["asc","desc"],"type":"string"},"symbol":{"description":"Token symbol to search for (partial match supported). Can be null if user ask for latest tokens","type":"string"}},"type":"object"},"search_web":{"additionalProperties":false,"description":"Input for SEARCH_WEB endpoint","properties":{"keyword":{"description":"Search keyword or phrase","type":"string"}},"required":["keyword"],"type":"object"},"structured_web_data":{"additionalProperties":false,"description":"Input for STRUCTURED_WEB_DATA endpoint","properties":{"mode":{"default":"regular","description":"The mode to browse the web (regular or browser)","enum":["regular","browser"],"type":"string"},"url":{"description":"The website URL to extract structured data from","type":"string"}},"required":["url"],"type":"object"},"trending_tokens":{"additionalProperties":false,"description":"Input for TRENDING_TOKENS endpoint","properties":{"limit":{"default":10,"description":"Maximum number of tokens to return (max 20)","type":"integer"},"page":{"default":1,"description":"Page number","type":"integer"},"timeframe":{"default":"24h","description":"Timeframe for trending data (24h","enum":["24h","7d","30d"],"type":"string"}},"type":"object"}},"required":["endpoint"],"type":"object"},"outputSchema":{"$id":"https://github.com/wyt-labs/mcp-router/plugins/crypto-data/crypto-data/crypto-data-output","$schema":"https://json-schema.org/draft/2020-12/schema","additionalProperties":false,"properties":{"bitcoin_market_sentiment":{"additionalProperties":false,"description":"Output for BITCOIN_MARKET_SENTIMENT endpoint","properties":{"data":{"description":"List of coin data index entries","items":{"additionalProperties":false,"properties":{"altcoin_season_index":{"description":"Altcoin season index is a metric used to measure the performance of non-Bitcoin cryptocurrencies in the cryptocurrency market. It helps investors understand whether altcoins are outperforming Bitcoin during a specific period providing insights into market trends and investment opportunities","maximum":100,"minimum":0,"type":"integer"},"created_at":{"description":"Timestamp when the data was created","format":"date-time","type":"string"},"greed_fear_index":{"description":"The Crypto Fear \\u0026 Greed Index is a sentiment indicator that measures market emotions and sentiment towards Bitcoin and the broader cryptocurrency market. The index ranges from 0-100 where: 0-20 indicates Extreme Fear (potentially good buying opportunity)","maximum":100,"minimum":0,"type":"integer"},"id":{"description":"ID of the coin data index","type":"integer"}},"required":["id","greed_fear_index","altcoin_season_index","created_at"],"type":"object"},"type":"array"}},"required":["data"],"type":"object"},"error":{"description":"Error message if the request failed","type":"string"},"github_repository":{"additionalProperties":false,"description":"Output for GITHUB_REPOSITORY endpoint","properties":{"description":{"description":"Repository description","type":"string"},"forks":{"description":"Number of forks","type":"integer"},"fullName":{"description":"Full repository name (owner/repo)","type":"string"},"id":{"description":"GitHub repository ID","type":"integer"},"issues":{"description":"Number of open issues","type":"integer"},"language":{"description":"Primary programming language","type":"string"},"lastUpdated":{"description":"Last update timestamp","format":"date-time","type":"string"},"name":{"description":"Repository name","type":"string"},"stars":{"description":"Number of stars","type":"integer"},"topics":{"description":"Repository topics/tags","items":{"type":"string"},"type":"array"},"url":{"description":"Repository URL","type":"string"}},"required":["id","name","fullName","description","url","stars","forks","issues","lastUpdated","language","topics"],"type":"object"},"health":{"additionalProperties":false,"description":"Output for HEALTH endpoint","properties":{"status":{"description":"API health status","type":"string"}},"required":["status"],"type":"object"},"search_tokens":{"additionalProperties":false,"description":"Output for SEARCH_TOKENS endpoint","properties":{"metadata":{"additionalProperties":false,"description":"Pagination metadata","properties":{"limit":{"description":"Number of items per page","type":"integer"},"page":{"description":"Page number","type":"integer"},"total":{"description":"Total number of items","type":"integer"},"totalPages":{"description":"Total number of pages","type":"integer"}},"required":["page","limit","total","totalPages"],"type":"object"},"tokens":{"description":"List of tokens matching search criteria","items":{"additionalProperties":false,"properties":{"createTime":{"description":"Creation timestamp","format":"date-time","type":"string"},"id":{"description":"Unique identifier for the token","type":"string"},"image":{"description":"URL to token logo image","type":"string"},"marketCap":{"description":"Market capitalization in USD","type":"number"},"name":{"description":"Token name (e.g.","type":"string"},"price":{"description":"Current price in USD","type":"number"},"priceChange24h":{"description":"24-hour price change percentage","type":"number"},"symbol":{"description":"Token symbol (e.g.","type":"string"},"telegram":{"description":"URL to the token\'s Telegram channel","type":"string"},"twitter":{"description":"URL to the token\'s Twitter account","type":"string"},"volume24h":{"description":"24-hour trading volume in USD","type":"number"},"website":{"description":"URL to the token\'s website","type":"string"}},"required":["id","symbol","name","price","marketCap","volume24h","priceChange24h","image","website","twitter","telegram","createTime"],"type":"object"},"type":"array"}},"required":["metadata","tokens"],"type":"object"},"search_web":{"additionalProperties":false,"description":"Output for SEARCH_WEB endpoint","properties":{"keyword":{"description":"The search keyword or phrase","type":"string"},"results":{"description":"List of search results","items":{"additionalProperties":false,"properties":{"title":{"description":"Title of the web page","type":"string"},"url":{"description":"URL of the web page","type":"string"}},"required":["title","url"],"type":"object"},"type":"array"},"summary":{"description":"Summary of search results","type":"string"}},"required":["keyword","summary","results"],"type":"object"},"structured_web_data":{"additionalProperties":false,"description":"Output for STRUCTURED_WEB_DATA endpoint","properties":{"description":{"description":"Website meta description extracted from og:description","type":"string"},"metadata":{"description":"Additional metadata extracted from the website","type":"object"},"structuredData":{"description":"Extracted structured data (schema varies based on website content)","type":"object"},"timestamp":{"description":"Timestamp when the data was extracted","format":"date-time","type":"string"},"title":{"description":"Website title extracted from og:title","type":"string"},"url":{"description":"Source URL","type":"string"}},"required":["url","title","description","structuredData","metadata","timestamp"],"type":"object"},"trending_tokens":{"additionalProperties":false,"description":"Output for TRENDING_TOKENS endpoint","properties":{"items":{"description":"List of trending tokens","items":{"additionalProperties":false,"properties":{"createTime":{"description":"Creation timestamp","format":"date-time","type":"string"},"id":{"description":"Unique identifier for the token","type":"string"},"image":{"description":"URL to token logo image","type":"string"},"marketCap":{"description":"Market capitalization in USD","type":"number"},"name":{"description":"Token name (e.g.","type":"string"},"price":{"description":"Current price in USD","type":"number"},"priceChange24h":{"description":"24-hour price change percentage","type":"number"},"symbol":{"description":"Token symbol (e.g.","type":"string"},"telegram":{"description":"URL to the token\'s Telegram channel","type":"string"},"twitter":{"description":"URL to the token\'s Twitter account","type":"string"},"volume24h":{"description":"24-hour trading volume in USD","type":"number"},"website":{"description":"URL to the token\'s website","type":"string"}},"required":["id","symbol","name","price","marketCap","volume24h","priceChange24h","image","website","twitter","telegram","createTime"],"type":"object"},"type":"array"},"metadata":{"additionalProperties":false,"description":"Pagination metadata","properties":{"limit":{"description":"Number of items per page","type":"integer"},"page":{"description":"Page number","type":"integer"},"total":{"description":"Total number of items","type":"integer"},"totalPages":{"description":"Total number of pages","type":"integer"}},"required":["page","limit","total","totalPages"],"type":"object"}},"required":["metadata","items"],"type":"object"}},"type":"object"},"sha256":"8a5a652309a06953b3417a41e3c8368038ac2360963999168c7daf33428c0051","title":"Crypto Data API","updatedAt":"2025-05-29T07:07:00.94299Z","url":"crypto-data.wasm"},{"createdAt":"2025-05-29T07:07:21.609283Z","description":"Access cryptocurrency price data via Binance API","identifier":"binance","inputSchema":{"$schema":"https://json-schema.org/draft/2020-12/schema","additionalProperties":false,"properties":{"endpoint":{"enum":["TICKER_24HR","PRICE"],"type":"string"},"headers":{"additionalProperties":{"type":"string"},"description":"Custom headers for the HTTP request","type":"object"},"price":{"additionalProperties":false,"description":"Input for PRICE endpoint","properties":{"symbol":{"description":"Trading pair symbol (e.g.","type":"string"}},"type":"object"},"ticker_24hr":{"additionalProperties":false,"description":"Input for TICKER_24HR endpoint","properties":{"symbol":{"description":"Trading pair symbol (e.g.","type":"string"}},"type":"object"}},"required":["endpoint"],"type":"object"},"outputSchema":{"$schema":"https://json-schema.org/draft/2020-12/schema","additionalProperties":false,"properties":{"data":{"description":"Response data from Binance API"},"error":{"description":"Error message if the request failed","type":"string"}},"required":["data"],"type":"object"},"sha256":"8d4341a140f75bd7df9ebdafc0f12cf8aaef2b5f65d72fab1a875f9a193bc715","title":"Binance API","updatedAt":"2025-05-29T07:07:25.406191Z","url":"binance.wasm"}]',
              },
            ],
          },
        },
      },
      {
        type: 'step-start',
      },
      {
        type: 'text',
        text: '现在让我获取当前的市场情绪指数和比特币价格信息：',
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          step: 1,
          args: {
            identifier: 'crypto-data',
            input: {
              endpoint: 'BITCOIN_MARKET_SENTIMENT',
              bitcoin_market_sentiment: {
                start_date: '2025-06-04',
                end_date: '2025-06-04',
              },
            },
          },
          toolCallId: 'toolu_vrtx_01SGUc4yZs56qTvKsBg3YYY4',
          toolName: 'useTool',
          result: {
            content: [
              {
                type: 'text',
                text: '{"help":"","output":"{\\"bitcoin_market_sentiment\\":{\\"data\\":[{\\"id\\":0,\\"greed_fear_index\\":57,\\"altcoin_season_index\\":18,\\"created_at\\":\\"2025-06-04T00:00:00Z\\"}]}}"}',
              },
            ],
          },
        },
      },
      {
        type: 'step-start',
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          step: 2,
          args: {
            identifier: 'binance',
            input: {
              endpoint: 'PRICE',
              price: {
                symbol: 'BTCUSDT',
              },
            },
          },
          toolCallId: 'toolu_vrtx_01Y9r1b86wfyi34t1mWPQP1n',
          toolName: 'useTool',
          result: {
            content: [
              {
                type: 'text',
                text: '{"help":"","output":"{\\"data\\":{\\"symbol\\":\\"BTCUSDT\\",\\"price\\":\\"105294.44000000\\"}}"}',
              },
            ],
          },
        },
      },
      {
        type: 'step-start',
      },
      {
        type: 'text',
        text: '现在让我搜索最新的比特币相关新闻和市场分析：',
      },
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          step: 3,
          args: {
            identifier: 'crypto-data',
            input:
              '{"endpoint": "SEARCH_WEB", "search_web": {"keyword": "bitcoin investment analysis June 2025 market outlook"}}}',
          },
          toolCallId: 'toolu_vrtx_01Rc6oWqF11cvtAtyp4VJS3f',
          toolName: 'useTool',
        },
      },
    ],
    attachments: [],
    createdAt: '2025-06-04T07:30:36.501Z',
  };

  it('should add a failed result to the message', () => {
    const result = addToolResultToMessage(errorMessage as any) as any;
    expect(result.parts[10].toolInvocation.result).toBeDefined();
  });
});
