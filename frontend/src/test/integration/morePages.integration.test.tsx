// Admin, notification, student and profile pages against API-shaped fakes

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Toaster } from 'sonner';
import { Toaster as ShadcnToaster } from '@/components/ui/toaster';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminSettings from '@/pages/AdminSettings';
import Notifications from '@/pages/Notifications';
import AgentNotifications from '@/pages/AgentNotifications';
import AgentStudents from '@/pages/AgentStudents';
import Profile from '@/pages/Profile';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserRole } from '@/constants/roles';
import { API, server, tokenFor, users, type TestUser } from '@/test/server';
import { renderWithProviders } from '@/test/utils';

type Call = { method: string; path: string; body?: unknown };

function recorder() {
  const calls: Call[] = [];
  const record = async (request: Request) => {
    const body = await request.clone().json().catch(() => undefined);
    calls.push({ method: request.method, path: new URL(request.url).pathname.replace('/api', ''), body });
  };
  return { calls, record };
}

const ticket = (id: number, code: string) => ({
  id, reference: `DT-${id}`, status: code === 'DOSSIER_CLOTURE' ? 'COMPLETED' : 'PENDING',
  current_milestone: { id, code, label: code },
  student: { first_name: 'Etu', last_name: `Diant${id}`, num_apogee: id, academic_year: '2025-2026' },
  created_at: '2026-10-01T09:00:00', updated_at: '2026-10-02T09:00:00',
});

function asUser(user: TestUser, ui: JSX.Element, path: string, roles: UserRole[]) {
  localStorage.setItem('auth_token', tokenFor(user));
  return renderWithProviders(
    <ProtectedRoute allowedRoles={roles}>
      {ui}
      <Toaster />
      <ShadcnToaster />
    </ProtectedRoute>,
    { path }
  );
}

beforeEach(() => {
  server.use(http.get(`${API}/notifications`, () => HttpResponse.json([])));
});

describe('AdminDashboard', () => {
  it('counts dossiers by milestone', async () => {
    server.use(
      http.get(`${API}/tickets`, () =>
        HttpResponse.json({ tickets: [ticket(1, 'DOSSIER_CLOTURE'), ticket(2, 'DOSSIER_EN_COURS'), ticket(3, 'DOSSIER_CLOTURE')], total: 3, pages: 1, page: 1, length: 100 })
      ),
      http.get(`${API}/ticket_milestone_history`, () => HttpResponse.json([])),
      http.get(`${API}/milestones`, () => HttpResponse.json({ data: [], count: 0 })),
      http.get(`${API}/profiles`, () => HttpResponse.json({ data: [], count: 0 }))
    );

    asUser(users.admin, <AdminDashboard />, '/admin', [UserRole.ADMIN]);

    expect(await screen.findByText('Tableau de bord Admin')).toBeInTheDocument();
    const closed = (await screen.findByText('Clôturés')).closest('[class*="card"], div') as HTMLElement;
    await waitFor(() => expect(within(closed.parentElement as HTMLElement).getByText('2')).toBeInTheDocument());
  });
});

describe('AdminSettings', () => {
  it('saves only the settings that changed', async () => {
    const { calls, record } = recorder();
    // One row per setting, as AppSettingSerializer returns them
    const settings = [
      { id: 1, key: 'warning_delay_days', value: 14, type: 'integer', description: 'Délai' },
      { id: 1, key: 'alerts_email', value: 'alertes@uit.ac.ma', type: 'string', description: null },
      { id: 1, key: 'enable_email_notifications', value: true, type: 'boolean', description: null },
    ];
    server.use(
      http.get(`${API}/app_settings`, () => HttpResponse.json({ data: settings, count: settings.length })),
      http.patch(`${API}/app_settings/:id`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ id: 1 });
      })
    );
    const user = userEvent.setup();
    asUser(users.admin, <AdminSettings />, '/settings', [UserRole.ADMIN]);

    const delay = await screen.findByDisplayValue('14');
    await user.clear(delay);
    await user.type(delay, '21');
    await user.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() => expect(calls).toEqual([{ method: 'PATCH', path: '/app_settings/1', body: { warning_delay_days: 21 } }]));
  });
});

