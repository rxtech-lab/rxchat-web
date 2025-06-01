'use client';

import { memo, useState } from 'react';
import { toast } from 'sonner';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  FileIcon,
  MoreHorizontalIcon,
  TrashIcon,
  DownloadIcon,
  Loader2Icon,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { VectorStoreDocument } from '@/lib/db/schema';

const PureDocumentItem = ({
  vectorDocument,
  onDelete,
}: {
  vectorDocument: VectorStoreDocument;
  onDelete: (documentId: string) => void;
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      const confirm = window.confirm(
        'Are you sure you want to delete this document?',
      );
      if (!confirm) {
        return;
      }
      const promise = async () => {
        setIsDeleting(true);
        const response = await fetch(`/api/documents/${vectorDocument.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to delete document');
        }

        onDelete(vectorDocument.id);
      };
      toast.promise(
        () =>
          promise().finally(() => {
            setIsDeleting(false);
          }),
        {
          loading: 'Deleting document...',
          success: 'Document deleted successfully',
        },
      );
    } catch (error) {
      toast.error('Failed to delete document');
      console.error('Error deleting document:', error);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(
        `/api/documents/${vectorDocument.id}/download`,
      );

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to get download link');
        return;
      }

      const data = await response.json();

      // Open the document in a new tab instead of downloading
      window.open(data.url, '_blank');
      toast.success('Document opened in new tab');
    } catch (error) {
      toast.error('Failed to download document');
      console.error('Error downloading document:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <SidebarMenuItem>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              asChild
              className={`h-auto p-3 ${isDeleting ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="flex items-start gap-3 w-full cursor-pointer">
                {isDeleting ? (
                  <Loader2Icon
                    size={20}
                    className="mt-0.5 shrink-0 text-muted-foreground animate-spin"
                  />
                ) : (
                  <FileIcon
                    size={20}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                  />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-sm font-medium truncate leading-tight">
                    {vectorDocument.originalFileName}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{formatFileSize(vectorDocument.size)}</span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(vectorDocument.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-sm">
            <div className="space-y-2">
              <div className="font-medium text-sm">
                {vectorDocument.originalFileName}
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  <span className="font-medium">Size:</span>{' '}
                  {formatFileSize(vectorDocument.size)}
                </div>
                <div>
                  <span className="font-medium">Created:</span>{' '}
                  {formatDistanceToNow(new Date(vectorDocument.createdAt), {
                    addSuffix: true,
                  })}
                </div>
                <div>{vectorDocument.content}</div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isDeleting}>
          <SidebarMenuAction showOnHover>
            <MoreHorizontalIcon />
            <span className="sr-only">More actions</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={handleDownload}
          >
            <DownloadIcon />
            <span>Download</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
            onSelect={handleDelete}
          >
            <TrashIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const DocumentItem = memo(PureDocumentItem);
