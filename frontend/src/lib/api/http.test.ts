import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpClient, buildQueryString, joinPath } from './http';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const lastCall = (fetchMock: ReturnType<typeof stubFetch>) => {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};

describe('joinPath', () => {
  it('joins segments without doubling or dropping slashes', () => {
    expect(joinPath('/api/', '/tickets/', 7)).toBe('/api/tickets/7');
    expect(joinPath('http://h/api', 'auth/session')).toBe('http://h/api/auth/session');
  });

  it('skips empty segments', () => {
    expect(joinPath('/api', '', 'tickets')).toBe('/api/tickets');
  });
});

describe('buildQueryString', () => {
  it('returns an empty string without params', () => {
    expect(buildQueryString()).toBe('');
    expect(buildQueryString({})).toBe('');
  });

  it('encodes filters the way data_routes.py parses them', () => {
    const qs = buildQueryString({ filters: [{ field: 'user_id', operator: 'eq', value: 3 }] });
    expect(decodeURIComponent(qs)).toBe('?filter[user_id][eq]=3');
  });

  it('encodes sort with a leading minus for descending fields', () => {
    const qs = buildQueryString({
      sort: [
        { field: 'created_at', direction: 'desc' },
        { field: 'reference', direction: 'asc' },
      ],
    });
    expect(decodeURIComponent(qs)).toBe('?sort=-created_at,reference');
  });

  it('sends a top-level limit (it used to be dropped)', () => {
    expect(buildQueryString({ limit: 5 })).toBe('?limit=5');
  });

  it('prefers pagination.limit and keeps page and offset', () => {
    expect(buildQueryString({ limit: 5, pagination: { page: 2, limit: 20, offset: 40 } })).toBe(
      '?page=2&limit=20&offset=40'
    );
  });

  it('appends extra raw parameters', () => {
    expect(buildQueryString(undefined, { unread: true })).toBe('?unread=true');
  });
});

describe('HttpClient.request', () => {
  const client = () => new HttpClient({ baseUrl: 'http://api.test/api', tokenKey: 'auth_token' });

  beforeEach(() => localStorage.clear());

  it('sends the stored JWT as a bearer token', async () => {
    localStorage.setItem('auth_token', 'abc');
    const fetchMock = stubFetch(json([]));

    await client().request('tickets');

    expect(lastCall(fetchMock).headers.Authorization).toBe('Bearer abc');
  });

  it('omits the token when auth is false', async () => {
    localStorage.setItem('auth_token', 'abc');
    const fetchMock = stubFetch(json({}));

    await client().request('auth/login', { method: 'POST', body: {}, auth: false });

    expect(lastCall(fetchMock).headers.Authorization).toBeUndefined();
  });

  it('JSON-encodes plain bodies', async () => {
    const fetchMock = stubFetch(json({ id: 1 }));

    await client().request('tickets', { method: 'POST', body: { reference: 'R1' } });

    const { url, init, headers } = lastCall(fetchMock);
    expect(url).toBe('http://api.test/api/tickets');
    expect(init.method).toBe('POST');
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"reference":"R1"}');
  });

  it('passes FormData through and lets the browser set the content type', async () => {
    const fetchMock = stubFetch(json({}));
    const form = new FormData();
    form.append('file', new Blob(['x']), 'a.png');

    await client().request('auth/upload-profile-image/1', { method: 'POST', body: form });

    const { init, headers } = lastCall(fetchMock);
    expect(init.body).toBe(form);
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('returns parsed JSON on success', async () => {
    stubFetch(json({ id: 1 }));
    await expect(client().request('tickets/1')).resolves.toEqual({ data: { id: 1 }, error: null });
  });

  it('returns null data for 204 No Content', async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(client().request('notifications/1', { method: 'DELETE' })).resolves.toEqual({
      data: null,
      error: null,
    });
  });

  it.each([
    ['error', { error: 'Ticket introuvable', code: 404 }],
    ['message', { message: 'Ticket introuvable' }],
    ['msg', { msg: 'Ticket introuvable' }],
  ])('reads the Flask error text from `%s`', async (_key, body) => {
    stubFetch(json(body, 404));

    const { data, error } = await client().request('tickets/9');

    expect(data).toBeNull();
    expect(error).toMatchObject({ message: 'Ticket introuvable', status: 404 });
  });

  it('falls back to the status when the error body is not JSON', async () => {
    stubFetch(new Response('<html>Bad Gateway</html>', { status: 502 }));

    const { error } = await client().request('tickets');

    expect(error?.status).toBe(502);
    expect(error?.message).toBeTruthy();
  });

  it('reports network failures without a status', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    const { error } = await client().request('tickets');

    expect(error).toEqual({ message: 'Failed to fetch' });
  });

  it('clears the token and calls onUnauthorized on a 401 with a token', async () => {
    localStorage.setItem('auth_token', 'expired');
    const onUnauthorized = vi.fn();
    stubFetch(json({ msg: 'Token has expired' }, 401));

    await new HttpClient({ baseUrl: '/api', onUnauthorized }).request('tickets');

    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('does not treat a failed login (no token) as an expired session', async () => {
    const onUnauthorized = vi.fn();
    stubFetch(json({ message: 'Invalid credentials' }, 401));

    await new HttpClient({ baseUrl: '/api', onUnauthorized }).request('auth/login', {
      method: 'POST',
      body: {},
      auth: false,
    });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
