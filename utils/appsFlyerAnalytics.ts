import { NativeModules } from 'react-native';
import appsFlyer from 'react-native-appsflyer';

import { isAppsFlyerReady } from '@/services/appsflyerService';
import { extractNumericId } from '@/utils/shopifyIds';

function canEmit(): boolean {
  return isAppsFlyerReady() && Boolean(NativeModules.RNAppsFlyer);
}

/**
 * Bind verified User ID to AppsFlyer logs upon successful login/signup.
 */
export const associateUserSession = (userId: string) => {
  if (!canEmit() || !userId.trim()) return;
  try {
    appsFlyer.setCustomerUserId(userId.trim(), () => {
      if (__DEV__) console.log('[AppsFlyer] User session mapped to platform');
    });
  } catch (e) {
    if (__DEV__) console.warn('[AppsFlyer] setCustomerUserId failed:', e);
  }
};

/**
 * Baseline AppsFlyer event emitter (in-app postbacks to AppsFlyer dashboard).
 */
const emitAppsFlyerSignal = (eventName: string, dataParams: Record<string, unknown> = {}) => {
  if (!canEmit()) return;
  try {
    appsFlyer.logEvent(
      eventName,
      dataParams,
      () => {
        if (__DEV__) console.log(`[AppsFlyer] Logged signal: ${eventName}`, dataParams);
      },
      (error) => {
        console.error(`[AppsFlyer] Signal fail ${eventName}:`, error);
      },
    );
  } catch (e) {
    if (__DEV__) console.warn(`[AppsFlyer] logEvent failed ${eventName}:`, e);
  }
};

// --- COMMERCE & CAMPAIGN AD OPTIMIZATION EVENTS ---

export const trackAddToCartAction = (
  itemId: string,
  itemCategory: string,
  itemPrice: number,
  quantity = 1,
) => {
  emitAppsFlyerSignal('af_add_to_cart', {
    af_content_id: extractNumericId(itemId) || itemId,
    af_content_type: itemCategory || 'product',
    af_price: itemPrice,
    af_quantity: quantity,
  });
};

export const trackInitiatedCheckoutAction = (cartTotalValue: number, currency = 'INR') => {
  emitAppsFlyerSignal('af_initiated_checkout', {
    af_price: cartTotalValue,
    af_currency: currency,
  });
};

/**
 * Financial events MUST include af_revenue (number) for ROAS reporting in ad dashboards.
 */
export const trackPurchaseCompletion = (
  orderId: string,
  finalBillAmount: number,
  currency = 'INR',
) => {
  emitAppsFlyerSignal('af_purchase', {
    af_revenue: finalBillAmount,
    af_currency: currency,
    af_receipt_id: orderId,
  });
};
