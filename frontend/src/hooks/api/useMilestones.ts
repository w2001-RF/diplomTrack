import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type MilestoneRow = Database['public']['Tables']['milestones']['Row'];
type MilestoneHistoryRow = Database['public']['Tables']['ticket_milestone_history']['Row'];
type MilestoneHistoryInsert = Database['public']['Tables']['ticket_milestone_history']['Insert'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface MilestoneHistoryWithDetails extends MilestoneHistoryRow {
  from_milestone?: MilestoneRow | null;
  to_milestone?: MilestoneRow | null;
  changed_by_profile?: { full_name: string | null; email: string } | null;
}

interface UseMilestonesOptions {
  autoFetch?: boolean;
}

interface UseMilestonesReturn {
  milestones: MilestoneRow[];
  loading: boolean;
  error: string | null;
  fetchMilestones: () => Promise<void>;
  getFirstMilestone: () => MilestoneRow | null;
  getMilestoneByCode: (code: string) => MilestoneRow | null;
  getMilestoneHistory: (ticketId: string) => Promise<MilestoneHistoryWithDetails[]>;
  recordMilestoneChange: (data: MilestoneHistoryInsert) => Promise<boolean>;
}

export function useMilestones(options: UseMilestonesOptions = {}): UseMilestonesReturn {
  const { autoFetch = true } = options;
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMilestones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await api.data.getMany<MilestoneRow>('milestones', {
        sort: [{ field: 'ordre', direction: 'asc' }]
      });

      if (fetchError) throw new Error(fetchError.message);
      setMilestones(data || []);
    } catch (err: any) {
      const message = err.message || 'Erreur lors du chargement des jalons';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getFirstMilestone = useCallback((): MilestoneRow | null => {
    return milestones.length > 0 ? milestones[0] : null;
  }, [milestones]);

  const getMilestoneByCode = useCallback((code: string): MilestoneRow | null => {
    return milestones.find(m => m.code === code) || null;
  }, [milestones]);

  const getMilestoneHistory = useCallback(async (
    ticketId: string
  ): Promise<MilestoneHistoryWithDetails[]> => {
    try {
      const { data: historyData, error: historyError } = await api.data.getMany<MilestoneHistoryRow>(
        'ticket_milestone_history',
        {
          filters: [{ field: 'ticket_id', operator: 'eq', value: ticketId }],
          sort: [{ field: 'changed_at', direction: 'desc' }]
        }
      );

      if (historyError) throw new Error(historyError.message);

      // Enrich history with milestone and profile details
      const enrichedHistory: MilestoneHistoryWithDetails[] = await Promise.all(
        (historyData || []).map(async (h) => {
          const fromMilestone = milestones.find(m => m.id === h.from_milestone_id) || null;
          const toMilestone = milestones.find(m => m.id === h.to_milestone_id) || null;

          // Get profile info
          const { data: profileData } = await api.data.getMany<ProfileRow>('profiles', {
            filters: [{ field: 'user_id', operator: 'eq', value: h.changed_by }],
            limit: 1
          });

          return {
            ...h,
            from_milestone: fromMilestone,
            to_milestone: toMilestone,
            changed_by_profile: profileData?.[0] ? {
              full_name: profileData[0].full_name,
              email: profileData[0].email
            } : null
          };
        })
      );

      return enrichedHistory;
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du chargement de l\'historique');
      return [];
    }
  }, [milestones]);

  const recordMilestoneChange = useCallback(async (
    data: MilestoneHistoryInsert
  ): Promise<boolean> => {
    try {
      const { error } = await api.data.create('ticket_milestone_history', data);
      if (error) throw new Error(error.message);
      return true;
    } catch (err: any) {
      console.error('Error recording milestone change:', err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchMilestones();
    }
  }, [autoFetch, fetchMilestones]);

  return {
    milestones,
    loading,
    error,
    fetchMilestones,
    getFirstMilestone,
    getMilestoneByCode,
    getMilestoneHistory,
    recordMilestoneChange
  };
}
