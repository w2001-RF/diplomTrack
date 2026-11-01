import { describe, expect, it } from 'vitest';
import { getRoleLabel, ROLE_VALUES, UserRole } from './roles';

describe('roles', () => {
  it('uses the uppercase values the backend validates (UserUpdateSchema)', () => {
    expect(ROLE_VALUES).toEqual(['STUDENT', 'AGENT', 'ADMIN']);
  });

  it('labels each role and falls back for unknown values', () => {
    expect(getRoleLabel(UserRole.ADMIN)).toBe('Administrator');
    expect(getRoleLabel(null)).toBe('Unknown');
    expect(getRoleLabel('agent' as UserRole)).toBe('Unknown');
  });
});
