// List endpoints return paginated envelopes ({tickets|students|documents, total});
// these tests pin the shapes the pages read (found by the Robot Framework QA run)

import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AgentDashboard from '@/pages/AgentDashboard';
import AgentTickets from '@/pages/AgentTickets';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserRole } from '@/constants/roles';
import { useStudentByUserQuery, useStudentsQuery, useTicketsQuery } from '@/hooks/api';
import { API, server, tokenFor, users } from '@/test/server';
import { queryWrapper, renderWithProviders } from '@/test/utils';

const ticket = (id: number, code: string) => ({
  id,
  reference: `DT-2026-${id}`,
  // Coarse status as the API sends it; the milestone is in current_milestone
  status: code === 'DOSSIER_CLOTURE' ? 'COMPLETED' : code === 'CREATED' ? 'OPEN' : 'PENDING',
  current_milestone: { id: 1, code, label: code },
  student: { first_name: 'Yasmine', last_name: `Etudiante${id}`, num_apogee: 1000 + id },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

function ticketsApi(tickets: ReturnType<typeof ticket>[]) {
  server.use(
    // Same envelope as backend/routes/ticket_routes.py get_tickets()
    http.get(`${API}/tickets`, () =>
      HttpResponse.json({ tickets, total: tickets.length, pages: 1, page: 1, length: 10 })
    ),
    http.get(`${API}/notifications`, () => HttpResponse.json([]))
  );
}

beforeEach(() => localStorage.setItem('auth_token', tokenFor(users.agent)));

describe('useTicketsQuery', () => {
  it('exposes the tickets envelope the pages read', async () => {
    ticketsApi([ticket(1, 'CREATED'), ticket(2, 'DOSSIER_CLOTURE')]);

    const { result } = renderHook(() => useTicketsQuery(), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.tickets?.total).toBe(2));
    expect(result.current.tickets?.tickets.map((t) => t.reference)).toEqual(['DT-2026-1', 'DT-2026-2']);
  });
});

describe('lists longer than one page', () => {
  // The API pages tickets with `length` and students with `limit` (default 10)
  const paged = <T,>(rows: T[], url: URL, sizeParam: string) => {
    const page = Number(url.searchParams.get('page') ?? 1);
    const size = Number(url.searchParams.get(sizeParam) ?? 10);
    return { slice: rows.slice((page - 1) * size, page * size), pages: Math.ceil(rows.length / size), page, size };
  };

  it('useTicketsQuery returns every ticket, not just the first page', async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ticket(i + 1, 'CREATED'));
    server.use(
      http.get(`${API}/tickets`, ({ request }) => {
        const p = paged(rows, new URL(request.url), 'length');
        return HttpResponse.json({ tickets: p.slice, total: rows.length, pages: p.pages, page: p.page, length: p.size });
      })
    );

    const { result } = renderHook(() => useTicketsQuery(), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.tickets.tickets).toHaveLength(25));
    expect(result.current.tickets.total).toBe(25);
    expect(result.current.tickets.tickets.at(-1)?.reference).toBe('DT-2026-25');
  });

  it('useStudentsQuery returns every student, not just the first page', async () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, first_name: 'E', last_name: `N${i + 1}` }));
    server.use(
      http.get(`${API}/students`, ({ request }) => {
        const p = paged(rows, new URL(request.url), 'limit');
        return HttpResponse.json({ students: p.slice, total: rows.length, page: p.page });
      })
    );

    const { result } = renderHook(() => useStudentsQuery(), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.students).toHaveLength(23));
  });
});

describe('useStudentsQuery', () => {
  it('unwraps the {students, total} envelope', async () => {
    server.use(
      http.get(`${API}/students`, () =>
        HttpResponse.json({ students: [{ id: 1, first_name: 'Yasmine', last_name: 'QaListe' }], total: 1, page: 1 })
      )
    );

    const { result } = renderHook(() => useStudentsQuery(), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.students).toHaveLength(1));
    expect(result.current.students[0].last_name).toBe('QaListe');
  });
});

describe('AgentDashboard', () => {
  const page = (
    <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
      <AgentDashboard />
    </ProtectedRoute>
  );

  it('lists recent dossiers and counts them', async () => {
    ticketsApi([ticket(1, 'CREATED'), ticket(2, 'DOSSIER_CLOTURE')]);

    renderWithProviders(page, { path: '/agent' });

    expect(await screen.findByText('DT-2026-1')).toBeInTheDocument();
    expect(screen.getByText('DT-2026-2')).toBeInTheDocument();
  });

  it('shows the empty state instead of crashing when there are no dossiers', async () => {
    ticketsApi([]);

    renderWithProviders(page, { path: '/agent' });

    expect(await screen.findByText('Aucun dossier')).toBeInTheDocument();
  });
});

describe('AgentTickets', () => {
  it('labels each dossier with its current milestone', async () => {
    ticketsApi([ticket(1, 'DOSSIER_CLOTURE'), ticket(2, 'EN_ATTENTE_REPONSE')]);

    renderWithProviders(
      <ProtectedRoute allowedRoles={[UserRole.AGENT]}>
        <AgentTickets />
      </ProtectedRoute>,
      { path: '/dossiers' }
    );

    const closed = (await screen.findByText('DT-2026-1')).closest('[class*="cursor-pointer"], tr, li, div') as HTMLElement;
    expect(await screen.findByText('Dossier clôturé')).toBeInTheDocument();
    expect(screen.getByText('En attente de réponse')).toBeInTheDocument();
    expect(closed).toBeTruthy();
  });
});

describe('useStudentByUserQuery', () => {
  it("returns the signed-in student's record, not the envelope", async () => {
    let filter: string | null = null;
    server.use(
      http.get(`${API}/students`, ({ request }) => {
        filter = new URL(request.url).searchParams.get('filter[user_id][eq]');
        return HttpResponse.json({ students: [{ id: 7, user_id: 3, first_name: 'Karim', last_name: 'Parcours' }], total: 1, page: 1 });
      })
    );

    const { result } = renderHook(() => useStudentByUserQuery('3'), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.data).toMatchObject({ id: 7, last_name: 'Parcours' }));
    expect(filter).toBe('3');
  });

  it('is null when the account has no student record', async () => {
    server.use(http.get(`${API}/students`, () => HttpResponse.json({ students: [], total: 0, page: 1 })));

    const { result } = renderHook(() => useStudentByUserQuery('3'), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});
