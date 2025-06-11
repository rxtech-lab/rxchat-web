'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Play, Square, Zap } from 'lucide-react';
import { useState } from 'react';
import { updateJobRunningStatusAction, triggerJobAction } from '../../actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface JobControlButtonsProps {
  job: {
    id: string;
    runningStatus: string;
  };
}

/**
 * Client component for job control buttons
 * Handles the interactive trigger and start/stop functionality
 */
export function JobControlButtons({ job }: JobControlButtonsProps) {
  const router = useRouter();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);

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
            // Trigger router refresh for server-side data
            router.refresh();
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
            // Trigger router refresh for server-side data
            router.refresh();
            return result.message;
          }
          throw new Error(result.message);
        },
        error: (error) => error.message || 'Failed to trigger job',
      },
    );
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleTrigger}
        disabled={isTriggering}
        className="flex items-center gap-2 text-purple-600 hover:text-purple-700 border-purple-200 hover:border-purple-300"
      >
        {isTriggering ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Zap className="size-4" />
        )}
        Trigger Job
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggleRunningStatus}
        disabled={isUpdatingStatus}
        className={`flex items-center gap-2 ${
          job.runningStatus === 'running'
            ? 'text-red-600 hover:text-red-700 border-red-200 hover:border-red-300'
            : 'text-green-600 hover:text-green-700 border-green-200 hover:border-green-300'
        }`}
      >
        {isUpdatingStatus ? (
          <Loader2 className="size-4 animate-spin" />
        ) : job.runningStatus === 'running' ? (
          <Square className="size-4" />
        ) : (
          <Play className="size-4" />
        )}
        {job.runningStatus === 'running' ? 'Stop Job' : 'Start Job'}
      </Button>
    </div>
  );
}
