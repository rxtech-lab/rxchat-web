import { auth } from '@/app/(auth)/auth';
import { JobResultCard } from '@/components/job-result-card';
import { JobResultsFilter } from '@/components/job-results-filter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { JobResult } from '@/lib/db/schema';
import dayjs from 'dayjs';
import cronstrue from 'cronstrue';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getJobResults, type GetJobResults } from './actions';
import { JobControlButtons } from './job-control-buttons';
import { PageRefresher } from './page-refresher';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page?: string;
    status?: string;
    limit?: string;
  }>;
}

/**
 * Loading component for the job results page
 */
function JobResultsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Job Info Skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardContent>
        </Card>

        {/* Filters Skeleton */}
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Results Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={`result-loading-${i}-${Math.random()}`}
              className="space-y-3"
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-20 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 flex-1" />
                    <Skeleton className="h-8 flex-1" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Job results page component - Server-side rendered
 */
async function JobResultsPage({ params, searchParams }: PageProps) {
  // Check authentication on server side
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Resolve params and searchParams
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  // Parse search params
  const currentPage = Number.parseInt(resolvedSearchParams?.page || '1', 10);
  const limit = Number.parseInt(resolvedSearchParams?.limit || '20', 10);
  const status = resolvedSearchParams?.status;
  const jobId = resolvedParams?.id;

  // Fetch data on server side
  let jobData: GetJobResults | null = null;
  let error: Error | null = null;

  try {
    jobData = await getJobResults({
      jobId,
      limit,
      offset: (currentPage - 1) * limit,
      status:
        status && status !== 'all'
          ? (status as 'pending' | 'completed' | 'failed')
          : undefined,
    });
  } catch (err) {
    // Ensure error is always of type Error or null
    error = err instanceof Error ? err : new Error(String(err));
  }

  if (error || !jobData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/jobs" className="flex items-center gap-2">
                <ArrowLeft className="size-4" />
                Back to Jobs
              </Link>
            </Button>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-gray-900">Job Results</h1>
              <p className="text-gray-600">Failed to load job results</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-600 text-lg font-medium mb-2">
              Failed to Load Job Results
            </div>
            <p className="text-red-600 text-sm">
              There was an error loading the job results. Please try refreshing
              the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { jobResults, hasMore, job } = jobData;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getRunningStatusColor = (runningStatus: string) => {
    switch (runningStatus) {
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'stopped':
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDateTime = (dateString: string | Date) => {
    return dayjs(dateString).format('MMM D, YYYY h:mm A');
  };

  // Job information items configuration
  const jobInfoItems = [
    {
      label: 'Status',
      value: (
        <Badge variant="outline" className={getStatusColor(job.status)}>
          {job.status.toUpperCase()}
        </Badge>
      ),
    },
    {
      label: 'Running Status',
      value: (
        <Badge
          variant="outline"
          className={getRunningStatusColor(job.runningStatus)}
        >
          {job.runningStatus === 'running' ? (
            <>
              <Loader2 className="size-3 mr-1 animate-spin" />
              RUNNING
            </>
          ) : (
            'STOPPED'
          )}
        </Badge>
      ),
    },
    {
      label: 'Job Type',
      value: (
        <Badge
          variant="outline"
          className="bg-purple-100 text-purple-800 border-purple-200"
        >
          {job.jobTriggerType.toUpperCase()}
        </Badge>
      ),
    },
    {
      label: 'Cron Schedule',
      value: (
        <div className="space-y-1">
          {job.cron ? (
            <>
              <div className="text-sm text-gray-900">
                {(() => {
                  try {
                    return cronstrue.toString(job.cron);
                  } catch (error) {
                    return 'Invalid cron expression';
                  }
                })()}
              </div>
              <div className="text-xs text-gray-500 font-mono">{job.cron}</div>
            </>
          ) : (
            <div className="text-sm text-gray-600">Not scheduled</div>
          )}
        </div>
      ),
    },
    {
      label: 'Created',
      value: (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Calendar className="size-3" />
          {formatDateTime(job.createdAt)}
        </div>
      ),
    },
    {
      label: 'Updated',
      value: (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Clock className="size-3" />
          {formatDateTime(job.updatedAt)}
        </div>
      ),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Add PageRefresher for periodic updates */}
      <PageRefresher />

      <div className="space-y-6">
        {/* Navigation and Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm">
            <Link href="/jobs" className="flex items-center gap-2">
              <ArrowLeft className="size-4" />
              Back to Jobs
            </Link>
          </Button>
        </div>

        {/* Job Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Job Information
              <p className="text-sm text-gray-500" title={'job id'}>
                {job.id}
              </p>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {jobInfoItems.map((item, index) => (
                <div key={item.label}>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">
                    {item.label}
                  </h4>
                  {item.value}
                </div>
              ))}
            </div>

            {/* Job Control Buttons and Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 border-t border-gray-200">
              <JobControlButtons job={job} />

              {/* Filters */}
              <div className="shrink-0">
                <JobResultsFilter
                  jobId={jobId}
                  status={status}
                  resultsCount={jobResults.length}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Grid */}
        {jobResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobResults.map((result: JobResult) => (
              <JobResultCard key={result.id} jobResult={result} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="mx-auto size-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Filter className="size-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No results found
            </h3>
            <p className="text-gray-500">
              {status
                ? 'Try adjusting your filters or check back later.'
                : 'This job has not produced any results yet.'}
            </p>
          </div>
        )}

        {/* Pagination */}
        {jobResults.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {jobResults.length} result(s) on page {currentPage}
              {jobResults.length === limit && hasMore && ' (more available)'}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={currentPage === 1}
                className={
                  currentPage === 1 ? 'pointer-events-none opacity-50' : ''
                }
              >
                <Link
                  href={`/jobs/${jobId}/results?${new URLSearchParams({
                    ...(status && { status }),
                    page: (currentPage - 1).toString(),
                  }).toString()}`}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Link>
              </Button>
              <span className="flex items-center px-3 py-1 text-sm bg-gray-100 rounded">
                {currentPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={!hasMore}
                className={!hasMore ? 'pointer-events-none opacity-50' : ''}
              >
                <Link
                  href={`/jobs/${jobId}/results?${new URLSearchParams({
                    ...(status && { status }),
                    page: (currentPage + 1).toString(),
                  }).toString()}`}
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main export with Suspense wrapper
 */
export default function Page(props: PageProps) {
  return (
    <Suspense fallback={<JobResultsLoading />}>
      <JobResultsPage {...props} />
    </Suspense>
  );
}
