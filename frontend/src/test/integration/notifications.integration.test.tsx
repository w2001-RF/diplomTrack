// Notifications against the Flask contract in backend/routes/notification_routes.py

import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useNotificationsQuery } from '@/hooks/api';
import { NotificationsMenu } from '@/components/layout/NotificationsMenu';
import type { NotificationRow } from '@/lib/api/models';
import { API, server, tokenFor, users } from '@/test/server';
import { queryWrapper, renderWithProviders } from '@/test/utils';

const now = new Date().toISOString();

/** In-memory notifications table with the real routes on top of it */
function notificationsApi(rows: NotificationRow[]) {
  const calls: string[] = [];
  server.use(
    http.get(`${API}/notifications`, () => HttpResponse.json(rows)),
    http.patch(`${API}/notifications/read-all`, () => {
      calls.push('read-all');
      rows.forEach((r) => (r.is_read = true));
      return HttpResponse.json({ message: 'All notifications marked as read', updated: rows.length });
    }),
    http.patch(`${API}/notifications/:id/read`, ({ params }) => {
      calls.push(`read ${params.id}`);
      rows.find((r) => r.id === params.id)!.is_read = true;
      return HttpResponse.json({ message: 'Notification marked as read' });
    }),
    http.delete(`${API}/notifications/:id`, ({ params }) => {
      calls.push(`delete ${params.id}`);
      rows.splice(rows.findIndex((r) => r.id === params.id), 1);
      return new HttpResponse(null, { status: 204 });
    })
  );
  return calls;
}

const row = (id: string, overrides: Partial<NotificationRow> = {}): NotificationRow => ({
  id,
  user_id: users.agent.id,
  ticket_id: null,
  type: 'info',
  title: `Notification ${id}`,
  message: `Message ${id}`,
  is_read: false,
  created_at: now,
  ...overrides,
});

beforeEach(() => localStorage.setItem('auth_token', tokenFor(users.agent)));

describe('useNotificationsQuery', () => {
  const setup = () =>
    renderHook(() => useNotificationsQuery({ userId: users.agent.id, pollInterval: false }), {
      wrapper: queryWrapper(),
    });

  it('counts unread items from is_read', async () => {
    notificationsApi([row('1'), row('2', { is_read: true }), row('3')]);

    const { result } = setup();

    await waitFor(() => expect(result.current.notifications).toHaveLength(3));
    expect(result.current.unreadCount).toBe(2);
  });

  it('marks one as read through PATCH /<id>/read and refetches', async () => {
    const calls = notificationsApi([row('1'), row('2')]);
    const { result } = setup();
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(() => result.current.markAsRead('1'));

    expect(calls).toEqual(['read 1']);
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
  });

  it('marks all as read with a single PATCH /read-all', async () => {
    const calls = notificationsApi([row('1'), row('2'), row('3')]);
    const { result } = setup();
    await waitFor(() => expect(result.current.unreadCount).toBe(3));

    await act(() => result.current.markAllAsRead());

    expect(calls).toEqual(['read-all']);
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it('does not query without a user', () => {
    // onUnhandledRequest: 'error' would fail the test if a request went out
    const { result } = renderHook(() => useNotificationsQuery({ pollInterval: false }), { wrapper: queryWrapper() });
    expect(result.current.notifications).toEqual([]);
  });

  it('exposes API errors', async () => {
    server.use(http.get(`${API}/notifications`, () => HttpResponse.json({ error: 'Erreur serveur' }, { status: 500 })));

    const { result } = setup();

    await waitFor(() => expect(result.current.error).toBe('Erreur serveur'));
  });
});

describe('NotificationsMenu', () => {
  async function openMenu() {
    const user = userEvent.setup();
    const bell = await screen.findByRole('button', { name: 'Notifications' });
    await user.click(bell);
    return { user, menu: await screen.findByRole('menu') };
  }

  it('shows the unread count on the bell', async () => {
    notificationsApi([row('1'), row('2'), row('3', { is_read: true })]);

    renderWithProviders(<NotificationsMenu />);

    const bell = await screen.findByRole('button', { name: 'Notifications' });
    await waitFor(() => expect(within(bell).getByText('2')).toBeInTheDocument());
  });

  it('opens the dossier and marks the notification read on click', async () => {
    const calls = notificationsApi([row('5', { ticket_id: '42', title: 'Délai dépassé' })]);
    renderWithProviders(<NotificationsMenu />);

    const { user, menu } = await openMenu();
    await user.click(within(menu).getByText('Délai dépassé'));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/dossier/42'));
    expect(calls).toContain('read 5');
  });

  it('says so when there are no notifications', async () => {
    notificationsApi([]);
    renderWithProviders(<NotificationsMenu />);

    const { menu } = await openMenu();

    expect(within(menu).getByText('Aucune notification')).toBeInTheDocument();
  });
});
