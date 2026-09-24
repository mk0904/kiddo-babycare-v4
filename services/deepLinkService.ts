/**
 * One funnel for every deep link, whatever delivered it.
 *
 * Why this exists: each push SDK opens its own deep link natively (CleverTap builds the
 * notification PendingIntent on Android and calls `UIApplication.open` on iOS), and those native
 * paths are fragile — they depend on the URI resolving to a declared intent filter and on the
 * notification-centre delegate chain being intact. When they work, the URL arrives through
 * expo-router's normal `Linking` handling. When they don't, nothing happens at all.
 *
 * So we also listen at the JS layer and navigate ourselves. Both paths funnel through
 * `handleDeepLink`, which drops a repeat of the same destination inside DEDUPE_WINDOW_MS — that is
 * what stops the belt and the braces from navigating twice when the native path *did* work.
 */
import { router } from 'expo-router';
import { deepLinkFromPushPayload, parseDeepLink, type ParsedDeepLink } from '@/utils/deepLink';

let CleverTap: any = null;
try {
  const ct = require('clevertap-react-native');
  CleverTap = ct?.default ?? ct;
} catch {
  // SDK not installed or not linked; deep link handling degrades to expo-router's own.
}

/** A push tap can reach us twice — once natively, once through the SDK listener. */
const DEDUPE_WINDOW_MS = 4000;

let lastTarget: string | null = null;
let lastHandledAt = 0;

/** Links that arrive before the navigator mounts (cold start from a notification). */
let navigationReady = false;
let pending: ParsedDeepLink | null = null;

function targetKey(parsed: ParsedDeepLink): string {
  if (parsed.kind === 'route') return `route:${parsed.path}`;
  if (parsed.kind === 'web') return `web:${parsed.url}`;
  return 'ignore';
}

function navigate(parsed: ParsedDeepLink): void {
  try {
    if (parsed.kind === 'route') {
      router.push(parsed.path as any);
    } else if (parsed.kind === 'web') {
      router.push({ pathname: '/webview', params: { url: parsed.url } } as any);
    }
  } catch (e) {
    console.warn('[DeepLink] navigation failed:', e);
  }
}

/**
 * Route a URL. Safe to call from anywhere, at any time, with anything.
 *
 * @param source  where it came from, for logs — 'clevertap', 'clevertap-initial', 'linking', …
 * @returns whether it resulted in navigation (or was queued for it)
 */
export function handleDeepLink(raw: string | null | undefined, source: string): boolean {
  const parsed = parseDeepLink(raw);

  if (parsed.kind === 'ignore') {
    console.log(`[DeepLink] ignored (${parsed.reason}) from ${source}:`, raw);
    return false;
  }

  const key = targetKey(parsed);
  const now = Date.now();
  if (key === lastTarget && now - lastHandledAt < DEDUPE_WINDOW_MS) {
    console.log(`[DeepLink] duplicate within ${DEDUPE_WINDOW_MS}ms, dropped (${source}):`, key);
    return false;
  }
  lastTarget = key;
  lastHandledAt = now;

  if (!navigationReady) {
    console.log(`[DeepLink] queued until navigator is ready (${source}):`, key);
    pending = parsed;
    return true;
  }

  console.log(`[DeepLink] navigating (${source}):`, key);
  navigate(parsed);
  return true;
}

/** Called once the root navigator has mounted; flushes a cold-start link. */
export function markNavigationReady(): void {
  if (navigationReady) return;
  navigationReady = true;
  if (pending) {
    const parsed = pending;
    pending = null;
    console.log('[DeepLink] flushing queued link:', targetKey(parsed));
    // A tick, so the first screen is mounted before we push on top of it.
    setTimeout(() => navigate(parsed), 0);
  }
}

/**
 * Subscribe to CleverTap notification taps.
 *
 * `CleverTapPushNotificationClicked` fires on both platforms and carries the full push payload,
 * with the deep link under `wzrk_dl`. `getInitialUrl` covers the cold-start case where the tap
 * happened before this listener existed.
 *
 * @returns an unsubscribe function
 */
export function registerCleverTapDeepLinks(): () => void {
  if (!CleverTap?.addListener || !CleverTap?.CleverTapPushNotificationClicked) {
    console.warn('[DeepLink] CleverTap SDK unavailable; push deep links rely on the native path only');
    return () => {};
  }

  const onClicked = (payload: any) => {
    const url = deepLinkFromPushPayload(payload);
    if (!url) {
      console.log('[DeepLink] CleverTap push tapped with no deep link in payload');
      return;
    }
    handleDeepLink(url, 'clevertap');
  };

  CleverTap.addListener(CleverTap.CleverTapPushNotificationClicked, onClicked);

  // Cold start: the tap that launched the app fired before we subscribed.
  try {
    CleverTap.getInitialUrl?.((err: any, url: string) => {
      if (err || !url) return;
      handleDeepLink(url, 'clevertap-initial');
    });
  } catch (e) {
    console.warn('[DeepLink] getInitialUrl failed:', e);
  }

  return () => {
    try {
      CleverTap.removeListener?.(CleverTap.CleverTapPushNotificationClicked);
    } catch {
      // best effort
    }
  };
}

export const deepLinkService = {
  handleDeepLink,
  markNavigationReady,
  registerCleverTapDeepLinks,
};
