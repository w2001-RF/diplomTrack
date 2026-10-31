import { createContext } from 'react';
import { UserRole } from '@/constants/roles';
import type { AuthUser } from '@/lib/api/types';

export type AppRole = UserRole;

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  role: AppRole | null;
  loading: boolean;
  mustResetPassword: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (newPassword: string) => Promise<{ data: Record<string, unknown> | null; error: Error | null }>;
  uploadProfileImage: (file: File) => Promise<{ error: Error | null; data?: { profile_image: string } }>;
  deleteProfileImage: () => Promise<{ error: Error | null }>;
  getProfileImageUrl: () => string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const TOKEN_KEY = 'auth_token';
