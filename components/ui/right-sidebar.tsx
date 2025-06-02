'use client';

import * as React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const RIGHT_SIDEBAR_COOKIE_NAME = 'right-sidebar:state';
const RIGHT_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const RIGHT_SIDEBAR_WIDTH = '16rem';
const RIGHT_SIDEBAR_WIDTH_MOBILE = '18rem';
const RIGHT_SIDEBAR_KEYBOARD_SHORTCUT = 'd';

type RightSidebarContext = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const RightSidebarContext = React.createContext<RightSidebarContext | null>(
  null,
);

export function useRightSidebar() {
  const context = React.useContext(RightSidebarContext);
  if (!context) {
    throw new Error(
      'useRightSidebar must be used within a RightSidebarProvider.',
    );
  }

  return context;
}

export const RightSidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }
>(
  (
    {
      defaultOpen = false,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const isMobile = useIsMobile();
    const [openMobile, setOpenMobile] = React.useState(false);

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(defaultOpen);
    const open = openProp ?? _open;
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === 'function' ? value(open) : value;
        if (setOpenProp) {
          setOpenProp(openState);
        } else {
          _setOpen(openState);
        }

        // This sets the cookie to keep the sidebar state.
        document.cookie = `${RIGHT_SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${RIGHT_SIDEBAR_COOKIE_MAX_AGE}`;
      },
      [setOpenProp, open],
    );

    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((open) => !open)
        : setOpen((open) => !open);
    }, [isMobile, setOpen, setOpenMobile]);

    // Adds a keyboard shortcut to toggle the sidebar.
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (
          event.key === RIGHT_SIDEBAR_KEYBOARD_SHORTCUT &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          toggleSidebar();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleSidebar]);

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? 'expanded' : 'collapsed';

    const contextValue = React.useMemo<RightSidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      }),
      [
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
      ],
    );

    return (
      <RightSidebarContext.Provider value={contextValue}>
        <div
          style={
            {
              '--right-sidebar-width': RIGHT_SIDEBAR_WIDTH,
              ...style,
            } as React.CSSProperties
          }
          className={cn('group/right-sidebar-wrapper', className)}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </RightSidebarContext.Provider>
    );
  },
);
RightSidebarProvider.displayName = 'RightSidebarProvider';

export const RightSidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    collapsible?: 'offcanvas' | 'none';
  }
>(({ collapsible = 'offcanvas', className, children, ...props }, ref) => {
  const { isMobile, state, openMobile, setOpenMobile } = useRightSidebar();

  if (collapsible === 'none') {
    return (
      <div
        className={cn(
          'flex h-full w-[--right-sidebar-width] flex-col bg-sidebar text-sidebar-foreground',
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="right-sidebar"
          data-mobile="true"
          className="w-[--right-sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={
            {
              '--right-sidebar-width': RIGHT_SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side="right"
        >
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        'group/right-sidebar hidden md:block text-sidebar-foreground',
        'h-screen w-[--right-sidebar-width] bg-sidebar border-l border-sidebar-border',
        'transition-all duration-200 ease-linear',
        state === 'collapsed' &&
          collapsible === 'offcanvas' &&
          'w-0 border-l-0 overflow-hidden',
        className,
      )}
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-side="right"
      {...props}
    >
      <div className="flex h-full w-full flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
});
RightSidebar.displayName = 'RightSidebar';

export const RightSidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'main'>
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        'relative flex min-h-svh flex-1 flex-col bg-background',
        className,
      )}
      {...props}
    />
  );
});
RightSidebarInset.displayName = 'RightSidebarInset';
