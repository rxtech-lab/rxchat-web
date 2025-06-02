import type { Attachment } from 'ai';
import { FileIcon, XIcon, Loader2Icon } from 'lucide-react';

import { LoaderIcon } from './icons';
import { useState } from 'react';

// Helper function to determine if a content type represents a document
const isDocumentContentType = (contentType: string): boolean => {
  return contentType === 'document' || 
         contentType === 'application/pdf' ||
         contentType === 'text/plain' ||
         contentType === 'text/markdown' ||
         contentType === 'text/html' ||
         contentType === 'text/css' ||
         contentType === 'application/javascript' ||
         contentType === 'application/json' ||
         contentType === 'text/xml' ||
         contentType === 'text/csv' ||
         contentType === 'application/x-yaml' ||
         contentType === 'text/yaml';
};

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onDelete,
  type = 'attachment',
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onDelete?: () => void | Promise<void>;
  type?: 'attachment' | 'document' | 'uploading';
}) => {
  const { name, url, contentType } = attachment;
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    setIsDeleting(true);
    try {
      console.log('deleting');
      e.preventDefault();
      e.stopPropagation();
      if (onDelete && !isDeleting) {
        onDelete();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      data-testid="input-attachment-preview"
      className={`flex flex-col gap-2 px-2 relative group ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
    >
      <div className="w-20 h-12 aspect-video bg-muted rounded-md relative flex flex-col items-center justify-center">
        {contentType ? (
          contentType.startsWith('image') ? (
            // NOTE: it is recommended to use next/image for images
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={name ?? 'An image attachment'}
              className="rounded-md size-full object-cover"
            />
          ) : isDocumentContentType(contentType) ? (
            isDeleting ? (
              <Loader2Icon
                size={20}
                className="text-muted-foreground animate-spin"
              />
            ) : (
              <FileIcon size={24} className="text-muted-foreground" />
            )
          ) : (
            <div className="" />
          )
        ) : (
          <div className="" />
        )}

        {isUploading && (
          <div
            data-testid="input-attachment-loader"
            className="animate-spin absolute text-zinc-500"
          >
            <LoaderIcon />
          </div>
        )}

        {/* Delete button - show for attachments and documents, not while uploading or deleting */}
        {onDelete && !isUploading && !isDeleting && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="absolute -top-2 -right-2 size-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title={
              type === 'document' ? 'Delete document' : 'Remove attachment'
            }
          >
            <XIcon size={12} />
          </button>
        )}
      </div>
      <div className="text-xs text-zinc-500 max-w-16 truncate">{name}</div>
    </div>
  );
};
