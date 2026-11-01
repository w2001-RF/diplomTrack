// HTTP client for the Flask API: one place for the base URL, the JWT, JSON
// encoding and error parsing.

import type { ApiError, ApiResponse, QueryParams } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /** JSON-encoded unless it is a FormData */
  body?: unknown;
  query?: QueryParams;
  /** Extra raw query-string parameters */
  queryParams?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  /** Send the stored JWT (default true) */
  auth?: boolean;
}

export interface HttpClientConfig {
  baseUrl: string;
  tokenKey?: string;
  headers?: Record<string, string>;
  /** Called when an authenticated request gets a 401 (expired or revoked JWT) */
  onUnauthorized?: () => void;
}

/** Join URL segments without doubling or dropping slashes */
export function joinPath(baseUrl: string, ...segments: (string | number)[]): string {
  let url = baseUrl.replace(/\/+$/, '');
  for (const raw of segments) {
    const segment = String(raw).replace(/^\/+|\/+$/g, '');
    if (segment) url += `/${segment}`;
  }
  return url;
}

/**
 * Encode QueryParams the way backend/routes/data_routes.py reads them:
 * filter[<field>][<op>]=v, sort=-field,field2, page, limit, offset, select.
 * The backend only applies the `eq` operator.
 */
export function buildQueryString(
  params?: QueryParams,
  extra?: Record<string, string | number | boolean>
): string {
  const search = new URLSearchParams();

  params?.filters?.forEach((f) => {
    search.append(`filter[${f.field}][${f.operator}]`, String(f.value));
  });
  if (params?.sort?.length) {
    search.append('sort', params.sort.map((s) => (s.direction === 'desc' ? `-${s.field}` : s.field)).join(','));
  }
  const pagination = params?.pagination;
  if (pagination?.page) search.append('page', String(pagination.page));
  const limit = pagination?.limit ?? params?.limit;
  if (limit) search.append('limit', String(limit));
  if (pagination?.offset) search.append('offset', String(pagination.offset));
  if (params?.select?.length) search.append('select', params.select.join(','));

  Object.entries(extra ?? {}).forEach(([key, value]) => search.append(key, String(value)));

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Flask errors are {"error": ..., "code": ...}; some routes use {"message": ...} */
async function parseError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  const message =
    (body && (body.error || body.message || body.msg)) || response.statusText || `HTTP ${response.status}`;
  return { message: String(message), status: response.status, code: body?.code, details: body };
}

export class HttpClient {
  readonly baseUrl: string;
  readonly tokenKey: string;
  private headers: Record<string, string>;
  private onUnauthorized?: () => void;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.tokenKey = config.tokenKey || 'auth_token';
    this.headers = config.headers || {};
    this.onUnauthorized = config.onUnauthorized;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
  }

  url(path: string | number | (string | number)[]): string {
    return joinPath(this.baseUrl, ...(Array.isArray(path) ? path : [path]));
  }

  async request<T>(path: string | number | (string | number)[], options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, query, queryParams, auth = true } = options;
    const headers: Record<string, string> = { ...this.headers, ...options.headers };

    const token = auth ? this.getToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;

    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body; // the browser sets the multipart boundary
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(this.url(path) + buildQueryString(query, queryParams), {
        method,
        headers,
        body: payload,
      });
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }

    if (!response.ok) {
      if (response.status === 401 && token) {
        this.clearToken();
        this.onUnauthorized?.();
      }
      return { data: null, error: await parseError(response) };
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return { data: null, error: null };
    }

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.blob();
    return { data: data as T, error: null };
  }
}
