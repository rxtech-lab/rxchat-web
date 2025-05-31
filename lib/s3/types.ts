export interface UploadResult {
  /**
   * Pre-signed URL for the uploaded file
   */
  uploadUrl: string;
  /**
   * Key of the uploaded file
   */
  key: string;
  /**
   * Pre-signed URL for the downloaded file
   */
  downloadUrl: string;
}

export interface GetFileOptions {
  /**
   * The time to live of the pre-signed URL in seconds
   */
  ttl?: number;
}

export interface S3 {
  uploadFile(file: File): Promise<UploadResult>;
  /**
   * Delete a file from the S3 bucket
   */
  deleteFile(key: string): Promise<void>;
  /**
   * Get the pre-signed URL for a file
   */
  getFileUrl(key: string, options?: GetFileOptions): Promise<string>;
}
