'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { deleteJobsAction } from '@/app/(chat)/jobs/actions';
import type { Job as JobType } from '@/lib/db/schema';
import { useDebounce } from '@uidotdev/usehooks';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { JobCard } from './job-card';

interface JobsListProps {
  initialJobs: JobType[];
  initialHasMore: boolean;
  currentPage: number;
  limit: number;
  initialFilters: {
    status: string;
    runningStatus: string;
    search: string;
  };
}

/**
 * Jobs list component with server-side pagination, filtering, and bulk operations
 */
export function JobsList({
  initialJobs,
  initialHasMore,
  currentPage,
  limit,
  initialFilters,
}: JobsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for optimistic updates
  const [jobs, setJobs] = useState<JobType[]>(initialJobs);
  const [hasMore, setHasMore] = useState(initialHasMore);

  // Filter state (controlled by URL params)
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [runningStatusFilter, setRunningStatusFilter] = useState(
    initialFilters.runningStatus,
  );
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);

  // Debounced search query
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setJobs(initialJobs);
    setHasMore(initialHasMore);
  }, [initialJobs, initialHasMore]);

  /**
   * Updates URL search params
   */
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      // Reset page when filters change (except for page navigation)
      if (
        !updates.page &&
        (updates.status !== undefined ||
          updates.runningStatus !== undefined ||
          updates.search !== undefined)
      ) {
        params.delete('page');
      }

      startTransition(() => {
        router.push(`/jobs?${params.toString()}`);
      });
    },
    [searchParams, router],
  );

  /**
   * Handles filter changes
   */
  const handleStatusFilterChange = useCallback(
    (value: string) => {
      setStatusFilter(value);
      updateSearchParams({ status: value });
    },
    [updateSearchParams],
  );

  const handleRunningStatusFilterChange = useCallback(
    (value: string) => {
      setRunningStatusFilter(value);
      updateSearchParams({ runningStatus: value });
    },
    [updateSearchParams],
  );

  // Update search params when debounced search query changes
  useEffect(() => {
    updateSearchParams({ search: debouncedSearchQuery });
  }, [debouncedSearchQuery, updateSearchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  /**
   * Handles pagination
   */
  const handlePageChange = useCallback(
    (page: number) => {
      updateSearchParams({ page: page.toString() });
    },
    [updateSearchParams],
  );

  /**
   * Handles job selection
   */
  const handleJobSelect = useCallback((jobId: string) => {
    setSelectedJobs((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(jobId)) {
        newSelection.delete(jobId);
      } else {
        newSelection.add(jobId);
      }
      return newSelection;
    });
  }, []);

  /**
   * Selects all visible jobs
   */
  const handleSelectAll = useCallback(() => {
    const allJobIds = new Set(jobs.map((job) => job.id));
    setSelectedJobs(allJobIds);
  }, [jobs]);

  /**
   * Clears all selections
   */
  const handleClearSelection = useCallback(() => {
    setSelectedJobs(new Set());
    setSelectionMode(false);
  }, []);

  /**
   * Handles bulk job deletion
   */
  const handleBulkDelete = useCallback(async () => {
    if (selectedJobs.size === 0) return;

    const deletePromise = deleteJobsAction({ ids: Array.from(selectedJobs) });

    toast.promise(deletePromise, {
      loading: `Deleting ${selectedJobs.size} job(s)...`,
      success: (result) => {
        if (result.success) {
          // Optimistically remove deleted jobs from the list
          setJobs((prev) => prev.filter((job) => !selectedJobs.has(job.id)));
          setSelectedJobs(new Set());
          setSelectionMode(false);

          // Refresh the page to ensure consistency
          router.refresh();

          return result.message;
        }
        throw new Error(result.message);
      },
      error: (error) => error.message || 'Failed to delete jobs',
    });

    await deletePromise;
  }, [selectedJobs, router]);

  /**
   * Refreshes the jobs list
   */
  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  /**
   * Handles job updates (for optimistic updates)
   */
  const handleJobUpdate = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
              <Input
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={handleStatusFilterChange}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Running Status Filter */}
            <Select
              value={runningStatusFilter}
              onValueChange={handleRunningStatusFilterChange}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by running status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Running States</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(!selectionMode)}
              className="flex items-center gap-2"
            >
              <Settings2 className="size-4" />
              {selectionMode ? 'Exit Selection' : 'Select Mode'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isPending}
              className="flex items-center gap-2"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Filter className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectionMode && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {selectedJobs.size} of {jobs.length} jobs selected
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={selectedJobs.size === jobs.length}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSelection}
                >
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={selectedJobs.size === 0}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="size-4" />
                  Delete ({selectedJobs.size})
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading State for Navigation */}
      {isPending && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading jobs...</span>
          </div>
        </div>
      )}

      {/* Jobs Grid */}
      {jobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onJobUpdate={handleJobUpdate}
              selectionMode={selectionMode}
              isSelected={selectedJobs.has(job.id)}
              onSelect={handleJobSelect}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="mx-auto size-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Filter className="size-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No jobs found
          </h3>
          <p className="text-gray-500">
            {searchQuery ||
            statusFilter !== 'all' ||
            runningStatusFilter !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'No jobs have been created yet.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {jobs.length} job(s) on page {currentPage}
          {jobs.length === limit && hasMore && ' (more available)'}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isPending}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="flex items-center px-3 py-1 text-sm bg-gray-100 rounded">
            {currentPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasMore || isPending}
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
