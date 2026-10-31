// Abstract interfaces for API operations

import { AnyRecord } from 'dns';
import type {
  ApiResponse,
  AuthResponse,
  SignUpCredentials,
  SignInCredentials,
  AuthUser,
  AuthSession,
  QueryParams,
  FilterParams,
  StorageUploadResult,
  RealtimeCallback,
  RealtimeSubscription,
  RealtimeEventType,
} from './types';

/**
 * Generic CRUD operations interface
 */
export interface IDataService {

  customRequest<T>(
    endpoint: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
      queryParams?: Record<string, string | number | boolean>;
    }
  ): Promise<ApiResponse<T>>;
  
  /**
   * Get a single record by ID
   */
  getOne<T = unknown>(table: string, id: string, select?: string[]): Promise<ApiResponse<T>>;

  /**
   * Get multiple records with optional filtering, sorting, and pagination
   */
  getMany<T = unknown>(table: string, params?: QueryParams): Promise<ApiResponse<T[]>>;

  /**
   * Create a new record
   */
  create<T = unknown>(table: string, data: Partial<T>): Promise<ApiResponse<T>>;

  /**
   * Create multiple records
   */
  createMany<T = unknown>(table: string, data: Partial<T>[]): Promise<ApiResponse<T[]>>;
  
  /**
   * Import multiple records
   */
  import<T = unknown>(table: string, data: Partial<T>[]): Promise<ApiResponse<T[]>>;

  /**
   * Update a record by ID
   */
  update<T = unknown>(table: string, id: string, data: Partial<T>, method: 'PUT' | 'PATCH'): Promise<ApiResponse<T>>;

  /**
   * Update multiple records matching filters
   */
  updateMany<T = unknown>(table: string, data: Partial<T>, params?: QueryParams): Promise<ApiResponse<T[]>>;

  /**
   * Delete a record by ID
   */
  delete(table: string, id: string): Promise<ApiResponse<null>>;

  /**
   * Delete multiple records matching filters
   */
  deleteMany(table: string, filters?: FilterParams[]): Promise<ApiResponse<null>>;

  /**
   * Execute a custom query (for complex operations)
   */
  query<R = unknown>(table: string, queryFn: (query: unknown) => unknown): Promise<ApiResponse<R>>;
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
   * Reset password
   */
  resetPassword(newPassword: string): Promise<{ data: AnyRecord | null }>;

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
   * Subscribe to auth state changes
   */
  onAuthStateChange(
    callback: (event: string, session: AuthSession | null) => void
  ): { unsubscribe: () => void };
}

/**
 * Storage service interface
 */
export interface IStorageService {
  /**
   * Upload a file
   */
  upload(
    bucket: string,
    path: string,
    file: File,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<ApiResponse<StorageUploadResult>>;

  /**
   * Download a file
   */
  download(bucket: string, path: string): Promise<ApiResponse<Blob>>;

  /**
   * Get public URL for a file
   */
  getPublicUrl(bucket: string, path: string): string;

  /**
   * Get signed URL for private file
   */
  getSignedUrl(
    bucket: string,
    path: string,
    expiresIn?: number
  ): Promise<ApiResponse<string>>;

  /**
   * Delete a file
   */
  delete(bucket: string, paths: string[]): Promise<ApiResponse<null>>;

  /**
   * List files in a bucket/folder
   */
  list(
    bucket: string,
    folder?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{ name: string; id: string }[]>>;
}

/**
 * Realtime service interface
 */
export interface IRealtimeService {
  /**
   * Subscribe to table changes
   */
  subscribe<T = unknown>(
    table: string,
    event: RealtimeEventType,
    callback: RealtimeCallback<T>,
    filter?: { column: string; value: string }
  ): RealtimeSubscription;

  /**
   * Create a channel for presence or broadcast
   */
  channel(name: string): IRealtimeChannel;
}

/**
 * Realtime channel interface
 */
export interface IRealtimeChannel {
  /**
   * Subscribe to postgres changes
   */
  onPostgresChanges<T = unknown>(
    table: string,
    event: RealtimeEventType,
    callback: RealtimeCallback<T>
  ): this;

  /**
   * Subscribe to presence
   */
  onPresence(
    event: 'sync' | 'join' | 'leave',
    callback: (payload: unknown) => void
  ): this;

  /**
   * Subscribe to broadcast
   */
  onBroadcast(event: string, callback: (payload: unknown) => void): this;

  /**
   * Track presence state
   */
  track(state: Record<string, unknown>): Promise<void>;

  /**
   * Send broadcast message
   */
  send(event: string, payload: unknown): Promise<void>;

  /**
   * Subscribe to channel
   */
  subscribe(callback?: (status: string) => void): this;

  /**
   * Unsubscribe from channel
   */
  unsubscribe(): void;
}

/**
 * Main API client interface combining all services
 */
export interface IApiClient {
  data: IDataService;
  auth: IAuthService;
  storage: IStorageService;
  realtime: IRealtimeService;
}
