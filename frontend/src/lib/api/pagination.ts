// Read every page of a paginated list endpoint. The API pages by default
// (10 tickets or students per page), while the dashboards and lists filter and
// count client side, so they need the whole collection.

import type { ApiResponse } from './types';

export interface Page<T> {
  items: T[];
  total: number;
}

/**
 * Fetch page 1, then the remaining pages in parallel, and concatenate them in
 * order. `fetchPage(page, size)` maps one API call to {items, total}.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, size: number) => Promise<ApiResponse<Page<T>>>,
  pageSize: number
): Promise<Page<T>> {
  const unwrap = ({ data, error }: ApiResponse<Page<T>>): Page<T> => {
    if (error) throw new Error(error.message);
    return { items: data?.items ?? [], total: data?.total ?? 0 };
  };

  const first = unwrap(await fetchPage(1, pageSize));
  const pageCount = Math.ceil(first.total / pageSize);
  if (pageCount <= 1) return first;

  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, i) => fetchPage(i + 2, pageSize).then(unwrap))
  );
  return { items: [first, ...rest].flatMap((p) => p.items), total: first.total };
}