describe.each([
  ['Notifications (student)', Notifications, users.student, UserRole.STUDENT, '/notifications'],
  ['AgentNotifications', AgentNotifications, users.agent, UserRole.AGENT, '/agent-notifications'],
] as const)('%s', (_name, Page, account, role, path) => {
  it('lists notifications and marks them read', async () => {
    const { calls, record } = recorder();
    const rows = [
      { id: 1, user_id: account.id, ticket_id: 5, type: 'warning', title: 'Délai dépassé', message: 'Dossier en retard', is_read: false, created_at: new Date().toISOString() },
      { id: 2, user_id: account.id, ticket_id: null, type: 'info', title: 'Bienvenue', message: 'Compte créé', is_read: true, created_at: new Date().toISOString() },
    ];
    server.use(
      http.get(`${API}/notifications`, () => HttpResponse.json(rows)),
      http.patch(`${API}/notifications/read-all`, async ({ request }) => {
        await record(request);
        rows.forEach((r) => (r.is_read = true));
        return HttpResponse.json({ updated: 1 });
      }),
      http.patch(`${API}/notifications/:id/read`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({});
      })
    );
    const user = userEvent.setup();
    asUser(account, <Page />, path, [role]);

    expect(await screen.findByText('Délai dépassé')).toBeInTheDocument();
    expect(screen.getByText('Bienvenue')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tout marquer comme lu/ }));

    await waitFor(() => expect(calls.map((c) => `${c.method} ${c.path}`)).toContain('PATCH /notifications/read-all'));
  });
});

describe('AgentStudents', () => {
  it('lists students from every page of the API', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1, first_name: 'Etu', last_name: `Nom${i + 1}`, num_apogee: 1000 + i, academic_year: '2025-2026',
      formation_id: 1, formation: { id: 1, formation_name: 'Génie logiciel', formation_type: { code: 'LUS' } },
    }));
    server.use(
      http.get(`${API}/students`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get('page') ?? 1);
        const size = Number(url.searchParams.get('limit') ?? 10);
        return HttpResponse.json({ students: rows.slice((page - 1) * size, page * size), total: rows.length, page });
      }),
      http.get(`${API}/formations`, () => HttpResponse.json({ data: [], count: 0 }))
    );

    asUser(users.agent, <AgentStudents />, '/students', [UserRole.AGENT]);

    expect(await screen.findByText('Etu Nom1')).toBeInTheDocument();
    // The table pages client side (10 rows); the counter proves all 12 were loaded
    expect(await screen.findByText('12 résultats')).toBeInTheDocument();
  });
});

describe('Profile', () => {
  it('changes the password and reports the API error when it fails', async () => {
    let fail = true;
    server.use(
      http.get(`${API}/profiles`, () =>
        HttpResponse.json({ data: [{ id: users.agent.id, user_id: users.agent.id, email: users.agent.email, full_name: 'Agent BFC' }], count: 1 })
      ),
      http.put(`${API}/auth/reset-password`, () =>
        fail
          ? HttpResponse.json({ message: 'Mot de passe trop faible' }, { status: 400 })
          : HttpResponse.json({ message: 'Password updated' })
      )
    );
    const user = userEvent.setup();
    asUser(users.agent, <Profile />, '/profile', [UserRole.AGENT]);

    const changePassword = async () => {
      await user.click(await screen.findByRole('button', { name: /Changer le mot de passe/ }));
      await user.type(screen.getByLabelText(/actuel/i), 'Secret-123');
      await user.type(document.getElementById('newPassword')!, 'Nouveau-456!');
      await user.type(document.getElementById('confirmPassword')!, 'Nouveau-456!');
      await user.click(screen.getByRole('button', { name: /^Enregistrer$/ }));
    };

    expect(await screen.findByText('Mon Profil')).toBeInTheDocument();
    await changePassword();
    // A failed change used to be reported as a success
    expect(await screen.findByText('Mot de passe trop faible')).toBeInTheDocument();
    expect(screen.queryByText(/modifié avec succès/)).not.toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole('button', { name: /^Enregistrer$/ }));
    expect(await screen.findByText(/modifié avec succès/)).toBeInTheDocument();
  });
});
