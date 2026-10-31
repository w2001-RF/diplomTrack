import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Ticket, 
  FileText, 
  Bell, 
  Users, 
  LogOut,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  User,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { UserRole } from '@/constants/roles';

type AppRole = UserRole;

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', icon: <LayoutDashboard size={20} />, path: '/', roles: [UserRole.AGENT] },
  { label: 'Tableau de bord', icon: <LayoutDashboard size={20} />, path: '/admin', roles: [UserRole.ADMIN] },
  { label: 'Dossiers', icon: <Ticket size={20} />, path: '/dossiers', roles: [UserRole.AGENT, UserRole.ADMIN] },
  { label: 'Étudiants', icon: <Users size={20} />, path: '/students', roles: [UserRole.AGENT, UserRole.ADMIN] },
  { label: 'Notifications', icon: <Bell size={20} />, path: '/agent-notifications', roles: [UserRole.AGENT, UserRole.ADMIN] },
  { label: 'Mon Profil', icon: <User size={20} />, path: '/profile', roles: [UserRole.AGENT, UserRole.ADMIN] },
  { label: 'Mon dossier', icon: <FileText size={20} />, path: '/my-dossier', roles: [UserRole.STUDENT] },
  { label: 'Notifications', icon: <Bell size={20} />, path: '/notifications', roles: [UserRole.STUDENT] },
  { label: 'Gestion Utilisateurs', icon: <Users size={20} />, path: '/users', roles: [UserRole.ADMIN] },
  { label: 'Configuration', icon: <Settings size={20} />, path: '/settings', roles: [UserRole.ADMIN] },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  
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
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap size={24} />
        </div>
        {!collapsed && (
          <div className="flex flex-col animate-fade-in">
            <span className="font-semibold text-sidebar-foreground">DiplomTrack</span>
            <span className="text-xs text-sidebar-foreground/60">ENSA - Ibn Tofail</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {item.icon}
              {!collapsed && (
                <span className="text-sm font-medium animate-fade-in">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/50",
          collapsed && "justify-center"
        )}>
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-semibold">
            {getRoleInitial(currentRole)}
          </div>
          {!collapsed && (
            <div className="flex flex-col animate-fade-in">
              <span className="text-sm font-medium text-sidebar-foreground">
                {getRoleLabel(currentRole)}
              </span>
              <span className="text-xs text-sidebar-foreground/60 truncate max-w-[140px]">
                {user?.email || 'Connecté'}
              </span>
            </div>
          )}
        </div>

        <Button 
          variant="ghost" 
          onClick={handleSignOut}
          className={cn(
            "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center px-0" : "justify-start"
          )}
        >
          <LogOut size={18} />
          {!collapsed && <span className="ml-2">Déconnexion</span>}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </Button>
      </div>
    </aside>
  );
}
