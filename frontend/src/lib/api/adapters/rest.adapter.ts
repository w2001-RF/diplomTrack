// REST API adapter implementation (template for backend integration)

import { AnyRecord } from 'dns';
import type {
  IDataService,
  IAuthService,
  IStorageService,
  IRealtimeService,
  IRealtimeChannel,
  IApiClient,
} from '../interfaces';
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
} from '../types';

// Configuration interface
export interface RestApiConfig {
  baseUrl: string;
  authEndpoint?: string;
  storageEndpoint?: string;
  headers?: Record<string, string>;
  tokenKey?: string;
}

/**
 * Get auth token from storage
 */
function getAuthToken(tokenKey: string): string | null {
  return localStorage.getItem(tokenKey);
}

/**
 * Set auth token in storage
 */
function setAuthToken(tokenKey: string, token: string): void {
  localStorage.setItem(tokenKey, token);
}

/**
 * Remove auth token from storage
 */
function removeAuthToken(tokenKey: string): void {
  localStorage.removeItem(tokenKey);
}

/**
 * Build query string from params
 */
function buildQueryString(params?: QueryParams): string {
  if (!params) return '';

  const searchParams = new URLSearchParams();

  // Add filters
  if (params.filters) {
    params.filters.forEach((filter) => {
      searchParams.append(`filter[${filter.field}][${filter.operator}]`, String(filter.value));
    });
  }

  // Add sorting
  if (params.sort && params.sort.length > 0) {
    const sortStr = params.sort.map((s) => (s.direction === 'desc' ? `-${s.field}` : s.field)).join(',');
    searchParams.append('sort', sortStr);
  }

  // Add pagination
  if (params.pagination) {
    if (params.pagination.page) searchParams.append('page', String(params.pagination.page));
    if (params.pagination.limit) searchParams.append('limit', String(params.pagination.limit));
    if (params.pagination.offset) searchParams.append('offset', String(params.pagination.offset));
  }

  // Add select fields
  if (params.select && params.select.length > 0) {
    searchParams.append('select', params.select.join(','));
  }

  const queryStr = searchParams.toString();
  return queryStr ? `?${queryStr}` : '';
}

/**
 * Normalize URL by removing trailing slashes and preventing double slashes
 */
function normalizePath(baseUrl: string, ...segments: string[]): string {
  // Remove trailing slash from base
  let url = baseUrl.replace(/\/$/, '');
  
  // Add each segment, ensuring no double slashes
  segments.forEach(segment => {
    // Remove leading and trailing slashes
    if (typeof segment !== 'string') {
      segment = String(segment);
    }
    segment = segment.replace(/^\/+|\/+$/g, '');
    if (segment) {
      url = url + '/' + segment;
    }
  });
  
  return url;
}

/**
 * REST API Data Service
 */
class RestDataService implements IDataService {
  private baseUrl: string;
  private tokenKey: string;
  private headers: Record<string, string>;

  constructor(config: RestApiConfig) {
    this.baseUrl = config.baseUrl;
    this.tokenKey = config.tokenKey || 'auth_token';
    this.headers = config.headers || {};
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.headers,
    };

