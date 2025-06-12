'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { JobResult as JobResultType } from '@/lib/db/schema';
import {
  Calendar,
  Clock,
  MoreVertical,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock8,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useState } from 'react';
import { deleteJobResultAction } from '@/app/(chat)/jobs/[id]/results/actions';
import { toast } from 'sonner';
import { OnStepView } from '@/lib/workflow/onstep-view';
import { OnStepSchema } from '@/lib/workflow/types';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';

interface JobResultCardProps {
  jobResult: JobResultType;
  onResultUpdate?: () => void;
  showWorkflow?: boolean;
}

/**
 * Job result card component displaying result information with workflow view
 */
export function JobResultCard({
  jobResult,
  onResultUpdate,
  showWorkflow = false,
}: JobResultCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [workflowExpanded, setWorkflowExpanded] = useState(false);

  const getStatusColor = () => {
    switch (jobResult.status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = () => {
    switch (jobResult.status) {
      case 'completed':
        return <CheckCircle className="size-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="size-4 text-red-600" />;
      case 'pending':
      default:
        return <Clock8 className="size-4 text-yellow-600 animate-pulse" />;
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this job result? This action cannot be undone.\nResult #${jobResult.id.slice(0, 8)} will be permanently removed.`,
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);

    const deletePromise = deleteJobResultAction({ id: jobResult.id });

    toast.promise(
      deletePromise.finally(() => {
        setIsDeleting(false);
      }),
      {
        loading: 'Deleting job result...',
        success: (result) => {
          if (result.success) {
            // Use callback if provided, otherwise refresh the page
            if (onResultUpdate) {
              onResultUpdate();
            } else {
              router.refresh();
            }
            return result.message;
          }
          throw new Error(result.message);
        },
        error: (error) => error.message || 'Failed to delete job result',
      },
    );
  };

  // Parse workflow data if present
  let workflowData = null;
  if (jobResult.result && typeof jobResult.result === 'object') {
    try {
      // Try to parse as OnStep data
      const parsedResult = OnStepSchema.safeParse(jobResult.result);
      if (parsedResult.success) {
        workflowData = parsedResult.data;
      }
    } catch (error) {
      console.warn('Failed to parse workflow data:', error);
    }
  }

  // Format JSON for Monaco editor
  const formattedResultData = jobResult.result
    ? JSON.stringify(jobResult.result, null, 2)
    : 'No result data available';

  return (
    <Card
      className={`relative transition-all duration-200 hover:shadow-md ${isDeleting ? 'pointer-events-none opacity-75' : ''}`}
    >
      {/* Loading overlay */}
      {isDeleting && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="size-8 animate-spin text-gray-600" />
            <span className="text-sm text-gray-600 font-medium">
              Deleting...
            </span>
          </div>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {getStatusIcon()}
                Result #{jobResult.id.slice(0, 8)}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={getStatusColor()}>
                  {jobResult.status.toUpperCase()}
                </Badge>
                {workflowData && (
                  <Badge
                    variant="outline"
                    className="bg-blue-100 text-blue-800 border-blue-200"
                  >
                    WORKFLOW
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                disabled={isDeleting}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setIsDetailsDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Eye className="size-4" />
                Show Details
              </DropdownMenuItem>
              {workflowData && (
                <DropdownMenuItem
                  onClick={() => setWorkflowExpanded(!workflowExpanded)}
                  className="flex items-center gap-2"
                >
                  {workflowExpanded ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                  {workflowExpanded ? 'Hide Workflow' : 'Show Workflow'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 text-red-600 focus:text-red-600"
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Delete Result
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="size-4" />
              <span>
                Created:{' '}
                {dayjs(jobResult.createdAt).format('MMM D, YYYY h:mm A')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="size-4" />
              <span>
                Updated:{' '}
                {dayjs(jobResult.updatedAt).format('MMM D, YYYY h:mm A')}
              </span>
            </div>
          </div>

          {(jobResult.reason as any) && (
            <div className="p-3 bg-gray-50 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-1">
                Reason:
              </h4>
              <p className="text-sm text-gray-600">{jobResult.reason}</p>
            </div>
          )}

          {/* Workflow View */}
          {workflowData && workflowExpanded && (
            <div className="border rounded-lg p-4 bg-white">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Workflow Execution:
              </h4>
              <div className="max-h-96 overflow-auto">
                <OnStepView
                  onStep={workflowData}
                  showMainInfo={true}
                  className="h-full"
                />
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2 pt-3 border-t border-gray-200">
            <Dialog
              open={isDetailsDialogOpen}
              onOpenChange={setIsDetailsDialogOpen}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={isDeleting}
                >
                  <Eye className="size-4 mr-1" />
                  Show Details
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>
                    Job Result Details - #{jobResult.id.slice(0, 8)}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0">
                  <div className="h-[60vh] border rounded-md overflow-hidden">
                    <Editor
                      height="100%"
                      defaultLanguage="json"
                      value={formattedResultData}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        wordWrap: 'on',
                        automaticLayout: true,
                      }}
                      theme="vs-light"
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            {workflowData && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWorkflowExpanded(!workflowExpanded)}
                className="flex-1"
                disabled={isDeleting}
              >
                {workflowExpanded ? (
                  <EyeOff className="size-4 mr-1" />
                ) : (
                  <Eye className="size-4 mr-1" />
                )}
                {workflowExpanded ? 'Hide' : 'Show'} Workflow
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
