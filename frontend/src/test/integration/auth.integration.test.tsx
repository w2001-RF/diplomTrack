// Real AuthProvider + pages + api client, with the Flask API faked by MSW

import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Toaster } from 'sonner';
import Auth from '@/pages/Auth';
import { RootRedirect } from '@/components/RootRedirect';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserRole } from '@/constants/roles';
import { useTicketsQuery } from '@/hooks/api';
import { API, PASSWORD, server, tokenFor, users } from '@/test/server';
import { LocationProbe, renderWithProviders } from '@/test/utils';

const loginPage = (
  <>
    <Auth />
    <Toaster />
  </>
);

async function logIn(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email', { selector: '#login-email' }), email);
  await user.type(screen.getByLabelText('Mot de passe', { selector: '#login-password' }), password);
  await user.click(screen.getByRole('button', { name: /se connecter/i }));
}

describe('login', () => {
  it.each([
    [users.admin, '/admin'],
    [users.agent, '/agent'],
    [users.student, '/my-dossier'],
  ])('signs in $role and lands on its home page', async (account, home) => {
    renderWithProviders(loginPage, { path: '/auth', routes: { '/': <RootRedirect /> } });

    await logIn(account.email, PASSWORD);

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(home));
    expect(localStorage.getItem('auth_token')).toBe(tokenFor(account));
  });

  it('shows the backend error for wrong credentials and stays on /auth', async () => {
    renderWithProviders(loginPage, { path: '/auth' });

    await logIn(users.agent.email, 'wrong-password');

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.queryByTestId('location')).not.toBeInTheDocument();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('validates the form before calling the API', async () => {
    let called = false;
    server.use(
      http.post(`${API}/auth/login`, () => {
        called = true;
        return HttpResponse.json({});
      })
    );
    renderWithProviders(loginPage, { path: '/auth' });

    // 'a@b' passes the browser's type=email check but not Zod's
    await logIn('a@b', '123');

    expect(await screen.findByText('Email invalide')).toBeInTheDocument();
    expect(screen.getByText(/au moins 6 caractères/)).toBeInTheDocument();
    expect(called).toBe(false);
  });
});

describe('session', () => {
  const agentPage = (
    <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
      <h1>Espace agent</h1>
    </ProtectedRoute>
  );

  it('restores the session from a stored token', async () => {
    localStorage.setItem('auth_token', tokenFor(users.agent));

    renderWithProviders(agentPage, { path: '/agent' });

    expect(await screen.findByRole('heading', { name: 'Espace agent' })).toBeInTheDocument();
  });

  it('drops a token the API no longer accepts', async () => {
    localStorage.setItem('auth_token', 'revoked');

    renderWithProviders(agentPage, { path: '/agent' });

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/auth'));
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('logs the user out when a request reports the JWT expired', async () => {
    localStorage.setItem('auth_token', tokenFor(users.agent));
    server.use(http.get(`${API}/tickets`, () => HttpResponse.json({ msg: 'Token has expired' }, { status: 401 })));
    function TicketsPage() {
      useTicketsQuery();
      return <h1>Dossiers</h1>;
    }

    renderWithProviders(
      <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
        <TicketsPage />
      </ProtectedRoute>,
      { path: '/dossiers', routes: { '/auth': <LocationProbe /> } }
    );

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/auth'));
  });
});
