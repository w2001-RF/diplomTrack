// Data hooks against handlers that mirror the Flask routes (method, path and
// body shape), so a hook calling the wrong endpoint fails here.

import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  useAllProfilesQuery,
  useDocumentsQuery,
  useMilestoneHistoryQuery,
  useMilestonesQuery,
  useProfileQuery,
  useSettingsQuery,
  useStudentsQuery,
  useTicketsQuery,
  useUpdateProfile,
} from '@/hooks/api';
import { useBulkCreateAgentsMutation } from '@/hooks/api/useBulkCreateAgentsMutation';
import { useDeleteUserMutation } from '@/hooks/api/useDeleteUserMutation';
import { useFormationsQuery } from '@/hooks/api/useFormationsQuery';
import { API, server, tokenFor, users } from '@/test/server';
import { queryWrapper } from '@/test/utils';

type Call = { method: string; path: string; body?: unknown };

/** Records every request the handlers receive */
function recorder() {
  const calls: Call[] = [];
  const record = async (request: Request) => {
    const url = new URL(request.url);
    const body = ['POST', 'PUT', 'PATCH'].includes(request.method)
      ? await request.clone().json().catch(() => undefined)
      : undefined;
    calls.push({ method: request.method, path: url.pathname.replace('/api', ''), body });
  };
  return { calls, record };
}

const milestones = [
  { id: 1, code: 'CREATED', label: 'Created', order: 1, is_terminal: false },
  { id: 8, code: 'DOSSIER_EN_COURS', label: 'En cours', order: 8, is_terminal: false },
];

beforeEach(() => localStorage.setItem('auth_token', tokenFor(users.agent)));

describe('useDocumentsQuery', () => {
  function documentsApi() {
    const { calls, record } = recorder();
    server.use(
      http.get(`${API}/documents`, () =>
        HttpResponse.json({ documents: [{ id: 1, document_type: 'CIN', is_validated: true }], total: 1 })
      ),
      http.patch(`${API}/documents/:id/validate`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ message: 'ok', document: { id: 1, is_validated: true } });
      }),
      http.patch(`${API}/documents/:id/invalidate`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ message: 'ok', document: { id: 1, is_validated: false } });
      }),
      http.delete(`${API}/documents/:id`, async ({ request }) => {
        await record(request);
        return new HttpResponse(null, { status: 204 });
      })
    );
    return calls;
  }

  it('lists the documents of a ticket', async () => {
    documentsApi();
    const { result } = renderHook(() => useDocumentsQuery({ ticketId: '5' }), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.documents).toHaveLength(1));
  });

  it('validates, invalidates with a reason and deletes', async () => {
    const calls = documentsApi();
    const { result } = renderHook(() => useDocumentsQuery({ ticketId: '5' }), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.documents).toHaveLength(1));

    await act(() => result.current.validateDocument('1', 'Conforme'));
    await act(() => result.current.inValidateDocument('1', 'Illisible'));
    await act(() => result.current.deleteDocument('1'));

    expect(calls).toEqual([
      { method: 'PATCH', path: '/documents/1/validate', body: { comment: 'Conforme' } },
      { method: 'PATCH', path: '/documents/1/invalidate', body: { comment: 'Illisible' } },
      { method: 'DELETE', path: '/documents/1', body: undefined },
    ]);
  });

  it('does not query without a ticket', () => {
    const { result } = renderHook(() => useDocumentsQuery({}), { wrapper: queryWrapper() });
    expect(result.current.documents).toEqual([]);
  });
});

