export function getPaginatedItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): readonly T[] {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const startIndex = (safePage - 1) * safePageSize;

  return items.slice(startIndex, startIndex + safePageSize);
}

export function getTotalPages(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
}
