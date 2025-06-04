'use client';

import { usePrompts } from '@/hooks/use-prompts';
import type { Prompt } from '@/lib/db/schema';
import { ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PromptForm } from '../prompt-form';
import { PromptList } from '../prompt-list';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { PromptSchema } from './prompt.schema';
import { useRouter } from 'next/navigation';
import { selectPrompt } from '@/app/(chat)/actions';

interface PromptDialogProps {
  currentPrompt?: Prompt;
}

type ViewMode = 'list' | 'create' | 'edit';

/**
 * Enhanced prompt dialog that allows users to choose templates, create, edit, and delete prompts
 * @param currentPrompt - The currently selected prompt (optional)
 * @param onSelectPrompt - Callback when a prompt is selected
 */
export function PromptDialog({ currentPrompt }: PromptDialogProps) {
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [loadingPromptId, setLoadingPromptId] = useState<string | undefined>();
  const router = useRouter();

  // Refs to store form data
  const formDataRef = useRef<{
    title: string;
    description?: string;
    code: string;
  } | null>(null);

  // Use the prompts hook for CRUD operations
  const {
    prompts,
    loading,
    fetchPrompts,
    createPrompt,
    updatePrompt,
    deletePrompt,
  } = usePrompts();

  // Fetch prompts when dialog opens
  useEffect(() => {
    if (open) {
      fetchPrompts();
    }
  }, [open, fetchPrompts]);

  // Handle prompt selection
  const handleSelectPrompt = async (prompt: Prompt) => {
    try {
      setLoadingPromptId(prompt.id);
      const promise = selectPrompt({ promptId: prompt.id });
      promise
        .then(() => {
          router.refresh();
          setOpen(false);
        })
        .finally(() => {
          setLoadingPromptId(undefined);
        });
      toast.promise(promise, {
        loading: 'Selecting prompt...',
        success: 'Prompt selected',
        error: (error) =>
          error instanceof Error ? error.message : 'Failed to select prompt',
      });
    } catch (error) {
      setLoadingPromptId(undefined);
      toast.error('Failed to select prompt');
      console.error('Error selecting prompt:', error);
    }
  };

  // Handle creating a new prompt
  const handleCreatePrompt = async (data: {
    title: string;
    description?: string;
    code: string;
  }) => {
    setSubmitting(true);
    try {
      await createPrompt(data);
      setViewMode('list');
      formDataRef.current = null;
      setFormValid(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle editing a prompt
  const handleEditPrompt = async (data: {
    title: string;
    description?: string;
    code: string;
  }) => {
    if (!editingPrompt) return;

    setSubmitting(true);
    try {
      const updatedPrompt = await updatePrompt(editingPrompt.id, data);
      // Keep dialog open and update the editing prompt with the latest data
      // Since updatePrompt returns the updated prompt from the server, use that
      const refreshedPrompts = prompts.find(p => p.id === editingPrompt.id);
      if (refreshedPrompts) {
        setEditingPrompt(refreshedPrompts);
      }
      // Keep current form data since user might want to make more changes
      formDataRef.current = data;
      setFormValid(true);
    } finally {
      setSubmitting(false);
      router.refresh();
    }
  };

  // Handle deleting a prompt
  const handleDeletePrompt = async (prompt: Prompt) => {
    const confirmed = confirm('Are you sure you want to delete this prompt?');
    if (confirmed) {
      await deletePrompt(prompt.id, prompt.title);
      router.refresh();
    }
  };

  const handleOpenDialog = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
    setViewMode('list');
    setEditingPrompt(null);
    formDataRef.current = null;
    setFormValid(false);
    setLoadingPromptId(undefined);
  };

  const handleBack = () => {
    setViewMode('list');
    setEditingPrompt(null);
    formDataRef.current = null;
    setFormValid(false);
  };

  const handleEditAction = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setViewMode('edit');
  };

  // Handle form data updates
  const handleFormDataUpdate = async (data: {
    title: string;
    description?: string;
    code: string;
  }) => {
    formDataRef.current = data;
    const result = PromptSchema.safeParse(data);
    setFormValid(result.success);
  };

  // Handle form submission from footer buttons
  const handleFormSubmit = () => {
    if (!formDataRef.current) return;

    if (viewMode === 'create') {
      handleCreatePrompt(formDataRef.current);
    } else if (viewMode === 'edit') {
      handleEditPrompt(formDataRef.current);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin" />
          <span className="ml-2">Loading prompts...</span>
        </div>
      );
    }

    switch (viewMode) {
      case 'create':
        return (
          <PromptForm onSubmit={handleFormDataUpdate} isLoading={submitting} />
        );

      case 'edit':
        return (
          <PromptForm
            prompt={editingPrompt || undefined}
            onSubmit={handleFormDataUpdate}
            isLoading={submitting}
          />
        );

      default:
        return (
          <PromptList
            prompts={prompts}
            onSelect={handleSelectPrompt}
            onEdit={handleEditAction}
            onDelete={handleDeletePrompt}
            onCreate={() => setViewMode('create')}
            selectedPromptId={currentPrompt?.id}
            loadingPromptId={loadingPromptId}
            className="min-h-[500px]"
          />
        );
    }
  };

  const getDialogTitle = () => {
    switch (viewMode) {
      case 'create':
        return 'Create New Prompt';
      case 'edit':
        return 'Edit Prompt';
      default:
        return 'Select Prompt Template';
    }
  };

  const renderDialogHeader = () => {
    return (
      <DialogHeader>
        <div className="flex items-center gap-4">
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          {viewMode === 'list' && (
            <Button
              onClick={() => setViewMode('create')}
              size="sm"
              className="flex items-center gap-2 mr-10"
            >
              <Plus className="size-4" />
              New Prompt
            </Button>
          )}
        </div>
      </DialogHeader>
    );
  };

  const isEditMode = viewMode === 'edit';

  return (
    <Dialog open={open}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleOpenDialog}
        className="flex items-center gap-2"
      >
        <ChevronRight className="size-4" />
        {currentPrompt?.title || 'Select Prompt'}
      </Button>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        {renderDialogHeader()}
        <Button
          size={'icon'}
          variant={'ghost'}
          onClick={() => setOpen(false)}
          className="absolute right-4 top-6 rounded-full opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </Button>
        <div className="flex-1 overflow-y-hidden">{renderContent()}</div>
        {(viewMode === 'create' || viewMode === 'edit') && (
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex items-center gap-2"
              disabled={submitting}
            >
              ← Back to List
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleFormSubmit}
                disabled={!formValid || submitting}
              >
                {submitting
                  ? 'Saving...'
                  : isEditMode
                    ? 'Update Prompt'
                    : 'Create Prompt'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
