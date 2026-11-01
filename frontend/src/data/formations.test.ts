import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAnneeUniversitaires } from './formations';

describe('getAnneeUniversitaires', () => {
  afterEach(() => vi.useRealTimers());

  it('lists the next year and the three previous ones, newest first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T10:00:00'));

    expect(getAnneeUniversitaires()).toEqual(['2027-2028', '2026-2027', '2025-2026', '2024-2025', '2023-2024']);
  });
});
