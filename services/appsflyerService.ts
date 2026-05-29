import { NativeModules, Platform } from 'react-native';
import appsFlyer from 'react-native-appsflyer';
import type { UnifiedDeepLinkData } from 'react-native-appsflyer';

import {
  APPSFLYER_DEV_KEY,
  APPSFLYER_IOS_APP_ID,
  APPSFLYER_ONELINK_TEMPLATE_ID,
  APPSFLYER_REFERRAL_DEEP_LINK_VALUE,
} from '@/config/appsflyer';
import { useReferralAttributionStore } from '@/store/referralAttributionStore';

let initialized = false;

export function isAppsFlyerReady(): boolean {
  return initialized && isNativeModuleAvailable() && Boolean(APPSFLYER_DEV_KEY);
}

function isNativeModuleAvailable(): boolean {
  return Boolean(NativeModules.RNAppsFlyer);
}

function handleDeepLink(res: UnifiedDeepLinkData) {
  if (res?.deepLinkStatus !== 'FOUND' || !res?.data) return;

  const { deep_link_value, deep_link_sub1, af_sub1 } = res.data;
  const sub1 = deep_link_sub1 ?? af_sub1;

  if (deep_link_value === APPSFLYER_REFERRAL_DEEP_LINK_VALUE && sub1) {
    const code = String(sub1).trim();
    if (!code) return;
    if (__DEV__) {
      console.log(`[AppsFlyer] Intercepted referral code: ${code}`);
    }
    useReferralAttributionStore.getState().setPendingReferralCode(code);
  }
}

/**
 * Register UDL listener and start AppsFlyer SDK.
 * Call once after ATT on iOS (see RootLayout).
 * @returns Unsubscribe deep-link listener (call on teardown).
 */
export function initializeAppsFlyer(): () => void {
  if (initialized) return () => {};
  if (!isNativeModuleAvailable()) {
    if (__DEV__) {
      console.warn('[AppsFlyer] Native module unavailable (Expo Go?) — skipping init');
    }
    return () => {};
  }
  if (!APPSFLYER_DEV_KEY) {
    if (__DEV__) {
      console.warn('[AppsFlyer] EXPO_PUBLIC_APPSFLYER_DEV_KEY is missing — SDK not started');
    }
    return () => {};
  }

  let unsubscribeDeepLink: (() => void) | undefined;

  try {
    appsFlyer.setAppInviteOneLinkID(APPSFLYER_ONELINK_TEMPLATE_ID);

    unsubscribeDeepLink = appsFlyer.onDeepLink(handleDeepLink);

    const initOptions = {
      devKey: APPSFLYER_DEV_KEY,
      isDebug: __DEV__,
      onDeepLinkListener: true,
      timeToWaitForATTUserAuthorization: 10,
      ...(Platform.OS === 'ios' && APPSFLYER_IOS_APP_ID
        ? { appId: APPSFLYER_IOS_APP_ID }
        : {}),
    };

    appsFlyer.initSdk(
      initOptions,
      () => {
        if (__DEV__) console.log('[AppsFlyer] Engine online');
      },
      (error) => {
        console.error('[AppsFlyer] Initialization error:', error);
      },
    );

    initialized = true;
  } catch (e) {
    console.error('[AppsFlyer] Failed to initialize:', e);
  }

  return () => {
    unsubscribeDeepLink?.();
  };
}

export function logCompleteRegistration(params?: Record<string, any>): void {
  if (!isAppsFlyerReady()) return;
  appsFlyer.logEvent('af_complete_registration', params || {}).catch((e) => {
    if (__DEV__) console.warn('[AppsFlyer] Failed to log af_complete_registration:', e);
  });
}
