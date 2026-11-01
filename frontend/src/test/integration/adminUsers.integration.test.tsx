// Admin user management against backend/routes/admin_routes.py and data_routes.py

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Toaster } from 'sonner';
import AdminUsers from '@/pages/AdminUsers';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserRole } from '@/constants/roles';
import { API, server, tokenFor, users } from '@/test/server';
import { renderWithProviders } from '@/test/utils';

const people = [
  { id: 10, user_id: 10, email: 'sara@uit.ac.ma', full_name: 'Sara Etudiante', role: 'STUDENT' },
  { id: 11, user_id: 11, email: 'omar@uit.ac.ma', full_name: 'Omar Agent', role: 'AGENT' },
];

function usersApi() {
  const updates: { id: string; body: unknown }[] = [];
  server.use(
    http.get(`${API}/profiles`, () =>
      HttpResponse.json({ data: people.map((p) => ({ ...p, created_at: '2026-10-01T00:00:00' })), count: people.length })
    ),
    http.get(`${API}/user_roles`, () =>
      HttpResponse.json({ data: people.map((p) => ({ id: p.id, user_id: p.user_id, role: p.role })), count: people.length })
    ),
    http.put(`${API}/admin/users/:id`, async ({ params, request }) => {
      const body = (await request.json()) as { role: string };
      updates.push({ id: String(params.id), body });
      people.find((p) => String(p.id) === params.id)!.role = body.role;
      return HttpResponse.json({ id: Number(params.id), role: body.role });
    }),
    http.get(`${API}/notifications`, () => HttpResponse.json([]))
  );
  return updates;
}

const page = (
  <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
    <AdminUsers />
    <Toaster />
  </ProtectedRoute>
);

const rowOf = async (email: string) => (await screen.findByText(email)).closest('tr') as HTMLElement;

beforeEach(() => {
  localStorage.setItem('auth_token', tokenFor(users.admin));
  people[0].role = 'STUDENT';
});

describe('AdminUsers', () => {
  it('lists users with their role badges', async () => {
    usersApi();
    renderWithProviders(page, { path: '/users' });

    expect(within(await rowOf('sara@uit.ac.ma')).getByText('Étudiant')).toBeInTheDocument();
    expect(within(await rowOf('omar@uit.ac.ma')).getByText('Agent BFC')).toBeInTheDocument();
  });

  it('promotes a student to agent through PUT /admin/users/<id>', async () => {
    const updates = usersApi();
    const user = userEvent.setup();
    renderWithProviders(page, { path: '/users' });

    await user.click(within(await rowOf('sara@uit.ac.ma')).getByRole('button', { name: 'Modifier le rôle' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Sara Etudiante/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(updates).toEqual([{ id: '10', body: { role: 'AGENT' } }]));
    expect(await screen.findByText(/mis à jour en Agent BFC/)).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByText('sara@uit.ac.ma').closest('tr')!).getByText('Agent BFC')).toBeInTheDocument());
  });

  it('offers no role change for administrators', async () => {
    usersApi();
    people.push({ id: 12, user_id: 12, email: 'root@uit.ac.ma', full_name: 'Admin', role: 'ADMIN' });
    renderWithProviders(page, { path: '/users' });

    const row = await rowOf('root@uit.ac.ma');
    expect(within(row).queryByRole('button', { name: 'Modifier le rôle' })).not.toBeInTheDocument();
    people.pop();
  });
});
