/**
 * Force re-login configuration.
 * Bump AUTH_SCHEMA_VERSION to force all users to re-login once.
 * Force update is now handled via remote config in appConfigService.
 */

import Constants from 'expo-constants';

/** Bump this to force re-login and clear auth/checkout/cart for all users once. */
export const AUTH_SCHEMA_VERSION = 4;

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


/** Play Store URL (Android). Uses app package from app.json. */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.barereactnativeapp072';

/** App Store URL (iOS). */
export const APP_STORE_URL = 'https://apps.apple.com/in/app/kiddo-baby-care-in-minutes/id6755881583';

function parseVersion(v: string): number[] {
  return v.split('.').map((n) => parseInt(n, 10) || 0);
}

/**
 * Compare two semver-like strings (e.g. "1.8.3"). Returns true if current < minimum.
 */
export function isVersionBelowMinimum(currentVersion: string, minVersion: string): boolean {
  if (!currentVersion || !minVersion) return false;
  const cur = parseVersion(currentVersion);
  const min = parseVersion(minVersion);
  for (let i = 0; i < Math.max(cur.length, min.length); i++) {
    const c = cur[i] ?? 0;
    const m = min[i] ?? 0;
    if (c < m) return true;
    if (c > m) return false;
  }
  return false;
}



