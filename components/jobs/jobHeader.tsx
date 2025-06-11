import { SidebarToggle } from '../sidebar-toggle';

export function JobsHeader() {
  return (
    <header className="flex sticky top-0 bg-background py-1.5 items-center px-2 md:px-2 gap-2">
      <SidebarToggle />
    </header>
  );
}