    const token = getAuthToken(this.tokenKey);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async customRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: any;
      headers?: Record<string, string>;
      queryParams?: Record<string, string | number | boolean>;
    } = {}
  ): Promise<ApiResponse<T>> {
    try {
      const {
        method = 'GET',
        body,
        headers: customHeaders = {},
        queryParams
      } = options;

      // Build query string if provided
      let url = normalizePath(this.baseUrl, endpoint);
      if (queryParams) {
        const searchParams = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          searchParams.append(key, String(value));
        });
        const queryStr = searchParams.toString();
        if (queryStr) url += `?${queryStr}`;
      }

      // Prepare request options
      const requestOptions: RequestInit = {
        method,
        headers: {
          ...this.getHeaders(),
          ...customHeaders,
        },
      };

      // Add body for POST, PUT, PATCH
      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        requestOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        return {
          data: null,
          error: {
            message: error.error || `HTTP ${response.status}`,
            status: response.status
          }
        };
      }

      // Handle empty responses (e.g., 204 No Content)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return { data: null as T, error: null };
      }

      const result = await response.json();
      return { data: result as T, error: null };
    } catch (error) {
      console.log(error)
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Network error'
        }
      };
    }
  }

  async getOne<T>(table: string, id: string, select?: string[]): Promise<ApiResponse<T>> {
    try {
      const queryStr = select ? `?select=${select.join(',')}` : '';
      const response = await fetch(normalizePath(this.baseUrl, table, id) + queryStr, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message || 'Request failed', status: response.status } };
      }

      const data = await response.json();
      return { data: data as T, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async getMany<T>(table: string, params?: QueryParams): Promise<ApiResponse<T[]>> {
    try {
      const queryStr = buildQueryString(params);
      const response = await fetch(normalizePath(this.baseUrl, table) + queryStr, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: [], error: { message: error.message || 'Request failed', status: response.status } };
      }

      const result = await response.json();
      
      // Support both { data: [], count: n } and plain array responses
      if (Array.isArray(result)) {
        return { data: result as T[], error: null };
      }
      
      return {
        data: (result.data || result.items || result) as T[],
        error: null,
        count: result.count || result.total,
      };
    } catch (error) {
      return { data: [], error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async create<T>(table: string, data: Partial<T>): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, table), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message || 'Request failed', status: response.status } };
      }

      const result = await response.json();
      return { data: result as T, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async createMany<T>(table: string, data: Partial<T>[]): Promise<ApiResponse<T[]>> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, table, 'bulk'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: [], error: { message: error.message || 'Request failed', status: response.status } };
      }

      const result = await response.json();
      return { data:  result as T[], error: null };
    } catch (error) {
      return { data: [], error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async import(table: string, data: { tickets: any[] }): Promise<ApiResponse<{
    success: boolean;
    imported: number;
    failed: number;
    total: number;
    results: any[];
  }>> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, table, 'import'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        return { 
          data: null, 
          error: { 
            message: error.message || 'Import failed', 
            status: response.status 
          } 
        };
      }

      const result = await response.json();
      return { data: result, error: null };
    } catch (error) {
      return { 
        data: null, 
        error: { 
          message: error instanceof Error ? error.message : 'Network error' 
        } 
      };
    }
  }

  async update<T>(table: string, id: string, data: Partial<T>, method: 'PUT' | 'PATCH' = 'PATCH'): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, table, id), {
        method: method,
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message || 'Request failed', status: response.status } };
      }

      const result = await response.json();
      return { data: result as T, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async updateMany<T>(table: string, data: Partial<T>, params?: QueryParams): Promise<ApiResponse<T[]>> {
    try {
      const queryStr = buildQueryString(params);
      const response = await fetch(normalizePath(this.baseUrl, table, 'bulk') + queryStr, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: [], error: { message: error.message || 'Request failed', status: response.status } };
      }

      const result = await response.json();
      return { data: (Array.isArray(result) ? result : result.data) as T[], error: null };
    } catch (error) {
      return { data: [], error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async delete(table: string, id: string): Promise<ApiResponse<null>> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, table, id), {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message || 'Request failed', status: response.status } };
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async deleteMany(table: string, filters?: FilterParams[]): Promise<ApiResponse<null>> {
    try {
      const queryStr = buildQueryString({ filters });
      const response = await fetch(normalizePath(this.baseUrl, table, 'bulk') + queryStr, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message || 'Request failed', status: response.status } };
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async query<R>(table: string, queryFn: (endpoint: string) => Promise<Response>): Promise<ApiResponse<R>> {
    try {
      const response = await queryFn(normalizePath(this.baseUrl, table));

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message || 'Request failed', status: response.status } };
      }

      const result = await response.json();
      return { data: result as R, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }
}

/**
 * REST API Auth Service
 */
