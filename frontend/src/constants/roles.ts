/**
 * User roles enum
 * Used throughout the application for role-based access control
 */
export enum UserRole {
  STUDENT = 'STUDENT',
  AGENT = 'AGENT',
  ADMIN = 'ADMIN',
}

export const ROLE_VALUES = [
  UserRole.STUDENT,
  UserRole.AGENT,
  UserRole.ADMIN,
] as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.STUDENT]: 'Student',
  [UserRole.AGENT]: 'Agent',
  [UserRole.ADMIN]: 'Administrator',
};

export const getRoleLabel = (role: UserRole | null | undefined): string => {
  if (!role) return 'Unknown';
  return ROLE_LABELS[role] || 'Unknown';
};
