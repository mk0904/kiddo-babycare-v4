/** Extract numeric ID from Shopify GID (e.g. gid://shopify/Product/123456789 -> 123456789). */
export function extractNumericId(id: string | undefined | null): string {
  if (!id) return '';
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}
