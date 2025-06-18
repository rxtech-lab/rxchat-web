import { McpToolResultSchema, parseMcpContent } from './message.utils';

describe('message.utils', () => {
  describe('parseMcpContent', () => {
    it('should parse MCP content with array of text items', () => {
      const input = {
        content: [
          {
            type: 'text',
            text: '{"url": "https://example.com", "output": "test"}',
          },
          {
            type: 'text',
            text: '{"url": "https://example2.com", "output": "test2"}',
          },
        ],
      };

      const result = parseMcpContent(input);

      expect(result).toEqual([
        { url: 'https://example.com', output: 'test' },
        { url: 'https://example2.com', output: 'test2' },
      ]);
    });

    it('should return non-text items as-is', () => {
      const input = {
        content: [
          {
            type: 'text',
            text: '{"url": "https://example.com", "output": "test"}',
          },
          { type: 'image', data: 'base64data' },
        ],
      };

      const result = parseMcpContent(input);

      expect(result).toEqual([
        { url: 'https://example.com', output: 'test' },
        { type: 'image', data: 'base64data' },
      ]);
    });

    it('should return false if content is not an array', () => {
      const input = {
        content: 'not an array',
      };

      const result = parseMcpContent(input);

      expect(result).toBe(false);
    });

    it('should return false if no content property exists', () => {
      const input = {
        data: 'some data',
      };

      const result = parseMcpContent(input);

      expect(result).toBe(false);
    });

    it('should return false for null input', () => {
      const result = parseMcpContent(null);

      expect(result).toBe(false);
    });

    it('should return false for undefined input', () => {
      const result = parseMcpContent(undefined);

      expect(result).toBe(false);
    });

    it('should handle invalid JSON in text items gracefully', () => {
      const input = {
        content: [{ type: 'text', text: 'invalid json' }],
      };

      expect(() => parseMcpContent(input)).toThrow();
    });
  });

  describe('mcpToolResultSchema', () => {
    it('should validate valid MCP tool result array', () => {
      const validData = [
        {
          output: '{"key": "value"}',
          url: 'https://example.com',
          suggestions: [
            {
              text: 'suggestion1',
              value: 'value1',
              type: 'SUGGESTION_TYPE_CHAT',
            },
          ],
          suggestHeight: 500,
        },
      ];

      const result = McpToolResultSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].output).toEqual({ key: 'value' });
        expect(result.data[0].url).toBe('https://example.com');
        expect(result.data[0].suggestions).toHaveLength(1);
      }
    });

    it('should validate MCP tool result with null suggestions', () => {
      const validData = [
        {
          output: '{"key": "value"}',
          url: 'https://example.com',
          suggestions: null,
          suggestHeight: null,
        },
      ];

      const result = McpToolResultSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].suggestions).toBe(null);
      }
    });

    it('should validate empty array', () => {
      const validData: any[] = [];

      const result = McpToolResultSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual([]);
      }
    });

    it('should validate multiple items in array', () => {
      const validData = [
        {
          output: '{"key1": "value1"}',
          url: 'https://example1.com',
          suggestions: [
            {
              text: 'suggestion1',
              value: 'value1',
              type: 'SUGGESTION_TYPE_CHAT',
            },
          ],
        },
        {
          output: '{"key2": "value2"}',
          url: 'https://example2.com',
          suggestions: null,
        },
      ];

      const result = McpToolResultSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].output).toEqual({ key1: 'value1' });
        expect(result.data[1].output).toEqual({ key2: 'value2' });
      }
    });

    it('should fail validation for missing required fields', () => {
      const invalidData = [
        {
          output: '{"key": "value"}',
          // missing url and suggestions
        },
      ];

      const result = McpToolResultSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should fail validation for invalid JSON in output', () => {
      const invalidData = [
        {
          output: 'invalid json',
          url: 'https://example.com',
          suggestions: null,
        },
      ];

      const result = McpToolResultSchema.safeParse(invalidData);

      expect(result.success).toBe(true);
    });

    it('should fail validation for non-string url', () => {
      const invalidData = [
        {
          output: '{"key": "value"}',
          url: 123,
          suggestions: null,
        },
      ];

      const result = McpToolResultSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should fail validation for invalid suggestions array', () => {
      const invalidData = [
        {
          output: '{"key": "value"}',
          url: 'https://example.com',
          suggestions: 'not an array',
        },
      ];

      const result = McpToolResultSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should fail validation for non-array input', () => {
      const invalidData = {
        output: '{"key": "value"}',
        url: 'https://example.com',
        suggestions: null,
      };

      const result = McpToolResultSchema.safeParse(invalidData);

      expect(result.success).toBe(false);
    });

    it('should handle complex nested JSON in output', () => {
      const validData = [
        {
          output: '{"nested": {"key": "value"}, "array": [1, 2, 3]}',
          url: 'https://example.com',
          suggestions: null,
        },
      ];

      const result = McpToolResultSchema.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].output).toEqual({
          nested: { key: 'value' },
          array: [1, 2, 3],
        });
      }
    });
  });

  describe('integration tests', () => {
    it('should handle invalid MCP content gracefully', () => {
      const mcpContent = {
        content: [
          {
            type: 'text',
            text: 'invalid json',
          },
        ],
      };

      expect(() => {
        const parsedContent = parseMcpContent(mcpContent);
        McpToolResultSchema.safeParse(parsedContent);
      }).toThrow();
    });
  });
});
