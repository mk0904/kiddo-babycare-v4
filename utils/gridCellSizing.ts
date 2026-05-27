/** Shared row sizing: fixed height + proportional widths. */

export type GridCellSizeInput = {
  widthFraction?: number;
  aspectRatio?: number;
};

export function resolveRowWidths(
  items: GridCellSizeInput[],
  availableWidth: number,
  gap: number
): number[] {
  if (items.length === 0) return [];

  const gapTotal = gap * Math.max(0, items.length - 1);
  const contentWidth = Math.max(0, availableWidth - gapTotal);

  const hasFraction = items.some(
    (item) => typeof item.widthFraction === 'number' && item.widthFraction > 0
  );

  if (!hasFraction) {
    const w = contentWidth / items.length;
    return items.map(() => w);
  }

  let assigned = 0;
  let unassignedCount = 0;
  const rawFractions = items.map((item) => {
    if (typeof item.widthFraction === 'number' && item.widthFraction > 0) {
      assigned += item.widthFraction;
      return item.widthFraction;
    }
    unassignedCount += 1;
    return 0;
  });

  const remainder = Math.max(0, 1 - assigned);
  const defaultShare = unassignedCount > 0 ? remainder / unassignedCount : 0;

  const normalized = rawFractions.map((f) => (f > 0 ? f : defaultShare));
  const sum = normalized.reduce((acc, f) => acc + f, 0) || 1;

  return normalized.map((f) => (f / sum) * contentWidth);
}

export function resolveFixedImageHeight(
  itemHeight: number | undefined,
  labelSpace: number,
  showLabels: boolean
): number | null {
  if (typeof itemHeight !== 'number' || itemHeight <= 0) return null;
  return itemHeight;
}

export function resolveImageHeightFromAspect(
  itemWidth: number,
  itemAspectRatio: number | undefined,
  defaultAspectRatio: number,
  labelSpace: number,
  showLabels: boolean
): number {
  const ar =
    typeof itemAspectRatio === 'number' && itemAspectRatio > 0
      ? itemAspectRatio
      : defaultAspectRatio;
  return itemWidth / ar;
}
