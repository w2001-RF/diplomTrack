import { useEffect, useState, ReactNode } from 'react';
import type { AuthUser } from '@/lib/api/types';
import { api } from '@/lib/api';
import { AuthContext, TOKEN_KEY, type AppRole } from './auth.context';
import { UserRole } from '@/constants/roles';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustResetPassword, setMustResetPassword] = useState(false);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await api.data.getMany<{ role: AppRole }>('user_roles', {
        filters: [{ field: 'user_id', operator: 'eq', value: userId }],
        limit: 1
      });

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      return data?.[0]?.role as AppRole | null;
    } catch (err) {
      console.error('Error fetching user role:', err);
      return null;
    }
  };

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem(TOKEN_KEY);
    
    if (token) {
      // Token exists, fetch current user and role from combined endpoint
      api.auth.getSession().then(({ session }) => {
        if (session?.user) {
          setUser(session.user);
          setRole((session.user.role as UserRole) || null);
          setMustResetPassword(session.user.must_reset_password || false);
          setLoading(false);
        } else {
          // Token invalid or expired
          localStorage.removeItem(TOKEN_KEY);
          setUser(null);
          setRole(null);
          setMustResetPassword(false);
          setLoading(false);
        }
      }).catch(err => {
        console.error('Error fetching session:', err);
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setRole(null);
        setMustResetPassword(false);
        setLoading(false);
      });
    } else {
      // No token, user is not authenticated
      setUser(null);
      setRole(null);
      setMustResetPassword(false);
      setLoading(false);
    }
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await api.auth.signUp({
      email,
      password,
      fullName
    });

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { user: authUser, error } = await api.auth.signIn({
        email,
        password
      });

      if (error) {
        return { error: error as Error };
      }

      if (authUser) {
        setUser(authUser);
        setRole((authUser.role as UserRole) || null);
        setMustResetPassword(authUser.must_reset_password || false);
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await api.auth.signOut();
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setRole(null);
    setMustResetPassword(false);
  };

  const resetPassword = async (newPassword: string) => {
    try {

      const data = await api.auth.resetPassword(newPassword);

      if (!data?.error && user) {
        setUser({ ...user, must_reset_password: false });
        setMustResetPassword(false);
      }

      return data;
    } catch (err) {
      return { 
        error: err instanceof Error ? err : new Error('Une erreur est survenue') 
      };
    }
  };

  const uploadProfileImage = async (file: File) => {
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      const { data, error } = await api.auth.uploadProfileImage(Number(user.id), file);
      
      if (error) {
        return { error: error as Error };
      }

      // Mettre à jour l'utilisateur local
      if (data && user) {
        setUser({ ...user, profile_image: data.profile_image });
      }

      return { error: null, data };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const deleteProfileImage = async () => {
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      const { error } = await api.auth.deleteProfileImage(Number(user.id));
      
      if (error) {
        return { error: error as Error };
      }

      // Mettre à jour l'utilisateur local
      if (user) {
        setUser({ ...user, profile_image: null });
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const getProfileImageUrl = () => {
    if (!user) return null;
    return api.auth.getProfileImageUrl(Number(user.id));
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user && !!localStorage.getItem(TOKEN_KEY),
      role,
      loading,
      mustResetPassword,
      signUp,
      signIn,
      signOut,
      resetPassword,
      uploadProfileImage,
      deleteProfileImage,
      getProfileImageUrl
    }}>
      {children}
    </AuthContext.Provider>
  );
};
