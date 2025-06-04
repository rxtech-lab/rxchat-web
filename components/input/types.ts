import type { Attachment } from 'ai';

/**
 * Interface for uploaded documents
 */
export interface UploadedDocument {
  id: string;
  filename: string;
  originalFileName: string;
  size: number;
}

/**
 * Upload result for images
 */
export interface ImageUploadResult {
  type: 'image';
  url: string;
  name: string;
  contentType: string;
}

/**
 * Upload result for documents
 */
export interface DocumentUploadResult extends UploadedDocument {
  type: 'document';
}

/**
 * Union type for all upload results
 */
export type UploadResult = ImageUploadResult | DocumentUploadResult;

/**
 * Props for file upload handlers
 */
export interface FileUploadProps {
  setAttachments: React.Dispatch<React.SetStateAction<Array<Attachment>>>;
  setUploadedDocuments: React.Dispatch<
    React.SetStateAction<Array<UploadedDocument>>
  >;
  setUploadQueue: React.Dispatch<React.SetStateAction<Array<string>>>;
  uploadQueue: Array<string>;
}

/**
 * Props for document management
 */
export interface DocumentManagerProps {
  uploadedDocuments: Array<UploadedDocument>;
  setUploadedDocuments: React.Dispatch<
    React.SetStateAction<Array<UploadedDocument>>
  >;
  setAttachments: React.Dispatch<React.SetStateAction<Array<Attachment>>>;
}
