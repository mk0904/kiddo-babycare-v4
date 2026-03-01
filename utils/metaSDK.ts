/**
 * Meta (Facebook) SDK - App events for attribution and dedup with backend CAPI.
 * Use same event_name and event_id as backend so Meta can deduplicate.
 */
import { Settings, AppEventsLogger } from 'react-native-fbsdk-next';

let initialized = false;

/**
 * Call once at app startup (e.g. in _layout.tsx).
 */
export function initMetaSDK(): void {
  if (initialized) return;
  try {
    Settings.initializeSDK();
    Settings.setAdvertiserTrackingEnabled(true);
    Settings.setAutoLogAppEventsEnabled(true);
    initialized = true;
  } catch (e) {
    if (__DEV__) {
      console.warn('[Meta SDK] init failed:', e);
    }
  }
}

/**
 * Map our event names to Meta standard events where applicable.
 */
const META_STANDARD_EVENTS: Record<string, string> = {
  'Purchase': 'Purchase',
  'Payment Success': 'Purchase',
  'Order Placed': 'Purchase',
  'Order Confirmed': 'Purchase',
  'Add to Cart': 'AddToCart',
  'AddToCart': 'AddToCart',
  'Product Viewed': 'ViewContent',
  'ViewContent': 'ViewContent',
  'Checkout Started': 'InitiatedCheckout',
  'InitiatedCheckout': 'InitiatedCheckout',
  'Search Performed': 'Search',
  'Search': 'Search',
  'CompleteRegistration': 'CompleteRegistration',
  'Signup Completed': 'CompleteRegistration',
  'Login Success': 'CompleteRegistration',
};

/**
 * Log event to Meta SDK. Use same event_id as in backend track for dedup.
 * @param eventName - Our event name (e.g. "Order Placed", "Purchase")
 * @param properties - Event properties; event_id used for CAPI dedup
 * @param eventId - Optional dedup id (orderId, etc.). Also read from properties.event_id if not passed.
 */
export function logMetaEvent(
  eventName: string,
  properties?: Record<string, unknown>,
  eventId?: string
): void {
  if (!initialized) return;
  try {
    const metaEventName = META_STANDARD_EVENTS[eventName] ?? eventName;
    const params = properties ?? {};
    const dedupId = eventId ?? (params.event_id as string) ?? (params.orderId as string);
    const sanitized: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && typeof v !== 'object') {
        sanitized[k] = v as string | number;
      }
    }
    if (dedupId) {
      AppEventsLogger.logEvent(metaEventName, sanitized, dedupId);
    } else {
      AppEventsLogger.logEvent(metaEventName, sanitized);
    }
  } catch (e) {
    if (__DEV__) {
      console.warn('[Meta SDK] logEvent failed:', eventName, e);
    }
  }
}
