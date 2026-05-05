/**
 * Meta (Facebook) SDK - App events for attribution and dedup with backend CAPI.
 * Use same event_name and event_id as backend so Meta can deduplicate.
 *
 * On iOS 14+, App Tracking Transparency (ATT) must be requested for Meta to receive
 * events; call requestMetaTrackingPermission() after app is in foreground (e.g. from _layout).
 *
 * In Expo Go the native module is not available; we guard all usage so the app does not crash.
 */
import { Platform } from 'react-native';

let initialized = false;

/** Lazy-load Meta SDK; returns null in Expo Go or when native module is missing. */
function getMetaSDK(): { Settings: typeof import('react-native-fbsdk-next').Settings; AppEventsLogger: typeof import('react-native-fbsdk-next').AppEventsLogger } | null {
  try {
    const sdk = require('react-native-fbsdk-next');
    if (!sdk?.Settings) return null; // native module not linked (e.g. Expo Go)
    return sdk;
  } catch {
    return null;
  }
}

/**
 * Call once at app startup (e.g. in _layout.tsx).
 */
export function initMetaSDK(): void {
  if (initialized) {
    if (__DEV__) console.log('[Meta SDK] Already initialized');
    return;
  }
  const sdk = getMetaSDK();
  if (!sdk) {
    if (__DEV__) console.warn('[Meta SDK] Native module not available (Expo Go?)');
    return;
  }
  const { Settings, AppEventsLogger } = sdk;
  try {
    if (__DEV__) console.log('[Meta SDK] Initializing with App ID: 1494379925573507');
    
    // Basic config
    Settings.setAppID('1494379925573507');
    Settings.setClientToken('04a657781e5dd2df8704fd3292d74e3d');
    
    // Enable collection & logging
    Settings.setAutoLogAppEventsEnabled(true);
    Settings.setAdvertiserIDCollectionEnabled(true);
    
    if (Platform.OS === 'ios') {
      // Advertiser tracking is managed by requestMetaTrackingPermission() on iOS
      if (__DEV__) console.log('[Meta SDK] iOS detected, ATE will be set after ATT prompt');
    } else {
      if (__DEV__) console.log('[Meta SDK] Android detected, ensuring advertiser ID collection is enabled');
    }

    // Enable debug logs in dev if the method exists
    if (__DEV__) {
      if ((Settings as any).setAppEventsDebugLogEnabled) {
        (Settings as any).setAppEventsDebugLogEnabled(true);
      } else {
        console.log('[Meta SDK] setAppEventsDebugLogEnabled not available in this SDK version');
      }
    }

    // Crucial for Android when AutoInit is false in app.json/AndroidManifest
    Settings.initializeSDK();
    
    initialized = true;
    if (__DEV__) console.log('[Meta SDK] Initialized successfully');
    
    // Optional: flush any queued events
    try {
      AppEventsLogger.flush();
    } catch {
      // ignore
    }
  } catch (e) {
    if (__DEV__) console.error('[Meta SDK] Initialization failed:', e);
  }
}

/**
 * Request App Tracking Transparency on iOS and set the ATE flag for Meta.
 * Must be called before initMetaSDK() on iOS so Meta receives the ATE flag.
 * We never bypass the ATT prompt or default to granted: ATE is true only when
 * the user actually grants (status === 'granted'). No-op on Android.
 */
const ATT_REQUEST_TIMEOUT_MS = 15000;

