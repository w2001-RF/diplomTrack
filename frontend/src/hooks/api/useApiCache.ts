import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

// Cache key constants for consistent cache management
export const CACHE_KEYS = {
  TICKETS: 'tickets',
  STUDENTS: 'students',
  DOCUMENTS: 'documents',
  MILESTONES: 'milestones',
  PROFILES: 'profiles',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  USER_ROLES: 'user_roles',
  USERS: 'users',
} as const;

// Default stale time: 5 minutes
export const DEFAULT_STALE_TIME = 5 * 60 * 1000;

// Default cache time: 30 minutes
export const DEFAULT_CACHE_TIME = 30 * 60 * 1000;

export interface CacheConfig {
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
  refetchInterval?: number | false;
}

export const defaultCacheConfig: CacheConfig = {
  staleTime: DEFAULT_STALE_TIME,
  cacheTime: DEFAULT_CACHE_TIME,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  refetchInterval: false,
};

/**
 * Hook for managing API cache
 * Provides utilities for invalidating and prefetching data
 */
export function useApiCache() {
  const queryClient = useQueryClient();

  const invalidateCache = useCallback((key: keyof typeof CACHE_KEYS | string[]) => {
    if (Array.isArray(key)) {
      queryClient.invalidateQueries({ queryKey: key });
    } else {
      queryClient.invalidateQueries({ queryKey: [CACHE_KEYS[key]] });
    }
  }, [queryClient]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const prefetch = useCallback(async <T>(
    key: string[],
    fetcher: () => Promise<T>,
    config?: Partial<CacheConfig>
  ) => {
    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: fetcher,
      staleTime: config?.staleTime ?? DEFAULT_STALE_TIME,
    });
  }, [queryClient]);

  const setQueryData = useCallback(<T>(key: string[], data: T) => {
    queryClient.setQueryData(key, data);
  }, [queryClient]);

  const getQueryData = useCallback(<T>(key: string[]): T | undefined => {
    return queryClient.getQueryData<T>(key);
  }, [queryClient]);

  const removeQueries = useCallback((key: string[]) => {
    queryClient.removeQueries({ queryKey: key });
  }, [queryClient]);

  return {
    invalidateCache,
    invalidateAll,
    prefetch,
    setQueryData,
    getQueryData,
    removeQueries,
    queryClient,
  };
}
