import { auth } from '@/app/(auth)/auth';
import { JobsList } from '@/components/jobs-list';
import { getJobs } from './actions';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { redirect } from 'next/navigation';
import { Calendar, Clock, FileText } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    runningStatus?: string;
    search?: string;
    limit?: string;
  }>;
}

/**
 * Loading component for the jobs page
 */
function JobsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            <Skeleton className="h-10 flex-1 max-w-md" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>

        {/* Jobs Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={`job-loading-${i}-${Math.random()}`}
              className="space-y-3"
            >
              <div className="border rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="size-5 text-gray-300" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-gray-300" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 text-gray-300" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-gray-300" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Jobs page component
 */
async function JobsPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const params = await searchParams;
  const currentPage = Number.parseInt(params.page || '1', 10);
  const limit = Number.parseInt(params.limit || '20', 10);
  const status =
    params.status && params.status !== 'all' ? params.status : undefined;
  const runningStatus =
    params.runningStatus && params.runningStatus !== 'all'
      ? params.runningStatus
      : undefined;
  const search = params.search || '';

  try {
    const { jobs, hasMore } = await getJobs({
      limit,
      status: status as any,
      runningStatus: runningStatus as any,
    });

    // Filter jobs by search query (simple client-side filtering for demo)
    const filteredJobs = search
      ? jobs.filter(
          (job) =>
            job.id.toLowerCase().includes(search.toLowerCase()) ||
            job.documentId.toLowerCase().includes(search.toLowerCase()),
        )
      : jobs;

    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Job Management</h1>
            <p className="text-gray-600">
              Manage and monitor your workflow jobs, track their status, and
              view results.
            </p>
          </div>

          {/* Jobs List */}
          <JobsList
            initialJobs={filteredJobs}
            initialHasMore={hasMore}
            currentPage={currentPage}
            limit={limit}
            initialFilters={{
              status: params.status || 'all',
              runningStatus: params.runningStatus || 'all',
              search: search,
            }}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Failed to load jobs:', error);

    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Job Management</h1>
            <p className="text-gray-600">
              Manage and monitor your workflow jobs, track their status, and
              view results.
            </p>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-600 text-lg font-medium mb-2">
              Failed to Load Jobs
            </div>
            <p className="text-red-600 text-sm">
              There was an error loading your jobs. Please try refreshing the
              page.
            </p>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Main export with Suspense wrapper
 */
export default function Page(props: PageProps) {
  return (
    <Suspense fallback={<JobsLoading />}>
      <JobsPage {...props} />
    </Suspense>
  );
}
