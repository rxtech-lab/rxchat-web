'use client';

import { searchMCPTools } from '@/app/(chat)/actions-mcp';
import type { Tool } from '@/lib/api/mcp-router/client';
import useSWR from 'swr';
import { useDebounceValue } from 'usehooks-ts';

export interface UseMCPToolsSearchOptions {
  query?: string;
  enabled?: boolean;
  limit?: number;
  debounceDelay?: number;
}

export interface UseMCPToolsSearchReturn {
  tools: Tool[];
  isLoading: boolean;
  error: string | null;
  isValidating: boolean;
}

/**
 * Custom hook for searching MCP tools with debouncing and SWR caching
 * @param options - Configuration options for the search
 * @returns Search results with loading and error states
 */
export function useMCPToolsSearch({
  query = '',
  enabled = true,
  debounceDelay = 300,
}: UseMCPToolsSearchOptions = {}): UseMCPToolsSearchReturn {
  // Debounce the search query to avoid too many API calls
  const [debouncedQuery] = useDebounceValue(query.trim(), debounceDelay);

  // Fetcher function that calls the appropriate server action
  const fetcher = async (key: [string, string]): Promise<Tool[]> => {
    const [, searchQuery] = key;
    const result = await searchMCPTools(searchQuery);

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch tools');
    }

    return result.tools || [];
  };
  // Use SWR for data fetching with caching
  const {
    data: tools = [],
    error,
    isLoading,
    isValidating,
  } = useSWR(['mcp-tools-search', debouncedQuery], fetcher, {
    // Revalidate on focus to ensure fresh data
    revalidateOnFocus: true,
    // Keep data for 5 minutes
    dedupingInterval: 5 * 60 * 1000,
    // Retry on error up to 3 times
    errorRetryCount: 3,
    // Show stale data while revalidating for better UX
    keepPreviousData: true,
    // Don't revalidate automatically for search results
    revalidateOnMount: true,
    revalidateIfStale: false,
  });

  return {
    tools,
    isLoading,
    error: error?.message || null,
    isValidating,
  };
}

/**
 * Hook specifically for searching tools with a query
 * This includes debouncing and is optimized for user input
 */
export function useMCPToolsQuery(
  query: string,
  options: Pick<
    UseMCPToolsSearchOptions,
    'enabled' | 'limit' | 'debounceDelay'
  > = {},
): UseMCPToolsSearchReturn {
  const enabled = options.enabled ?? true;

  return useMCPToolsSearch({
    query: enabled ? query : '',
    enabled,
    limit: options.limit ?? 10,
    debounceDelay: options.debounceDelay ?? 300,
  });
}