class RestAuthService implements IAuthService {
  private baseUrl: string;
  private tokenKey: string;
  private authChangeCallbacks: Set<(event: string, session: AuthSession | null) => void>;

  constructor(config: RestApiConfig) {
    this.baseUrl = config.authEndpoint || normalizePath(config.baseUrl, 'auth');
    this.tokenKey = config.tokenKey || 'auth_token';
    this.authChangeCallbacks = new Set();
  }

  private notifyAuthChange(event: string, session: AuthSession | null): void {
    this.authChangeCallbacks.forEach((callback) => callback(event, session));
  }

  async getSession(): Promise<{ session: AuthSession | null; error: Error | null }> {
    const token = getAuthToken(this.tokenKey);
    if (!token) {
      return { session: null, error: null };
    }

    try {
      const response = await fetch(normalizePath(this.baseUrl, 'session'), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        removeAuthToken(this.tokenKey);
        return { session: null, error: null };
      }

      const session = await response.json();
      return { session, error: null };
    } catch (error) {
      return { session: null, error: error as Error };
    }
  }

  async getUser(): Promise<{ user: AuthUser | null; error: Error | null }> {
    const { session, error } = await this.getSession();
    if (error || !session) {
      return { user: null, error };
    }
    return { user: session.user, error: null };
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, 'signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          username: credentials.fullName,
          ...credentials.metadata,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { user: null, session: null, error: { message: error.message, status: response.status } };
      }

      const result = await response.json();
      if (result.access_token) {
        setAuthToken(this.tokenKey, result.access_token);
        this.notifyAuthChange('SIGNED_UP', result.session || result);
      }

