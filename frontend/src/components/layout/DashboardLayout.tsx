import { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { Search } from 'lucide-react';
import { NotificationsMenu } from './NotificationsMenu';
import { Input } from '@/components/ui/input';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      
      <main className="ml-64 min-h-screen transition-all duration-300">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-4">
            {title && (
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Search */
            title && (<div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                placeholder="Rechercher..." 
                className="pl-10 w-64 bg-secondary/50 border-transparent focus:border-primary/30"
              />
            </div>)}
            
            {/* Notifications */}
            <NotificationsMenu />
          </div>
        </header>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
