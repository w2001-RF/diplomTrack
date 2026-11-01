import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ProfileRow, ProfileUpdate } from '@/lib/api/models';
import { toast } from 'sonner';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';

/**
 * Hook to fetch a profile by user_id
 */
export function useProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [CACHE_KEYS.PROFILES, userId],
    queryFn: async (): Promise<ProfileRow | null> => {
      if (!userId) return null;

      const { data, error } = await api.data.getMany<ProfileRow>('profiles', {
        filters: [{ field: 'user_id', operator: 'eq', value: userId }],
        limit: 1
      });

      if (error) throw new Error(error.message);
      return data?.[0] || null;
    },
    enabled: !!userId,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
  });
}

/**
 * Hook for updating profiles
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, data }: { profileId: string; data: ProfileUpdate }) => {
      // Flask only accepts PUT on /api/profiles/<id>
      const { error } = await api.data.update<ProfileRow>('profiles', profileId, data, 'PUT');
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Profil mis à jour');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.PROFILES] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour du profil');
    }
  });
}

/**
 * Hook to fetch all profiles (for admin)
 */
export function useAllProfilesQuery(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: [CACHE_KEYS.PROFILES, 'all'],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await api.data.getMany<ProfileRow>('profiles', {
        sort: [{ field: 'created_at', direction: 'desc' }]
      });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
  });
}
