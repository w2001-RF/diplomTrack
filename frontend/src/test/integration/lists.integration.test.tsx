// List endpoints return paginated envelopes ({tickets|students|documents, total});
// these tests pin the shapes the pages read (found by the Robot Framework QA run)

import { beforeEach, describe, expect, it } from 'vitest';
import { renderHook, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import AgentDashboard from '@/pages/AgentDashboard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { UserRole } from '@/constants/roles';
import { useStudentsQuery, useTicketsQuery } from '@/hooks/api';
import { API, server, tokenFor, users } from '@/test/server';
import { queryWrapper, renderWithProviders } from '@/test/utils';

const ticket = (id: number, code: string) => ({
  id,
  reference: `DT-2026-${id}`,
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
