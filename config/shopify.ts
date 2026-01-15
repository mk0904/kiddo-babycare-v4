// Shopify Configuration
// Tokens from Kiddo app configuration
// TODO: Move these to environment variables in production

export const SHOPIFY_STORE_DOMAIN = process.env.EXPO_PUBLIC_SHOPIFY_STORE_DOMAIN || 'kiddo-quick-baby-joy-m4bpo.myshopify.com';
export const SHOPIFY_STOREFRONT_ACCESS_TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN || 'PLACEHOLDER_SHOPIFY_STOREFRONT_TOKEN';
export const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.EXPO_PUBLIC_SHOPIFY_ADMIN_ACCESS_TOKEN || 'PLACEHOLDER_SHOPIFY_ADMIN_TOKEN';

export const SHOPIFY_API_URL = `https://${SHOPIFY_STORE_DOMAIN}/api/2025-01/graphql.json`;
export const SHOPIFY_ADMIN_API_URL = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01`;

