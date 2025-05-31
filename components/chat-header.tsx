'use client';

import { useRouter } from 'next/navigation';
import { useWindowSize } from 'usehooks-ts';

import { ModelSelector } from '@/components/model-selector';
import { SidebarToggle } from '@/components/sidebar-toggle';
import { Button } from '@/components/ui/button';
import type { Providers } from '@/lib/ai/models';
import type { Session } from 'next-auth';
import { memo, useState } from 'react';
import { PlusIcon, FileIcon } from './icons';
import { useSidebar } from './ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { type VisibilityType, VisibilitySelector } from './visibility-selector';
import { SidebarDocuments } from './sidebar-documents';

function PureChatHeader({
  chatId,
  selectedModelId,
  selectedVisibilityType,
  isReadonly,
  session,
  providers,
}: {
  chatId: string;
  selectedModelId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  providers: Providers;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);

  const { width: windowWidth } = useWindowSize();

  return (
    <>
      <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2">
        <SidebarToggle />

        {(!open || windowWidth < 768) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                className="order-2 md:order-1 md:px-2 px-2 md:h-fit ml-auto md:ml-0"
                onClick={() => {
                  router.push('/');
                  router.refresh();
                }}
              >
                <PlusIcon />
                <span className="md:sr-only">New Chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>New Chat</TooltipContent>
          </Tooltip>
        )}

        {/* Documents Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="order-3 md:order-2 md:px-2 px-2 md:h-fit"
              onClick={() => setIsDocumentsOpen(true)}
            >
              <FileIcon />
              <span className="md:sr-only">Documents</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Documents</TooltipContent>
        </Tooltip>

        {!isReadonly && providers && (
          <ModelSelector
            session={session}
            providers={providers}
            selectedModelId={selectedModelId}
            className="order-1 md:order-3"
          />
        )}

        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            className="order-1 md:order-4"
          />
        )}
      </header>

      {/* Documents Sidebar */}
      <SidebarDocuments
        user={session.user}
        isOpen={isDocumentsOpen}
        onOpenChange={setIsDocumentsOpen}
      />
    </>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return prevProps.selectedModelId === nextProps.selectedModelId;
});
