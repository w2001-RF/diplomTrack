import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { ProtectedRoute } from './ProtectedRoute';
import { RootRedirect } from './RootRedirect';
import { UserRole } from '@/constants/roles';
import { fakeAuth, renderWithProviders } from '@/test/utils';
import type { AuthUser } from '@/lib/api/types';

const userWith = (role: UserRole): AuthUser => ({ id: '1', email: 'u@uit.ac.ma', role });
const signedIn = (role: UserRole, extra = {}) => fakeAuth({ user: userWith(role), role, ...extra });

const location = () => screen.getByTestId('location').textContent;

describe('RootRedirect', () => {
  it('renders nothing while the session is loading', () => {
    const { container } = renderWithProviders(<RootRedirect />, { auth: fakeAuth({ loading: true }) });
    expect(container).toBeEmptyDOMElement();
  });

  it('sends anonymous visitors to /auth', () => {
    renderWithProviders(<RootRedirect />, { auth: fakeAuth() });
    expect(location()).toBe('/auth');
  });

  it.each([
    [UserRole.ADMIN, '/admin'],
    [UserRole.AGENT, '/agent'],
    [UserRole.STUDENT, '/my-dossier'],
  ])('sends %s to %s', (role, target) => {
    renderWithProviders(<RootRedirect />, { auth: signedIn(role) });
    expect(location()).toBe(target);
  });
});

describe('ProtectedRoute', () => {
  const page = (roles?: UserRole[]) => (
    <ProtectedRoute allowedRoles={roles}>
      <h1>Page protégée</h1>
    </ProtectedRoute>
  );

  it('shows a loader while the session is loading', () => {
    renderWithProviders(page(), { path: '/dossiers', auth: fakeAuth({ loading: true }) });
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('redirects anonymous visitors to /auth', () => {
    renderWithProviders(page(), { path: '/dossiers', auth: fakeAuth() });
    expect(location()).toBe('/auth');
  });

  it('renders the page for an allowed role', () => {
    renderWithProviders(page([UserRole.AGENT, UserRole.ADMIN]), { path: '/dossiers', auth: signedIn(UserRole.AGENT) });
    expect(screen.getByRole('heading', { name: 'Page protégée' })).toBeInTheDocument();
  });

  it.each([
    [UserRole.STUDENT, '/my-dossier'],
    [UserRole.ADMIN, '/admin'],
    [UserRole.AGENT, '/'],
  ])('sends a %s without access to %s', (role, target) => {
    const others = Object.values(UserRole).filter((r) => r !== role);
    renderWithProviders(page(others), { path: '/somewhere', auth: signedIn(role) });
    expect(location()).toBe(target);
  });

  it.each([UserRole.ADMIN, UserRole.STUDENT])('renders an allowed page for %s (uses the router location)', (role) => {
    // ProtectedRoute used to read window.location, which is "/" outside a BrowserRouter
    renderWithProviders(page([role]), { path: '/users', auth: signedIn(role) });
    expect(screen.getByRole('heading', { name: 'Page protégée' })).toBeInTheDocument();
  });

  it('shows the forced password reset instead of the page', () => {
    renderWithProviders(page(), { path: '/dossiers', auth: signedIn(UserRole.ADMIN, { mustResetPassword: true }) });

    expect(screen.getByText('Réinitialisation obligatoire')).toBeInTheDocument();
    expect(screen.queryByText('Page protégée')).not.toBeInTheDocument();
  });
});
