import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

interface UseNotificationsQueryOptions {
  userId?: string;
  enabled?: boolean;
  limit?: number;
}

/**
 * React Query-based hook for notifications with caching
 */
export function useNotificationsQuery(options: UseNotificationsQueryOptions = {}) {
  const { userId, enabled = true, limit } = options;
  const queryClient = useQueryClient();

  // Main query for fetching notifications
  const notificationsQuery = useQuery({
    queryKey: [CACHE_KEYS.NOTIFICATIONS, userId, { limit }],
    queryFn: async (): Promise<NotificationRow[]> => {
      if (!userId) return [];

      const { data, error } = await api.data.getMany<NotificationRow>('notifications', {
        filters: [{ field: 'user_id', operator: 'eq', value: userId }],
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
  });

  // Mutation for marking a notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.data.update<NotificationRow>('notifications', id, { read: true });
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
      const notifications = notificationsQuery.data || [];
      const unreadNotifications = notifications.filter(n => !n.read);
      
      await Promise.all(
        unreadNotifications.map(n => 
          api.data.update<NotificationRow>('notifications', n.id, { read: true })
        )
      );
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
  const unreadCount = notifications.filter(n => !n.read).length;

  // Add a new notification locally (for realtime updates)
  const addNotification = (notification: NotificationRow) => {
    queryClient.setQueryData<NotificationRow[]>(
      [CACHE_KEYS.NOTIFICATIONS, userId, { limit }],
      (old) => old ? [notification, ...old] : [notification]
    );
  };

  return {
    // Query state
    notifications,
    unreadCount,
    loading: notificationsQuery.isLoading,
    error: notificationsQuery.error?.message || null,
    isRefetching: notificationsQuery.isRefetching,
    
    // Query actions
    refetch: notificationsQuery.refetch,
    addNotification,
    
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
