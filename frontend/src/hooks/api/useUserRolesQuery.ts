import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { UserRoleRow } from '@/lib/api/models';
import { CACHE_KEYS, defaultCacheConfig } from './useApiCache';

/**
 * Hook to fetch all user roles (for admin). GET /api/user_roles is read-only:
 * roles change through PUT /api/admin/users/<id>.
 */
export function useUserRolesQuery(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const rolesQuery = useQuery({
    queryKey: [CACHE_KEYS.USER_ROLES],
    queryFn: async (): Promise<UserRoleRow[]> => {
      const { data, error } = await api.data.getMany<UserRoleRow>('user_roles', {
        sort: [{ field: 'created_at', direction: 'desc' }]
      });

      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled,
    staleTime: defaultCacheConfig.staleTime,
    gcTime: defaultCacheConfig.cacheTime,
  });

  return {
    roles: rolesQuery.data || [],
    loading: rolesQuery.isLoading,
    error: rolesQuery.error?.message || null,
    isRefetching: rolesQuery.isRefetching,
    refetch: rolesQuery.refetch,
  };
}
