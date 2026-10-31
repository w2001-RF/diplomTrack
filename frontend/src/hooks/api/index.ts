// Export all API hooks

// Basic hooks (state-based)
export { useTickets, type TicketWithStudent } from './useTickets';
export { useStudents } from './useStudents';
export { useDocuments } from './useDocuments';
export { useMilestones, type MilestoneHistoryWithDetails } from './useMilestones';
export { useProfiles } from './useProfiles';
export { useNotifications } from './useNotifications';

// React Query hooks (with caching)
export { useTicketsQuery, useTicketQuery } from './useTicketsQuery';
export { useStudentsQuery, useStudentQuery, useStudentByUserQuery } from './useStudentsQuery';
export { useDocumentsQuery } from './useDocumentsQuery';
export { useMilestonesQuery, useMilestoneHistoryQuery } from './useMilestonesQuery';
export { useProfileQuery, useUpdateProfile, useAllProfilesQuery } from './useProfilesQuery';
export { useNotificationsQuery } from './useNotificationsQuery';
export { useSettingsQuery } from './useSettingsQuery';
export { useUserRolesQuery, useUserRoleQuery } from './useUserRolesQuery';

// Cache utilities
export { useApiCache, CACHE_KEYS, defaultCacheConfig } from './useApiCache';
