'use client';

import type { Prompt } from '@/lib/db/schema';
import { useCallback } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

/**
 * Fetcher function for SWR to fetch prompts from the API
 */
const fetcher = async (url: string): Promise<Prompt[]> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch prompts');
  }
  return response.json();
};

/**
 * Custom hook for managing prompt CRUD operations with SWR
 */
export function usePrompts() {
  const {
    data: prompts = [],
    error,
    isLoading,
    mutate: revalidate,
  } = useSWR('/api/prompts', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  });

  // Create a new prompt
  const createPrompt = useCallback(
    async (data: {
      title: string;
      description?: string;
      code: string;
      visibility?: 'private' | 'public';
    }) => {
      const promise = async () => {
        const response = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create prompt');
        }

        const newPrompt = await response.json();

        // Optimistically update the cache
        await revalidate([...prompts, newPrompt], false);
        // Revalidate from server
        await revalidate();

        return newPrompt;
      };

      return toast.promise(promise(), {
        loading: 'Creating prompt...',
        success: (newPrompt) => `${newPrompt.title} has been created`,
        error: (error) => error.message || 'Failed to create prompt',
      });
    },
    [prompts, revalidate],
  );

  // Update an existing prompt
  const updatePrompt = useCallback(
    async (
      id: string,
      data: {
        title?: string;
        description?: string;
        code?: string;
        visibility?: 'private' | 'public';
      },
    ) => {
      const promise = async () => {
        const response = await fetch('/api/prompts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update prompt');
        }

        const updatedPrompt = await response.json();

        // Optimistically update the cache
        const updatedPrompts = prompts.map((p) =>
          p.id === id ? updatedPrompt : p,
        );
        await revalidate(updatedPrompts, false);
        // Revalidate from server
        await revalidate();

        return updatedPrompt;
      };

      return toast.promise(promise(), {
        loading: 'Updating prompt...',
        success: (updatedPrompt) => `${updatedPrompt.title} has been updated`,
        error: (error) => error.message || 'Failed to update prompt',
      });
    },
    [prompts, revalidate],
  );

  // Delete a prompt
  const deletePrompt = useCallback(
    async (id: string, title: string) => {
      const promise = async () => {
        const response = await fetch(`/api/prompts?id=${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete prompt');
        }

        // Optimistically update the cache
        const filteredPrompts = prompts.filter((p) => p.id !== id);
        await revalidate(filteredPrompts, false);
        // Revalidate from server
        await revalidate();

        return { success: true };
      };

      return toast.promise(promise(), {
        loading: 'Deleting prompt...',
        success: () => `${title} has been deleted`,
        error: (error) => error.message || 'Failed to delete prompt',
      });
    },
    [prompts, revalidate],
  );

  // Manual fetch function for backward compatibility
  const fetchPrompts = useCallback(async () => {
    try {
      await revalidate();
      return prompts;
    } catch (error) {
      toast.error('Failed to load prompts');
      console.error('Error fetching prompts:', error);
      throw error;
    }
  }, [revalidate, prompts]);

  return {
    prompts,
    loading: isLoading,
    error,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
    revalidate, // Expose revalidate function for manual cache updates
  };
}
