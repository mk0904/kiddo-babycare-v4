
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
  currency = 'INR',
) => {
  emitAppsFlyerSignal('af_add_to_cart', {
    af_content_id: extractNumericId(itemId) || itemId,
    af_content_type: itemCategory || 'product',
    af_price: itemPrice,
    af_quantity: quantity,
    af_currency: currency,
  });
};

export const trackInitiatedCheckoutAction = (
  cartTotalValue: number,
  itemCount: number,
  contentIds?: string[],
  currency = 'INR',
) => {
  const payload: Record<string, any> = {
    af_price: cartTotalValue,
    af_currency: currency,
    af_quantity: itemCount,
    af_content_type: 'product',
  };
  if (contentIds && contentIds.length > 0) {
    payload.af_content_id = contentIds.map(id => extractNumericId(id) || id);
  }
  emitAppsFlyerSignal('af_initiated_checkout', payload);
};

/**
 * Financial events MUST include af_revenue (number) for ROAS reporting in ad dashboards.
 */
export const trackPurchaseCompletion = (
  orderId: string,
  finalBillAmount: number,
  itemCount: number,
  contentIds?: string[],
  currency = 'INR',
) => {
  const payload: Record<string, any> = {
    af_revenue: finalBillAmount,
    af_price: finalBillAmount,
    af_currency: currency,
    af_receipt_id: orderId,
    af_order_id: orderId,
    af_quantity: itemCount,
    af_content_type: 'product',
  };
  if (contentIds && contentIds.length > 0) {
    payload.af_content_id = contentIds.map(id => extractNumericId(id) || id);
  }
  emitAppsFlyerSignal('af_purchase', payload);
};

export const trackRegistrationAction = (
  registrationMethod = 'phone',
) => {
  emitAppsFlyerSignal('af_complete_registration', {
    af_registration_method: registrationMethod,
  });
};

export const trackLoginAction = (
  loginMethod = 'phone',
) => {
  emitAppsFlyerSignal('af_login', {
    af_login_method: loginMethod,
  });
};

export const trackSearchAction = (
  searchString: string,
  contentList?: string[],
) => {
  const payload: Record<string, any> = {
    af_search_string: searchString,
  };
  if (contentList && contentList.length > 0) {
    payload.af_content_list = contentList;
  }
  emitAppsFlyerSignal('af_search', payload);
};

export const trackContentViewAction = (
  productId: string,
  price?: number,
  currency: string = 'INR',
) => {
  const payload: Record<string, any> = {
    af_content_id: extractNumericId(productId) || productId,
    af_content_type: 'product',
    af_currency: currency,
  };
  if (price != null && Number.isFinite(price)) {
    payload.af_price = price;
  }
  emitAppsFlyerSignal('af_content_view', payload);
};

export const trackListViewAction = (
  contentType: string,
  contentList?: string[],
) => {
  const payload: Record<string, any> = {
    af_content_type: contentType,
  };
  if (contentList && contentList.length > 0) {
    payload.af_content_list = contentList;
  }
  emitAppsFlyerSignal('af_list_view', payload);
};

export const trackAddToWishlistAction = (
  productId: string,
  price?: number,
  currency: string = 'INR',
) => {
  const payload: Record<string, any> = {
    af_content_id: extractNumericId(productId) || productId,
    af_content_type: 'product',
    af_currency: currency,
  };
  if (price != null && Number.isFinite(price)) {
    payload.af_price = price;
  }
  emitAppsFlyerSignal('af_add_to_wishlist', payload);
};
