import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NotificationRow } from '@/lib/api/models';
import { toast } from 'sonner';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';

interface UseNotificationsQueryOptions {
  userId?: string;
  enabled?: boolean;
  limit?: number;
  /** Polling interval in ms; the API has no push channel (default 60 s, false to disable) */
  pollInterval?: number | false;
  /** Show a toast when polling brings in notifications that were not there before */
  notifyOnNew?: boolean;
}

/**
 * React Query-based hook for notifications with caching
 */
export function useNotificationsQuery(options: UseNotificationsQueryOptions = {}) {
  const { userId, enabled = true, limit, pollInterval = 60 * 1000, notifyOnNew = false } = options;
  const queryClient = useQueryClient();

  // Main query for fetching notifications
  const notificationsQuery = useQuery({
    queryKey: [CACHE_KEYS.NOTIFICATIONS, userId, { limit }],
    queryFn: async (): Promise<NotificationRow[]> => {
      if (!userId) return [];

      // The API scopes notifications to the JWT's user
      const { data, error } = await api.data.getMany<NotificationRow>('notifications', {
        sort: [{ field: 'created_at', direction: 'desc' }],
        limit
      });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: enabled && !!userId,
    staleTime: 30 * 1000, // Notifications refresh more frequently - 30 seconds
    gcTime: defaultCacheConfig.cacheTime,
    refetchOnWindowFocus: true,
    refetchInterval: pollInterval,
  });

  // Toast for notifications that arrived since the previous fetch
  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const data = notificationsQuery.data;
    if (!data) return;
    const ids = new Set(data.map((n) => String(n.id)));
    if (notifyOnNew && seenIds.current && data.some((n) => !seenIds.current!.has(String(n.id)))) {
      toast.info('Nouvelle notification reçue');
    }
    seenIds.current = ids;
  }, [notificationsQuery.data, notifyOnNew]);

  // Mutation for marking a notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.data.customRequest(`notifications/${id}/read`, { method: 'PATCH' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.NOTIFICATIONS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  });

  // Mutation for marking all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await api.data.customRequest('notifications/read-all', { method: 'PATCH' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Toutes les notifications ont été marquées comme lues');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.NOTIFICATIONS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  });

  // Mutation for deleting a notification
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.data.delete('notifications', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Notification supprimée');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.NOTIFICATIONS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    }
  });

  // Mutation for deleting all notifications for a specific user
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      
      const { data, error } = await api.data.customRequest<{ message: string, deleted_count: number }>(
        'notifications/delete-all',
        {
          method: 'DELETE',
        }
      );
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      const count = data?.deleted_count || 0;
      toast.success(`${count} notification${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''}`);
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.NOTIFICATIONS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression des Notifications');
    }
  });

  const notifications = notificationsQuery.data || [];
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return {
    // Query state
    notifications,
    unreadCount,
    loading: notificationsQuery.isLoading,
    error: notificationsQuery.error?.message || null,
    isRefetching: notificationsQuery.isRefetching,
    
    // Query actions
    refetch: notificationsQuery.refetch,
    
    // Mutations
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    deleteNotification: deleteMutation.mutateAsync,
    deleteAllNotifications: deleteAllMutation.mutateAsync,
  
    
    // Mutation states
    isMarkingRead: markAsReadMutation.isPending,
    isMarkingAllRead: markAllAsReadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isDeletingAll: deleteAllMutation.isPending,
  };
}
