import { compare, valid } from 'semver';

// Interface for release note data structure
export interface ReleaseNote {
  version: string;
  releaseDate: string;
  releaseNotes: string; // Markdown content
}

export interface ReleaseNotesResponse {
  latestVersion: string;
  releases: ReleaseNote[];
}

// Cookie key for tracking read release notes
const RELEASE_NOTE_COOKIE_KEY = 'release-note-read';

/**
 * Get the read version from cookies
 */
export function getReadVersion(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const cookies = document.cookie.split(';');
    const releaseNoteCookie = cookies.find((cookie) =>
      cookie.trim().startsWith(`${RELEASE_NOTE_COOKIE_KEY}=`),
    );

    if (releaseNoteCookie) {
      return releaseNoteCookie.split('=')[1].trim();
    }
  } catch (error) {
    console.error('Error reading release note cookie:', error);
  }

  return null;
}

/**
 * Set the read version in cookies
 */
export function setReadVersion(version: string): void {
  if (typeof window === 'undefined') return;

  try {
    // Set cookie to expire in 1 year
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    document.cookie = `${RELEASE_NOTE_COOKIE_KEY}=${version}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
  } catch (error) {
    console.error('Error setting release note cookie:', error);
  }
}

/**
 * Check if user should see release notes for a given version
 * Returns true if the user hasn't read the latest version or if there's a newer version
 */
export function shouldShowReleaseNotes(latestVersion: string): boolean {
  if (!valid(latestVersion)) {
    console.warn('Invalid latest version format:', latestVersion);
    return false;
  }

  const readVersion = getReadVersion();

  // If no version has been read, show release notes
  if (!readVersion) {
    return true;
  }

  // If read version is invalid, show release notes
  if (!valid(readVersion)) {
    console.warn('Invalid read version format:', readVersion);
    return true;
  }

  // Show release notes if the latest version is newer than the read version
  try {
    return compare(latestVersion, readVersion) > 0;
  } catch (error) {
    console.error('Error comparing versions:', error);
    return false;
  }
}

/**
 * Fetch release notes from the configured API endpoint
 */
export async function fetchReleaseNotes(): Promise<ReleaseNotesResponse> {
  const releaseNotesUrl = process.env.NEXT_PUBLIC_RELEASE_NOTE_URL;

  if (!releaseNotesUrl) {
    throw new Error(
      'NEXT_PUBLIC_RELEASE_NOTE_URL environment variable is not configured',
    );
  }

  try {
    const response = await fetch(releaseNotesUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add cache control to ensure we get the latest data
      cache: 'no-cache',
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch release notes: ${response.status} ${response.statusText}`,
      );
    }

    const data: ReleaseNotesResponse = await response.json();

    // Validate the response structure
    if (!data.latestVersion || !Array.isArray(data.releases)) {
      throw new Error('Invalid release notes response format');
    }

    // Validate each release note
    for (const release of data.releases) {
      if (
        !release.version ||
        !release.releaseDate ||
        typeof release.releaseNotes !== 'string'
      ) {
        throw new Error('Invalid release note format');
      }
    }

    return data;
  } catch (error) {
    console.error('Error fetching release notes:', error);
    throw error;
  }
}

/**
 * Get the release note for a specific version
 */
export function getReleaseNoteByVersion(
  releases: ReleaseNote[],
  version: string,
): ReleaseNote | null {
  return releases.find((release) => release.version === version) || null;
}