      return { user: result.user, session: result.session || result, error: null };
    } catch (error) {
      return { user: null, session: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, 'login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        return { user: null, session: null, error: { message: error.message, status: response.status } };
      }

      const result = await response.json(); 
      if (result.access_token) {
        setAuthToken(this.tokenKey, result.access_token);
        
        // Fetch user data from /session endpoint
        try {
          const sessionResponse = await fetch(normalizePath(this.baseUrl, 'session'), {
            method: 'GET',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${result.access_token}`
            },
          });
          
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            this.notifyAuthChange('SIGNED_IN', sessionData);
            return { user: sessionData.user, session: sessionData, error: null };
          }
        } catch (err) {
          console.error('Error fetching session after login:', err);
        }
        
        this.notifyAuthChange('SIGNED_IN', result);
      }

      return { user: result.user, session: result.session || result, error: null };
    } catch (error) {
      return { user: null, session: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async signOut(): Promise<{ error: Error | null }> {

    removeAuthToken(this.tokenKey);
    this.notifyAuthChange('SIGNED_OUT', null);
    return { error: null };
  }

  async resetPassword(newPassword: string): Promise<{ data: AnyRecord | null }> {
    const token = getAuthToken(this.tokenKey);

    try {
      const response = await fetch(normalizePath(this.baseUrl, 'reset-password'), {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { error: new Error(error.message) };
      }
      const data = await response.json();
      return data;
    } catch (error) {
      return { error: error as Error };
    }
  }

  async uploadProfileImage(userId: number, file: File): Promise<ApiResponse<{ profile_image: string }>> {
    const token = getAuthToken(this.tokenKey);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(normalizePath(this.baseUrl, 'upload-profile-image', String(userId)), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message, status: response.status } };
      }

      const result = await response.json();
      return { data: result, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async deleteProfileImage(userId: number): Promise<ApiResponse<null>> {
    const token = getAuthToken(this.tokenKey);
    
    try {
      const response = await fetch(normalizePath(this.baseUrl, 'delete-profile-image', String(userId)), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message, status: response.status } };
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  getProfileImageUrl(userId: number): string {
    return normalizePath(this.baseUrl, 'profile-image', String(userId));
  }

  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void): { unsubscribe: () => void } {
    this.authChangeCallbacks.add(callback);
    return {
      unsubscribe: () => {
        this.authChangeCallbacks.delete(callback);
      },
    };
  }
}

/**
 * REST API Storage Service
 */
class RestStorageService implements IStorageService {
  private baseUrl: string;
  private tokenKey: string;

  constructor(config: RestApiConfig) {
    this.baseUrl = config.storageEndpoint || normalizePath(config.baseUrl, 'storage');
    this.tokenKey = config.tokenKey || 'auth_token';
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const token = getAuthToken(this.tokenKey);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async upload(
    bucket: string,
    path: string,
    file: File,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<ApiResponse<StorageUploadResult>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', path);
      if (options?.upsert) formData.append('upsert', 'true');

      const response = await fetch(normalizePath(this.baseUrl, bucket, 'upload'), {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message, status: response.status } };
      }

      const result = await response.json();
      return { data: { path: result.path, url: result.url }, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async download(bucket: string, path: string): Promise<ApiResponse<Blob>> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, bucket, 'download', path), {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return { data: null, error: { message: 'Download failed', status: response.status } };
      }

      const blob = await response.blob();
      return { data: blob, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  getPublicUrl(bucket: string, path: string): string {
    return normalizePath(this.baseUrl, bucket, 'public', path);
  }

  async getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<ApiResponse<string>> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, bucket, 'signed-url'), {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, expiresIn }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message, status: response.status } };
      }

      const result = await response.json();
      return { data: result.url, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async delete(bucket: string, paths: string[]): Promise<ApiResponse<null>> {
    try {
      const response = await fetch(normalizePath(this.baseUrl, bucket, 'delete'), {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paths }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error: { message: error.message, status: response.status } };
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  async list(
    bucket: string,
    folder?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{ name: string; id: string }[]>> {
    try {
      const params = new URLSearchParams();
      if (folder) params.append('folder', folder);
      if (options?.limit) params.append('limit', String(options.limit));
      if (options?.offset) params.append('offset', String(options.offset));

      const response = await fetch(normalizePath(this.baseUrl, bucket, 'list') + `?${params}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: [], error: { message: error.message, status: response.status } };
      }

      const result = await response.json();
      return { data: result.files || result, error: null };
    } catch (error) {
      return { data: [], error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }
}

/**
 * Placeholder Realtime Service for REST API
 * Real implementation would use WebSockets or SSE
 */
class RestRealtimeService implements IRealtimeService {
  subscribe<T>(
    _table: string,
    _event: RealtimeEventType,
    _callback: RealtimeCallback<T>,
    _filter?: { column: string; value: string }
  ): RealtimeSubscription {
    console.warn('REST API realtime not implemented. Use WebSocket adapter for realtime features.');
    return { unsubscribe: () => {} };
  }

  channel(_name: string): IRealtimeChannel {
    console.warn('REST API realtime channels not implemented. Use WebSocket adapter for realtime features.');
    return {
      onPostgresChanges: () => ({ onPostgresChanges: () => ({}), onPresence: () => ({}), onBroadcast: () => ({}), track: async () => {}, send: async () => {}, subscribe: () => ({}), unsubscribe: () => {} }) as unknown as IRealtimeChannel,
      onPresence: () => ({}) as unknown as IRealtimeChannel,
      onBroadcast: () => ({}) as unknown as IRealtimeChannel,
      track: async () => {},
      send: async () => {},
      subscribe: () => ({}) as unknown as IRealtimeChannel,
      unsubscribe: () => {},
    };
  }
}

/**
 * REST API Client
 */
export class RestApiClient implements IApiClient {
  data: IDataService;
  auth: IAuthService;
  storage: IStorageService;
  realtime: IRealtimeService;

  constructor(config: RestApiConfig) {
    this.data = new RestDataService(config);
    this.auth = new RestAuthService(config);
    this.storage = new RestStorageService(config);
    this.realtime = new RestRealtimeService();
  }
}

/**
 * Create a REST API client instance
 */
export function createRestApiClient(config: RestApiConfig): IApiClient {
  return new RestApiClient(config);
}
