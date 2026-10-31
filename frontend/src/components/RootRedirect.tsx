import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/constants/roles';

export const RootRedirect = () => {
  const { user, loading } = useAuth();

  // Prevent flicker while auth state is resolving
  if (loading) {
    return null; // or a spinner
  }

  // 🚫 Not authenticated → login
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // ✅ Authenticated → role-based redirect
  switch (user.role) {
    case UserRole.ADMIN:
      return <Navigate to="/admin" replace />;
    case UserRole.AGENT:
      return <Navigate to="/agent" replace />;
    case UserRole.STUDENT:
      return <Navigate to="/my-dossier" replace />;
    default:
      return <Navigate to="/auth" replace />;
  }
};
