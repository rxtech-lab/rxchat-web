import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ProfileTabsProps {
  currentTab: string;
}

const tabs = [
  { id: 'account', label: 'Account', href: '/profile?tab=account' },
  {
    id: 'security',
    label: 'Security',
    href: '/profile?tab=security',
    disabled: true,
  },
  {
    id: 'preferences',
    label: 'Preferences',
    href: '/profile?tab=preferences',
    disabled: true,
  },
  {
    id: 'billing',
    label: 'Billing',
    href: '/profile?tab=billing',
    disabled: true,
  },
  {
    id: 'usage',
    label: 'Usage',
    href: '/profile?tab=usage',
    disabled: true,
  },
];

/**
 * Server component for profile tab navigation using URL search parameters
 */
export function ProfileTabs({ currentTab }: ProfileTabsProps) {
  return (
    <div className="border-b border-border">
      <nav className="flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const isDisabled = tab.disabled;

          if (isDisabled) {
            return (
              <span
                key={tab.id}
                className={cn(
                  'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm cursor-not-allowed',
                  'border-transparent text-muted-foreground/50',
                )}
                aria-disabled="true"
              >
                {tab.label}
              </span>
            );
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={cn(
                'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
