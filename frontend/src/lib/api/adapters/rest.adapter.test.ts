import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createRestApiClient } from './rest.adapter';
import { API, PASSWORD, server, tokenFor, users } from '@/test/server';

const client = () => createRestApiClient({ baseUrl: API });

describe('data service', () => {
  it('getMany accepts a plain array response', async () => {
    server.use(http.get(`${API}/milestones`, () => HttpResponse.json([{ id: 1 }, { id: 2 }])));

    const { data, error, count } = await client().data.getMany('milestones');

    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(count).toBeUndefined();
  });

  it('getMany unwraps a paginated {data, count} response', async () => {
    server.use(http.get(`${API}/profiles`, () => HttpResponse.json({ data: [{ id: 1 }], count: 41 })));

    const { data, count } = await client().data.getMany('profiles');

    expect(data).toEqual([{ id: 1 }]);
    expect(count).toBe(41);
  });

  it('getMany sends filters, sort and limit as query parameters', async () => {
    let url: URL | undefined;
    server.use(
      http.get(`${API}/user_roles`, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await client().data.getMany('user_roles', {
      filters: [{ field: 'user_id', operator: 'eq', value: '3' }],
      sort: [{ field: 'created_at', direction: 'desc' }],
      limit: 1,
    });

    expect(url?.searchParams.get('filter[user_id][eq]')).toBe('3');
    expect(url?.searchParams.get('sort')).toBe('-created_at');
    expect(url?.searchParams.get('limit')).toBe('1');
  });

  it('getMany returns an empty list and the Flask error on failure', async () => {
    server.use(http.get(`${API}/tickets`, () => HttpResponse.json({ error: 'Accès refusé' }, { status: 403 })));

    const { data, error } = await client().data.getMany('tickets');

    expect(data).toEqual([]);
    expect(error).toMatchObject({ message: 'Accès refusé', status: 403 });
  });

  it('update uses the requested method on /<resource>/<id>', async () => {
    let seen: { method: string; body: unknown } | undefined;
    server.use(
      http.put(`${API}/admin/users/:id`, async ({ request, params }) => {
        seen = { method: request.method, body: await request.json() };
        return HttpResponse.json({ id: Number(params.id), role: 'AGENT' });
      })
    );

    const { data } = await client().data.update('admin/users', '5', { role: 'AGENT' }, 'PUT');

    expect(seen).toEqual({ method: 'PUT', body: { role: 'AGENT' } });
    expect(data).toEqual({ id: 5, role: 'AGENT' });
  });

  it('createMany posts to /<resource>/bulk', async () => {
    server.use(http.post(`${API}/admin/users/agents/bulk`, () => HttpResponse.json([{ id: 9 }], { status: 201 })));

    const { data } = await client().data.createMany('admin/users/agents', [{}]);

    expect(data).toEqual([{ id: 9 }]);
  });

  it('delete returns no data on success', async () => {
    server.use(http.delete(`${API}/notifications/:id`, () => new HttpResponse(null, { status: 204 })));

    await expect(client().data.delete('notifications', '4')).resolves.toEqual({ data: null, error: null });
  });
});

describe('auth service', () => {
  it('signIn stores the token, loads the session and notifies listeners', async () => {
    const api = client();
    const listener = vi.fn();
    api.auth.onAuthStateChange(listener);

    const { user, error } = await api.auth.signIn({ email: users.agent.email, password: PASSWORD });

    expect(error).toBeNull();
    expect(user).toMatchObject({ email: users.agent.email, role: 'AGENT' });
    expect(localStorage.getItem('auth_token')).toBe(tokenFor(users.agent));
    expect(listener).toHaveBeenCalledWith('SIGNED_IN', expect.objectContaining({ user: users.agent }));
  });

  it('signIn surfaces the backend message for bad credentials', async () => {
    const { user, error } = await client().auth.signIn({ email: users.agent.email, password: 'wrong' });

    expect(user).toBeNull();
    expect(error?.message).toBe('Invalid credentials');
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('getSession returns null without a token, without calling the API', async () => {
    await expect(client().auth.getSession()).resolves.toEqual({ session: null, error: null });
  });

  it('getSession drops a token the API rejects', async () => {
    localStorage.setItem('auth_token', 'forged');

    const { session, error } = await client().auth.getSession();

    expect(session).toBeNull();
    expect(error).toBeNull();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('emits SESSION_EXPIRED when an authenticated request gets a 401', async () => {
    localStorage.setItem('auth_token', tokenFor(users.agent));
    server.use(http.get(`${API}/tickets`, () => HttpResponse.json({ msg: 'Token has expired' }, { status: 401 })));
    const api = client();
    const listener = vi.fn();
    api.auth.onAuthStateChange(listener);

    await api.data.getMany('tickets');

    expect(listener).toHaveBeenCalledWith('SESSION_EXPIRED', null);
  });

  it('signOut clears the token and notifies SIGNED_OUT', async () => {
    localStorage.setItem('auth_token', 'abc');
    const api = client();
    const listener = vi.fn();
    const subscription = api.auth.onAuthStateChange(listener);

    await api.auth.signOut();
    subscription.unsubscribe();
    await api.auth.signOut();

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith('SIGNED_OUT', null);
  });

  it('resetPassword returns {data, error} for both outcomes', async () => {
    localStorage.setItem('auth_token', tokenFor(users.admin));
    server.use(
      http.put(`${API}/auth/reset-password`, async ({ request }) => {
        const { password } = (await request.json()) as { password: string };
        return password
          ? HttpResponse.json({ message: 'Password updated' })
          : HttpResponse.json({ message: 'Password required' }, { status: 400 });
      })
    );

    await expect(client().auth.resetPassword('New-Pass-42')).resolves.toEqual({
      data: { message: 'Password updated' },
      error: null,
    });
    const failed = await client().auth.resetPassword('');
    expect(failed.data).toBeNull();
    expect(failed.error?.message).toBe('Password required');
  });

  it('uploadProfileImage sends the file as multipart form data', async () => {
    // Inspect the outgoing request directly: Node's fetch cannot serialize
    // jsdom's FormData, so MSW would never see a multipart body
    const fetchMock = vi.fn(async () => HttpResponse.json({ profile_image: 'profiles/2.png' }));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['png'], 'me.png', { type: 'image/png' });

    const { data } = await client().auth.uploadProfileImage(2, file);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API}/auth/upload-profile-image/2`);
    expect((init.body as FormData).get('file')).toBe(file);
    expect(data).toEqual({ profile_image: 'profiles/2.png' });
  });

  it('builds the profile image URL from the base URL', () => {
    expect(client().auth.getProfileImageUrl(2)).toBe(`${API}/auth/profile-image/2`);
  });
});
