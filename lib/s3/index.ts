import { S3Client } from '@aws-sdk/client-s3';

export function createS3Client() {
  return new S3Client();
}
