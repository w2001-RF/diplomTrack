import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UserRoleRow, UserRoleInsert, UserRoleUpdate, AppRole } from '@/lib/api/models';
import { toast } from 'sonner';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';

/**
 * Hook to fetch all user roles (for admin)
 */
export function useUserRolesQuery(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();

  const rolesQuery = useQuery({
    queryKey: [CACHE_KEYS.USER_ROLES],
    queryFn: async (): Promise<UserRoleRow[]> => {
      const { data, error } = await api.data.getMany<UserRoleRow>('user_roles', {
        sort: [{ field: 'created_at', direction: 'desc' }]
      });

      if (error) throw new Error(error.message);
      return data|| [];
    },
    enabled,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserRoleInsert) => {
      const { data: role, error } = await api.data.create<UserRoleRow>('user_roles', data);
      if (error) throw new Error(error.message);
      return role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.USER_ROLES] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création du rôle');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UserRoleUpdate }) => {
      const { error } = await api.data.update<UserRoleRow>('user_roles', id, data);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Rôle mis à jour');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.USER_ROLES] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour du rôle');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.data.delete('user_roles', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Rôle supprimé');
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS.USER_ROLES] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression du rôle');
    }
  });

  return {
    roles: rolesQuery.data || [],
    loading: rolesQuery.isLoading,
    error: rolesQuery.error?.message || null,
    isRefetching: rolesQuery.isRefetching,
    
    refetch: rolesQuery.refetch,
    
    createRole: createMutation.mutateAsync,
    updateRole: (id: string, data: UserRoleUpdate) => updateMutation.mutateAsync({ id, data }),
    deleteRole: deleteMutation.mutateAsync,
    
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Hook to get role for a specific user
 */
export function useUserRoleQuery(userId: string | undefined) {
  return useQuery({
    queryKey: [CACHE_KEYS.USER_ROLES, userId],
    queryFn: async (): Promise<UserRoleRow | null> => {
      if (!userId) return null;

      const { data, error } = await api.data.getMany<UserRoleRow>('user_roles', {
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
