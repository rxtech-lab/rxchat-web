'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getDocumentContent } from '@/lib/document/actions/action_server';
import OnStepView from '@/lib/workflow/onstep-view';
import type { OnStep } from '@/lib/workflow/types';
import { toast } from 'sonner';
import { Loader2, FileText, X } from 'lucide-react';
import { Button } from './ui/button';

interface DocumentViewerDialogProps {
  documentId: string;
  children: React.ReactNode;
}

/**
 * Dialog component for viewing document content using OnStepView
 */
export function DocumentViewerDialog({
  documentId,
  children,
}: DocumentViewerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [documentData, setDocumentData] = useState<OnStep | null>(null);

  const handleOpenDialog = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);

    if (!documentData) {
      setIsLoading(true);

      try {
        const result = await getDocumentContent({ id: documentId });
        if ('error' in result && result.error !== null) {
          console.error('Error getting document content:', result.error);
          toast.error(result.error as string);
          return;
        }

        setDocumentData(result as OnStep);
      } catch (error) {
        console.error('Error getting document content:', error);
        toast.error('Failed to load document content');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild onClick={handleOpenDialog}>
        {children}
      </DialogTrigger>
      <DialogContent
        className="max-w-6xl max-h-[80vh] p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-4">
            <span className="flex items-center gap-2">
              <FileText className="size-5" />
              <span>Document Viewer</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="ml-auto"
            >
              <X className="size-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            {documentData?.title || 'Loading document content...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2">
                <Loader2 className="size-6 animate-spin" />
                <span>Loading document content...</span>
              </div>
            </div>
          ) : documentData ? (
            <div
              className="h-full overflow-auto p-6 pt-0 min-h-[70vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <OnStepView onStep={documentData} showMainInfo={true} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <FileText className="size-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No document content available</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
