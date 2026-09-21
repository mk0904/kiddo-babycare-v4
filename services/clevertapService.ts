/**
 * CleverTap in-app events and profile.
 * All events from mixpanelHelpers are also sent here so CleverTap has full coverage.
 * Safe no-op when clevertap-react-native is not installed or not initialized.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

let CleverTap: any = null;

try {
  const ct = require('clevertap-react-native');
  CleverTap = ct?.default ?? ct;
} catch {
  // SDK not installed or not linked; all methods no-op
}

function getCT(): any {
  return CleverTap ?? null;
}

/** Must match `app.json` → `@clevertap/clevertap-expo-plugin` → `android.defaultNotificationChannelId` */
const ANDROID_DEFAULT_CT_CHANNEL_ID = 'default_channel';

export const clevertapService = {
  recordEvent(eventName: string, properties?: Record<string, any>): void {
    try {
      const ct = getCT();
      if (!ct?.recordEvent) return;
      if (properties && Object.keys(properties).length > 0) {
        const sanitizedProps: Record<string, any> = {};
        for (const [key, value] of Object.entries(properties)) {
          const safeKey = key.replace(/\./g, '_');
          if (Array.isArray(value)) {
            sanitizedProps[safeKey] = value.join(', ');
          } else {
            sanitizedProps[safeKey] = value;
          }
        }
        ct.recordEvent(eventName, sanitizedProps);
      } else {
        ct.recordEvent(eventName);
      }
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] recordEvent error:', e);
    }
  },

  onUserLogin(profile: {
    Identity?: string;
    Email?: string;
    Phone?: string;
    Name?: string;
    [k: string]: any;
  }): void {
    try {
      const ct = getCT();
      if (!ct?.onUserLogin) return;
      const formattedProfile = { ...profile };
      if (formattedProfile.Phone) {
        const cleaned = String(formattedProfile.Phone).replace(/\D/g, '');
        if (cleaned.length === 10) {
          formattedProfile.Phone = `+91${cleaned}`;
        } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
          formattedProfile.Phone = `+${cleaned}`;
        } else if (!String(formattedProfile.Phone).startsWith('+')) {
          formattedProfile.Phone = `+${cleaned}`;
        }
      }
      ct.onUserLogin(formattedProfile);
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] onUserLogin error:', e);
    }
  },

  logout(): void {
    try {
      const ct = getCT();
      // Note: CleverTap React Native SDK does not expose a ct.logout() method.
      // Profile separation on logout is managed via fresh anonymous identity / onUserLogin.
      if (typeof ct?.logout === 'function') {
        ct.logout();
      }
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] logout error:', e);
    }
  },

  /**
   * CleverTap Charged event for revenue (order/payment). Call once per successful order.
   * Conforms to standard CleverTap Charged event schema with Amount, Charged ID, Payment Mode,
   * and product-level items array.
   */
  recordCharged(
    orderId: string,
    amount: number,
    itemCount: number,
    paymentMethod?: string,
    currency: string = 'INR',
    items?: Array<{
      name?: string;
      title?: string;
      category?: string;
      price?: number;
      quantity?: number;
      productId?: string;
      sku?: string;
    }>
  ): void {
    try {
      const ct = getCT();
      if (!ct?.recordChargedEvent) return;

      const chargeDetails: Record<string, any> = {
        // Standard CleverTap revenue keys
        'Amount': amount,
        'Charged ID': orderId,
        'Payment Mode': paymentMethod || 'Unknown',
        'Payment Method': paymentMethod || 'Unknown',
        'Currency': currency,
        'Items Count': itemCount,
        // Legacy / fallback keys for consistency
        orderId,
        totalValue: amount,
        currency,
        itemCount,
        paymentMethod: paymentMethod || 'Unknown',
      };

      const itemsArray = (items && items.length > 0)
        ? items.map((item) => ({
            'Product Name': item.title || item.name || 'Product',
            'Category': item.category || 'General',
            'Price': typeof item.price === 'number' ? item.price : 0,
            'Quantity': typeof item.quantity === 'number' ? item.quantity : 1,
            'Product ID': item.productId || '',
            'SKU': item.sku || '',
          }))
        : [];

      ct.recordChargedEvent(chargeDetails, itemsArray);
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] recordCharged error:', e);
    }
  },

  /**
   * Register the native push token with CleverTap (required for push campaigns and uninstall tracking).
   *
   * - **Android:** Uses `setFCMPushToken` (and `setPushToken` for redundancy) with the FCM token.
   *   Requires `fcmSenderId` in `app.json` for uninstall tracking to work.
   *   Also creates notification channel `default_channel`.
   * - **iOS:** Uses `setPushToken` with the APNs token. Push does not work on Simulator.
   *
   * Safe to call multiple times (e.g. after login). Requests notification permission if needed.
   */
  async syncNativePushTokenWithCleverTap(): Promise<void> {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

    const ct = getCT();
    if (!ct?.setFCMPushToken) return;

    if (Platform.OS === 'android') {
      try {
        if (ct.createNotificationChannel) {
          ct.createNotificationChannel(
            ANDROID_DEFAULT_CT_CHANNEL_ID,
            'Kiddo',
            'Order updates and offers',
            5,
            true
          );
        }
      } catch (e) {
        if (__DEV__) console.warn('[CleverTap] createNotificationChannel error:', e);
      }
    }

    try {
      let perm = await Notifications.getPermissionsAsync();
      if (perm.status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        perm = req;
      }
      if (perm.status !== 'granted') {
        if (__DEV__) {
          console.warn('[CleverTap] Push sync skipped: notification permission denied');
        }
        return;
      }

      const devicePush = await Notifications.getDevicePushTokenAsync();
      const token = typeof devicePush?.data === 'string' ? devicePush.data : null;
      if (!token) {
        if (__DEV__) {
          console.warn(
            '[CleverTap] No native push token — Android: check google-services / Play Services; iOS: use a real device (Simulator has no APNs token)'
          );
        }
        return;
      }

      if (Platform.OS === 'ios') {
        // Use setPushToken for APNs (iOS)
        if (ct.setPushToken) {
          ct.setPushToken(token);
        } else {
          ct.setFCMPushToken(token);
        }
      } else {
        // For Android, ensure the token is registered correctly for FCM
        ct.setFCMPushToken(token);
        if (ct.setPushToken) {
          ct.setPushToken(token);
        }
      }

      if (__DEV__) {
        console.log('[CleverTap] Native push token sent (', Platform.OS, ', length:', token.length, ')');
      }
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] syncNativePushTokenWithCleverTap error:', e);
    }
  },
};
