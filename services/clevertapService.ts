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
        ct.recordEvent(eventName, properties);
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
      ct.onUserLogin(profile);
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] onUserLogin error:', e);
    }
  },

  logout(): void {
    try {
      const ct = getCT();
      if (ct?.logout) ct.logout();
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] logout error:', e);
    }
  },

  /**
   * CleverTap Charged event for revenue (order/payment). Call once per successful order.
   */
  recordCharged(
    orderId: string,
    amount: number,
    itemCount: number,
    paymentMethod?: string,
    currency: string = 'INR'
  ): void {
    try {
      const ct = getCT();
      if (!ct?.recordChargedEvent) return;
      const chargeDetails: Record<string, any> = {
        totalValue: amount,
        orderId,
        currency,
        itemCount,
      };
      if (paymentMethod) chargeDetails.paymentMethod = paymentMethod;
      ct.recordChargedEvent(chargeDetails, []);
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] recordCharged error:', e);
    }
  },

  /**
   * Register the native push token with CleverTap (required for push campaigns).
   *
   * - **Android:** `registerForPush()` is a no-op; we must use `setFCMPushToken` with the FCM token.
   *   Also creates notification channel `default_channel` (matches `app.json` CleverTap plugin).
   * - **iOS:** Same JS API `setFCMPushToken` maps native-side to `setPushTokenAsString` (APNs token from
   *   `getDevicePushTokenAsync`). Push does not work on Simulator.
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

      ct.setFCMPushToken(token);
      if (__DEV__) {
        console.log('[CleverTap] Native push token sent (', Platform.OS, ', length:', token.length, ')');
      }
    } catch (e) {
      if (__DEV__) console.warn('[CleverTap] syncNativePushTokenWithCleverTap error:', e);
    }
  },
};
