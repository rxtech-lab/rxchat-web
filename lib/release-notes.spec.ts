/**
 * @jest-environment jsdom
 */

import {
  getReadVersion,
  setReadVersion,
  shouldShowReleaseNotes,
  fetchReleaseNotes,
  getReleaseNoteByVersion,
  type ReleaseNote,
  type ReleaseNotesResponse,
} from './release-notes';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock process.env
const originalEnv = process.env;

describe('release-notes', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };

    // Clear all cookies before each test
    document.cookie.split(';').forEach((cookie) => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });

    mockFetch.mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getReadVersion', () => {
    it('should return null when no cookie is set', () => {
      expect(getReadVersion()).toBeNull();
    });

    it('should return the version from cookie', () => {
      document.cookie = 'release-note-read=1.2.3';
      expect(getReadVersion()).toBe('1.2.3');
    });

    it('should handle multiple cookies and find the correct one', () => {
      document.cookie = 'other-cookie=value';
      document.cookie = 'release-note-read=2.0.0';
      document.cookie = 'another-cookie=another-value';
      expect(getReadVersion()).toBe('2.0.0');
    });
  });

  describe('setReadVersion', () => {
    it('should set the version cookie', () => {
      setReadVersion('1.0.0');
      expect(getReadVersion()).toBe('1.0.0');
    });

    it('should update existing version cookie', () => {
      setReadVersion('1.0.0');
      expect(getReadVersion()).toBe('1.0.0');

      setReadVersion('2.0.0');
      expect(getReadVersion()).toBe('2.0.0');
    });
  });

  describe('shouldShowReleaseNotes', () => {
    it('should return true when no version has been read', () => {
      expect(shouldShowReleaseNotes('1.0.0')).toBe(true);
    });

    it('should return false when the same version has been read', () => {
      setReadVersion('1.0.0');
      expect(shouldShowReleaseNotes('1.0.0')).toBe(false);
    });

    it('should return true when a newer version is available', () => {
      setReadVersion('1.0.0');
      expect(shouldShowReleaseNotes('1.1.0')).toBe(true);
      expect(shouldShowReleaseNotes('2.0.0')).toBe(true);
    });

    it('should return false when an older version is checked', () => {
      setReadVersion('2.0.0');
      expect(shouldShowReleaseNotes('1.9.0')).toBe(false);
      expect(shouldShowReleaseNotes('1.0.0')).toBe(false);
    });

    it('should handle pre-release versions correctly', () => {
      setReadVersion('1.0.0');
      expect(shouldShowReleaseNotes('1.1.0-beta.1')).toBe(true);

      setReadVersion('1.1.0-beta.1');
      expect(shouldShowReleaseNotes('1.1.0')).toBe(true);
    });

    it('should return false for invalid version formats', () => {
      expect(shouldShowReleaseNotes('invalid-version')).toBe(false);

      setReadVersion('1.0.0');
      expect(shouldShowReleaseNotes('not-a-version')).toBe(false);
    });

    it('should handle invalid read version gracefully', () => {
      document.cookie = 'release-note-read=invalid-version';
      expect(shouldShowReleaseNotes('1.0.0')).toBe(true);
    });
  });

  describe('fetchReleaseNotes', () => {
    it('should throw error when NEXT_PUBLIC_RELEASE_NOTE_URL is not configured', async () => {
      process.env.NEXT_PUBLIC_RELEASE_NOTE_URL = undefined;

      await expect(fetchReleaseNotes()).rejects.toThrow(
        'NEXT_PUBLIC_RELEASE_NOTE_URL environment variable is not configured',
      );
    });

    it('should successfully fetch and parse release notes', async () => {
      process.env.NEXT_PUBLIC_RELEASE_NOTE_URL =
        'https://api.example.com/releases';

      const mockResponse: ReleaseNotesResponse = {
        latestVersion: '1.2.0',
        releases: [
          {
            version: '1.2.0',
            releaseDate: '2024-01-15',
            releaseNotes: '# Bug fixes\n- Fixed issue #123',
          },
          {
            version: '1.1.0',
            releaseDate: '2024-01-01',
            releaseNotes: '# New features\n- Added new feature',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetchReleaseNotes();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/releases',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-cache',
        }),
      );
    });

    it('should throw error when API returns non-ok response', async () => {
      process.env.NEXT_PUBLIC_RELEASE_NOTE_URL =
        'https://api.example.com/releases';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(fetchReleaseNotes()).rejects.toThrow(
        'Failed to fetch release notes: 404 Not Found',
      );
    });

    it('should throw error for invalid response format', async () => {
      process.env.NEXT_PUBLIC_RELEASE_NOTE_URL =
        'https://api.example.com/releases';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      } as Response);

      await expect(fetchReleaseNotes()).rejects.toThrow(
        'Invalid release notes response format',
      );
    });

    it('should validate individual release note format', async () => {
      process.env.NEXT_PUBLIC_RELEASE_NOTE_URL =
        'https://api.example.com/releases';

      const invalidResponse = {
        latestVersion: '1.0.0',
        releases: [
          {
            version: '1.0.0',
            // Missing releaseDate
            releaseNotes: 'Some notes',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse,
      } as Response);

      await expect(fetchReleaseNotes()).rejects.toThrow(
        'Invalid release note format',
      );
    });
  });

  describe('getReleaseNoteByVersion', () => {
    const mockReleases: ReleaseNote[] = [
      {
        version: '1.2.0',
        releaseDate: '2024-01-15',
        releaseNotes: 'Latest release',
      },
      {
        version: '1.1.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'Previous release',
      },
    ];

    it('should return the correct release note by version', () => {
      const result = getReleaseNoteByVersion(mockReleases, '1.1.0');
      expect(result).toEqual({
        version: '1.1.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'Previous release',
      });
    });

    it('should return null for non-existent version', () => {
      const result = getReleaseNoteByVersion(mockReleases, '1.0.0');
      expect(result).toBeNull();
    });

    it('should return null for empty releases array', () => {
      const result = getReleaseNoteByVersion([], '1.0.0');
      expect(result).toBeNull();
    });
  });
});
