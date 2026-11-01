// Export all API hooks

// React Query hooks (with caching)
export { useTicketsQuery, useTicketQuery, type TicketWithStudent } from './useTicketsQuery';
export { useStudentsQuery, useStudentQuery, useStudentByUserQuery } from './useStudentsQuery';
export { useDocumentsQuery } from './useDocumentsQuery';
export { useMilestonesQuery, useMilestoneHistoryQuery, type MilestoneHistoryWithDetails } from './useMilestonesQuery';
export { useProfileQuery, useUpdateProfile, useAllProfilesQuery } from './useProfilesQuery';
export { useNotificationsQuery } from './useNotificationsQuery';
export { useSettingsQuery } from './useSettingsQuery';
export { useUserRolesQuery, useUserRoleQuery } from './useUserRolesQuery';

// Cache utilities
export { useApiCache, CACHE_KEYS, defaultCacheConfig } from './useApiCache';
