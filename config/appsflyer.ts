/**
 * AppsFlyer configuration — set keys in `.env` (see `.env.example`).
 */
export const APPSFLYER_ONELINK_TEMPLATE_ID =
  (process.env.EXPO_PUBLIC_APPSFLYER_ONELINK_ID || 'pjjk').trim();

/** AppsFlyer OneLink subdomain — must match Android intent-filter + iOS associated domain */
export const APPSFLYER_ONELINK_HOST = 'kiddo-app.onelink.me';

/** Custom URL scheme fallback for AppsFlyer deep links (Info → URL Types) */
export const APPSFLYER_URL_SCHEME = 'kiddo';

/** AppsFlyer dev key from dashboard → App settings */
export const APPSFLYER_DEV_KEY = (process.env.EXPO_PUBLIC_APPSFLYER_DEV_KEY || 'dLFHzRMT5LMrRzFnGr3pYK').trim();

/**
 * iOS App Store numeric ID (not bundle id), e.g. 1234567890.
 * Required for iOS attribution; omit on Android-only runs.
 */
export const APPSFLYER_IOS_APP_ID = (process.env.EXPO_PUBLIC_APPSFLYER_IOS_APP_ID || 'ANK22C64TH').trim();

/** Deep link path value for referral invite OneLinks */
export const APPSFLYER_REFERRAL_DEEP_LINK_VALUE = 'referral_signup';
