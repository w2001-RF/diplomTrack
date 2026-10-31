import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AppSettingRow, AppSettingUpdate } from '@/lib/api/models';
import { toast } from 'sonner';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';

/**
 * Hook to fetch all app settings
 */
export function useSettingsQuery(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: [CACHE_KEYS.SETTINGS],
    queryFn: async (): Promise<AppSettingRow[]> => {
      const { data, error } = await api.data.getMany<AppSettingRow>('app_settings', {
        sort: [{ field: 'id', direction: 'asc' }]
      });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Settings rarely change - 10 minutes
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AppSettingUpdate }) => {
      const { error } = await api.data.update<AppSettingRow>('app_settings', id, data);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.SETTINGS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  });

  const updateMultipleMutation = useMutation({
    mutationFn: async (updates: { id: string; data: AppSettingUpdate }[]) => {
      const results = await Promise.all(
        updates.map(({ id, data }) =>
          api.data.update<AppSettingRow>('app_settings', id, data)
        )
      );

      const errorResult = results.find(r => r?.error);
      if (errorResult?.error) {
        throw new Error(errorResult.error.message);
      }
    },
    onSuccess: () => {
      toast.success('Paramètres sauvegardés');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.SETTINGS] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    }
  });

  return {
    settings: settingsQuery.data || [],
    loading: settingsQuery.isLoading,
    error: settingsQuery.error?.message || null,
    isRefetching: settingsQuery.isRefetching,
    
    refetch: settingsQuery.refetch,
    
    updateSetting: (id: string, data: AppSettingUpdate) => updateMutation.mutateAsync({ id, data }),
    updateMultipleSettings: updateMultipleMutation.mutateAsync,
    
    isSaving: updateMutation.isPending || updateMultipleMutation.isPending,
  };
}
