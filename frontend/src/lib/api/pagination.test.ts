import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './pagination';

const pageOf = (items: number[], total: number) => ({ data: { items, total }, error: null });

describe('fetchAllPages', () => {
  it('makes one request when everything fits on the first page', async () => {
    const fetchPage = vi.fn(async () => pageOf([1, 2, 3], 3));

    const result = await fetchAllPages(fetchPage, 100);

    expect(result).toEqual({ items: [1, 2, 3], total: 3 });
    expect(fetchPage).toHaveBeenCalledOnce();
    expect(fetchPage).toHaveBeenCalledWith(1, 100);
  });

  it('fetches the remaining pages and keeps their order', async () => {
    const all = Array.from({ length: 7 }, (_, i) => i + 1);
    const fetchPage = vi.fn(async (page: number, size: number) =>
      pageOf(all.slice((page - 1) * size, page * size), all.length)
    );

    const result = await fetchAllPages(fetchPage, 3);

    expect(result).toEqual({ items: all, total: 7 });
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([1, 2, 3]);
  });

  it('returns an empty list for an empty collection', async () => {
    await expect(fetchAllPages(async () => pageOf([], 0), 50)).resolves.toEqual({ items: [], total: 0 });
  });

  it('throws the API error of any page', async () => {
    const fetchPage = vi.fn(async (page: number) =>
      page === 1 ? pageOf([1], 2) : { data: null, error: { message: 'Erreur serveur' } }
    );

    await expect(fetchAllPages(fetchPage, 1)).rejects.toThrow('Erreur serveur');
  });
});
