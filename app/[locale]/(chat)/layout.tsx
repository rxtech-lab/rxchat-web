import { cookies } from 'next/headers';

import { AppSidebar } from '@/components/app-sidebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { auth } from '../(auth)/auth';
import Script from 'next/script';
import { AppDocumentsSidebar } from '@/components/sidebar-documents';
import { RightSidebarProvider } from '@/components/ui/right-sidebar';

export const experimental_ppr = true;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get('sidebar:state')?.value !== 'true';
  const isRightCollapsed =
    cookieStore.get('right-sidebar:state')?.value !== 'true';

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <RightSidebarProvider defaultOpen={!isRightCollapsed}>
        <SidebarProvider defaultOpen={!isCollapsed}>
          <div className="flex h-screen w-full">
            <AppSidebar user={session?.user} />
            <SidebarInset className="flex-1">{children}</SidebarInset>
            <AppDocumentsSidebar user={session?.user} />
          </div>
        </SidebarProvider>
      </RightSidebarProvider>
    </>
  );
}
