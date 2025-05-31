import {
  S3Client as AWSS3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';
import type {
  S3,
  GetFileOptions,
  UploadResult,
  PresignedUploadResult,
  ImageUploadResult,
  ImageUploadOptions,
} from './types';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE, isImageType } from '../constants';

/**
 * S3Client implementation for file operations
 * Provides methods to upload, delete, and get pre-signed URLs for files
 */
export class S3Client implements S3 {
  private client: AWSS3Client;
  private bucketName: string;
  private customEndpoint: string | null = null;

  constructor() {
    // check if access key and secret key are set
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error(
        'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set',
      );
    }

    // Prepare S3 client configuration with custom endpoint support
    const clientConfig: any = {
      region: process.env.AWS_REGION || 'auto',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    };

    // Add custom endpoint if AWS_S3_ENDPOINT is provided
    // This enables support for S3-compatible services like MinIO, DigitalOcean Spaces, etc.
    if (process.env.AWS_S3_ENDPOINT) {
      clientConfig.endpoint = process.env.AWS_S3_ENDPOINT;
      // Force path-style addressing for custom endpoints (required for most S3-compatible services)
      clientConfig.forcePathStyle = true;
    }

    if (process.env.AWS_S3_CUSTOM_DOMAIN) {
      this.customEndpoint = process.env.AWS_S3_CUSTOM_DOMAIN;
    }

    // Initialize AWS S3 client with environment variables
    this.client = new AWSS3Client(clientConfig);

    if (!process.env.AWS_S3_BUCKET_NAME) {
      throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
    }

    this.bucketName = process.env.AWS_S3_BUCKET_NAME;
  }

  /**
   * Validate file size and type before upload
   * @param file - The file to validate
   * @param options - Upload options including size and type restrictions
   */
  private validateFile(file: File): void {
    const maxFileSize = MAX_FILE_SIZE;

    // Check file size
    if (file.size > maxFileSize) {
      throw new Error(
        `File size ${this.formatFileSize(file.size)} exceeds maximum allowed size of ${this.formatFileSize(maxFileSize)}`,
      );
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new Error(
        `File type "${file.type}" is not allowed. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
      );
    }
  }

  /**
   * Format file size in human readable format
   * @param bytes - File size in bytes
   * @returns Formatted file size string
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Upload a file to S3 and return upload and download URLs
   * @param file - The file to upload
   * @param options - Upload options including size and type restrictions
   * @returns Promise containing upload URL, key, and download URL
   */
  async uploadFile(file: File): Promise<UploadResult> {
    // Validate file before upload
    this.validateFile(file);

    // Generate unique key for the file
    const fileExtension = file.name.split('.').pop();
    const key = `uploads/${nanoid()}.${fileExtension}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload file to S3
    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      Metadata: {
        'original-filename': file.name,
        'upload-timestamp': new Date().toISOString(),
      },
    });

    await this.client.send(putCommand);

    // Generate pre-signed URLs
    const uploadUrl = await getSignedUrl(this.client, putCommand, {
      expiresIn: 3600,
    });
    const downloadUrl = await this.getFileUrl(key, { ttl: 3600 });

    return {
      uploadUrl,
      key,
      downloadUrl,
    };
  }

  /**
   * Upload an image with public access to S3
   * @param file - The image file to upload
   * @param options - Upload options including path prefix and TTL
   * @returns Promise containing public URL, key, and content type
   */
  async uploadImage(
    file: File,
    options?: ImageUploadOptions,
  ): Promise<ImageUploadResult> {
    // Validate file before upload
    this.validateFile(file);

    // Verify it's an image
    if (!isImageType(file.type)) {
      throw new Error(`File type "${file.type}" is not a supported image type`);
    }

    // Generate unique key for the image
    const fileExtension = file.name.split('.').pop();
    const pathPrefix = options?.pathPrefix || 'images';
    const key = `${pathPrefix}/${nanoid()}.${fileExtension}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload image to S3 with public-read ACL
    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ACL: options?.isPublic !== false ? 'public-read' : undefined,
      Metadata: {
        'original-filename': file.name,
        'upload-timestamp': new Date().toISOString(),
      },
    });

    await this.client.send(putCommand);

    // Generate public URL for the image
    const publicUrl = this.getPublicUrl(key);

    return {
      url: publicUrl,
      key,
      contentType: file.type,
    };
  }

  /**
   * Get a pre-signed URL for uploading an image
   * @param filename - The original filename
   * @param mimeType - The MIME type of the image
   * @param options - Upload options including path prefix and TTL
   * @returns Promise containing presigned upload URL, key, and public URL
   */
  async getPresignedImageUploadUrl(
    filename: string,
    mimeType: string,
    options?: ImageUploadOptions,
  ): Promise<PresignedUploadResult & { publicUrl: string }> {
    // Verify it's an image type
    if (!isImageType(mimeType)) {
      throw new Error(`MIME type "${mimeType}" is not a supported image type`);
    }

    const ttl = options?.ttl || 3600; // Default to 1 hour
    const fileExtension = filename.split('.').pop();
    const pathPrefix = options?.pathPrefix || 'images';
    const key = `${pathPrefix}/${nanoid()}.${fileExtension}`;

    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType,
      ACL: options?.isPublic !== false ? 'public-read' : undefined,
    });

    const uploadUrl = await getSignedUrl(this.client, putCommand, {
      expiresIn: ttl,
    });

    const publicUrl = this.getPublicUrl(key);

    return {
      uploadUrl,
      key,
      publicUrl,
    };
  }

  /**
   * Generate public URL for a file in the S3 bucket
   * @param key - The S3 key of the file
   * @returns The public URL
   */
  private getPublicUrl(key: string): string {
    if (this.customEndpoint) {
      const endpoint = this.customEndpoint.replace(/\/$/, ''); // Remove trailing slash
      return `${endpoint}/${key}`;
    }

    if (process.env.AWS_S3_ENDPOINT) {
      // For custom endpoints (like MinIO, DigitalOcean Spaces)
      const endpoint = process.env.AWS_S3_ENDPOINT.replace(/\/$/, ''); // Remove trailing slash
      return `${endpoint}/${this.bucketName}/${key}`;
    }

    // For AWS S3
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Delete a file from S3
   * @param key - The S3 key of the file to delete
   */
  async deleteFile(key: string): Promise<void> {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.client.send(deleteCommand);
  }

  /**
   * Get a pre-signed URL for downloading a file
   * @param key - The S3 key of the file
   * @param options - Optional parameters including TTL
   * @returns Promise containing the pre-signed download URL
   */
  async getFileUrl(key: string, options?: GetFileOptions): Promise<string> {
    const ttl = options?.ttl || 3600; // Default to 1 hour

    const getCommand = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(this.client, getCommand, { expiresIn: ttl });
    return url;
  }

  /**
   * Get a pre-signed URL for uploading a file without actually uploading it
   * @param key - The S3 key for the file
   * @param mimeType - The MIME type of the file
   * @param options - Optional parameters including TTL
   * @returns Promise containing the pre-signed upload URL and key
   */
  async getPresignedUploadUrl(
    key: string,
    mimeType: string,
    options?: GetFileOptions,
  ): Promise<PresignedUploadResult> {
    const ttl = options?.ttl || 3600; // Default to 1 hour

    const putCommand = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.client, putCommand, {
      expiresIn: ttl,
    });

    return {
      uploadUrl,
      key,
    };
  }
}
