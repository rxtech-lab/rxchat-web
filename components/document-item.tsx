'use client';

import type { VectorStoreDocument } from '@/lib/db/schema';
import { formatDistanceToNow } from 'date-fns';
import {
  DownloadIcon,
  EditIcon,
  FileIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  TrashIcon,
} from 'lucide-react';
import { memo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

/**
 * Document action interface for shared actions between dropdown and context menu
 */
interface DocumentAction {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  className?: string;
  onClick: () => void;
  disabled?: boolean;
}

const PureDocumentItem = ({
  vectorDocument,
  onDelete,
  onRename,
}: {
  vectorDocument: VectorStoreDocument;
  onDelete: (documentId: string) => void;
  onRename?: (documentId: string, newName: string) => void;
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(vectorDocument.originalFileName);

  /**
   * Handles document deletion with confirmation and loading states
   */
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

  /**
   * Handles document download by opening in new tab
   */
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

  /**
   * Handles document renaming with validation
   */
  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === vectorDocument.originalFileName) {
      setShowRenameDialog(false);
      return;
    }

    try {
      setIsRenaming(true);
      const response = await fetch(`/api/documents/${vectorDocument.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newName: newName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to rename document');
        return;
      }

      // Call the onRename callback if provided
      if (onRename) {
        onRename(vectorDocument.id, newName.trim());
      }

      toast.success('Document renamed successfully');
      setShowRenameDialog(false);
    } catch (error) {
      toast.error('Failed to rename document');
      console.error('Error renaming document:', error);
    } finally {
      setIsRenaming(false);
    }
  };

  /**
   * Opens the rename dialog with current filename
   */
  const handleRenameDialogOpen = () => {
    setNewName(vectorDocument.originalFileName);
    setShowRenameDialog(true);
  };

  /**
   * Formats file size from bytes to human readable format
   */
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  /**
   * Shared actions array for both dropdown menu and context menu
   */
  const documentActions: DocumentAction[] = [
    {
      id: 'download',
      label: 'Download',
      icon: DownloadIcon,
      onClick: handleDownload,
      disabled: isDeleting || isRenaming,
    },
    {
      id: 'rename',
      label: 'Rename',
      icon: EditIcon,
      onClick: handleRenameDialogOpen,
      disabled: isDeleting || isRenaming,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: TrashIcon,
      className:
        'text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500',
      onClick: handleDelete,
      disabled: isDeleting || isRenaming,
    },
  ];

  /**
   * Renders action items for menus
   */
  const renderActionItem = (
    action: DocumentAction,
    Component: typeof DropdownMenuItem | typeof ContextMenuItem,
  ) => (
    <Component
      key={action.id}
      className={`${action.className || ''} cursor-pointer hover:bg-muted`}
      onSelect={action.onClick}
      disabled={action.disabled}
    >
      <action.icon size={16} />
      <span>{action.label}</span>
    </Component>
  );

  return (
    <SidebarMenuItem>
      <ContextMenu>
        <ContextMenuTrigger>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton
                  asChild
                  className={`h-auto p-3 ${isDeleting || isRenaming ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-start gap-3 w-full cursor-pointer">
                    {isDeleting ? (
                      <Loader2Icon
                        size={20}
                        className="mt-0.5 shrink-0 text-muted-foreground animate-spin"
                      />
                    ) : isRenaming ? (
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
                          {formatDistanceToNow(
                            new Date(vectorDocument.createdAt),
                            {
                              addSuffix: true,
                            },
                          )}
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
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          {documentActions.map((action) =>
            renderActionItem(action, ContextMenuItem),
          )}
        </ContextMenuContent>
      </ContextMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isDeleting || isRenaming}>
          <SidebarMenuAction showOnHover>
            <MoreHorizontalIcon />
            <span className="sr-only">More actions</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          {documentActions.map((action) =>
            renderActionItem(action, DropdownMenuItem),
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
            <DialogDescription>
              Enter a new name for your document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document-name">Document Name</Label>
              <Input
                id="document-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter document name"
                disabled={isRenaming}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRename();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRenameDialog(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={
                !newName.trim() ||
                newName.trim() === vectorDocument.originalFileName ||
                isRenaming
              }
            >
              {isRenaming ? 'Renaming...' : 'Rename'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  );
};

export const DocumentItem = memo(PureDocumentItem);
