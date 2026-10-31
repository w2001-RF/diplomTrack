// Supabase adapter implementation

import { supabase } from '@/integrations/supabase/client';
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

// Type for dynamic table access
type AnyTable = any;

/**
 * Convert Supabase error to ApiError
 */
function toApiError(error: unknown): { message: string; code?: string; status?: number } {
  if (error && typeof error === 'object') {
    const e = error as { message?: string; code?: string; status?: number };
    return {
      message: e.message || 'Unknown error',
      code: e.code,
      status: e.status,
    };
  }
  return { message: String(error) };
}

/**
 * Apply filters to a Supabase query
 */
function applyFilters(query: AnyTable, filters?: FilterParams[]): AnyTable {
  if (!filters || filters.length === 0) return query;

  filters.forEach((filter) => {
    switch (filter.operator) {
      case 'eq':
        query = query.eq(filter.field, filter.value);
        break;
      case 'neq':
        query = query.neq(filter.field, filter.value);
        break;
      case 'gt':
        query = query.gt(filter.field, filter.value);
        break;
      case 'gte':
        query = query.gte(filter.field, filter.value);
        break;
      case 'lt':
        query = query.lt(filter.field, filter.value);
        break;
      case 'lte':
        query = query.lte(filter.field, filter.value);
        break;
      case 'like':
        query = query.like(filter.field, filter.value);
        break;
      case 'ilike':
        query = query.ilike(filter.field, filter.value);
        break;
      case 'in':
        query = query.in(filter.field, filter.value as unknown[]);
        break;
      case 'is':
        query = query.is(filter.field, filter.value);
        break;
    }
  });

  return query;
}

/**
 * Get supabase table reference with dynamic typing
 */
function getTable(table: string) {
  return supabase.from(table as AnyTable);
}

/**
 * Supabase Data Service
 */
class SupabaseDataService implements IDataService {
  async getOne<T>(table: string, id: string, select?: string[]): Promise<ApiResponse<T>> {
    const selectStr = select?.join(', ') || '*';
    const { data, error } = await getTable(table)
      .select(selectStr)
      .eq('id', id)
      .maybeSingle();

    return {
      data: data as T | null,
      error: error ? toApiError(error) : null,
    };
  }

  async getMany<T>(table: string, params?: QueryParams): Promise<ApiResponse<T[]>> {
    const selectStr = params?.select?.join(', ') || '*';
    let query = getTable(table).select(selectStr, { count: 'exact' });

    // Apply filters
    query = applyFilters(query, params?.filters);

    // Apply sorting
    if (params?.sort && params.sort.length > 0) {
      params.sort.forEach((s) => {
        query = query.order(s.field, { ascending: s.direction === 'asc' });
      });
    }

    // Apply pagination
    if (params?.pagination) {
      const { limit, offset, page } = params.pagination;
      if (limit) {
        const start = offset ?? (page ? (page - 1) * limit : 0);
        query = query.range(start, start + limit - 1);
      }
    }

    const { data, error, count } = await query;

    return {
      data: (data as T[]) || [],
      error: error ? toApiError(error) : null,
      count: count ?? undefined,
    };
  }

  async create<T>(table: string, data: Partial<T>): Promise<ApiResponse<T>> {
    const { data: result, error } = await getTable(table)
      .insert(data as AnyTable)
      .select()
      .single();

    return {
      data: result as T | null,
      error: error ? toApiError(error) : null,
    };
  }

  async createMany<T>(table: string, data: Partial<T>[]): Promise<ApiResponse<T[]>> {
    const { data: result, error } = await getTable(table)
      .insert(data as AnyTable[])
      .select();

    return {
      data: (result as T[]) || [],
      error: error ? toApiError(error) : null,
    };
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<ApiResponse<T>> {
    const { data: result, error } = await getTable(table)
      .update(data as AnyTable)
      .eq('id', id)
      .select()
      .single();

    return {
      data: result as T | null,
      error: error ? toApiError(error) : null,
    };
  }

  async updateMany<T>(
    table: string,
    data: Partial<T>,
    params?: QueryParams
  ): Promise<ApiResponse<T[]>> {
    let query = getTable(table).update(data as AnyTable);
    query = applyFilters(query, params?.filters);
    const { data: result, error } = await query.select();

    return {
      data: (result as T[]) || [],
      error: error ? toApiError(error) : null,
    };
  }

  async delete(table: string, id: string): Promise<ApiResponse<null>> {
    const { error } = await getTable(table).delete().eq('id', id);

    return {
      data: null,
      error: error ? toApiError(error) : null,
    };
  }

  async deleteMany(table: string, filters?: FilterParams[]): Promise<ApiResponse<null>> {
    let query = getTable(table).delete();
    query = applyFilters(query, filters);
    const { error } = await query;

    return {
      data: null,
      error: error ? toApiError(error) : null,
    };
  }

  async query<R>(table: string, queryFn: (query: AnyTable) => AnyTable): Promise<ApiResponse<R>> {
    const baseQuery = getTable(table);
    const { data, error } = await queryFn(baseQuery);

    return {
      data: data as R | null,
      error: error ? toApiError(error) : null,
    };
  }
}

/**
 * Supabase Auth Service
 */
class SupabaseAuthService implements IAuthService {
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    return {
      session: data.session as AuthSession | null,
      error: error as Error | null,
    };
  }

  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    return {
      user: data.user as AuthUser | null,
      error: error as Error | null,
    };
  }

  async signUp(credentials: SignUpCredentials): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          full_name: credentials.fullName,
          ...credentials.metadata,
        },
      },
    });

    return {
      user: data.user as AuthUser | null,
      session: data.session as AuthSession | null,
      error: error ? toApiError(error) : null,
    };
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    return {
      user: data.user as AuthUser | null,
      session: data.session as AuthSession | null,
      error: error ? toApiError(error) : null,
    };
  }

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error: error as Error | null };
  }

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error as Error | null };
  }

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error as Error | null };
  }

  onAuthStateChange(callback: (event: string, session: AuthSession | null) => void) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session as AuthSession | null);
    });
    return { unsubscribe: () => data.subscription.unsubscribe() };
  }
}

