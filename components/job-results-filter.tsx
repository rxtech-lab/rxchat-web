'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface JobResultsFilterProps {
  jobId: string;
  status?: string;
  resultsCount: number;
}

/**
 * Client component for filtering job results
 * Handles the interactive filter controls and navigation
 */
export function JobResultsFilter({
  jobId,
  status,
  resultsCount,
}: JobResultsFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'all') {
      params.delete('status');
    } else {
      params.set('status', value);
    }

    params.delete('page'); // Reset page when filter changes
    router.push(`/jobs/${jobId}/results?${params.toString()}`);
};

  return (
    <div className="">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3">
          <Select value={status || 'all'} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-gray-600">
          {resultsCount} result(s) found
        </div>
      </div>
    </div>
  );
}
