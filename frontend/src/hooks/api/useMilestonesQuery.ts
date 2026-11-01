import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { MilestoneRow, MilestoneHistoryRow, MilestoneHistoryInsert, ProfileRow } from '@/lib/api/models';
import { toast } from 'sonner';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';

export interface MilestoneHistoryWithDetails extends MilestoneHistoryRow {
  from_milestone?: MilestoneRow | null;
  to_milestone?: MilestoneRow | null;
  changed_by_profile?: { full_name: string | null; email: string } | null;
}

/**
 * React Query-based hook for milestones with caching
 */
export function useMilestonesQuery() {
  const queryClient = useQueryClient();

  // Main query for fetching milestones
  const milestonesQuery = useQuery({
    queryKey: [CACHE_KEYS.MILESTONES],
    queryFn: async (): Promise<MilestoneRow[]> => {
      const { data, error } = await api.data.getMany<MilestoneRow>('milestones', {
        sort: [{ field: 'order', direction: 'asc' }]
      });

      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 10 * 60 * 1000, // Milestones rarely change - 10 minutes stale time
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false,
  });

  const getFirstMilestone = (): MilestoneRow | null => {
    const milestones = milestonesQuery.data || [];
    return milestones.length > 0 ? milestones.find(m => m.order === 1) || null : null;
  };

  const getMilestoneByCode = (code: string): MilestoneRow | null => {
    const milestones = milestonesQuery.data || [];
    return milestones.find(m => m.code === code) || null;
  };

  return {
    // Query state
    milestones: milestonesQuery.data || [],
    loading: milestonesQuery.isLoading,
    error: milestonesQuery.error?.message || null,
    
    // Query actions
    refetch: milestonesQuery.refetch,
    
    // Helper functions
    getFirstMilestone,
    getMilestoneByCode
  };
}

/**
 * Hook to fetch milestone history for a specific ticket
 */
export function useMilestoneHistoryQuery(ticketId: string | undefined) {
  const { milestones } = useMilestonesQuery();

  return useQuery({
    queryKey: [CACHE_KEYS.MILESTONES, 'history', ticketId],
    queryFn: async (): Promise<MilestoneHistoryWithDetails[]> => {
      if (!ticketId) return [];

      const { data: historyData, error: historyError } = await api.data.getMany<MilestoneHistoryRow>(
        'ticket_milestone_history',
        {
          filters: [{ field: 'ticket_id', operator: 'eq', value: ticketId }],
          sort: [{ field: 'changed_at', direction: 'desc' }],
        }
      );

      if (historyError) throw new Error(historyError.message);

      // Enrich history with milestone and profile details
      const enrichedHistory: MilestoneHistoryWithDetails[] = await Promise.all(
        (historyData || []).map(async (h) => {
          const fromMilestone = h.from_milestone || null;
          const toMilestone = h.to_milestone || null;

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
    },
    enabled: !!ticketId && milestones.length > 0,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
  });
}
