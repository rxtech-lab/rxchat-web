'use client';

import { useRouter } from 'next/navigation';
import { AUTO_REFRESH_INTERVAL } from '@/lib/constants';
import useSWR from 'swr';

/**
 * Client component that handles periodic page refreshing
 * Uses SWR to periodically call router.refresh() for server-side data updates
 */
export function PageRefresher() {
  const router = useRouter();

  // Use SWR with a dummy fetcher that just calls router.refresh()
  const { data } = useSWR(
    'page-refresh',
    async () => {
      router.refresh();
      return Date.now();
    },
    {
      refreshInterval: AUTO_REFRESH_INTERVAL, // Auto-refresh every 30 seconds
      revalidateOnFocus: true, // Revalidate when window gains focus
      revalidateOnReconnect: true, // Revalidate when connection is restored
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
    },
  );

  return null; // This component renders nothing
}
