// MSW server that stands in for the Flask API in integration tests.
// Default handlers cover the auth endpoints; tests add their own with
// server.use(...).

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const API = 'http://api.test/api';

export const users = {
  admin: { id: '1', email: 'admin@uit.ac.ma', username: 'admin', role: 'ADMIN', must_reset_password: false },
  agent: { id: '2', email: 'agent@uit.ac.ma', username: 'agent', role: 'AGENT', must_reset_password: false },
  student: { id: '3', email: 'etudiant@uit.ac.ma', username: 'etudiant', role: 'STUDENT', must_reset_password: false },
} as const;

export type TestUser = (typeof users)[keyof typeof users];

/** The token encodes the user so /auth/session can answer for it */
export const tokenFor = (user: TestUser) => `token-${user.username}`;

const userForToken = (request: Request) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  return Object.values(users).find((u) => tokenFor(u) === token);
};

export const PASSWORD = 'Secret-123';

export const authHandlers = [
  http.post(`${API}/auth/login`, async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const user = Object.values(users).find((u) => u.email === email);
    if (!user || password !== PASSWORD) {
      return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    return HttpResponse.json({ access_token: tokenFor(user) });
  }),

  http.get(`${API}/auth/session`, ({ request }) => {
    const user = userForToken(request);
    if (!user) return HttpResponse.json({ msg: 'Missing Authorization Header' }, { status: 401 });
    return HttpResponse.json({ access_token: tokenFor(user), user });
  }),
];

export const server = setupServer(...authHandlers);
