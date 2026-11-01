import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { NotificationsMenu } from './NotificationsMenu';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

const COLLAPSED_KEY = 'sidebar_collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1');
      } catch {
        // Private mode: the choice just isn't remembered
      }
      return !value;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <main className={cn('min-h-screen transition-[margin] duration-300 ease-out', collapsed ? 'ml-[4.5rem]' : 'ml-64')}>
        {/* Frosted top bar */}
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 px-8">
          <div className="min-w-0">
            {title && <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{title}</h1>}
          </div>
          <div className="flex items-center gap-2">
            <NotificationsMenu />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
