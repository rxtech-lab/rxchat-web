import { calculateSHA256 } from './utils';

describe('SHA256 Utilities', () => {
  describe('calculateSHA256', () => {
    test('should calculate correct SHA256 hash for known input', async () => {
      // "hello" in UTF-8 should produce this specific SHA256
      const input = new TextEncoder().encode('hello');
      const expectedHash = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
      
      const result = await calculateSHA256(input);
      
      expect(result).toBe(expectedHash);
    });

    test('should calculate different hashes for different inputs', async () => {
      const input1 = new TextEncoder().encode('hello');
      const input2 = new TextEncoder().encode('world');
      
      const hash1 = await calculateSHA256(input1);
      const hash2 = await calculateSHA256(input2);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should calculate same hash for identical inputs', async () => {
      const input1 = new TextEncoder().encode('test content');
      const input2 = new TextEncoder().encode('test content');
      
      const hash1 = await calculateSHA256(input1);
      const hash2 = await calculateSHA256(input2);
      
      expect(hash1).toBe(hash2);
    });

    test('should handle empty input', async () => {
      const input = new Uint8Array(0);
      const expectedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      
      const result = await calculateSHA256(input);
      
      expect(result).toBe(expectedHash);
    });

    test('should return 64-character hex string', async () => {
      const input = new TextEncoder().encode('any content');
      
      const result = await calculateSHA256(input);
      
      expect(result).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});