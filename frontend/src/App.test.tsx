// The real route table, rendered at a URL like the browser would

import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import App from './App';
import { API, server, tokenFor, users } from '@/test/server';

const visit = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

afterEach(() => window.history.pushState({}, '', '/'));

describe('App routes', () => {
  it('shows the login page at /auth', async () => {
    visit('/auth');
    expect(await screen.findByLabelText('Email', { selector: '#login-email' })).toBeInTheDocument();
  });

  it('sends an anonymous visitor from a protected page to /auth', async () => {
    visit('/dossiers');
    await waitFor(() => expect(window.location.pathname).toBe('/auth'));
  });

  it('sends a signed-in student from / to their dossier', async () => {
    localStorage.setItem('auth_token', tokenFor(users.student));
    server.use(
      http.get(`${API}/students`, () => HttpResponse.json({ students: [], total: 0, page: 1 })),
      http.get(`${API}/milestones`, () => HttpResponse.json({ data: [], count: 0 })),
      http.get(`${API}/notifications`, () => HttpResponse.json([]))
    );

    visit('/');

    await waitFor(() => expect(window.location.pathname).toBe('/my-dossier'));
  });

  it('shows the not-found page for unknown URLs', async () => {
    visit('/nulle-part');
    expect(await screen.findByText('404')).toBeInTheDocument();
  });
});
