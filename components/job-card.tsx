'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Job as JobType } from '@/lib/db/schema';
import cronstrue from 'cronstrue';
import {
  Calendar,
  Clock,
  FileText,
  MoreVertical,
  Play,
  Square,
  Trash2,
  Eye,
  Loader2,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  deleteJobAction,
  updateJobRunningStatusAction,
  triggerJobAction,
} from '@/app/(chat)/jobs/actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { DocumentViewerDialog } from './document-viewer-dialog';

interface JobCardProps {
  job: JobType;
  onJobUpdate?: () => void;
  isSelected?: boolean;
  onSelect?: (jobId: string) => void;
  selectionMode?: boolean;
}

/**
 * Job card component displaying job information with action buttons
 */
export function JobCard({
  job,
  onJobUpdate,
  isSelected = false,
  onSelect,
  selectionMode = false,
}: JobCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const router = useRouter();

  const getStatusColor = () => {
    switch (job.status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getRunningStatusColor = () => {
    switch (job.runningStatus) {
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'stopped':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleDelete = async () => {
    const confirm = window.confirm('Are you sure you want to delete this job?');
    if (!confirm) return;

    setIsDeleting(true);

    const deletePromise = deleteJobAction({ id: job.id });

    toast.promise(
      deletePromise.finally(() => {
        setIsDeleting(false);
        router.refresh();
      }),
      {
        loading: 'Deleting job...',
        success: (result) => {
          if (result.success) {
            onJobUpdate?.();
            return result.message;
          }
          throw new Error(result.message);
        },
        error: (error) => error.message || 'Failed to delete job',
      },
    );
  };

  const handleToggleRunningStatus = async () => {
    setIsUpdatingStatus(true);

    const newStatus = job.runningStatus === 'running' ? 'stopped' : 'running';
    const updatePromise = updateJobRunningStatusAction({
      id: job.id,
      runningStatus: newStatus,
    });

    toast.promise(
      updatePromise.finally(() => {
        setIsUpdatingStatus(false);
      }),
      {
        loading: `${newStatus === 'running' ? 'Starting' : 'Stopping'} job...`,
        success: (result) => {
          if (result.success) {
            onJobUpdate?.();
            return result.message;
          }
          throw new Error(result.message);
        },
        error: (error) => error.message || 'Failed to update job status',
      },
    );
  };

  const handleTrigger = async () => {
    setIsTriggering(true);

    const triggerPromise = triggerJobAction({ id: job.id });

    toast.promise(
      triggerPromise.finally(() => {
        setIsTriggering(false);
      }),
      {
        loading: 'Triggering job...',
        success: (result) => {
          if (result.success) {
            onJobUpdate?.();
            return result.message;
          }
          throw new Error(result.message);
        },
        error: (error) => error.message || 'Failed to trigger job',
      },
    );
  };

  const handleCardClick = () => {
    if (selectionMode && onSelect) {
      onSelect(job.id);
    } else {
      // Navigate to results page when not in selection mode
      router.push(`/jobs/${job.id}/results`);
    }
  };

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md cursor-pointer',
        selectionMode && 'hover:bg-gray-50',
        isSelected && 'ring-2 ring-blue-500 bg-blue-50',
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {selectionMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelect?.(job.id)}
                className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="size-5 text-gray-600" />
                Job #{job.id.slice(0, 8)}
              </CardTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className={getStatusColor()}>
                  {job.status.toUpperCase()}
                </Badge>
                <Badge variant="outline" className={getRunningStatusColor()}>
                  {job.runningStatus === 'running' ? (
                    <>
                      <Loader2 className="size-3 mr-1 animate-spin" />
                      RUNNING
                    </>
                  ) : (
                    'STOPPED'
                  )}
                </Badge>
              </div>
            </div>
          </div>

          {!selectionMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DocumentViewerDialog documentId={job.documentId}>
                  <DropdownMenuItem
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={(e) => e.preventDefault()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Eye className="size-4" />
                    View Document
                  </DropdownMenuItem>
                </DocumentViewerDialog>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  disabled={isDeleting}
                  className="flex items-center gap-2 text-red-600 focus:text-red-600"
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete Job
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {/* Document ID */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="size-4" />
            <span>Document: {job.documentId.slice(0, 8)}...</span>
          </div>

          {/* Job Type and Cron */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge
                variant="outline"
                className="bg-purple-100 text-purple-800 border-purple-200 text-xs"
              >
                {job.jobTriggerType.toUpperCase()}
              </Badge>
            </div>
            {job.cron && (
              <div className="space-y-1">
                <div className="text-xs text-gray-700 font-medium">
                  {(() => {
                    try {
                      return cronstrue.toString(job.cron);
                    } catch (error) {
                      return 'Invalid cron expression';
                    }
                  })()}
                </div>
                <div className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border">
                  {job.cron}
                </div>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="size-4" />
              <span>
                Created: {new Date(job.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="size-4" />
              <span>
                Updated: {new Date(job.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions for non-selection mode */}
        {!selectionMode && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleTrigger();
              }}
              disabled={isTriggering}
              className="flex-1 text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300"
            >
              {isTriggering ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Zap className="size-4 mr-1" />
              )}
              Trigger
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleRunningStatus();
              }}
              disabled={isUpdatingStatus}
              className={cn(
                'flex-1',
                job.runningStatus === 'running'
                  ? 'text-red-600 hover:text-red-700 border-red-200 hover:border-red-300'
                  : 'text-green-600 hover:text-green-700 border-green-200 hover:border-green-300',
              )}
            >
              {isUpdatingStatus ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : job.runningStatus === 'running' ? (
                <Square className="size-4 mr-1" />
              ) : (
                <Play className="size-4 mr-1" />
              )}
              {job.runningStatus === 'running' ? 'Stop' : 'Start'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
