/**
 * OneSignal push notifications.
 * Device still uses OneSignal SDK to receive notifications; backend sends via its configured provider
 * (OneSignal or other) so provider can be swapped without app release.
 * - Android: FCM (google-services required). Test on device or emulator with Play Services.
 * - iOS: APNs. Push does NOT work on iOS Simulator. Use a real device; run `cd ios && pod install` after native deps change.
 */
import { Platform } from 'react-native';

let OneSignal: any = null;

if (Platform.OS === 'android') {
  try {
    const OneSignalModule = require('react-native-onesignal');
    OneSignal = OneSignalModule?.OneSignal ?? OneSignalModule?.default ?? OneSignalModule;
  } catch (error: any) {
    if (__DEV__) console.warn('[OneSignal] Android import failed:', error?.message);
  }
} else {
  try {
    const OneSignalModule = require('react-native-onesignal');
    OneSignal = OneSignalModule?.OneSignal ?? OneSignalModule?.default ?? OneSignalModule;
  } catch (error: any) {
    if (__DEV__) console.warn('[OneSignal] iOS import failed (simulator?):', error?.message ?? error);
  }
}

const ONESIGNAL_APP_ID = 'f27e340f-3a14-47bb-abef-d94319e7e93e';

function getActualOneSignal() {
  if (OneSignal?.OneSignal && typeof OneSignal.OneSignal === 'object') return OneSignal.OneSignal;
  return OneSignal;
}

export const oneSignalService = {
  initialize: (): boolean => {
    try {
      if (!OneSignal) {
        if (__DEV__) console.warn('[OneSignal] Module not found');
        return false;
      }
      const actual = getActualOneSignal();
      if (typeof actual?.initialize === 'function') {
        actual.initialize(ONESIGNAL_APP_ID);
        OneSignal = actual;
        return true;
      }
      if (typeof actual?.setAppId === 'function') {
        actual.setAppId(ONESIGNAL_APP_ID);
        OneSignal = actual;
        return true;
      }
      if (actual?.Notifications) {
        OneSignal = actual;
        return true;
      }
      try {
        (actual as any).initialize(ONESIGNAL_APP_ID);
        OneSignal = actual;
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  },

  requestPermission: async (fallbackToSettings: boolean = true): Promise<boolean> => {
    try {
      const actual = getActualOneSignal();
      if (!actual?.Notifications?.requestPermission) return false;
      return await actual.Notifications.requestPermission(fallbackToSettings);
    } catch {
      return false;
    }
  },

  isAvailable: (): boolean => {
    const actual = OneSignal?.OneSignal || OneSignal;
    return !!(
      actual &&
      (typeof actual.initialize === 'function' ||
        typeof actual.setAppId === 'function' ||
        actual.Notifications !== undefined)
    );
  },

  getPermissionStatus: async (): Promise<boolean> => {
    try {
      const actual = getActualOneSignal();
      if (!actual?.Notifications?.getPermissionAsync) return false;
      return await actual.Notifications.getPermissionAsync();
    } catch {
      return false;
    }
  },

  checkSubscriptionStatus: async (): Promise<{ isSubscribed: boolean; id: string | null }> => {
    try {
      const actual = getActualOneSignal();
      if (!actual?.User?.pushSubscription?.getIdAsync) return { isSubscribed: false, id: null };
      const id = await actual.User.pushSubscription.getIdAsync();
      const isOptedIn = await actual.User.pushSubscription.getOptedInAsync?.() ?? false;
      return { isSubscribed: !!isOptedIn, id: id || null };
    } catch {
      return { isSubscribed: false, id: null };
    }
  },
};
