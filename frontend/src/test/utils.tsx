// Render helpers shared by component and integration tests

import { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext, type AuthContextType } from '@/hooks/auth.context';
import { AuthProvider } from '@/hooks/AuthProvider';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** Prints the current path so tests can assert redirects */
export function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

/** Wrapper for renderHook: fresh QueryClient, no router or auth */
export function queryWrapper(client = createTestQueryClient()) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/** A fake AuthContext value; override only what the test cares about */
export function fakeAuth(overrides: Partial<AuthContextType> = {}): AuthContextType {
  return {
    user: null,
    isAuthenticated: false,
    role: null,
    loading: false,
    mustResetPassword: false,
    signUp: async () => ({ error: null }),
    signIn: async () => ({ error: null }),
    signOut: async () => {},
    resetPassword: async () => ({ data: {}, error: null }),
    uploadProfileImage: async () => ({ error: null }),
    deleteProfileImage: async () => ({ error: null }),
    getProfileImageUrl: () => null,
    ...overrides,
  };
}

interface RenderOptions {
  path?: string;
  /** Extra routes rendered next to the element under test */
  routes?: Record<string, ReactElement>;
  /** Use a fake auth context instead of the real AuthProvider */
  auth?: AuthContextType;
}

/**
 * Render `ui` at `path` inside a router, QueryClient and auth provider.
 * Every other path renders a LocationProbe, so redirects are observable.
 */
export function renderWithProviders(ui: ReactElement, { path = '/', routes = {}, auth }: RenderOptions = {}) {
  const client = createTestQueryClient();
  const tree = (
    <Routes>
      <Route path={path} element={ui} />
      {Object.entries(routes).map(([p, el]) => (
        <Route key={p} path={p} element={el} />
      ))}
      <Route path="*" element={<LocationProbe />} />
    </Routes>
  );

  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {auth ? <AuthContext.Provider value={auth}>{tree}</AuthContext.Provider> : <AuthProvider>{tree}</AuthProvider>}
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...result, client };
}
