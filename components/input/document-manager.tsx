'use client';

import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { DocumentManagerProps } from './types';

/**
 * Custom hook for managing document operations
 * @param props - Document manager props containing state setters
 * @returns Object with document management functions
 */
export function useDocumentManager({
  uploadedDocuments,
  setUploadedDocuments,
  setAttachments,
}: DocumentManagerProps) {
  const { mutate: globalMutate } = useSWRConfig();

  /**
   * Delete a document from the server and update state
   * @param documentId - The ID of the document to delete
   */
  const deleteDocument = async (documentId: string) => {
    try {
      const confirm = window.confirm(
        'Are you sure you want to delete this document?',
      );
      if (!confirm) {
        return;
      }

      const promise = async () => {
        const response = await fetch(`/api/documents/${documentId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete document');
        }

        setUploadedDocuments((currentDocuments) =>
          currentDocuments.filter((doc) => doc.id !== documentId),
        );

        // Revalidate sidebar documents infinite query and all document-related queries
        globalMutate(
          (key) => typeof key === 'string' && key.startsWith('/api/documents'),
          true,
          { revalidate: true },
        );
      };

      toast.promise(promise, {
        loading: 'Deleting document...',
        success: 'Document deleted successfully',
        error: 'Failed to delete document',
      });
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  /**
   * Clear all uploaded documents from state
   */
  const clearDocuments = () => {
    setUploadedDocuments([]);
  };

  /**
   * Get a specific document by ID
   * @param documentId - The ID of the document to find
   * @returns The document or undefined if not found
   */
  const getDocument = (documentId: string) => {
    return uploadedDocuments.find((doc) => doc.id === documentId);
  };

  return {
    deleteDocument,
    clearDocuments,
    getDocument,
  };
}
