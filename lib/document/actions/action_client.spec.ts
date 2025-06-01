/**
 * @jest-environment node
 */

// Mock the server actions to avoid import issues in test environment
jest.mock('./action_server', () => ({
  getPresignedUploadUrl: jest.fn(),
  completeDocumentUpload: jest.fn(),
}));

// Mock fetch globally
global.fetch = jest.fn();

import { createDocuments } from './action_client';
import { getPresignedUploadUrl, completeDocumentUpload } from './action_server';

const mockGetPresignedUploadUrl = getPresignedUploadUrl as jest.MockedFunction<
  typeof getPresignedUploadUrl
>;
const mockCompleteDocumentUpload = completeDocumentUpload as jest.MockedFunction<
  typeof completeDocumentUpload
>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Helper function to create a mock file
function createMockFile(name: string, type: string, size: number): File {
  const file = new File(['content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

// Helper function to create a mock FileList
function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (const file of files) {
        yield file;
      }
    },
  };
  
  // Add indexed properties
  files.forEach((file, index) => {
    (fileList as any)[index] = file;
  });
  
  return fileList as FileList;
}

describe('createDocuments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful responses
    mockGetPresignedUploadUrl.mockResolvedValue({
      url: 'https://test-bucket.s3.amazonaws.com/test-upload-url',
      id: 'test-document-id',
    });
    
    mockCompleteDocumentUpload.mockResolvedValue({});
    
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response);
  });

  it('should handle empty file list', async () => {
    const result = await createDocuments(null);
    expect(result.results).toHaveLength(0);
    expect(result.allSucceeded).toBe(true);
    expect(result.allFailed).toBe(false);
    expect(mockGetPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('should handle empty FileList', async () => {
    const emptyFileList = createMockFileList([]);
    const result = await createDocuments(emptyFileList);
    expect(result.results).toHaveLength(0);
    expect(result.allSucceeded).toBe(true);
    expect(result.allFailed).toBe(false);
    expect(mockGetPresignedUploadUrl).not.toHaveBeenCalled();
  });

  it('should upload single file successfully', async () => {
    const file = createMockFile('test.pdf', 'application/pdf', 1024);
    const fileList = createMockFileList([file]);
    
    const result = await createDocuments(fileList);
    
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(0);
    expect(result.allSucceeded).toBe(true);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].fileName).toBe('test.pdf');
    
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledWith({
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
    });
    
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test-bucket.s3.amazonaws.com/test-upload-url',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': '1024',
        },
        body: file,
      }),
    );
    
    expect(mockCompleteDocumentUpload).toHaveBeenCalledWith({
      documentId: 'test-document-id',
    });
  });

  it('should handle multiple files in parallel (new behavior)', async () => {
    const file1 = createMockFile('test1.pdf', 'application/pdf', 1024);
    const file2 = createMockFile('test2.txt', 'text/plain', 512);
    const fileList = createMockFileList([file1, file2]);
    
    mockGetPresignedUploadUrl
      .mockResolvedValueOnce({
        url: 'https://test-bucket.s3.amazonaws.com/test-upload-url-1',
        id: 'test-document-id-1',
      })
      .mockResolvedValueOnce({
        url: 'https://test-bucket.s3.amazonaws.com/test-upload-url-2',
        id: 'test-document-id-2',
      });
    
    const result = await createDocuments(fileList);
    
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(0);
    expect(result.allSucceeded).toBe(true);
    expect(result.results).toHaveLength(2);
    
    expect(mockGetPresignedUploadUrl).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockCompleteDocumentUpload).toHaveBeenCalledTimes(2);
  });

  it('should allow partial failures with throwOnAnyFailure: false', async () => {
    const file1 = createMockFile('test1.pdf', 'application/pdf', 1024);
    const file2 = createMockFile('test2.txt', 'text/plain', 512);
    const fileList = createMockFileList([file1, file2]);
    
    // First file succeeds, second file fails at presigned URL step
    mockGetPresignedUploadUrl
      .mockResolvedValueOnce({
        url: 'https://test-bucket.s3.amazonaws.com/test-upload-url-1',
        id: 'test-document-id-1',
      })
      .mockResolvedValueOnce({
        error: 'Presigned URL failed',
      });
    
    const result = await createDocuments(fileList, { throwOnAnyFailure: false });
    
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.allSucceeded).toBe(false);
    expect(result.allFailed).toBe(false);
    
    const results = result.results;
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].fileName).toBe('test1.pdf');
    expect(results[1].success).toBe(false);
    expect(results[1].fileName).toBe('test2.txt');
    expect(results[1].error).toContain('Failed to get presigned URL');
  });

  it('should handle presigned URL error', async () => {
    const file = createMockFile('test.pdf', 'application/pdf', 1024);
    const fileList = createMockFileList([file]);
    
    mockGetPresignedUploadUrl.mockResolvedValue({
      error: 'Failed to get presigned URL',
    });
    
    await expect(createDocuments(fileList)).rejects.toThrow(
      'Failed to upload test.pdf: Failed to get presigned URL: Failed to get presigned URL'
    );
  });

  it('should handle S3 upload error', async () => {
    const file = createMockFile('test.pdf', 'application/pdf', 1024);
    const fileList = createMockFileList([file]);
    
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);
    
    await expect(createDocuments(fileList)).rejects.toThrow(
      'Failed to upload test.pdf: Failed to upload to S3: Internal Server Error'
    );
  });

  it('should handle complete upload error', async () => {
    const file = createMockFile('test.pdf', 'application/pdf', 1024);
    const fileList = createMockFileList([file]);
    
    mockCompleteDocumentUpload.mockResolvedValue({
      error: 'Failed to complete upload',
    });
    
    await expect(createDocuments(fileList)).rejects.toThrow(
      'Failed to upload test.pdf: Failed to complete upload: Failed to complete upload'
    );
  });

  it('should handle partial failures with detailed results', async () => {
    const file1 = createMockFile('test1.pdf', 'application/pdf', 1024);
    const file2 = createMockFile('test2.txt', 'text/plain', 512);
    const fileList = createMockFileList([file1, file2]);
    
    // First file succeeds, second file fails at presigned URL step
    mockGetPresignedUploadUrl
      .mockResolvedValueOnce({
        url: 'https://test-bucket.s3.amazonaws.com/test-upload-url-1',
        id: 'test-document-id-1',
      })
      .mockResolvedValueOnce({
        error: 'Presigned URL failed',
      });
    
    try {
      await createDocuments(fileList);
      fail('Expected function to throw an error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to upload');
      expect(error.uploadResults).toBeDefined();
      expect(error.uploadResults.successCount).toBe(1);
      expect(error.uploadResults.failureCount).toBe(1);
      expect(error.uploadResults.allSucceeded).toBe(false);
      expect(error.uploadResults.allFailed).toBe(false);
      
      const results = error.uploadResults.results;
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].fileName).toBe('test1.pdf');
      expect(results[1].success).toBe(false);
      expect(results[1].fileName).toBe('test2.txt');
      expect(results[1].error).toContain('Failed to get presigned URL');
    }
  });

  it('should handle all files failing', async () => {
    const file1 = createMockFile('test1.pdf', 'application/pdf', 1024);
    const file2 = createMockFile('test2.txt', 'text/plain', 512);
    const fileList = createMockFileList([file1, file2]);
    
    mockGetPresignedUploadUrl.mockResolvedValue({
      error: 'Service unavailable',
    });
    
    try {
      await createDocuments(fileList);
      fail('Expected function to throw an error');
    } catch (error: any) {
      expect(error.uploadResults.allFailed).toBe(true);
      expect(error.uploadResults.successCount).toBe(0);
      expect(error.uploadResults.failureCount).toBe(2);
    }
  });

  it('should process files in parallel rather than sequentially', async () => {
    const file1 = createMockFile('test1.pdf', 'application/pdf', 1024);
    const file2 = createMockFile('test2.txt', 'text/plain', 512);
    const fileList = createMockFileList([file1, file2]);
    
    const startTimes: number[] = [];
    
    // Mock a delay in presigned URL fetching to verify parallel execution
    mockGetPresignedUploadUrl.mockImplementation(async () => {
      startTimes.push(Date.now());
      // Small delay to simulate network call
      await new Promise(resolve => setTimeout(resolve, 50));
      return {
        url: 'https://test-bucket.s3.amazonaws.com/test-upload-url',
        id: 'test-document-id',
      };
    });
    
    const start = Date.now();
    await createDocuments(fileList);
    const end = Date.now();
    
    // If run in parallel, both calls should start around the same time
    // If run sequentially, there would be ~50ms difference
    const timeDifference = Math.abs(startTimes[1] - startTimes[0]);
    expect(timeDifference).toBeLessThan(20); // Allow some tolerance for test execution
    
    // Total time should be closer to 50ms (parallel) than 100ms (sequential)
    const totalTime = end - start;
    expect(totalTime).toBeLessThan(80); // Parallel execution should be much faster
  });

  it('should maintain backward compatibility with default throwOnAnyFailure behavior', async () => {
    const file1 = createMockFile('test1.pdf', 'application/pdf', 1024);
    const file2 = createMockFile('test2.txt', 'text/plain', 512);
    const fileList = createMockFileList([file1, file2]);
    
    // First file succeeds, second file fails at presigned URL step
    mockGetPresignedUploadUrl
      .mockResolvedValueOnce({
        url: 'https://test-bucket.s3.amazonaws.com/test-upload-url-1',
        id: 'test-document-id-1',
      })
      .mockResolvedValueOnce({
        error: 'Presigned URL failed',
      });
    
    // Should throw with default behavior
    try {
      await createDocuments(fileList); // Default throwOnAnyFailure: true
      fail('Expected function to throw an error');
    } catch (error: any) {
      expect(error.message).toContain('Failed to upload');
      expect(error.uploadResults).toBeDefined();
      expect(error.uploadResults.successCount).toBe(1);
      expect(error.uploadResults.failureCount).toBe(1);
    }
  });

  it('should call onFileUploadCallback for each completed file', async () => {
    const file1 = createMockFile('test1.pdf', 'application/pdf', 1024);
    const file2 = createMockFile('test2.txt', 'text/plain', 512);
    const fileList = createMockFileList([file1, file2]);
    
    // Setup mocks for successful uploads
    mockGetPresignedUploadUrl
      .mockResolvedValueOnce({
        url: 'https://test-bucket.s3.amazonaws.com/test-upload-url-1',
        id: 'test-document-id-1',
      })
      .mockResolvedValueOnce({
        url: 'https://test-bucket.s3.amazonaws.com/test-upload-url-2',
        id: 'test-document-id-2',
      });
    
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    
    mockCompleteDocumentUpload
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: true });
    
    // Track callback calls
    const callbackResults: any[] = [];
    const callback = jest.fn((result: any) => {
      callbackResults.push(result);
    });
    
    const results = await createDocuments(fileList, { 
      throwOnAnyFailure: false,
      onFileUploadCallback: callback 
    });
    
    // Verify callback was called for each file
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callbackResults).toHaveLength(2);
    
    // Verify callback results match the final results
    expect(callbackResults.every(r => r.success)).toBe(true);
    expect(callbackResults.map(r => r.fileName)).toEqual(['test1.pdf', 'test2.txt']);
    
    // Verify final results are still correct
    expect(results.successCount).toBe(2);
    expect(results.failureCount).toBe(0);
  });

  it('should call onFileUploadCallback for failed files too', async () => {
    const file1 = createMockFile('test1.pdf', 'application/pdf', 1024);
    const file2 = createMockFile('test2.txt', 'text/plain', 512);
    const fileList = createMockFileList([file1, file2]);
    
    // First file succeeds, second fails
    mockGetPresignedUploadUrl
      .mockResolvedValueOnce({
        url: 'https://test-bucket.s3.amazonaws.com/test-upload-url-1',
        id: 'test-document-id-1',
      })
      .mockResolvedValueOnce({
        error: 'Presigned URL failed',
      });
    
    mockFetch.mockResolvedValueOnce(new Response('', { status: 200 }));
    mockCompleteDocumentUpload.mockResolvedValueOnce({ success: true });
    
    // Track callback calls
    const callbackResults: any[] = [];
    const callback = jest.fn((result: any) => {
      callbackResults.push(result);
    });
    
    const results = await createDocuments(fileList, { 
      throwOnAnyFailure: false,
      onFileUploadCallback: callback 
    });
    
    // Verify callback was called for each file
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callbackResults).toHaveLength(2);
    
    // Verify one success and one failure
    const successResults = callbackResults.filter(r => r.success);
    const failureResults = callbackResults.filter(r => !r.success);
    expect(successResults).toHaveLength(1);
    expect(failureResults).toHaveLength(1);
    
    // Verify final results match
    expect(results.successCount).toBe(1);
    expect(results.failureCount).toBe(1);
  });
});