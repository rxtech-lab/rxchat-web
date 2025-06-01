import { completeDocumentUpload, getPresignedUploadUrl } from './action_server';

/**
 * Upload result for a single file
 */
export interface FileUploadResult {
  fileName: string;
  success: boolean;
  error?: string;
  documentId?: string;
}

/**
 * Upload results for multiple files
 */
export interface DocumentUploadResults {
  results: FileUploadResult[];
  successCount: number;
  failureCount: number;
  allSucceeded: boolean;
  allFailed: boolean;
}

/**
 * Upload a single file and return the result
 */
async function uploadSingleFile(file: File): Promise<FileUploadResult> {
  try {
    // Step 1: Get the presigned URL from the API
    const presigned = await getPresignedUploadUrl({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    });
    
    if ('error' in presigned) {
      return {
        fileName: file.name,
        success: false,
        error: `Failed to get presigned URL: ${presigned.error}`,
      };
    }

    // Step 2: Upload the file to S3 using the presigned URL
    const response = await fetch(presigned.url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
        'Content-Length': file.size.toString(),
      },
      body: file,
    });

    if (!response.ok) {
      return {
        fileName: file.name,
        success: false,
        error: `Failed to upload to S3: ${response.statusText}`,
      };
    }

    // Step 3: Call complete upload API to finalize the document creation
    const completeResponse = await completeDocumentUpload({
      documentId: presigned.id,
    });
    
    if ('error' in completeResponse) {
      return {
        fileName: file.name,
        success: false,
        error: `Failed to complete upload: ${completeResponse.error}`,
      };
    }

    return {
      fileName: file.name,
      success: true,
      documentId: presigned.id,
    };
  } catch (error) {
    return {
      fileName: file.name,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Create documents from multiple files using parallel processing with Promise.allSettled
 * for better performance compared to sequential uploads
 * 
 * @param fileList - The files to upload
 * @param options - Upload options including optional callback for individual file completion
 * @returns Upload results with detailed information about successes and failures
 */
export async function createDocuments(
  fileList: FileList | null, 
  options: { 
    throwOnAnyFailure?: boolean;
    onFileUploadCallback?: (result: FileUploadResult) => void;
  } = { throwOnAnyFailure: true }
): Promise<DocumentUploadResults> {
  const files = fileList ? Array.from(fileList) : null;
  if (!files || files.length === 0) {
    return {
      results: [],
      successCount: 0,
      failureCount: 0,
      allSucceeded: true,
      allFailed: false,
    };
  }

  // Use Promise.allSettled to upload all files in parallel
  // Wrap each upload with callback if provided
  const uploadPromises = files.map(file => {
    const uploadPromise = uploadSingleFile(file);
    
    // If callback is provided, call it when this specific file completes
    if (options.onFileUploadCallback) {
      uploadPromise.then(result => {
        options.onFileUploadCallback!(result);
      }).catch(() => {
        // Handle case where uploadSingleFile rejects (shouldn't happen normally)
        // The callback will be called with the error result in the settled results processing
      });
    }
    
    return uploadPromise;
  });
  
  const settledResults = await Promise.allSettled(uploadPromises);
  
  // Process the results
  const results: FileUploadResult[] = settledResults.map((settledResult, index) => {
    let result: FileUploadResult;
    
    if (settledResult.status === 'fulfilled') {
      result = settledResult.value;
    } else {
      // This should rarely happen since uploadSingleFile handles its own errors
      result = {
        fileName: files[index].name,
        success: false,
        error: settledResult.reason instanceof Error 
          ? settledResult.reason.message 
          : 'Unexpected error during upload',
      };
      
      // Call callback for rejected promises if callback is provided
      if (options.onFileUploadCallback) {
        options.onFileUploadCallback(result);
      }
    }
    
    return result;
  });

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  const uploadResults: DocumentUploadResults = {
    results,
    successCount,
    failureCount,
    allSucceeded: successCount === files.length,
    allFailed: failureCount === files.length,
  };

  // Handle error throwing based on options and results
  if (options.throwOnAnyFailure && failureCount > 0) {
    const failedFiles = results.filter(r => !r.success);
    const errorMessage = failedFiles.length === 1 
      ? `Failed to upload ${failedFiles[0].fileName}: ${failedFiles[0].error}`
      : `Failed to upload ${failedFiles.length} files. First error: ${failedFiles[0].error}`;
    
    // Attach the detailed results to the error for potential future use
    const error = new Error(errorMessage) as Error & { uploadResults?: DocumentUploadResults };
    error.uploadResults = uploadResults;
    throw error;
  } else if (uploadResults.allFailed) {
    // Always throw if all files failed, regardless of options
    const failedFiles = results.filter(r => !r.success);
    const errorMessage = failedFiles.length === 1 
      ? `Failed to upload ${failedFiles[0].fileName}: ${failedFiles[0].error}`
      : `Failed to upload all ${failedFiles.length} files. First error: ${failedFiles[0].error}`;
    
    const error = new Error(errorMessage) as Error & { uploadResults?: DocumentUploadResults };
    error.uploadResults = uploadResults;
    throw error;
  }

  return uploadResults;
}
