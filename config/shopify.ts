// Shopify Configuration
// Note: On Android it's common to accidentally set EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN including
// "https://", trailing slashes, or a path. Normalize to just the hostname.
const RAW_SHOPIFY_STORE_DOMAIN =
  process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN || 'kiddo-quick-baby-joy-m4bpo.myshopify.com';

export const SHOPIFY_STORE_DOMAIN = RAW_SHOPIFY_STORE_DOMAIN
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/\/.*$/, '')
  .replace(/\/+$/, '');
export const SHOPIFY_STOREFRONT_ACCESS_TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN ?? '';
export const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_ADMIN_ACCESS_TOKEN ?? '';

export const SHOPIFY_API_URL = `https://${SHOPIFY_STORE_DOMAIN}/api/2025-01/graphql.json`;
export const SHOPIFY_ADMIN_API_URL = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01`;

if (__DEV__) {
  // Helps debug Android-only "Network Error" issues by confirming the exact URL at runtime.
  console.log('[ShopifyConfig]', { SHOPIFY_STORE_DOMAIN, SHOPIFY_API_URL });
}

