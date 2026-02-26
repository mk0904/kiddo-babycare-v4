/**
 * Deep link domain for Universal Links (iOS) and App Links (Android).
 * Used when sharing product links so they are clickable (https) and open the app when installed.
 *
 * Set EXPO_PUBLIC_DEEP_LINK_DOMAIN to your domain (e.g. app.kiddo.in or go.yourdomain.com).
 * You must host .well-known/assetlinks.json and .well-known/apple-app-site-association on this domain.
 */
const RAW =
  process.env.EXPO_PUBLIC_DEEP_LINK_DOMAIN || 'app.kiddo.in';

export const DEEP_LINK_DOMAIN = RAW
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/\/.*$/, '')
  .replace(/\/+$/, '');

/** Full base URL for app deep links (https). */
export const DEEP_LINK_BASE_URL = `https://${DEEP_LINK_DOMAIN}`;

/** Product deep link path prefix (no leading slash). */
export const PRODUCT_PATH_PREFIX = 'product';

/** Full product URL for a given handle or id segment. */
export function getProductDeepLink(handleOrId: string): string {
  const segment = encodeURIComponent(handleOrId);
  return `${DEEP_LINK_BASE_URL}/${PRODUCT_PATH_PREFIX}/${segment}`;
}
