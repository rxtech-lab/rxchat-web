'use client';

import useSWR from 'swr';
import {
  fetchReleaseNotes,
  type ReleaseNotesResponse,
} from '@/lib/release-notes';

/**
 * SWR hook for fetching release notes
 * Only fetches if NEXT_PUBLIC_RELEASE_NOTE_URL is configured
 */
export function useReleaseNotes() {
  const releaseNotesUrl = process.env.NEXT_PUBLIC_RELEASE_NOTE_URL;

  const { data, error, isLoading, mutate } = useSWR<ReleaseNotesResponse>(
    // Only fetch if URL is configured
    releaseNotesUrl ? 'release-notes' : null,
    fetchReleaseNotes,
    {
      // Refresh every 30 minutes to check for new releases
      refreshInterval: 30 * 60 * 1000,
      // Revalidate on window focus to check for updates
      revalidateOnFocus: true,
      // Retry on error with exponential backoff
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      // Don't revalidate on mount if we have cached data
      revalidateOnMount: true,
    },
  );

  return {
    releaseNotes: data,
    isLoading,
    error,
    mutate,
    isConfigured: !!releaseNotesUrl,
  };
}
