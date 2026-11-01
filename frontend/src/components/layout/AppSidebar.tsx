import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Ticket, 
  FileText, 
  Bell, 
  Users, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandLockup, BrandMark } from '@/components/brand/Brand';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { UserRole } from '@/constants/roles';

type AppRole = UserRole;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: AppRole[];
  /** Other path prefixes that belong to this section, e.g. a dossier's page */
  matches?: string[];
}

const isCurrentSection = (pathname: string, item: NavItem) =>
  [item.path, ...(item.matches ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));

const navItems: NavItem[] = [
  { label: 'Tableau de bord', icon: <LayoutDashboard size={19} />, path: '/agent', roles: [UserRole.AGENT] },
  { label: 'Tableau de bord', icon: <LayoutDashboard size={19} />, path: '/admin', roles: [UserRole.ADMIN] },
  { label: 'Dossiers', icon: <Ticket size={19} />, path: '/dossiers', roles: [UserRole.AGENT, UserRole.ADMIN], matches: ['/dossier'] },
  { label: 'Étudiants', icon: <Users size={19} />, path: '/students', roles: [UserRole.AGENT, UserRole.ADMIN] },
  { label: 'Notifications', icon: <Bell size={19} />, path: '/agent-notifications', roles: [UserRole.AGENT, UserRole.ADMIN] },
  { label: 'Mon Profil', icon: <User size={19} />, path: '/profile', roles: [UserRole.AGENT, UserRole.ADMIN] },
  { label: 'Mon dossier', icon: <FileText size={19} />, path: '/my-dossier', roles: [UserRole.STUDENT] },
  { label: 'Notifications', icon: <Bell size={19} />, path: '/notifications', roles: [UserRole.STUDENT] },
  { label: 'Gestion Utilisateurs', icon: <Users size={19} />, path: '/users', roles: [UserRole.ADMIN] },
  { label: 'Configuration', icon: <Settings size={19} />, path: '/settings', roles: [UserRole.ADMIN] },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function AppSidebar({ collapsed, onToggleCollapsed }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  
  const currentRole: AppRole = role || UserRole.STUDENT;
  const filteredNavItems = navItems.filter(item => item.roles.includes(currentRole));

  const handleSignOut = async () => {
    await signOut();
    toast.success('Déconnexion réussie');
    navigate('/auth');
  };

  const getRoleLabel = (r: AppRole) => {
    switch (r) {
      case UserRole.STUDENT: return 'Étudiant';
      case UserRole.AGENT: return 'Agent BFC';
      case UserRole.ADMIN: return 'Administrateur';
    }
  };

  const getRoleInitial = (r: AppRole) => {
    switch (r) {
      case UserRole.STUDENT: return 'E';
      case UserRole.AGENT: return 'A';
      case UserRole.ADMIN: return 'S';
    }
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      {/* Faint zellige lattice behind the navigation */}
      <div aria-hidden className="bg-zellige pointer-events-none absolute inset-0 opacity-[0.04]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brand-crimson/20 blur-3xl" />

      {/* Header */}
      <div className={cn("relative flex h-16 items-center border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        {collapsed ? <BrandMark inverted className="h-9 w-9" /> : <BrandLockup inverted subtitle="ENSA · Université Ibn Tofaïl" />}
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 space-y-0.5 overflow-y-auto p-3">
        {filteredNavItems.map((item) => {
          const isActive = isCurrentSection(location.pathname, item);
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-200",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-white/10 font-semibold text-white"
                  : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-white"
              )}
            >
              {/* Crimson marker on the current page */}
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand-crimson transition-opacity",
                  isActive ? "opacity-100" : "opacity-0"
                )}
              />
              {item.icon}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="relative space-y-1 border-t border-sidebar-border p-3">
        <div className={cn("flex items-center gap-3 rounded-xl px-2 py-2", collapsed && "justify-center px-0")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white to-white/70 text-sm font-semibold text-brand-deep">
            {getRoleInitial(currentRole)}
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-white">{getRoleLabel(currentRole)}</span>
              <span className="truncate text-xs text-sidebar-foreground/60">{user?.email || 'Connecté'}</span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          onClick={handleSignOut}
          title={collapsed ? 'Déconnexion' : undefined}
          className={cn(
            "h-9 w-full rounded-xl text-sidebar-foreground/75 hover:bg-white/5 hover:text-white",
            collapsed ? "justify-center px-0" : "justify-start px-3"
          )}
        >
          <LogOut size={18} />
          {collapsed ? <span className="sr-only">Déconnexion</span> : <span>Déconnexion</span>}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          className="h-9 w-full rounded-xl text-sidebar-foreground/60 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </Button>
      </div>
    </aside>
  );
}
