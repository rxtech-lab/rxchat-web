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

export interface PresignedUploadResult {
  /**
   * Pre-signed URL for uploading the file
   */
  uploadUrl: string;
  /**
   * Key of the file to be uploaded
   */
  key: string;
}

/**
 * Result for image uploads with public access
 */
export interface ImageUploadResult {
  /**
   * Public URL for the uploaded image
   */
  url: string;
  /**
   * Key of the uploaded image
   */
  key: string;
  /**
   * Content type of the image
   */
  contentType: string;
}

/**
 * Options for image uploads
 */
export interface ImageUploadOptions {
  /**
   * Whether to make the image publicly accessible
   */
  isPublic?: boolean;
  /**
   * Custom path prefix for the image (defaults to 'images/')
   */
  pathPrefix?: string;
  /**
   * TTL for presigned URLs in seconds
   */
  ttl?: number;
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
   * Upload an image with public access
   */
  uploadImage(
    file: File,
    options?: ImageUploadOptions,
  ): Promise<ImageUploadResult>;
  /**
   * Get a pre-signed URL for uploading an image
   */
  getPresignedImageUploadUrl(
    filename: string,
    mimeType: string,
    options?: ImageUploadOptions,
  ): Promise<PresignedUploadResult & { publicUrl: string }>;
  /**
   * Get a pre-signed URL for uploading a file without actually uploading it
   */
  getPresignedUploadUrl(
    key: string,
    mimeType: string,
    options?: GetFileOptions,
  ): Promise<PresignedUploadResult>;
  /**
   * Delete a file from the S3 bucket
   */
  deleteFile(key: string): Promise<void>;
  /**
   * Get the pre-signed URL for a file
   */
  getFileUrl(key: string, options?: GetFileOptions): Promise<string>;
}
