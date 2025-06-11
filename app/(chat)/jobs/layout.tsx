import { JobsHeader } from '@/components/jobs/jobHeader';

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full">
      <JobsHeader />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
