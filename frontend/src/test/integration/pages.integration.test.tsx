// The dossier pages (TicketDetail, MyDossier, CreateTicket) against a fake API
// with one realistic dossier, shaped like the Flask serializers.

import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Toaster } from 'sonner';
import TicketDetail from '@/pages/TicketDetail';
import MyDossier from '@/pages/MyDossier';
import CreateTicket from '@/pages/CreateTicket';
import NotFound from '@/pages/NotFound';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserRole } from '@/constants/roles';
import { API, server, tokenFor, users } from '@/test/server';
import { renderWithProviders } from '@/test/utils';

const milestone = (id: number, code: string, label: string, order: number) => ({ id, code, label, order, is_terminal: code === 'DOSSIER_CLOTURE' });
const MILESTONES = [
  milestone(1, 'CREATED', 'Créé', 1),
  milestone(8, 'DOSSIER_EN_COURS', 'Dossier en cours', 8),
  milestone(9, 'PIECES_COMPLETES', 'Pièces complètes', 9),
  milestone(12, 'DOSSIER_CLOTURE', 'Dossier clôturé', 12),
];

const formation = { id: 1, formation_name: 'Génie logiciel', formation_type: { code: 'LUS', label: 'Licence' } };
const student = {
  id: 7, user_id: 3, first_name: 'Karim', last_name: 'Parcours', email: 'etudiant@uit.ac.ma',
  num_apogee: 20261234, academic_year: '2025-2026', formation_id: 1, formation,
};

function dossier(code = 'DOSSIER_EN_COURS') {
  const current = MILESTONES.find((m) => m.code === code)!;
  return {
    id: 5, reference: 'DT-2026-0005', status: code === 'DOSSIER_CLOTURE' ? 'COMPLETED' : 'PENDING',
    current_milestone_id: current.id, current_milestone: current, diploma_validation_type: 'DIPLOMA',
    student, student_id: 7, created_at: '2026-10-01T09:00:00', updated_at: '2026-10-02T09:00:00',
    chronologies: [
      { id: 1, milestone: MILESTONES[0], milestone_id: 1, started_at: '2026-10-01T09:00:00', ended_at: '2026-10-02T09:00:00', status: 'DONE' },
      { id: 2, milestone: current, milestone_id: current.id, started_at: '2026-10-02T09:00:00', ended_at: null, status: 'PENDING' },
    ],
    documents: [],
  };
}

const documents = [
  { id: 11, ticket_id: 5, document_type: 'CIN', file_path: '/u/cin.pdf', is_validated: false, created_at: '2026-10-02T09:00:00' },
  { id: 12, ticket_id: 5, document_type: 'BAC', file_path: '/u/bac.pdf', is_validated: true, created_at: '2026-10-02T09:00:00' },
];

type Call = { method: string; path: string; body?: unknown };

function dossierApi(code = 'DOSSIER_EN_COURS') {
  const calls: Call[] = [];
  const record = async (request: Request) => {
    const body = await request.clone().json().catch(() => undefined);
    calls.push({ method: request.method, path: new URL(request.url).pathname.replace('/api', ''), body });
  };
  let ticket = dossier(code);
  server.use(
    http.get(`${API}/tickets/:id`, () => HttpResponse.json(ticket)),
    http.get(`${API}/tickets`, () => HttpResponse.json({ tickets: [ticket], total: 1, pages: 1, page: 1, length: 100 })),
    http.patch(`${API}/tickets/:id/transition`, async ({ request }) => {
      await record(request);
      const { next_state } = (await request.json()) as { next_state: string };
      if (next_state === 'PIECES_COMPLETES') {
        return HttpResponse.json({ error: 'Cannot transition to PIECES_COMPLETES. Missing or unvalidated documents: CIN', code: 4001, status: 400 }, { status: 400 });
      }
      ticket = dossier(next_state);
      return HttpResponse.json({ message: 'Ticket updated successfully', ticket });
    }),
    http.post(`${API}/tickets`, async ({ request }) => {
      await record(request);
      return HttpResponse.json(dossier('CREATED'), { status: 201 });
    }),
    http.get(`${API}/documents`, () => HttpResponse.json({ documents, total: documents.length })),
    http.patch(`${API}/documents/:id/validate`, async ({ request }) => {
      await record(request);
      return HttpResponse.json({ message: 'ok', document: { ...documents[0], is_validated: true } });
    }),
    http.get(`${API}/milestones`, () => HttpResponse.json({ data: MILESTONES, count: MILESTONES.length })),
    http.get(`${API}/ticket_milestone_history`, () => HttpResponse.json([])),
    http.get(`${API}/profiles`, () => HttpResponse.json({ data: [], count: 0 })),
    http.get(`${API}/notifications`, () => HttpResponse.json([])),
    http.get(`${API}/students`, ({ request }) => {
      const byUser = new URL(request.url).searchParams.get('filter[user_id][eq]');
      return HttpResponse.json({ students: byUser && byUser !== '3' ? [] : [student], total: 1, page: 1 });
    }),
    http.get(`${API}/formations`, () => HttpResponse.json({ data: [formation], count: 1 }))
  );
  return calls;
}

