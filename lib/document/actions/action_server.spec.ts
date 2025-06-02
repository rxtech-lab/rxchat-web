// Mock server-only to avoid ESM import issues in Jest
jest.mock('server-only', () => ({}));

// Mock bcrypt-ts to avoid ESM import issues in Jest
jest.mock('bcrypt-ts', () => ({
  genSaltSync: jest.fn(() => 'mock-salt'),
  hashSync: jest.fn((password: string) => `mock-hash-${password}`),
  compare: jest.fn(() => Promise.resolve(true)),
  compareSync: jest.fn(() => true),
}));

// Mock nanoid to avoid ESM import issues
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-nanoid'),
}));

// Mock AI modules
jest.mock('ai', () => ({
  generateText: jest.fn(() => Promise.resolve({ text: 'Generated summary' })),
  generateId: jest.fn(() => 'mock-id'),
}));

// Mock langchain
jest.mock('@langchain/textsplitters', () => ({
  RecursiveCharacterTextSplitter: jest.fn().mockImplementation(() => ({
    splitText: jest.fn(() => Promise.resolve(['chunk1', 'chunk2']))
  }))
}));

import { calculateSHA256 } from '@/lib/utils';

describe('Document Upload - SHA256 Functionality', () => {
  describe('SHA256 Calculation', () => {
    test('should calculate SHA256 correctly', async () => {
      const testContent = 'Hello, World!';
      const buffer = new TextEncoder().encode(testContent);
      
      const hash = await calculateSHA256(buffer);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should produce consistent hashes for same content', async () => {
      const testContent = 'Consistent content test';
      const buffer1 = new TextEncoder().encode(testContent);
      const buffer2 = new TextEncoder().encode(testContent);
      
      const hash1 = await calculateSHA256(buffer1);
      const hash2 = await calculateSHA256(buffer2);
      
      expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different content', async () => {
      const content1 = 'First content';
      const content2 = 'Second content';
      
      const buffer1 = new TextEncoder().encode(content1);
      const buffer2 = new TextEncoder().encode(content2);
      
      const hash1 = await calculateSHA256(buffer1);
      const hash2 = await calculateSHA256(buffer2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});