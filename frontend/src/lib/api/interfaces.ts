// Abstract interfaces for API operations. Hooks depend on these, not on a
// concrete adapter, so the backend can be swapped by writing a new adapter.

import type {
  ApiResponse,
  AuthResponse,
  SignUpCredentials,
  SignInCredentials,
  AuthUser,
  AuthSession,
  QueryParams,
  FilterParams,
} from './types';
import type { RequestOptions } from './http';

export type CustomRequestOptions = Pick<RequestOptions, 'method' | 'body' | 'headers' | 'queryParams' | 'query'>;

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  total: number;
  results: unknown[];
}

/**
 * Resource operations. `resource` is a path under the API base URL
 * (e.g. 'tickets', 'admin/users').
 */
export interface IDataService {
  /**
   * Call an endpoint that does not fit the CRUD helpers below
   */
  customRequest<T>(endpoint: string, options?: CustomRequestOptions): Promise<ApiResponse<T>>;

  /**
   * GET /<resource>/<id>
   */
  getOne<T = unknown>(resource: string, id: string, select?: string[]): Promise<ApiResponse<T>>;

  /**
   * GET /<resource> with optional filtering, sorting, and pagination
   */
  getMany<T = unknown>(resource: string, params?: QueryParams): Promise<ApiResponse<T[]>>;

  /**
   * POST /<resource>
   */
  create<T = unknown>(resource: string, data: Partial<T>): Promise<ApiResponse<T>>;

  /**
   * POST /<resource>/bulk
   */
  createMany<T = unknown>(resource: string, data: Partial<T>[]): Promise<ApiResponse<T[]>>;

  /**
   * POST /<resource>/import
   */
  import(resource: string, data: unknown): Promise<ApiResponse<ImportResult>>;

  /**
   * PUT or PATCH /<resource>/<id>
   */
  update<T = unknown>(resource: string, id: string, data: Partial<T>, method?: 'PUT' | 'PATCH'): Promise<ApiResponse<T>>;

  /**
   * DELETE /<resource>/<id>
   */
  delete(resource: string, id: string): Promise<ApiResponse<null>>;

  /**
   * DELETE /<resource>/bulk with filters
   */
  deleteMany(resource: string, filters?: FilterParams[]): Promise<ApiResponse<null>>;
}

/**
 * Authentication service interface
 */
export interface IAuthService {
  /**
   * Get current session
   */
  getSession(): Promise<{ session: AuthSession | null; error: Error | null }>;

  /**
   * Get current user
   */
  getUser(): Promise<{ user: AuthUser | null; error: Error | null }>;

  /**
   * Sign up a new user
   */
  signUp(credentials: SignUpCredentials): Promise<AuthResponse>;

  /**
   * Sign in an existing user
   */
  signIn(credentials: SignInCredentials): Promise<AuthResponse>;

  /**
   * Sign out the current user
   */
  signOut(): Promise<{ error: Error | null }>;

  /**
   * Change the current user's password
   */
  resetPassword(newPassword: string): Promise<{ data: Record<string, unknown> | null; error: Error | null }>;

  /**
   * Upload profile image
   */
  uploadProfileImage(userId: number, file: File): Promise<ApiResponse<{ profile_image: string }>>;

  /**
   * Delete profile image
   */
  deleteProfileImage(userId: number): Promise<ApiResponse<null>>;

  /**
   * Get profile image
   */
  getProfileImageUrl(userId: number): string;

  /**
   * Subscribe to auth state changes (SIGNED_IN, SIGNED_UP, SIGNED_OUT, SESSION_EXPIRED)
   */
  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void
  ): { unsubscribe: () => void };
}

/**
 * Main API client interface combining all services
 */
export interface IApiClient {
  data: IDataService;
  auth: IAuthService;
}