/**
 * Supabase Storage Service
 */
class SupabaseStorageService implements IStorageService {
  async upload(
    bucket: string,
    path: string,
    file: File,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<ApiResponse<StorageUploadResult>> {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: options?.contentType,
      upsert: options?.upsert,
    });

    if (error) {
      return { data: null, error: toApiError(error) };
    }

    return {
      data: { path: data.path, url: this.getPublicUrl(bucket, data.path) },
      error: null,
    };
  }

  async download(bucket: string, path: string): Promise<ApiResponse<Blob>> {
    const { data, error } = await supabase.storage.from(bucket).download(path);

    return {
      data: data,
      error: error ? toApiError(error) : null,
    };
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn = 3600
  ): Promise<ApiResponse<string>> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    return {
      data: data?.signedUrl || null,
      error: error ? toApiError(error) : null,
    };
  }

  async delete(bucket: string, paths: string[]): Promise<ApiResponse<null>> {
    const { error } = await supabase.storage.from(bucket).remove(paths);

    return {
      data: null,
      error: error ? toApiError(error) : null,
    };
  }

  async list(
    bucket: string,
    folder?: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<{ name: string; id: string }[]>> {
    const { data, error } = await supabase.storage.from(bucket).list(folder, {
      limit: options?.limit,
      offset: options?.offset,
    });

    return {
      data: data?.map((f) => ({ name: f.name, id: f.id })) || [],
      error: error ? toApiError(error) : null,
    };
  }
}

/**
 * Supabase Realtime Channel Wrapper
 */
class SupabaseRealtimeChannel implements IRealtimeChannel {
  private channel: ReturnType<typeof supabase.channel>;

  constructor(name: string) {
    this.channel = supabase.channel(name);
  }

  onPostgresChanges<T>(
    table: string,
    event: RealtimeEventType,
    callback: RealtimeCallback<T>
  ): this {
    (this.channel as AnyTable).on(
      'postgres_changes',
      { event, schema: 'public', table },
      (payload: AnyTable) => {
        callback({
          eventType: payload.eventType as RealtimeEventType,
          new: payload.new as T | null,
          old: payload.old as T | null,
          table,
        });
      }
    );
    return this;
  }

  onPresence(event: 'sync' | 'join' | 'leave', callback: (payload: unknown) => void): this {
    (this.channel as AnyTable).on('presence', { event }, callback);
    return this;
  }

  onBroadcast(event: string, callback: (payload: unknown) => void): this {
    (this.channel as AnyTable).on('broadcast', { event }, callback);
    return this;
  }

  async track(state: Record<string, unknown>): Promise<void> {
    await this.channel.track(state);
  }

  async send(event: string, payload: unknown): Promise<void> {
    await this.channel.send({ type: 'broadcast', event, payload });
  }

  subscribe(callback?: (status: string) => void): this {
    this.channel.subscribe((status) => {
      callback?.(status);
    });
    return this;
  }

  unsubscribe(): void {
    supabase.removeChannel(this.channel);
  }
}

/**
 * Supabase Realtime Service
 */
class SupabaseRealtimeService implements IRealtimeService {
  subscribe<T>(
    table: string,
    event: RealtimeEventType,
    callback: RealtimeCallback<T>,
    filter?: { column: string; value: string }
  ): RealtimeSubscription {
    const channel = supabase.channel(`${table}_changes`);

    const config: AnyTable = { event, schema: 'public', table };
    if (filter) {
      config.filter = `${filter.column}=eq.${filter.value}`;
    }

    (channel as AnyTable)
      .on('postgres_changes', config, (payload: AnyTable) => {
        callback({
          eventType: payload.eventType as RealtimeEventType,
          new: payload.new as T | null,
          old: payload.old as T | null,
          table,
        });
      })
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  channel(name: string): IRealtimeChannel {
    return new SupabaseRealtimeChannel(name);
  }
}

/**
 * Supabase API Client
 */
class SupabaseApiClient implements IApiClient {
  data: IDataService;
  auth: IAuthService;
  storage: IStorageService;
  realtime: IRealtimeService;

  constructor() {
    this.data = new SupabaseDataService();
    this.auth = new SupabaseAuthService();
    this.storage = new SupabaseStorageService();
    this.realtime = new SupabaseRealtimeService();
  }
}

// Export singleton instance
export const supabaseClient = new SupabaseApiClient();
