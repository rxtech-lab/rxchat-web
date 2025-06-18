'use client';

import { useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { VisibilityType } from '@/components/visibility-selector';

export function useDocumentVisibility({
  documentId,
  initialVisibilityType,
}: {
  documentId: string;
  initialVisibilityType: VisibilityType;
}) {
  const { mutate } = useSWRConfig();

  const { data: localVisibility, mutate: setLocalVisibility } = useSWR(
    `${documentId}-visibility`,
    null,
    {
      fallbackData: initialVisibilityType,
    },
  );

  const visibilityType = useMemo(() => {
    return localVisibility;
  }, [localVisibility]);

  const setVisibilityType = async (updatedVisibilityType: VisibilityType) => {
    // Optimistically update local state
    setLocalVisibility(updatedVisibilityType);

    // Revalidate documents list to reflect changes
    mutate('/api/documents');

    try {
      // Update visibility on server
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visibility: updatedVisibilityType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || 'Failed to update document visibility',
        );
      }
    } catch (error) {
      // Revert optimistic update on error
      setLocalVisibility(initialVisibilityType);
      throw error;
    }
  };

  return { visibilityType, setVisibilityType };
}
