export type Sortable = {
  id: number;
  parent_id: number | null;
  sort_order: number;
};

/**
 * New sort_order values after moving one item up or down among its siblings. Siblings are
 * renumbered 1..n so gaps and ties from older data are cleaned up too. Returns only the
 * rows whose sort_order changes (empty when the move is not possible).
 */
export function moveItem(
  items: readonly Sortable[],
  id: number,
  direction: "up" | "down",
) {
  const item = items.find((i) => i.id === id);
  if (!item) return [];
  const siblings = items
    .filter((i) => i.parent_id === item.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const from = siblings.findIndex((i) => i.id === id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= siblings.length) return [];
  const order = [...siblings];
  [order[from], order[to]] = [order[to]!, order[from]!];
  return order
    .map((s, index) => ({
      id: s.id,
      sort_order: index + 1,
      before: s.sort_order,
    }))
    .filter((s) => s.sort_order !== s.before)
    .map(({ id: rowId, sort_order }) => ({ id: rowId, sort_order }));
}

/** sort_order for a new item placed last among its siblings. */
export function nextSortOrder(
  items: readonly Sortable[],
  parentId: number | null,
): number {
  const siblings = items.filter((i) => i.parent_id === parentId);
  return siblings.length === 0
    ? 1
    : Math.max(...siblings.map((s) => s.sort_order)) + 1;
}
