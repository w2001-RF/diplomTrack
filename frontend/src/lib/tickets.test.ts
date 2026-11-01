import { describe, expect, it } from 'vitest';
import { milestoneCodeOf } from './tickets';

describe('milestoneCodeOf', () => {
  it('reads the current milestone, not the coarse ticket status', () => {
    // API: status is OPEN | PENDING | COMPLETED, the milestone lives in current_milestone
    expect(milestoneCodeOf({ status: 'COMPLETED', current_milestone: { code: 'DOSSIER_CLOTURE' } })).toBe('DOSSIER_CLOTURE');
  });

  it('is undefined when the ticket has no milestone yet', () => {
    expect(milestoneCodeOf({ status: 'OPEN' })).toBeUndefined();
    expect(milestoneCodeOf(undefined)).toBeUndefined();
  });
});
