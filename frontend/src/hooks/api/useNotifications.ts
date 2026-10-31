import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];

interface UseNotificationsOptions {
  userId?: string;
  autoFetch?: boolean;
}

interface UseNotificationsReturn {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  deleteNotification: (id: string) => Promise<boolean>;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { userId, autoFetch = true } = options;
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await api.data.getMany<NotificationRow>('notifications', {
        filters: [{ field: 'user_id', operator: 'eq', value: userId }],
        sort: [{ field: 'created_at', direction: 'desc' }]
      });

      if (fetchError) throw new Error(fetchError.message);
      setNotifications(data || []);
    } catch (err: any) {
      const message = err.message || 'Erreur lors du chargement des notifications';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAsRead = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await api.data.update<NotificationRow>('notifications', id, { read: true });
      if (error) throw new Error(error.message);
      
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour');
      return false;
    }
  }, []);

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifications.map(n => 
          api.data.update<NotificationRow>('notifications', n.id, { read: true })
        )
      );
      
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('Toutes les notifications ont été marquées comme lues');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la mise à jour');
      return false;
    }
  }, [userId, notifications]);

  const deleteNotification = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await api.data.delete('notifications', id);
      if (error) throw new Error(error.message);
      
      setNotifications(prev => prev.filter(n => n.id !== id));
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
      return false;
    }
  }, []);

  useEffect(() => {
    if (autoFetch && userId) {
      fetchNotifications();
    }
  }, [autoFetch, userId, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  };
}
