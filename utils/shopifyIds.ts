/** Extract numeric ID from Shopify GID (e.g. gid://shopify/Product/123456789 -> 123456789). */
export function extractNumericId(id: string | undefined | null): string {
  if (!id) return '';
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

// Standard Shopify CDN cached widths for faster TTFB (Time To First Byte)
const SHOPIFY_BUCKET_WIDTHS = [200, 300, 400, 500, 600, 800, 1000, 1200];

/**
 * Returns a resized Shopify CDN image URL.
 * Shopify supports `_<width>x` sizing via URL manipulation.
 *
 * Example:
 *   https://cdn.shopify.com/.../image.jpg?v=123
 *   -> https://cdn.shopify.com/.../image_400x.jpg?v=123
 *
 * @param url   Original Shopify CDN image URL
 * @param width Desired width in pixels (e.g. 400 for product cards, 800 for banners)
 */
export function shopifyImageUrl(url: string | undefined | null, width: number): string {
  if (!url || !url.includes('cdn.shopify.com')) return url || '';

  // Already has a size suffix like _400x — don't add another
  if (/_([\d]+x[\d]*)\./.test(url)) return url;

  // Snap requested width to the nearest/larger standard bucket to ensure a CDN cache hit
  let bucketWidth = SHOPIFY_BUCKET_WIDTHS[SHOPIFY_BUCKET_WIDTHS.length - 1]; // default to largest
  for (const bucket of SHOPIFY_BUCKET_WIDTHS) {
    if (bucket >= width) {
      bucketWidth = bucket;
      break;
    }
  }

  // Insert _{bucketWidth}x before the file extension (before the ? query string)
  return url.replace(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i, `_${bucketWidth}x.$1$2`);
}
