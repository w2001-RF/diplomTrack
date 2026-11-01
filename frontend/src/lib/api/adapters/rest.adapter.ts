// REST adapter for the Flask API (backend/). Resources map to /api/<resource>
// and /api/<resource>/<id>; anything else goes through customRequest.

import type { IDataService, IAuthService, IApiClient, CustomRequestOptions, ImportResult } from '../interfaces';
import type {
  ApiResponse,
  AuthResponse,
  SignUpCredentials,
  SignInCredentials,
  AuthUser,
  AuthSession,
  QueryParams,
  FilterParams,
} from '../types';
import { HttpClient } from '../http';

export interface RestApiConfig {
  baseUrl: string;
  tokenKey?: string;
  headers?: Record<string, string>;
}

type AuthListener = (event: string, session: AuthSession | null) => void;

class RestDataService implements IDataService {
  constructor(private http: HttpClient) {}

  customRequest<T>(endpoint: string, options: CustomRequestOptions = {}): Promise<ApiResponse<T>> {
    return this.http.request<T>(endpoint, options);
  }

  getOne<T>(resource: string, id: string, select?: string[]): Promise<ApiResponse<T>> {
    return this.http.request<T>([resource, id], { query: { select } });
  }

  async getMany<T>(resource: string, params?: QueryParams): Promise<ApiResponse<T[]>> {
    const { data, error } = await this.http.request<T[] | { [key: string]: unknown; count?: number; total?: number }>(
      resource,
      { query: params }
    );
    if (error) return { data: [], error };

    // Routes return a plain array or a paginated envelope whose list sits under
    // one key: {data|items|tickets|students|documents: [...], count|total}
    if (Array.isArray(data)) return { data, error: null };
    const list = Object.values(data ?? {}).find(Array.isArray) as T[] | undefined;
    return {
      data: list ?? [],
      error: null,
      count: data?.count ?? data?.total,
    };
  }

  create<T>(resource: string, data: Partial<T>): Promise<ApiResponse<T>> {
    return this.http.request<T>(resource, { method: 'POST', body: data });
  }

  async createMany<T>(resource: string, data: Partial<T>[]): Promise<ApiResponse<T[]>> {
    const result = await this.http.request<T[]>([resource, 'bulk'], { method: 'POST', body: data });
    return result.error ? { data: [], error: result.error } : result;
  }

  import(resource: string, data: unknown): Promise<ApiResponse<ImportResult>> {
    return this.http.request<ImportResult>([resource, 'import'], { method: 'POST', body: data });
  }

  update<T>(resource: string, id: string, data: Partial<T>, method: 'PUT' | 'PATCH' = 'PATCH'): Promise<ApiResponse<T>> {
    return this.http.request<T>([resource, id], { method, body: data });
  }

  async delete(resource: string, id: string): Promise<ApiResponse<null>> {
    const { error } = await this.http.request<unknown>([resource, id], { method: 'DELETE' });
    return { data: null, error };
  }

  async deleteMany(resource: string, filters?: FilterParams[]): Promise<ApiResponse<null>> {
    const { error } = await this.http.request<unknown>([resource, 'bulk'], { method: 'DELETE', query: { filters } });
    return { data: null, error };
  }
}

/** JWT auth against /api/auth/* (backend/routes/auth_routes.py) */
class RestAuthService implements IAuthService {
  private listeners = new Set<AuthListener>();

  constructor(private http: HttpClient) {}

  notify(event: string, session: AuthSession | null): void {
    this.listeners.forEach((listener) => listener(event, session));
  }

  async getSession(): Promise<{ session: AuthSession | null; error: Error | null }> {
    if (!this.http.getToken()) return { session: null, error: null };

    const { data, error } = await this.http.request<AuthSession>('auth/session');
    if (error) {
      this.http.clearToken();
      // A network failure is an error; a rejected token just means "no session"
      return { session: null, error: error.status ? null : new Error(error.message) };
    }
    return { session: data, error: null };
  }

  async getUser(): Promise<{ user: AuthUser | null; error: Error | null }> {
    const { session, error } = await this.getSession();
    return { user: session?.user ?? null, error };
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    const { data, error } = await this.http.request<AuthSession & { session?: AuthSession }>('auth/signup', {
      method: 'POST',
      auth: false,
      body: {
        email: credentials.email,
        password: credentials.password,
        username: credentials.fullName,
        ...credentials.metadata,
      },
    });
    if (error) return { user: null, session: null, error };

    const session = data?.session || data;
    if (data?.access_token) {
      this.http.setToken(data.access_token);
      this.notify('SIGNED_UP', session);
    }
    return { user: data?.user ?? null, session, error: null };
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    const { data, error } = await this.http.request<{ access_token?: string; user?: AuthUser }>('auth/login', {
      method: 'POST',
      auth: false,
      body: credentials,
    });
    if (error) return { user: null, session: null, error };
    if (!data?.access_token) return { user: data?.user ?? null, session: null, error: null };

    this.http.setToken(data.access_token);

    // /login only returns the token; /session returns the user with its role
    const { session } = await this.getSession();
    const resolved = session ?? ({ access_token: data.access_token, user: data.user } as AuthSession);
    this.notify('SIGNED_IN', resolved);
    return { user: resolved.user ?? null, session: resolved, error: null };
  }

  async signOut(): Promise<{ error: Error | null }> {
    this.http.clearToken();
    this.notify('SIGNED_OUT', null);
    return { error: null };
  }

  async resetPassword(newPassword: string): Promise<{ data: Record<string, unknown> | null; error: Error | null }> {
    const { data, error } = await this.http.request<Record<string, unknown>>('auth/reset-password', {
      method: 'PUT',
      body: { password: newPassword },
    });
    return { data, error: error ? new Error(error.message) : null };
  }

  uploadProfileImage(userId: number, file: File): Promise<ApiResponse<{ profile_image: string }>> {
    const form = new FormData();
    form.append('file', file);
    return this.http.request(['auth/upload-profile-image', userId], { method: 'POST', body: form });
  }

  async deleteProfileImage(userId: number): Promise<ApiResponse<null>> {
    const { error } = await this.http.request<unknown>(['auth/delete-profile-image', userId], { method: 'DELETE' });
    return { data: null, error };
  }

  getProfileImageUrl(userId: number): string {
    return this.http.url(['auth/profile-image', userId]);
  }

  onAuthStateChange(callback: AuthListener): { unsubscribe: () => void } {
    this.listeners.add(callback);
    return { unsubscribe: () => this.listeners.delete(callback) };
  }
}

export class RestApiClient implements IApiClient {
  data: IDataService;
  auth: IAuthService;

  constructor(config: RestApiConfig) {
    const http: HttpClient = new HttpClient({
      ...config,
      // Expired/revoked JWT: tell AuthProvider so it can drop the user
      onUnauthorized: () => auth.notify('SESSION_EXPIRED', null),
    });
    const auth = new RestAuthService(http);
    this.auth = auth;
    this.data = new RestDataService(http);
  }
}

export function createRestApiClient(config: RestApiConfig): IApiClient {
  return new RestApiClient(config);
}
