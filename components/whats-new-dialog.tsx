'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Markdown } from '@/components/markdown';
import { useReleaseNotes } from '@/hooks/use-release-notes';
import {
  shouldShowReleaseNotes,
  setReadVersion,
  getReleaseNoteByVersion,
} from '@/lib/release-notes';

interface WhatsNewDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * WhatsNewDialog component that displays release notes for the latest version
 * Automatically shows when user hasn't read the latest release notes
 */
export function WhatsNewDialog({ open, onOpenChange }: WhatsNewDialogProps) {
  const { releaseNotes, isLoading, error, isConfigured } = useReleaseNotes();
  const [isOpen, setIsOpen] = useState(false);
  const [hasCheckedVersion, setHasCheckedVersion] = useState(false);

  // Check if we should show the dialog when release notes are loaded
  useEffect(() => {
    if (!isConfigured || !releaseNotes || hasCheckedVersion) {
      return;
    }

    const shouldShow = shouldShowReleaseNotes(releaseNotes.latestVersion);
    if (shouldShow && open === undefined) {
      setIsOpen(true);
    }
    setHasCheckedVersion(true);
  }, [releaseNotes, hasCheckedVersion, isConfigured, open]);

  // Handle controlled vs uncontrolled dialog state
  const dialogOpen = open !== undefined ? open : isOpen;
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setIsOpen(newOpen);
    }
  };

  // Handle marking release notes as read
  const handleMarkAsRead = () => {
    if (releaseNotes?.latestVersion) {
      setReadVersion(releaseNotes.latestVersion);
    }
    handleOpenChange(false);
  };

  // Don't render if not configured or no data
  if (!isConfigured || !releaseNotes) {
    return null;
  }

  // Get the latest release note
  const latestRelease = getReleaseNoteByVersion(
    releaseNotes.releases,
    releaseNotes.latestVersion,
  );

  if (!latestRelease) {
    return null;
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>🎉</span>
            What&apos;s New in v{latestRelease.version}
          </DialogTitle>
          <DialogDescription>
            Released on{' '}
            {format(new Date(latestRelease.releaseDate), 'MMMM d, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full size-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Failed to load release notes</p>
              <p className="text-sm mt-2">Please try again later</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <Markdown>{latestRelease.releaseNotes}</Markdown>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleMarkAsRead}>I&apos;ve Read This</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
