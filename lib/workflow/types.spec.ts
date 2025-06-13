import {
  WorkflowSchema,
  CronjobTriggerNodeSchema,
  ToolNodeSchema,
  ConditionNodeSchema,
  ConverterNodeSchema,
  RuntimeCodeSchema,
} from './types';
import { v4 } from 'uuid';

describe('Schema validation', () => {
  describe('WorkflowSchema', () => {
    const testCases: {
      workflow: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        workflow: {
          title: 'Test Workflow',
          trigger: {
            identifier: '550e8400-e29b-41d4-a716-446655440001',
            type: 'cronjob-trigger',
            cron: '0 0 * * *',
            child: {
              identifier: '550e8400-e29b-41d4-a716-446655440002',
              type: 'tool',
              toolIdentifier: 'test-tool',
              description: 'A test tool',
              child: null,
            },
          },
        },
        isValid: true,
        description: 'valid workflow with cronjob trigger',
      },
      {
        workflow: {
          trigger: {
            identifier: '550e8400-e29b-41d4-a716-446655440001',
            type: 'cronjob-trigger',
            cron: '0 0 * * *',
            child: null,
          },
        },
        isValid: false,
        description: 'missing title',
      },
      {
        workflow: {
          title: 'Test Workflow',
        },
        isValid: false,
        description: 'missing trigger',
      },
      {
        workflow: {
          title: '',
          trigger: {
            identifier: '550e8400-e29b-41d4-a716-446655440001',
            type: 'cronjob-trigger',
            cron: '0 0 * * *',
            child: null,
          },
        },
        isValid: false,
        description: 'empty title',
      },
      {
        workflow: {
          title: 'New Workflow',
          trigger: {
            identifier: v4(),
            type: 'cronjob-trigger',
            cron: '0 2 * * *',
            child: {
              identifier: v4(),
              type: 'tool',
              toolIdentifier: 'crypto-data',
              description: 'Fetch crypto data',
              child: {
                identifier: v4(),
                description: 'Fetch crypto data',
                type: 'tool',
                toolIdentifier: 'binance',
                child: null,
              },
            },
          },
        },
        isValid: true,
        description: 'valid workflow with nested tool nodes',
      },
    ];

    testCases.forEach(({ workflow, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => WorkflowSchema.parse(workflow)).not.toThrow();
        } else {
          expect(() => WorkflowSchema.parse(workflow)).toThrow();
        }
      });
    });
  });

  describe('CronjobTriggerNodeSchema', () => {
    const cronTestCases: {
      trigger: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 * * *', // daily at midnight
          child: null,
        },
        isValid: true,
        description: 'valid daily cron without child',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: {
            identifier: '550e8400-e29b-41d4-a716-446655440002',
            type: 'tool',
            toolIdentifier: 'test-tool',
            description: 'A test tool',
            child: null,
          },
        },
        isValid: true,
        description: 'valid daily cron with child',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '30 14 * * 1', // every Monday at 2:30 PM
          child: null,
        },
        isValid: true,
        description: 'valid weekly cron',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '*/15 * * * *', // every 15 minutes
          child: null,
        },
        isValid: true,
        description: 'valid interval cron',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '60 0 * * *', // invalid minute (60)
          child: null,
        },
        isValid: false,
        description: 'invalid minute value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 25 * * *', // invalid hour (25)
          child: null,
        },
        isValid: false,
        description: 'invalid hour value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 32 * *', // invalid day (32)
          child: null,
        },
        isValid: false,
        description: 'invalid day value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 * 13 *', // invalid month (13)
          child: null,
        },
        isValid: false,
        description: 'invalid month value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          cron: '0 0 * * 7', // invalid weekday (7)
          child: null,
        },
        isValid: false,
        description: 'invalid weekday value',
      },
      {
        trigger: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'cronjob-trigger',
          child: null,
        },
        isValid: false,
        description: 'missing cron field',
      },
      {
        trigger: {
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: null,
        },
        isValid: false,
        description: 'missing identifier',
      },
      {
        trigger: {
          identifier: 'invalid-uuid',
          type: 'cronjob-trigger',
          cron: '0 0 * * *',
          child: null,
        },
        isValid: false,
        description: 'invalid UUID identifier',
      },
    ];

    cronTestCases.forEach(({ trigger, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => CronjobTriggerNodeSchema.parse(trigger)).not.toThrow();
        } else {
          expect(() => CronjobTriggerNodeSchema.parse(trigger)).toThrow();
        }
      });
    });
  });

  describe('ToolNodeSchema', () => {
    const toolTestCases: {
      node: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'tool',
          toolIdentifier: 'send-email',
          description: 'Send an email',
          child: null,
        },
        isValid: true,
        description: 'valid tool node without child',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'tool',
          toolIdentifier: 'send-email',
          description: 'Send an email',
          child: {
            identifier: '550e8400-e29b-41d4-a716-446655440002',
            description: 'Child tool node',
            type: 'tool',
            toolIdentifier: 'another-tool',
            child: null,
          },
        },
        isValid: true,
        description: 'valid tool node with child',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'tool',
          child: null,
          description: 'Tool without child',
        },
        isValid: false,
        description: 'missing toolIdentifier field',
      },
      {
        node: {
          type: 'tool',
          toolIdentifier: 'send-email',
          description: 'Tool without identifier',
          child: null,
        },
        isValid: false,
        description: 'missing identifier',
      },
      {
        node: {
          identifier: 'invalid-uuid',
          type: 'tool',
          toolIdentifier: 'send-email',
          description: 'Tool with invalid identifier',
          child: null,
        },
        isValid: false,
        description: 'invalid UUID identifier',
      },
    ];

    toolTestCases.forEach(({ node, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => ToolNodeSchema.parse(node)).not.toThrow();
        } else {
          expect(() => ToolNodeSchema.parse(node)).toThrow();
        }
      });
    });
  });

  describe('ConditionNodeSchema', () => {
    const conditionTestCases: {
      node: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'condition',
          runtime: 'js',
          code: 'return input.status === "active";',
          children: [],
        },
        isValid: true,
        description: 'valid condition node with empty children',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'condition',
          runtime: 'js',
          code: 'return input.status === "active";',
          children: [
            {
              identifier: '550e8400-e29b-41d4-a716-446655440002',
              type: 'tool',
              toolIdentifier: 'test-tool-1',
              description: 'Test tool 1',
              child: null,
            },
            {
              identifier: '550e8400-e29b-41d4-a716-446655440003',
              type: 'tool',
              toolIdentifier: 'test-tool-2',
              description: 'Test tool 2',
              child: null,
            },
          ],
        },
        isValid: true,
        description: 'valid condition node with multiple children',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'condition',
          children: [],
        },
        isValid: false,
        description: 'missing runtime and code',
      },
      {
        node: {
          identifier: 'invalid-uuid',
          type: 'condition',
          runtime: 'js',
          code: 'return true;',
          children: [],
        },
        isValid: false,
        description: 'invalid UUID identifier',
      },
    ];

    conditionTestCases.forEach(({ node, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => ConditionNodeSchema.parse(node)).not.toThrow();
        } else {
          expect(() => ConditionNodeSchema.parse(node)).toThrow();
        }
      });
    });
  });

  describe('ConverterNodeSchema', () => {
    const converterTestCases: {
      node: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'converter',
          runtime: 'js',
          code: 'return convertJsonToCsv(input);',
          child: null,
        },
        isValid: true,
        description: 'valid converter node without child',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'converter',
          runtime: 'js',
          code: 'return convertJsonToCsv(input);',
          child: {
            identifier: '550e8400-e29b-41d4-a716-446655440002',
            type: 'tool',
            toolIdentifier: 'test-tool',
            description: 'Test tool',
            child: null,
          },
        },
        isValid: true,
        description: 'valid converter node with child',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'converter',
          converter: 'json-to-csv',
          child: null,
        },
        isValid: false,
        description: 'missing runtime and code',
      },
      {
        node: {
          identifier: '550e8400-e29b-41d4-a716-446655440001',
          type: 'converter',
          runtime: 'js',
          child: null,
        },
        isValid: false,
        description: 'missing code field',
      },
      {
        node: {
          identifier: 'invalid-uuid',
          type: 'converter',
          converter: 'json-to-csv',
          runtime: 'js',
          code: 'return input;',
          child: null,
        },
        isValid: false,
        description: 'invalid UUID identifier',
      },
    ];

    converterTestCases.forEach(({ node, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => ConverterNodeSchema.parse(node)).not.toThrow();
        } else {
          expect(() => ConverterNodeSchema.parse(node)).toThrow();
        }
      });
    });
  });

  describe('RuntimeCodeSchema', () => {
    const runtimeTestCases: {
      runtime: any;
      isValid: boolean;
      description: string;
    }[] = [
      {
        runtime: {
          runtime: 'js',
          code: 'return true;',
        },
        isValid: true,
        description: 'valid js runtime',
      },
      {
        runtime: {
          runtime: 'python',
          code: 'return True',
        },
        isValid: false,
        description: 'unsupported runtime type',
      },
      {
        runtime: {
          runtime: 'js',
        },
        isValid: false,
        description: 'missing code field',
      },
      {
        runtime: {
          code: 'return true;',
        },
        isValid: false,
        description: 'missing runtime field',
      },
    ];

    runtimeTestCases.forEach(({ runtime, isValid, description }) => {
      it(`should ${isValid ? 'validate' : 'invalidate'} ${description}`, () => {
        if (isValid) {
          expect(() => RuntimeCodeSchema.parse(runtime)).not.toThrow();
        } else {
          expect(() => RuntimeCodeSchema.parse(runtime)).toThrow();
        }
      });
    });
  });

  describe('Node Relationship Constraints', () => {
    it('should validate that tool nodes can only have one child', () => {
      const validToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'tool',
        toolIdentifier: 'test-tool',
        description: 'Test tool',
        child: {
          identifier: '550e8400-e29b-41d4-a716-446655440002',
          type: 'tool',
          toolIdentifier: 'child-tool',
          child: null,
          description: 'Child tool node',
        },
      };

      expect(() => ToolNodeSchema.parse(validToolNode)).not.toThrow();

      // Should not accept parent property (ToolNodeSchema extends RegularNodeSchema which only has child)
      const invalidToolNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'tool',
        toolIdentifier: 'test-tool',
        description: 'Test tool',
        child: null,
        parent: { identifier: '550e8400-e29b-41d4-a716-446655440002' },
      };

      // This should fail because the schema doesn't have parent property
      expect(() => ToolNodeSchema.parse(invalidToolNode)).toThrow();
    });

    it('should validate that condition nodes can have multiple children', () => {
      const validConditionNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'condition',
        runtime: 'js',
        code: 'return true;',
        children: [
          {
            identifier: '550e8400-e29b-41d4-a716-446655440002',
            type: 'tool',
            toolIdentifier: 'test-tool-1',
            description: 'Test tool 1',
            child: null,
          },
          {
            identifier: '550e8400-e29b-41d4-a716-446655440003',
            type: 'tool',
            toolIdentifier: 'test-tool-2',
            description: 'Test tool 2',
            child: null,
          },
        ],
      };

      expect(() => ConditionNodeSchema.parse(validConditionNode)).not.toThrow();
    });

    it('should validate that trigger nodes can only have one child and no parents', () => {
      const validTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'cronjob-trigger',
        cron: '0 0 * * *',
        child: {
          identifier: '550e8400-e29b-41d4-a716-446655440002',
          type: 'tool',
          toolIdentifier: 'test-tool',
          description: 'A test tool',
          child: null,
        },
      };

      expect(() =>
        CronjobTriggerNodeSchema.parse(validTriggerNode),
      ).not.toThrow();

      // Should not accept parent property (TriggerNodeSchema doesn't have parent property)
      const invalidTriggerNode = {
        identifier: '550e8400-e29b-41d4-a716-446655440001',
        type: 'cronjob-trigger',
        cron: '0 0 * * *',
        parent: { identifier: '550e8400-e29b-41d4-a716-446655440002' },
        child: {
          identifier: '550e8400-e29b-41d4-a716-446655440003',
          description: 'A test tool',
          type: 'tool',
          toolIdentifier: 'test-tool',
          child: null,
        },
      };

      // This should fail because trigger schema doesn't have parent property
      expect(() =>
        CronjobTriggerNodeSchema.parse(invalidTriggerNode),
      ).toThrow();
    });
  });

  it('should validate', () => {
    const workflow = {
      title: 'New Workflow',
      trigger: {
        identifier: '3392c943-5ad4-42aa-951d-d9f6429425f9',
        type: 'cronjob-trigger',
        cron: '0 2 * * *',
        child: {
          identifier: '0c53a9a1-d98a-425a-ad72-0c3829e33472',
          type: 'tool',
          toolIdentifier: 'crypto-data',
          child: {
            identifier: '94fc6813-e874-4aff-a6ea-335645ffe7fb',
            type: 'converter',
            runtime: 'js',
            code: "// The output of crypto-data is an object with tokens (array of tokens) or items (array of trending tokens).\n// Binance expects an input with endpoint and symbol (e.g., { endpoint: 'PRICE', price: { symbol: 'BTCUSDT' } })\n// We'll take the first token's symbol from the output and format it for Binance's PRICE endpoint.\nasync function handle(input: any): Promise<any> {\n  let symbol = null;\n  if (input.tokens && input.tokens.length > 0) {\n    symbol = input.tokens[0].symbol;\n  } else if (input.items && input.items.length > 0) {\n    symbol = input.items[0].symbol;\n  }\n  if (!symbol) throw new Error('No token symbol found in crypto-data output');\n  // Binance expects symbol in format like BTCUSDT (no dash, no slash)\n  symbol = symbol.replace(/[-/]/g, '').toUpperCase();\n  return {\n    endpoint: 'PRICE',\n    price: {\n      symbol\n    }\n  };\n}",
            child: {
              identifier: 'e19c486b-2d2e-474a-9347-d7eb5587b978',
              type: 'tool',
              toolIdentifier: 'binance',
              child: null,
              description: 'Access cryptocurrency price data via Binance API',
              inputSchema: {
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                additionalProperties: false,
                properties: {
                  endpoint: {
                    enum: ['TICKER_24HR', 'PRICE'],
                    type: 'string',
                  },
                  headers: {
                    additionalProperties: {
                      type: 'string',
                    },
                    description: 'Custom headers for the HTTP request',
                    type: 'object',
                  },
                  price: {
                    additionalProperties: false,
                    description: 'Input for PRICE endpoint',
                    properties: {
                      symbol: {
                        description: 'Trading pair symbol (e.g.',
                        type: 'string',
                      },
                    },
                    type: 'object',
                  },
                  ticker_24hr: {
                    additionalProperties: false,
                    description: 'Input for TICKER_24HR endpoint',
                    properties: {
                      symbol: {
                        description: 'Trading pair symbol (e.g.',
                        type: 'string',
                      },
                    },
                    type: 'object',
                  },
                },
                required: ['endpoint'],
                type: 'object',
              },
              outputSchema: {
                $schema: 'https://json-schema.org/draft/2020-12/schema',
                additionalProperties: false,
                properties: {
                  data: {
                    description: 'Response data from Binance API',
                  },
                  error: {
                    description: 'Error message if the request failed',
                    type: 'string',
                  },
                },
                required: ['data'],
                type: 'object',
              },
            },
          },
          description:
            "\n\t\t\tAccess pumpfun cryptocurrency data, trending tokens, and structured website data. Sometimes, the\n\t\t\ttrending tokens are not available, use search tokens order by created_time to get the latest tokens.\n\t\t\tID is the token address for the token, you can then go https://pump.fun/coin/:ID to get the token detail.\n\t\t\tWhen user ask for certain token's detail, then use web search to get the new about the token.\n\t\t\tYou can also use structured_web_data to get the structured data from a website to analyze the website.\n\t\t",
          inputSchema: {
            $id: 'https://github.com/wyt-labs/mcp-router/plugins/crypto-data/crypto-data/crypto-data-input',
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            additionalProperties: false,
            properties: {
              bitcoin_market_sentiment: {
                additionalProperties: false,
                description: 'Input for BITCOIN_MARKET_SENTIMENT endpoint',
                properties: {
                  end_date: {
                    description:
                      'The end date to get the sentiment for. Default is today',
                    type: 'string',
                  },
                  start_date: {
                    description:
                      'The start date to get the sentiment for. Default is today',
                    type: 'string',
                  },
                },
                required: ['start_date', 'end_date'],
                type: 'object',
              },
              endpoint: {
                enum: [
                  'HEALTH',
                  'TRENDING_TOKENS',
                  'SEARCH_TOKENS',
                  'GITHUB_REPOSITORY',
                  'SEARCH_WEB',
                  'STRUCTURED_WEB_DATA',
                  'BITCOIN_MARKET_SENTIMENT',
                ],
                type: 'string',
              },
              github_repository: {
                additionalProperties: false,
                description: 'Input for GITHUB_REPOSITORY endpoint',
                properties: {
                  owner: {
                    description: 'Repository owner',
                    type: 'string',
                  },
                  repo: {
                    description: 'Repository name',
                    type: 'string',
                  },
                },
                required: ['owner', 'repo'],
                type: 'object',
              },
              health: {
                additionalProperties: false,
                description: 'Input for HEALTH endpoint',
                properties: {},
                type: 'object',
              },
              search_tokens: {
                additionalProperties: false,
                description: 'Input for SEARCH_TOKENS endpoint',
                properties: {
                  limit: {
                    default: 10,
                    description: 'Maximum number of tokens to return',
                    type: 'integer',
                  },
                  order: {
                    default: ['swap_count'],
                    description:
                      'Order results by fields. Can be multiple fields but please remember to include created_time when make a search!!!!!',
                    items: {
                      enum: [
                        'swap_count',
                        'created_time',
                        'volume24h',
                        'price',
                        'market_cap',
                      ],
                      type: 'string',
                    },
                    type: 'array',
                  },
                  sort_direction: {
                    default: 'desc',
                    description: 'Sort direction',
                    enum: ['asc', 'desc'],
                    type: 'string',
                  },
                  symbol: {
                    description:
                      'Token symbol to search for (partial match supported). Can be null if user ask for latest tokens',
                    type: 'string',
                  },
                },
                type: 'object',
              },
              trending_tokens: {
                additionalProperties: false,
                description: 'Input for TRENDING_TOKENS endpoint',
                properties: {
                  limit: {
                    default: 10,
                    description: 'Maximum number of tokens to return (max 20)',
                    type: 'integer',
                  },
                  page: {
                    default: 1,
                    description: 'Page number',
                    type: 'integer',
                  },
                  timeframe: {
                    default: '24h',
                    description: 'Timeframe for trending data (24h',
                    enum: ['24h', '7d', '30d'],
                    type: 'string',
                  },
                },
                type: 'object',
              },
            },
            required: ['endpoint'],
            type: 'object',
          },
          outputSchema: {
            $id: 'https://github.com/wyt-labs/mcp-router/plugins/crypto-data/crypto-data/crypto-data-output',
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            additionalProperties: false,
            properties: {
              bitcoin_market_sentiment: {
                additionalProperties: false,
                description: 'Output for BITCOIN_MARKET_SENTIMENT endpoint',
                properties: {
                  data: {
                    description: 'List of coin data index entries',
                    items: {
                      additionalProperties: false,
                      properties: {
                        altcoin_season_index: {
                          description:
                            'Altcoin season index is a metric used to measure the performance of non-Bitcoin cryptocurrencies in the cryptocurrency market. It helps investors understand whether altcoins are outperforming Bitcoin during a specific period providing insights into market trends and investment opportunities',
                          maximum: 100,
                          minimum: 0,
                          type: 'integer',
                        },
                        created_at: {
                          description: 'Timestamp when the data was created',
                          format: 'date-time',
                          type: 'string',
                        },
                        greed_fear_index: {
                          description:
                            'The Crypto Fear & Greed Index is a sentiment indicator that measures market emotions and sentiment towards Bitcoin and the broader cryptocurrency market. The index ranges from 0-100 where: 0-20 indicates Extreme Fear (potentially good buying opportunity)',
                          maximum: 100,
                          minimum: 0,
                          type: 'integer',
                        },
                        id: {
                          description: 'ID of the coin data index',
                          type: 'integer',
                        },
                      },
                      required: [
                        'id',
                        'greed_fear_index',
                        'altcoin_season_index',
                        'created_at',
                      ],
                      type: 'object',
                    },
                    type: 'array',
                  },
                },
                required: ['data'],
                type: 'object',
              },
              error: {
                description: 'Error message if the request failed',
                type: 'string',
              },
              github_repository: {
                additionalProperties: false,
                description: 'Output for GITHUB_REPOSITORY endpoint',
                properties: {
                  description: {
                    description: 'Repository description',
                    type: 'string',
                  },
                  forks: {
                    description: 'Number of forks',
                    type: 'integer',
                  },
                  fullName: {
                    description: 'Full repository name (owner/repo)',
                    type: 'string',
                  },
                  id: {
                    description: 'GitHub repository ID',
                    type: 'integer',
                  },
                  issues: {
                    description: 'Number of open issues',
                    type: 'integer',
                  },
                  language: {
                    description: 'Primary programming language',
                    type: 'string',
                  },
                  lastUpdated: {
                    description: 'Last update timestamp',
                    format: 'date-time',
                    type: 'string',
                  },
                  name: {
                    description: 'Repository name',
                    type: 'string',
                  },
                  stars: {
                    description: 'Number of stars',
                    type: 'integer',
                  },
                  topics: {
                    description: 'Repository topics/tags',
                    items: {
                      type: 'string',
                    },
                    type: 'array',
                  },
                  url: {
                    description: 'Repository URL',
                    type: 'string',
                  },
                },
                required: [
                  'id',
                  'name',
                  'fullName',
                  'description',
                  'url',
                  'stars',
                  'forks',
                  'issues',
                  'lastUpdated',
                  'language',
                  'topics',
                ],
                type: 'object',
              },
              health: {
                additionalProperties: false,
                description: 'Output for HEALTH endpoint',
                properties: {
                  status: {
                    description: 'API health status',
                    type: 'string',
                  },
                },
                required: ['status'],
                type: 'object',
              },
              search_tokens: {
                additionalProperties: false,
                description: 'Output for SEARCH_TOKENS endpoint',
                properties: {
                  metadata: {
                    additionalProperties: false,
                    description: 'Pagination metadata',
                    properties: {
                      limit: {
                        description: 'Number of items per page',
                        type: 'integer',
                      },
                      page: {
                        description: 'Page number',
                        type: 'integer',
                      },
                      total: {
                        description: 'Total number of items',
                        type: 'integer',
                      },
                      totalPages: {
                        description: 'Total number of pages',
                        type: 'integer',
                      },
                    },
                    required: ['page', 'limit', 'total', 'totalPages'],
                    type: 'object',
                  },
                  tokens: {
                    description: 'List of tokens matching search criteria',
                    items: {
                      additionalProperties: false,
                      properties: {
                        createTime: {
                          description: 'Creation timestamp',
                          format: 'date-time',
                          type: 'string',
                        },
                        id: {
                          description: 'Unique identifier for the token',
                          type: 'string',
                        },
                        image: {
                          description: 'URL to token logo image',
                          type: 'string',
                        },
                        marketCap: {
                          description: 'Market capitalization in USD',
                          type: 'number',
                        },
                        name: {
                          description: 'Token name (e.g.',
                          type: 'string',
                        },
                        price: {
                          description: 'Current price in USD',
                          type: 'number',
                        },
                        priceChange24h: {
                          description: '24-hour price change percentage',
                          type: 'number',
                        },
                        symbol: {
                          description: 'Token symbol (e.g.',
                          type: 'string',
                        },
                        telegram: {
                          description: "URL to the token's Telegram channel",
                          type: 'string',
                        },
                        twitter: {
                          description: "URL to the token's Twitter account",
                          type: 'string',
                        },
                        volume24h: {
                          description: '24-hour trading volume in USD',
                          type: 'number',
                        },
                        website: {
                          description: "URL to the token's website",
                          type: 'string',
                        },
                      },
                      required: [
                        'id',
                        'symbol',
                        'name',
                        'price',
                        'marketCap',
                        'volume24h',
                        'priceChange24h',
                        'image',
                        'website',
                        'twitter',
                        'telegram',
                        'createTime',
                      ],
                      type: 'object',
                    },
                    type: 'array',
                  },
                },
                required: ['metadata', 'tokens'],
                type: 'object',
              },
              trending_tokens: {
                additionalProperties: false,
                description: 'Output for TRENDING_TOKENS endpoint',
                properties: {
                  items: {
                    description: 'List of trending tokens',
                    items: {
                      additionalProperties: false,
                      properties: {
                        createTime: {
                          description: 'Creation timestamp',
                          format: 'date-time',
                          type: 'string',
                        },
                        id: {
                          description: 'Unique identifier for the token',
                          type: 'string',
                        },
                        image: {
                          description: 'URL to token logo image',
                          type: 'string',
                        },
                        marketCap: {
                          description: 'Market capitalization in USD',
                          type: 'number',
                        },
                        name: {
                          description: 'Token name (e.g.',
                          type: 'string',
                        },
                        price: {
                          description: 'Current price in USD',
                          type: 'number',
                        },
                        priceChange24h: {
                          description: '24-hour price change percentage',
                          type: 'number',
                        },
                        symbol: {
                          description: 'Token symbol (e.g.',
                          type: 'string',
                        },
                        telegram: {
                          description: "URL to the token's Telegram channel",
                          type: 'string',
                        },
                        twitter: {
                          description: "URL to the token's Twitter account",
                          type: 'string',
                        },
                        volume24h: {
                          description: '24-hour trading volume in USD',
                          type: 'number',
                        },
                        website: {
                          description: "URL to the token's website",
                          type: 'string',
                        },
                      },
                      required: [
                        'id',
                        'symbol',
                        'name',
                        'price',
                        'marketCap',
                        'volume24h',
                        'priceChange24h',
                        'image',
                        'website',
                        'twitter',
                        'telegram',
                        'createTime',
                      ],
                      type: 'object',
                    },
                    type: 'array',
                  },
                  metadata: {
                    additionalProperties: false,
                    description: 'Pagination metadata',
                    properties: {
                      limit: {
                        description: 'Number of items per page',
                        type: 'integer',
                      },
                      page: {
                        description: 'Page number',
                        type: 'integer',
                      },
                      total: {
                        description: 'Total number of items',
                        type: 'integer',
                      },
                      totalPages: {
                        description: 'Total number of pages',
                        type: 'integer',
                      },
                    },
                    required: ['page', 'limit', 'total', 'totalPages'],
                    type: 'object',
                  },
                },
                required: ['metadata', 'items'],
                type: 'object',
              },
            },
            type: 'object',
          },
        },
      },
    };

    const parsed = WorkflowSchema.safeParse(workflow);
    expect(parsed.error).toBeUndefined();
  });

  it('should validate with fixed input', () => {
    const workflow = {
      title: 'New Workflow',
      trigger: {
        identifier: 'fb92a7f2-e692-446f-8a9c-cf03436bd6fd',
        type: 'cronjob-trigger',
        cron: '0 2 * * *',
        child: {
          identifier: '7c93f3d9-d181-4815-8d4b-572592dd53c2',
          type: 'fixed-input',
          output: {
            endpoint: 'PRICE',
            price: {
              symbol: 'BTCUSDT',
            },
          },
          child: {
            identifier: 'a1bfba2c-073e-4ab8-aaca-39abf3a533aa',
            type: 'tool',
            toolIdentifier: 'binance',
            child: null,
            description: 'Access cryptocurrency price data via Binance API',
            inputSchema: {
              $schema: 'https://json-schema.org/draft/2020-12/schema',
              additionalProperties: false,
              properties: {
                endpoint: {
                  enum: ['TICKER_24HR', 'PRICE'],
                  type: 'string',
                },
                headers: {
                  additionalProperties: {
                    type: 'string',
                  },
                  description: 'Custom headers for the HTTP request',
                  type: 'object',
                },
                price: {
                  additionalProperties: false,
                  description: 'Input for PRICE endpoint',
                  properties: {
                    symbol: {
                      description: 'Trading pair symbol (e.g.',
                      type: 'string',
                    },
                  },
                  type: 'object',
                },
                ticker_24hr: {
                  additionalProperties: false,
                  description: 'Input for TICKER_24HR endpoint',
                  properties: {
                    symbol: {
                      description: 'Trading pair symbol (e.g.',
                      type: 'string',
                    },
                  },
                  type: 'object',
                },
              },
              required: ['endpoint'],
              type: 'object',
            },
            outputSchema: {
              $schema: 'https://json-schema.org/draft/2020-12/schema',
              additionalProperties: false,
              properties: {
                data: {
                  description: 'Response data from Binance API',
                },
                error: {
                  description: 'Error message if the request failed',
                  type: 'string',
                },
              },
              required: ['data'],
              type: 'object',
            },
          },
        },
      },
    };

    const parsed = WorkflowSchema.safeParse(workflow);
    expect(parsed.error).toBeUndefined();
  });

  it('should validate with the validated workflow', () => {
    const workflow = {
      title: 'New Workflow',
      trigger: {
        type: 'cronjob-trigger',
        identifier: 'e54d5190-3fe2-48b8-a474-6624f63485d5',
        cron: '0 0 * * *',
        child: {
          identifier: 'e147ada6-a1bc-4924-824e-d1463e7a2dbe',
          type: 'fixed-input',
          output: { endpoint: 'PRICE', price: { symbol: 'BTCUSDT' } },
          child: {
            identifier: 'a260f855-d64e-4e2e-b621-aaa6e1acba39',
            type: 'tool',
            toolIdentifier: 'binance',
            child: null,
            description: 'Access cryptocurrency price data via Binance API',
            inputSchema: {
              $schema: 'https://json-schema.org/draft/2020-12/schema',
              additionalProperties: false,
              properties: {
                endpoint: {
                  enum: ['TICKER_24HR', 'PRICE'],
                  type: 'string',
                },
                headers: {
                  additionalProperties: {
                    type: 'string',
                  },
                  description: 'Custom headers for the HTTP request',
                  type: 'object',
                },
                price: {
                  additionalProperties: false,
                  description: 'Input for PRICE endpoint',
                  properties: {
                    symbol: {
                      description: 'Trading pair symbol (e.g.',
                      type: 'string',
                    },
                  },
                  type: 'object',
                },
                ticker_24hr: {
                  additionalProperties: false,
                  description: 'Input for TICKER_24HR endpoint',
                  properties: {
                    symbol: {
                      description: 'Trading pair symbol (e.g.',
                      type: 'string',
                    },
                  },
                  type: 'object',
                },
              },
              required: ['endpoint'],
              type: 'object',
            },
            outputSchema: {
              $schema: 'https://json-schema.org/draft/2020-12/schema',
              additionalProperties: false,
              properties: {
                data: {
                  description: 'Response data from Binance API',
                },
                error: {
                  description: 'Error message if the request failed',
                  type: 'string',
                },
              },
              required: ['data'],
              type: 'object',
            },
          },
        },
      },
    };

    const parsed = WorkflowSchema.safeParse(workflow);
    expect(parsed.error).toBeUndefined();
  });
});