describe('TicketDetail (agent)', () => {
  beforeEach(() => localStorage.setItem('auth_token', tokenFor(users.agent)));

  const open = () =>
    renderWithProviders(
      <ProtectedRoute allowedRoles={[UserRole.AGENT, UserRole.ADMIN, UserRole.STUDENT]}>
        <TicketDetail />
        <Toaster />
      </ProtectedRoute>,
      { path: '/dossier/:id', initialPath: '/dossier/5' }
    );

  it('shows the dossier, its student and its documents', async () => {
    dossierApi();
    open();

    expect(await screen.findByText('DT-2026-0005')).toBeInTheDocument();
    expect(screen.getAllByText(/Parcours/).length).toBeGreaterThan(0);
    expect(await screen.findByText('/u/cin.pdf')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('Dossier en cours');
  });

  it('moves the dossier through the milestone select', async () => {
    const calls = dossierApi();
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Dossier clôturé' }));

    await waitFor(() => expect(calls).toContainEqual(expect.objectContaining({
      method: 'PATCH', path: '/tickets/5/transition', body: expect.objectContaining({ next_state: 'DOSSIER_CLOTURE' }),
    })));
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Dossier clôturé'));
  });

  it('shows the workflow error when a transition is refused', async () => {
    dossierApi();
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Pièces complètes' }));

    expect(await screen.findByText(/Missing or unvalidated documents: CIN/)).toBeInTheDocument();
  });

  it('validates a document through the confirmation dialog', async () => {
    const calls = dossierApi();
    const user = userEvent.setup();
    open();

    await user.click(await screen.findByRole('button', { name: /^Valider$/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Confirmer la validation/ }));

    await waitFor(() => expect(calls).toContainEqual(expect.objectContaining({ method: 'PATCH', path: '/documents/11/validate' })));
  });
});

describe('MyDossier (student)', () => {
  beforeEach(() => localStorage.setItem('auth_token', tokenFor(users.student)));

  const open = () =>
    renderWithProviders(
      <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
        <MyDossier />
      </ProtectedRoute>,
      { path: '/my-dossier' }
    );

  it('shows the dossier with its current milestone', async () => {
    // statusLabels[ticket.status] used to be blank: status is COMPLETED, not a milestone code
    dossierApi('DOSSIER_CLOTURE');
    open();

    expect(await screen.findByText('DT-2026-0005')).toBeInTheDocument();
    expect(screen.getAllByText('Dossier clôturé').length).toBeGreaterThan(0);
  });
});

describe('CreateTicket (agent)', () => {
  beforeEach(() => localStorage.setItem('auth_token', tokenFor(users.agent)));

  it('creates a dossier for the selected student and opens it', async () => {
    const calls = dossierApi();
    const user = userEvent.setup();
    renderWithProviders(
      <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
        <CreateTicket />
      </ProtectedRoute>,
      { path: '/dossiers/create' }
    );

    await user.type(await screen.findByPlaceholderText(/Rechercher par nom/), 'Parcours');
    await user.click(await screen.findByText('Karim Parcours'));
    await user.click(screen.getByRole('button', { name: /Créer le ticket/ }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dossier/5'));
    expect(calls).toContainEqual(expect.objectContaining({
      method: 'POST', path: '/tickets', body: { student_id: 7, initial_milestone_code: 'CREATED' },
    }));
  });
});

describe('NotFound', () => {
  it('says the page does not exist', () => {
    renderWithProviders(<NotFound />, { path: '/nowhere' });
    expect(screen.getByText('404')).toBeInTheDocument();
  });
});

