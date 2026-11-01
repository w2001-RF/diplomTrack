// Generic API Response types

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  count?: number;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}

export interface FilterParams {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is';
  value: unknown;
}

export interface QueryParams {
  filters?: FilterParams[];
  sort?: SortParams[];
  pagination?: PaginationParams;
  select?: string[];
  limit?: number;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  role?: 'student' | 'agent' | 'admin';
  is_active?: boolean;
  must_reset_password?: boolean;
  profile_image?: string | null;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: AuthUser;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  fullName?: string;
  metadata?: Record<string, unknown>;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser | null;
  session: AuthSession | null;
  error: ApiError | null;
}