export async function requestMetaTrackingPermission(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const sdk = getMetaSDK();
  if (!sdk) {
    if (__DEV__) console.warn('[Meta SDK] Native module not available, skipping ATT');
    return;
  }
  const { Settings } = sdk;

  try {
    if (__DEV__) console.log('[Meta SDK] Requesting ATT permission...');
    const { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');

    const current = await getTrackingPermissionsAsync();
    if (current.status === 'granted' || current.status === 'denied') {
      if (__DEV__) console.log('[Meta SDK] ATT already determined:', current.status);
      Settings.setAdvertiserTrackingEnabled(current.status === 'granted');
      return;
    }

    const attPromise = requestTrackingPermissionsAsync();
    const timeoutPromise = new Promise<{ status: string }>((_, reject) =>
      setTimeout(() => reject(new Error('ATT request timeout')), ATT_REQUEST_TIMEOUT_MS)
    );
    const { status } = await Promise.race([attPromise, timeoutPromise]);
    
    if (__DEV__) console.log('[Meta SDK] ATT status received:', status);
    const granted = status === 'granted';
    Settings.setAdvertiserTrackingEnabled(granted);
  } catch (e) {
    if (__DEV__) console.warn('[Meta SDK] ATT request failed:', e);
    try {
      Settings.setAdvertiserTrackingEnabled(false);
    } catch {
      // native module may be unavailable (Expo Go)
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
  'Checkout Started': 'InitiateCheckout',
  'InitiateCheckout': 'InitiateCheckout',
  'Search Performed': 'Search',
  'Search': 'Search',
  'Wishlist Added': 'AddToWishlist',
  'AddToWishlist': 'AddToWishlist',
  'Signup Completed': 'CompleteRegistration',
  'Login Success': 'CompleteRegistration',
};

/**
 * Extract numeric ID from Shopify GID (e.g. gid://shopify/Product/123456789 -> 123456789)
 */
export function extractNumericId(id: string | undefined | null): string {
  if (!id) return '';
  const match = id.match(/\/(\d+)$/);
  return match ? match[1] : id;
}

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
  if (!initialized) {
    if (__DEV__) console.warn(`[Meta SDK] logMetaEvent dropped (not yet initialized): ${eventName}`);
    return;
  }
  const sdk = getMetaSDK();
  if (!sdk) return;
  const { AppEventsLogger } = sdk;

  try {
    const metaEventName = META_STANDARD_EVENTS[eventName] ?? eventName;
    const params = properties ?? {};
    const dedupId = eventId ?? (params.event_id as string) ?? (params.orderId as string);
    
    if (__DEV__) {
      console.log(`[Meta SDK] Logging event: ${metaEventName}`, { params, dedupId });
    }

    // Sanitize parameters (Meta expects strings, numbers, or arrays of strings/numbers)
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      
      if (Array.isArray(v)) {
        sanitized[k] = v.map(item => (typeof item === 'object' ? JSON.stringify(item) : item));
      } else if (typeof v !== 'object') {
        sanitized[k] = v;
      }
    }

    // Handle Purchase events specially (Meta dashboard requirement)
    if (metaEventName === 'Purchase') {
      const value = Number(params.value || params.amount || params.revenue || 0);
      const currency = String(params.currency || 'INR');
      
      if (dedupId) {
        sanitized.event_id = String(dedupId);
      }
      
      AppEventsLogger.logPurchase(value, currency, sanitized);
      AppEventsLogger.flush();
      return;
    }

    const metaParams: Record<string, any> = { ...sanitized };

    // Standard parameter mapping
    if (sanitized.productId || sanitized.product_id) {
      metaParams.content_id = extractNumericId(sanitized.productId || sanitized.product_id);
    }
    if (sanitized.content_id) {
      metaParams.content_ids = [sanitized.content_id];
    }
    if (sanitized.content_ids) {
      metaParams.content_ids = sanitized.content_ids;
    }
    if (sanitized.content_type) {
      metaParams.content_type = sanitized.content_type;
    }
    if (sanitized.query || sanitized.search_string) {
      metaParams.search_string = sanitized.query || sanitized.search_string;
    }
    if (sanitized.currency) {
      metaParams.currency = sanitized.currency;
    }
    if (sanitized.value !== undefined) {
      metaParams.value = sanitized.value;
    }

    if (dedupId) {
      metaParams.event_id = String(dedupId);
    }

    if (__DEV__) {
      console.log(`[MetaSDK] Logging ${metaEventName}:`, metaParams);
    }

    AppEventsLogger.logEvent(metaEventName, metaParams);
    
    AppEventsLogger.flush();
  } catch (e) {
    if (__DEV__) {
      console.warn('[Meta SDK] logEvent failed:', eventName, e);
    }
  }
}

/**
 * Set user data for Advanced Matching (helps Meta match events without IDFA).
 * Pass raw strings; the SDK handles hashing (or we can hash manually).
 */
export function setMetaUserData(userData: {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  userId?: string;
}): void {
  if (!initialized) {
    if (__DEV__) console.warn('[Meta SDK] setMetaUserData called before init, skipping');
    return;
  }
  const sdk = getMetaSDK();
  if (!sdk) return;
  const { AppEventsLogger } = sdk;
  try {
    const data: Record<string, string> = {};
    if (userData.email) data.email = userData.email.toLowerCase().trim();
    if (userData.phone) data.phone = userData.phone.replace(/[^0-9]/g, '');
    if (userData.firstName) data.firstName = userData.firstName.toLowerCase().trim();
    if (userData.lastName) data.lastName = userData.lastName.toLowerCase().trim();
    
    if (__DEV__) console.log('[Meta SDK] Setting user data for advanced matching:', data);
    
    // @ts-ignore
    if (AppEventsLogger.setUserData) {
      AppEventsLogger.setUserData(data);
    }
    
    // Also set the User ID if provided
    if (userData.userId) {
      if (__DEV__) console.log('[Meta SDK] Setting User ID:', userData.userId);
      AppEventsLogger.setUserID(userData.userId);
    }
  } catch (e) {
    if (__DEV__) console.warn('[Meta SDK] setUserData/setUserID failed:', e);
  }
}
