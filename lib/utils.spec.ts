import { calculateSha256FromUrl } from './utils';

// Mock fetch to avoid actual network requests
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('SHA256 Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateSha256FromUrl', () => {
    it('should calculate SHA256 hash from file URL', async () => {
      const testContent = 'Hello, World!';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from(testContent).buffer),
      });

      const result = await calculateSha256FromUrl('https://example.com/test.txt');

      expect(result).toHaveLength(64); // SHA256 hash should be 64 hex characters
      expect(result).toMatch(/^[a-f0-9]{64}$/); // Should be valid hex string
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/test.txt');
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(calculateSha256FromUrl('https://example.com/nonexistent.txt')).rejects.toThrow(
        'Failed to calculate SHA256: Failed to download file: Not Found'
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(calculateSha256FromUrl('https://example.com/test.txt')).rejects.toThrow(
        'Failed to calculate SHA256: Network error'
      );
    });

    it('should generate different hashes for different content', async () => {
      const content1 = 'Content 1';
      const content2 = 'Content 2';

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from(content1).buffer),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(Buffer.from(content2).buffer),
        });

      const hash1 = await calculateSha256FromUrl('https://example.com/file1.txt');
      const hash2 = await calculateSha256FromUrl('https://example.com/file2.txt');

      expect(hash1).not.toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});