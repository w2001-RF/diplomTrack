import { ReactNode } from 'react';
import { Navigate, useLocation  } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { UserRole } from '@/constants/roles';
import { ForcePasswordResetModal } from "@/pages/ForcePasswordResetModal";

type AppRole = UserRole;

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading, mustResetPassword } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Force password reset if required (except on profile page)
  if (mustResetPassword) {
    return <ForcePasswordResetModal /> ;
  }

  // Check role if allowedRoles is specified
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect students to their dossier page, admin to admin dashboard, others to dashboard
    if (role === UserRole.STUDENT) {
      return <Navigate to="/my-dossier" replace />;
    }
    if (role === UserRole.ADMIN) {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/" replace />;
  }

  // If student tries to access root, redirect to my-dossier
  if (role === UserRole.STUDENT && window.location.pathname === '/') {
    return <Navigate to="/my-dossier" replace />;
  }

  // If admin tries to access root, redirect to admin dashboard
  if (role === UserRole.ADMIN && window.location.pathname === '/') {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};
