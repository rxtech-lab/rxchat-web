'use client';

import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import {
  getContentTypeFromFileName,
  getDocumentDownloadUrl,
} from './file-utils';
import type { UploadResult, FileUploadProps } from './types';

/**
 * Custom hook for handling file uploads
 * @param props - File upload props containing state setters
 * @returns Object with upload function and handlers
 */
export function useFileUpload({
  setAttachments,
  setUploadedDocuments,
  setUploadQueue,
  uploadQueue,
}: FileUploadProps) {
  const { mutate: globalMutate } = useSWRConfig();

  /**
   * Upload a single file to the server
   * @param file - The file to upload
   * @returns Promise that resolves to upload result or null if failed
   */
  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    const uploadPromise = async (): Promise<UploadResult> => {
      // Step 1: Get presigned URL from our API
      const metadataResponse = await fetch('/api/files/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
          mimeType: file.type,
        }),
      });

      if (!metadataResponse.ok) {
        const { error } = await metadataResponse.json();
        throw new Error(error || 'Failed to get upload URL');
      }

      const uploadData = await metadataResponse.json();

      // Step 2: Upload directly to S3 using presigned URL
      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      // Step 3: Handle completion based on file type
      if (uploadData.type === 'image') {
        // For images, return the public URL
        return {
          type: 'image',
          url: uploadData.publicUrl,
          name: uploadData.filename,
          contentType: uploadData.contentType,
        };
      } else if (uploadData.type === 'document') {
        // For documents, complete the upload process
        const completeResponse = await fetch('/api/documents/complete-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: uploadData.documentId,
          }),
        });

        if (!completeResponse.ok) {
          const { error } = await completeResponse.json();
          throw new Error(error || 'Failed to complete document upload');
        }

        // Return document data for tracking
        return {
          type: 'document',
          id: uploadData.documentId,
          filename: uploadData.filename,
          originalFileName: file.name,
          size: file.size,
        };
      } else {
        throw new Error('Unknown upload type');
      }
    };

    try {
      const toastPromise = toast.promise(uploadPromise(), {
        loading: `Uploading ${file.name}...`,
        success: (data) => {
          if (data.type === 'document') {
            // Revalidate sidebar documents infinite query and all document-related queries
            globalMutate(
              (key) =>
                typeof key === 'string' && key.startsWith('/api/documents'),
              true,
              { revalidate: true },
            );
            return `Document "${data.filename}" uploaded successfully`;
          }
          return `${file.name} uploaded successfully`;
        },
        error: (error) =>
          error.message || 'Failed to upload file, please try again!',
      });

      const result = await toastPromise.unwrap();
      return result;
    } catch (error) {
      return null;
    }
  };

  /**
   * Handle file change event from input
   * @param event - The change event from file input
   */
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);

    setUploadQueue(files.map((file) => file.name));

    try {
      const uploadPromises = files.map((file) => uploadFile(file));
      const uploadResults = await Promise.all(uploadPromises);

      // Separate images and documents
      const images = uploadResults.filter(
        (
          result,
        ): result is {
          type: 'image';
          url: string;
          name: string;
          contentType: string;
        } => result !== null && result.type === 'image',
      );

      const documents = uploadResults.filter(
        (
          result,
        ): result is {
          type: 'document';
          id: string;
          filename: string;
          originalFileName: string;
          size: number;
        } => result !== null && result.type === 'document',
      );

      // Add images to attachments
      if (images.length > 0) {
        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...images.map((img) => ({
            url: img.url,
            name: img.name,
            contentType: img.contentType,
          })),
        ]);
      }

      // Add documents to uploadedDocuments and also as attachments for AI access
      if (documents.length > 0) {
        setUploadedDocuments((currentDocuments) => [
          ...currentDocuments,
          ...documents.map((doc) => ({
            id: doc.id,
            filename: doc.filename,
            originalFileName: doc.originalFileName,
            size: doc.size,
          })),
        ]);

        // Get download URLs and add documents as attachments for AI to access
        // This allows the AI to directly read the document content during the conversation
        const documentAttachments = await Promise.all(
          documents.map(async (doc) => {
            const downloadUrl = await getDocumentDownloadUrl(doc.id);
            if (downloadUrl) {
              // Use extracted function to detect MIME type based on file extension
              const contentType = getContentTypeFromFileName(
                doc.originalFileName,
              );

              return {
                url: downloadUrl,
                name: doc.originalFileName,
                contentType,
              };
            }
            return null;
          }),
        );

        // Filter out any failed download URL requests and add to attachments
        const validDocumentAttachments = documentAttachments.filter(
          (
            attachment,
          ): attachment is {
            url: string;
            name: string;
            contentType: string;
          } => attachment !== null,
        );
        if (validDocumentAttachments.length > 0) {
          setAttachments((currentAttachments) => [
            ...currentAttachments,
            ...validDocumentAttachments,
          ]);
        }

        // Ensure documents sidebar is updated after batch upload
        globalMutate(
          (key) => {
            console.log(
              key,
              typeof key === 'string' && key.startsWith('/api/documents'),
            );
            return typeof key === 'string' && key.startsWith('/api/documents');
          },
          true,
          { revalidate: true },
        );
      }
    } catch (error) {
      console.error('Error uploading files!', error);
    } finally {
      setUploadQueue([]);
    }
  };

  return {
    handleFileChange,
    uploadFile,
  };
}
