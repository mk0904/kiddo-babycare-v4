export function normalizeBoolean(value: unknown): boolean | undefined {
  if (value === true || value === false) return value;

  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  return undefined;
}

export function normalizeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }

  return undefined;
}

export function getVariantNodes(variants: any): any[] {
  const arr = variants?.edges || variants || [];
  if (!Array.isArray(arr)) return [];
  return arr.map(v => v?.node || v).filter(Boolean);
}

/**
 * Returns:
 * - true/false when we can confidently determine availability
 * - undefined when data is missing (caller can choose a fallback)
 */
export function isVariantAvailable(variant: any): boolean | undefined {
  const avail = normalizeBoolean(variant?.availableForSale);
  if (avail === false) return false;

  // Storefront API: `currentlyNotInStock` is a reliable boolean signal that the variant is out of stock.
  // It can be true even when `availableForSale` is true (backorders / continue selling).
  const currentlyNotInStock = normalizeBoolean(variant?.currentlyNotInStock);
  if (currentlyNotInStock === true) return false;

  const quantityAvailable = normalizeNumber(variant?.quantityAvailable);
  if (quantityAvailable !== undefined) return quantityAvailable > 0;

  const inventoryQuantity = normalizeNumber(variant?.inventoryQuantity);
  if (inventoryQuantity !== undefined) return inventoryQuantity > 0;

  if (avail === true) return true;
  return undefined;
}

/**
 * Conservative availability check:
 * - treats `"false"` (string) as false
 * - treats `0` inventory as out of stock
 * - if variants exist, requires at least one variant to be available
 */
export function isProductAvailable(product: any): boolean {
  const avail = normalizeBoolean(product?.availableForSale);
  if (avail === false) return false;

  const quantityAvailable = normalizeNumber(product?.quantityAvailable);
  if (quantityAvailable !== undefined) return quantityAvailable > 0;

  const totalInventory = normalizeNumber(product?.totalInventory);
  if (totalInventory !== undefined) return totalInventory > 0;

  const variantNodes = getVariantNodes(product?.variants);
  if (variantNodes.length > 0) {
    let sawUnknown = false;
    for (const v of variantNodes) {
      const vAvail = isVariantAvailable(v);
      if (vAvail === true) return true;
      if (vAvail === undefined) sawUnknown = true;
    }
    // If all variants were deterministically unavailable, product is unavailable.
    if (!sawUnknown) return false;
  }

  // Fall back to product-level boolean if present.
  if (avail === true) return true;
  return false;
}

export function isProductOutOfStock(product: any): boolean {
  return !isProductAvailable(product);
}

/**
 * Sort products so in-stock items appear first, out-of-stock at the end.
 * Preserves relative order within each group.
 */
export function sortInStockFirst<T extends Record<string, any>>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const aInStock = isProductAvailable(a);
    const bInStock = isProductAvailable(b);
    if (aInStock && !bInStock) return -1;
    if (!aInStock && bInStock) return 1;
    return 0;
  });
}

