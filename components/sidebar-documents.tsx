'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { DEBOUNCE_TIME } from '@/lib/constants';
import type { VectorStoreDocument } from '@/lib/db/schema';
import { createDocuments, type FileUploadResult } from '@/lib/document/actions/action_client';
import { fetcher } from '@/lib/utils';
import {
  getDocumentsPaginationKey,
  type DocumentHistory,
} from '@/lib/utils/pagination';
import { useDebounce } from '@uidotdev/usehooks';
import { isToday, isYesterday, subMonths, subWeeks } from 'date-fns';
import { FileIcon, LoaderIcon, PlusIcon, SearchIcon } from 'lucide-react';
import type { User } from 'next-auth';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { mutate as globalMutate } from 'swr';
import useSWRInfinite from 'swr/infinite';
import { DocumentItem } from './document-item';

type GroupedDocuments = {
  today: VectorStoreDocument[];
  yesterday: VectorStoreDocument[];
  lastWeek: VectorStoreDocument[];
  lastMonth: VectorStoreDocument[];
  older: VectorStoreDocument[];
};

/**
 * Sidebar action interface for shared actions between buttons and context menu
 */
interface SidebarAction {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * Groups documents by date for better organization
 */
const groupDocumentsByDate = (
  documents: VectorStoreDocument[],
): GroupedDocuments => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return documents.reduce(
    (groups, document) => {
      const documentDate = new Date(document.createdAt);

      if (isToday(documentDate)) {
        groups.today.push(document);
      } else if (isYesterday(documentDate)) {
        groups.yesterday.push(document);
      } else if (documentDate > oneWeekAgo) {
        groups.lastWeek.push(document);
      } else if (documentDate > oneMonthAgo) {
        groups.lastMonth.push(document);
      } else {
        groups.older.push(document);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedDocuments,
  );
};

export function SidebarDocuments({
  user,
  isOpen,
  onOpenChange,
}: {
  user: User | undefined;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query to avoid too many API calls
  const debouncedSearchQuery = useDebounce(searchQuery, DEBOUNCE_TIME);

  const {
    data: paginatedDocumentHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<DocumentHistory>(
    (pageIndex, previousPageData) =>
      getDocumentsPaginationKey(
        pageIndex,
        previousPageData,
        debouncedSearchQuery,
      ),
    fetcher,
    {
      fallbackData: [],
      refreshInterval: 0, // Don't auto-refresh for documents
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
    },
  );

  const hasReachedEnd = paginatedDocumentHistories
    ? paginatedDocumentHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyDocumentHistory = paginatedDocumentHistories
    ? paginatedDocumentHistories.every((page) => page.documents.length === 0)
    : false;

  // Flatten all documents from all pages and transform them
  const allDocuments = paginatedDocumentHistories
    ? paginatedDocumentHistories.flatMap((page) => page.documents)
    : [];

  const groupedDocuments = groupDocumentsByDate(allDocuments as any);

  /**
   * Handles document deletion with optimistic updates
   */
  const handleDeleteDocument = useCallback(
    (documentId: string) => {
      // Optimistically update the cache by removing the deleted document
      mutate((pages) => {
        if (!pages) return pages;
        return pages.map((page) => ({
          ...page,
          documents: page.documents.filter((doc) => doc.id !== documentId),
        }));
      }, false);

      // Also revalidate to ensure consistency
      globalMutate(
        (key) => typeof key === 'string' && key.startsWith('/api/documents'),
        undefined,
        { revalidate: true },
      );
    },
    [mutate],
  );

  /**
   * Handles document renaming with optimistic updates
   */
  const handleRenameDocument = useCallback(
    (documentId: string, newName: string) => {
      // Optimistically update the cache with the new name
      mutate((pages) => {
        if (!pages) return pages;
        return pages.map((page) => ({
          ...page,
          documents: page.documents.map((doc) =>
            doc.id === documentId ? { ...doc, originalFileName: newName } : doc,
          ),
        }));
      }, false);

      // Also revalidate to ensure consistency
      globalMutate(
        (key) => typeof key === 'string' && key.startsWith('/api/documents'),
        undefined,
        { revalidate: true },
      );
    },
    [mutate],
  );

  /**
   * Handles file upload with progress indication and detailed error handling
   */
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      
      // Create an upload promise that handles both success and partial failure scenarios
      const uploadPromise = async () => {
        // Callback to handle individual file completion for immediate UI updates
        const onFileUploadCallback = (fileResult: FileUploadResult) => {
          if (fileResult.success && fileResult.documentId) {
            // Optimistically add the new document to the cache immediately
            mutate((pages) => {
              if (!pages || pages.length === 0) return pages;
              
              // Create a new document object based on the successful upload
              const newDocument = {
                id: fileResult.documentId,
                name: fileResult.fileName,
                createdAt: new Date().toISOString(),
                // Add other required fields with sensible defaults
                updatedAt: new Date().toISOString(),
                userId: user.id,
                vectorStoreId: fileResult.documentId,
              };
              
              // Add to the first page (most recent documents)
              const updatedPages = [...pages];
              if (updatedPages[0]) {
                updatedPages[0] = {
                  ...updatedPages[0],
                  documents: [newDocument, ...updatedPages[0].documents],
                };
              }
              
              return updatedPages;
            }, false); // Don't revalidate immediately to avoid flicker
            
            // Also notify other parts of the app
            globalMutate(
              (key) =>
                typeof key === 'string' && key.startsWith('/api/documents'),
              undefined,
              { revalidate: false }, // Don't revalidate to avoid overwriting our optimistic update
            );
          }
        };
        
        // Allow partial failures to get detailed results and use callback for real-time updates
        const result = await createDocuments(event.target.files, { 
          throwOnAnyFailure: false,
          onFileUploadCallback 
        });
        
        // Final revalidation after all uploads complete to ensure data consistency
        if (result.successCount > 0) {
          // Small delay to let the optimistic updates settle
          setTimeout(async () => {
            await mutate();
            globalMutate(
              (key) =>
                typeof key === 'string' && key.startsWith('/api/documents'),
              undefined,
              { revalidate: true },
            );
          }, 100);
        }
        
        // Show additional warning toast for partial failures
        if (result.failureCount > 0 && result.successCount > 0) {
          const failedFiles = result.results.filter(r => !r.success);
          const failedFileNames = failedFiles.slice(0, 3).map(f => f.fileName).join(', ');
          const moreCount = failedFiles.length > 3 ? ` and ${failedFiles.length - 3} more` : '';
          
          toast.error(`Failed to upload: ${failedFileNames}${moreCount}`, {
            description: failedFiles[0].error,
          });
        }
        
        return result;
      };

      toast.promise(
        uploadPromise().finally(() => {
          setIsUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }),
        {
          loading: 'Uploading documents...',
          success: (result) => {
            if (result.allSucceeded) {
              return `${result.successCount} documents uploaded successfully`;
            } else if (result.successCount > 0) {
              return `${result.successCount} of ${files.length} documents uploaded successfully`;
            } else {
              // This case should be handled by error, but just in case
              return 'Upload completed';
            }
          },
          error: (error) => {
            // Handle the case where all files failed (this will be thrown as an error)
            if (error.uploadResults) {
              const { failureCount } = error.uploadResults;
              return `Failed to upload all ${failureCount} documents`;
            }
            return 'Failed to upload documents';
          },
        },
      );
    },
    [mutate, user.id],
  );

  /**
   * Triggers the file input click
   */
  const triggerFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Loads more documents when scrolling
   */
  const loadMoreDocuments = useCallback(() => {
    if (!hasReachedEnd && !isValidating) {
      setSize((size) => size + 1);
    }
  }, [hasReachedEnd, isValidating, setSize]);

  /**
   * Shared sidebar actions for context menu and buttons
   */
  const sidebarActions: SidebarAction[] = [
    {
      id: 'upload',
      label: 'Upload Documents',
      icon: PlusIcon,
      onClick: triggerFileUpload,
      disabled: isUploading,
    },
  ];

  /**
   * Renders action items for context menu
   */
  const renderContextMenuItem = (action: SidebarAction) => (
    <ContextMenuItem
      key={action.id}
      onSelect={action.onClick}
      disabled={action.disabled}
      className="cursor-pointer hover:bg-muted"
    >
      <action.icon size={16} />
      <span>{action.label}</span>
    </ContextMenuItem>
  );

  /**
   * Renders document groups with proper headers
   */
  const renderDocumentGroup = (
    title: string,
    documents: VectorStoreDocument[],
  ) => {
    if (documents.length === 0) return null;

    return (
      <div key={title} className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-2">
          {title}
        </h3>
        {/* Remove bullet points from document list */}
        <div className="space-y-1 list-none">
          {documents.map((document) => (
            <DocumentItem
              key={document.id}
              vectorDocument={document}
              onDelete={handleDeleteDocument}
              onRename={handleRenameDocument}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[540px]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <FileIcon size={20} />
            Documents
          </SheetTitle>
        </SheetHeader>

        <ContextMenu>
          <ContextMenuTrigger className="flex flex-col h-full overflow-hidden">
            {/* Search and Upload Section */}
            <div className="space-y-3 mb-6">
              {/* Search Bar */}
              <div className="relative">
                <SearchIcon
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  disabled={isUploading}
                />
              </div>

              {/* Upload Button - only show if there are documents */}
              {!hasEmptyDocumentHistory && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={isUploading}
                    onClick={triggerFileUpload}
                  >
                    {isUploading ? (
                      <>
                        <LoaderIcon className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <PlusIcon />
                        Upload Documents
                      </>
                    )}
                  </Button>
                </div>
              )}
              {/* Hidden file input - always present for upload functionality */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.bmp,.svg,.webp,.mp3,.mp4,.avi,.mov,.wmv,.flv,.webm,.m4a,.wav,.ogg"
              />
            </div>

            {/* Documents List */}
            <div className="flex-1 overflow-y-auto space-y-4">
              {isLoading && allDocuments.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <LoaderIcon className="animate-spin" />
                </div>
              ) : hasEmptyDocumentHistory ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileIcon size={48} className="text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    No documents found
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {debouncedSearchQuery
                      ? 'No documents match your search query.'
                      : 'Upload your first document to get started.'}
                  </p>
                  {!debouncedSearchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={triggerFileUpload}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <LoaderIcon className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <PlusIcon />
                          Upload Documents
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {renderDocumentGroup('Today', groupedDocuments.today)}
                  {renderDocumentGroup('Yesterday', groupedDocuments.yesterday)}
                  {renderDocumentGroup(
                    'Last 7 days',
                    groupedDocuments.lastWeek,
                  )}
                  {renderDocumentGroup(
                    'Last 30 days',
                    groupedDocuments.lastMonth,
                  )}
                  {renderDocumentGroup('Older', groupedDocuments.older)}

                  {/* Load More Button */}
                  {!hasReachedEnd && allDocuments.length > 0 && (
                    <div className="flex justify-center py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMoreDocuments}
                        disabled={isValidating}
                      >
                        {isValidating ? (
                          <>
                            <LoaderIcon className="animate-spin" />
                            Loading...
                          </>
                        ) : (
                          'Load More'
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            {sidebarActions.map(renderContextMenuItem)}
          </ContextMenuContent>
        </ContextMenu>
      </SheetContent>
    </Sheet>
  );
}
