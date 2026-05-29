/**
 * Freshchat configuration — set keys in `.env` (e.g., .env.development / .env.production).
 */
export const FRESHCHAT_APP_ID = (process.env.EXPO_PUBLIC_FRESHCHAT_APP_ID || '18fc7ead-5392-4155-bb24-c226ec2cd1dc').trim();
export const FRESHCHAT_APP_KEY = (process.env.EXPO_PUBLIC_FRESHCHAT_APP_KEY || 'bf9d2c25-4c3d-4deb-a937-0b6f1c9f8d3a').trim();
export const FRESHCHAT_DOMAIN = (process.env.EXPO_PUBLIC_FRESHCHAT_DOMAIN || 'msdk.in.freshchat.com').trim();
