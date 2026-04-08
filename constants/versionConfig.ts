/**
 * Force update and force re-login configuration (in-code only, no remote config).
 * Bump AUTH_SCHEMA_VERSION to force all users to re-login once.
 * Set MIN_APP_VERSION to the lowest app version that may use the app (older builds see "Update required").
 */

import Constants from 'expo-constants';

/** Bump this to force re-login and clear auth/checkout/cart for all users once. */
export const AUTH_SCHEMA_VERSION = 3;

/**
 * App version for API calls (coupons, etc.). Uses native version per platform when available
 * (iOS: CFBundleShortVersionString, Android: versionName) so TestFlight/iOS reports the actual iOS version.
 */
export function getAppVersionForApi(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Application = require('expo-application') as { nativeApplicationVersion: string | null };
    const native = Application?.nativeApplicationVersion;
    if (native != null && String(native).trim() !== '') return String(native).trim();
  } catch (_) {
    // expo-application not available (e.g. web)
  }
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** Minimum app version required. Older builds will see "Update required" and be sent to the store. */
export const MIN_APP_VERSION = '1.8.3';


/** Play Store URL (Android). Uses app package from app.json. */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.barereactnativeapp072';

/** App Store URL (iOS). */
export const APP_STORE_URL = 'https://apps.apple.com/in/app/kiddo-baby-care-in-minutes/id6755881583';

/**
 * Compare two semver-like strings (e.g. "1.8.3"). Returns true if current < minimum.
 */
function parseVersion(v: string): number[] {
  return v.split('.').map((n) => parseInt(n, 10) || 0);
}

export function isAppUpdateRequired(currentVersion: string): boolean {
  if (!currentVersion || !MIN_APP_VERSION) return false;
  const cur = parseVersion(currentVersion);
  const min = parseVersion(MIN_APP_VERSION);
  for (let i = 0; i < Math.max(cur.length, min.length); i++) {
    const c = cur[i] ?? 0;
    const m = min[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false;
}

export function supportsTryBuyPostDeliveryOrderSummary(): boolean {
  return true;
}
