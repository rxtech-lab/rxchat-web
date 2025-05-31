import { S3Client } from './s3';

export function createS3Client() {
  return new S3Client();
}
