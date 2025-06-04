'use client';

import type { Attachment } from 'ai';
import { PreviewAttachment } from '../preview-attachment';
import type { UploadedDocument } from './types';

interface AttachmentsPreviewProps {
  attachments: Array<Attachment>;
  uploadedDocuments: Array<UploadedDocument>;
  uploadQueue: Array<string>;
  onDeleteAttachment: (attachmentUrl: string) => void;
  onDeleteDocument: (documentId: string) => void;
}

/**
 * Component for displaying attachment previews
 * @param props - Props containing attachments, documents, and handlers
 * @returns JSX element with attachment previews
 */
export function AttachmentsPreview({
  attachments,
  uploadedDocuments,
  uploadQueue,
  onDeleteAttachment,
  onDeleteDocument,
}: AttachmentsPreviewProps) {
  const hasContent =
    attachments.length > 0 ||
    uploadedDocuments.length > 0 ||
    uploadQueue.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <div
      data-testid="attachments-preview"
      className="flex flex-row gap-2 overflow-x-scroll items-end py-2"
    >
      {attachments
        .filter((attachment) =>
          // Filter out document attachments to prevent duplicates
          // Only show image attachments here since documents are rendered separately below
          attachment.contentType?.startsWith('image/'),
        )
        .map((attachment) => (
          <PreviewAttachment
            key={attachment.url}
            attachment={attachment}
            onDelete={() => onDeleteAttachment(attachment.url)}
            type="attachment"
          />
        ))}

      {uploadedDocuments.map((document) => (
        <PreviewAttachment
          key={document.id}
          attachment={{
            url: '',
            name: document.originalFileName,
            contentType: 'document',
          }}
          onDelete={() => onDeleteDocument(document.id)}
          type="document"
        />
      ))}

      {uploadQueue.map((filename) => (
        <PreviewAttachment
          key={filename}
          attachment={{
            url: '',
            name: filename,
            contentType: '',
          }}
          isUploading={true}
          type="uploading"
        />
      ))}
    </div>
  );
}
