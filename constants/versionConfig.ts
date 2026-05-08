/**
 * Force update and force re-login configuration (in-code only, no remote config).
 * Bump AUTH_SCHEMA_VERSION to force all users to re-login once.
 * Set MIN_APP_VERSION_IOS / MIN_APP_VERSION_ANDROID so older builds see "Update required".
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

/** Minimum iOS app version (CFBundleShortVersionString). Older builds see "Update required". */
export const MIN_APP_VERSION_IOS = '3.2.1';

/** Minimum Android app version (versionName). Older builds see "Update required". */
export const MIN_APP_VERSION_ANDROID = '1.9.9';

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

function isVersionBelowMinimum(currentVersion: string, minVersion: string): boolean {
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

export function minimumAppVersionForPlatform(os: typeof Platform.OS): string | null {
  if (os === 'ios') return MIN_APP_VERSION_IOS;
  if (os === 'android') return MIN_APP_VERSION_ANDROID;
  return null;
}

/** True when this binary is older than the minimum allowed for the current platform (iOS vs Android). */
export function isAppUpdateRequired(currentVersion: string): boolean {
  const minVersion = minimumAppVersionForPlatform(Platform.OS);
  const result = minVersion != null && minVersion !== '' && isVersionBelowMinimum(currentVersion, minVersion);

  if (__DEV__) {
    console.log(`[VersionCheck] OS: ${Platform.OS}, Current: "${currentVersion}", Min: "${minVersion}", Required: ${result}`);
  }

  return result;
}

export function supportsTryBuyPostDeliveryOrderSummary(): boolean {
  return true;
}