describe('useMilestonesQuery and history', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API}/milestones`, () => HttpResponse.json({ data: milestones, count: milestones.length })),
      // Same shape as ChronologieSerializer.serialize_transition
      http.get(`${API}/ticket_milestone_history`, () =>
        HttpResponse.json([
          { id: 2, ticket_id: 5, from_milestone: milestones[0], to_milestone: milestones[1], changed_by: 2,
            changed_at: '2026-10-01T10:00:00', notes: 'Pièces reçues' },
        ])
      ),
      http.get(`${API}/profiles`, () =>
        HttpResponse.json({ data: [{ id: 2, user_id: 2, full_name: 'Agent BFC', email: 'agent@uit.ac.ma' }], count: 1 })
      )
    );
  });

  it('finds milestones by code and the first one by order', async () => {
    const { result } = renderHook(() => useMilestonesQuery(), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.milestones).toHaveLength(2));
    expect(result.current.getFirstMilestone()?.code).toBe('CREATED');
    expect(result.current.getMilestoneByCode('DOSSIER_EN_COURS')?.order).toBe(8);
  });

  it('enriches each transition with who made it', async () => {
    const { result } = renderHook(() => useMilestoneHistoryQuery('5'), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    const [entry] = result.current.data!;
    expect(entry.to_milestone?.code).toBe('DOSSIER_EN_COURS');
    expect(entry.changed_by_profile).toEqual({ full_name: 'Agent BFC', email: 'agent@uit.ac.ma' });
  });
});

describe('useSettingsQuery', () => {
  it('loads settings and saves several at once', async () => {
    const { calls, record } = recorder();
    server.use(
      http.get(`${API}/app_settings`, () => HttpResponse.json({ data: [{ id: 1, warning_delay_days: 14 }], count: 1 })),
      http.patch(`${API}/app_settings/:id`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ id: 1 });
      })
    );
    const { result } = renderHook(() => useSettingsQuery(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.settings).toHaveLength(1));

    await act(() => result.current.updateMultipleSettings([{ id: '1', data: { warning_delay_days: 21 } }]));

    expect(calls).toEqual([{ method: 'PATCH', path: '/app_settings/1', body: { warning_delay_days: 21 } }]);
  });
});

describe('profiles', () => {
  const profile = { id: 2, user_id: 2, email: 'agent@uit.ac.ma', full_name: 'Agent BFC' };

  it('loads one profile and all profiles', async () => {
    server.use(http.get(`${API}/profiles`, () => HttpResponse.json({ data: [profile], count: 1 })));

    const one = renderHook(() => useProfileQuery('2'), { wrapper: queryWrapper() });
    const all = renderHook(() => useAllProfilesQuery(), { wrapper: queryWrapper() });

    await waitFor(() => expect(one.result.current.data).toMatchObject({ email: 'agent@uit.ac.ma' }));
    await waitFor(() => expect(all.result.current.data).toHaveLength(1));
  });

  it('updates a profile with PUT, the only method the API accepts', async () => {
    // It used to send PATCH, which Flask answers with 405
    const { calls, record } = recorder();
    server.use(
      http.put(`${API}/profiles/:id`, async ({ request }) => {
        await record(request);
        return HttpResponse.json(profile);
      })
    );
    const { result } = renderHook(() => useUpdateProfile(), { wrapper: queryWrapper() });

    await act(() => result.current.mutateAsync({ profileId: '2', data: { phone_number: '0600000000' } }));

    expect(calls).toEqual([{ method: 'PUT', path: '/profiles/2', body: { phone_number: '0600000000' } }]);
  });
});

describe('admin user mutations', () => {
  it('creates agents in bulk and returns their one-time passwords', async () => {
    const { calls, record } = recorder();
    server.use(
      http.post(`${API}/admin/users/agents/bulk`, async ({ request }) => {
        await record(request);
        return HttpResponse.json(
          { created: [{ id: 9, username: 'a1', email: 'a1@uit.ac.ma', password: 'Tmp-1' }], count: 1 },
          { status: 201 }
        );
      })
    );
    const { result } = renderHook(() => useBulkCreateAgentsMutation(), { wrapper: queryWrapper() });

    const response = await act(() => result.current.mutateAsync({ agents: [{ username: 'a1', email: 'a1@uit.ac.ma' }] }));

    expect(response.created[0].password).toBe('Tmp-1');
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/admin/users/agents/bulk' });
  });

  it('deletes a user', async () => {
    const { calls, record } = recorder();
    server.use(
      http.delete(`${API}/admin/users/:id`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ message: 'deleted' });
      })
    );
    const { result } = renderHook(() => useDeleteUserMutation(), { wrapper: queryWrapper() });

    await act(() => result.current.mutateAsync('9'));

    expect(calls).toEqual([{ method: 'DELETE', path: '/admin/users/9', body: undefined }]);
  });
});

describe('useStudentsQuery mutations', () => {
  it('creates, updates with PUT, deletes and bulk-creates students', async () => {
    const { calls, record } = recorder();
    server.use(
      http.get(`${API}/students`, () => HttpResponse.json({ students: [], total: 0, page: 1 })),
      http.post(`${API}/students`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ id: 1 }, { status: 201 });
      }),
      http.put(`${API}/students/:id`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ id: 1 });
      }),
      http.delete(`${API}/students/:id`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ message: 'deleted' });
      }),
      http.post(`${API}/students/bulk`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ success: 1, failed: 0, total: 1, errors: [] });
      })
    );
    const { result } = renderHook(() => useStudentsQuery(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.createStudent({ first_name: 'A', last_name: 'B', num_apogee: '1', email: 'a@b.ma', academic_year: '2025-2026' }));
    await act(() => result.current.updateStudent('1', { last_name: 'C' }));
    await act(() => result.current.deleteStudent('1'));
    await act(() => result.current.createManyStudents([{ first_name: 'D', last_name: 'E', academic_year: '2025-2026' } as never]));

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /students',
      'PUT /students/1',
      'DELETE /students/1',
      'POST /students/bulk',
    ]);
    expect(calls[3].body).toMatchObject({ students: [expect.objectContaining({ first_name: 'D' })] });
  });
});

describe('useTicketsQuery mutations', () => {
  it('creates, imports, creates with history and deletes tickets', async () => {
    const { calls, record } = recorder();
    server.use(
      http.get(`${API}/tickets`, () => HttpResponse.json({ tickets: [], total: 0, pages: 0, page: 1, length: 100 })),
      http.post(`${API}/tickets`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ id: 3, reference: 'DT-3' }, { status: 201 });
      }),
      http.post(`${API}/tickets/import`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ success: true, imported: 2, failed: 0, total: 2, results: [] });
      }),
      http.post(`${API}/tickets/create-advanced`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ id: 4 }, { status: 201 });
      }),
      http.delete(`${API}/tickets/:id`, async ({ request }) => {
        await record(request);
        return HttpResponse.json({ message: 'deleted' });
      })
    );
    const { result } = renderHook(() => useTicketsQuery(), { wrapper: queryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const created = await act(() => result.current.createTicket({ student_id: '7', initial_milestone_code: 'CREATED' } as never));
    await act(() => result.current.importTickets({ tickets: [{}, {}] }));
    await act(() => result.current.createAdvancedTicket({ student_id: 7, target_milestone_code: 'DOSSIER_EN_COURS', chronologies: [] } as never));
    await act(() => result.current.deleteTicket('3'));

    expect(created).toMatchObject({ reference: 'DT-3' });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /tickets',
      'POST /tickets/import',
      'POST /tickets/create-advanced',
      'DELETE /tickets/3',
    ]);
  });
});

describe('useFormationsQuery', () => {
  it('lists formations', async () => {
    server.use(
      http.get(`${API}/formations`, () =>
        HttpResponse.json({ data: [{ id: 1, formation_name: 'Génie logiciel', formation_type: { code: 'LUS' } }], count: 1 })
      )
    );

    const { result } = renderHook(() => useFormationsQuery(), { wrapper: queryWrapper() });

    await waitFor(() => expect(result.current.formations).toHaveLength(1));
  });
});
