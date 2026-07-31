import { analyticsService } from '@/services/analyticsService';
import { clevertapService } from '@/services/clevertapService';
import { useUserStore } from '@/store/userStore';
import {
    associateUserSession,
    trackAddToCartAction,
    trackAddToWishlistAction,
    trackContentViewAction,
    trackInitiatedCheckoutAction,
    trackListViewAction,
    trackLoginAction,
    trackPurchaseCompletion,
    trackRegistrationAction,
    trackSearchAction,
} from '@/utils/appsFlyerAnalytics';
import { extractNumericId } from '@/utils/shopifyIds';

/**
 * Analytics Helpers - Events are sent to the backend (Mixpanel, CleverTap) and CleverTap in-app.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ANON_DEVICE_ID_KEY = '@kiddo_anon_device_id';
let _cachedAnonId: string | null = null;

/** Returns a stable anonymous device ID, generating one on first call and caching it. */
async function getOrCreateAnonId(): Promise<string> {
  if (_cachedAnonId) return _cachedAnonId;
  try {
    let stored = await AsyncStorage.getItem(ANON_DEVICE_ID_KEY);
    if (!stored) {
      // Generate a simple UUID-like ID without external deps
      stored = 'anon-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      await AsyncStorage.setItem(ANON_DEVICE_ID_KEY, stored);
    }
    _cachedAnonId = stored;
    return stored;
  } catch {
    return 'anon-unknown';
  }
}

function getDistinctId(): string {
  try {
    const user = useUserStore.getState().user;
    return user?.email || user?.id || user?.customerId || user?.phone || _cachedAnonId || '';
  } catch {
    return _cachedAnonId || '';
  }
}

// Eagerly warm the anon ID cache on module load so it's ready before first event
getOrCreateAnonId().catch(() => {});


/**
 * Track a custom event (sent to backend → Mixpanel).
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  try {
    const props = properties ?? {};
    analyticsService.track(eventName, props, getDistinctId());
    
    // Send event directly to local Mixpanel SDK
    try {
      const { mixpanel } = require('@/mixpanel');
      if (mixpanel) {
        mixpanel.track(eventName, props);
      }
    } catch (e) {
      console.warn('[Mixpanel] Direct tracking failed:', e);
    }

    // CleverTap Snapshot (DAU/WAU/MAU) uses "App Launched"; send it when app opens so metrics populate
    const ctEventName = eventName === 'App Opened' ? 'App Launched' : eventName;
    clevertapService.recordEvent(ctEventName, props);
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
};

/**
 * Identify a user (call after login). Sends to backend for Mixpanel identify + people.set.
 */
export const identifyUser = (userId: string, userProperties?: {
  name?: string;
  email?: string;
  [key: string]: any;
}) => {
  try {
    analyticsService.identify(userId, userProperties ?? {});
    
    // Set properties directly in local Mixpanel SDK
    try {
      const { mixpanel } = require('@/mixpanel');
      if (mixpanel) {
        mixpanel.identify(userId);
        const mixpanelProps: Record<string, any> = {};
        if (userProperties?.name) mixpanelProps['$name'] = userProperties.name;
        if (userProperties?.email) mixpanelProps['$email'] = userProperties.email;
        if (userProperties?.phone) mixpanelProps['$phone'] = userProperties.phone;
        
        // Include any other metadata properties passed in
        Object.entries(userProperties ?? {}).forEach(([k, v]) => {
          if (!['name', 'email', 'phone'].includes(k)) {
            mixpanelProps[k] = v;
          }
        });
        
        mixpanel.people.set(mixpanelProps);
      }
    } catch (e) {
      console.warn('[Mixpanel] Direct identify/people.set failed:', e);
    }

    const profile: Record<string, any> = {
      Identity: userId,
      ...(userProperties ?? {}),
    };
    if (userProperties?.email) profile.Email = userProperties.email;
    if (userProperties?.name) profile.Name = userProperties.name;
    if (userProperties?.phone) profile.Phone = userProperties.phone;
    clevertapService.onUserLogin(profile);
    // Attach native push token (FCM / APNs) to CleverTap profile for push campaigns
    void clevertapService.syncNativePushTokenWithCleverTap();
    associateUserSession(userId);
  } catch (error) {
    console.error('Analytics identify error:', error);
  }
};

/**
 * Track screen views
 */
export const trackScreenView = (screenName: string, additionalProperties?: Record<string, any>) => {
  try {
    const props = { screen: screenName, ...additionalProperties };
    analyticsService.track('Screen View', props, getDistinctId());
    clevertapService.recordEvent('Screen View', props);
  } catch (error) {
    console.error('Analytics screen tracking error:', error);
  }
};

/**
 * Reset user identity (call on logout). Backend no-ops; client clears local state.
 */
export const resetUser = () => {
  try {
    analyticsService.reset();
    
    // Reset local Mixpanel SDK identity
    try {
      const { mixpanel } = require('@/mixpanel');
      if (mixpanel) {
        mixpanel.reset();
      }
    } catch (e) {
      console.warn('[Mixpanel] Direct reset failed:', e);
    }

    clevertapService.logout();
  } catch (error) {
    console.error('Analytics reset error:', error);
  }
};

// Pre-defined event trackers for common actions

export const trackLoginSuccess = (userId: string) => {
  trackEvent('Login Success', { userId });
  identifyUser(userId);
  trackLoginAction();
};

export const trackLoginFailed = (reason?: string) => {
  trackEvent('Login Failed', { reason });
};

export const trackProductViewed = (productId: string, productName?: string, price?: number) => {
  trackEvent('Product Viewed', {
    productId,
    productName,
    price,
    content_id: extractNumericId(productId),
    content_type: 'product',
    value: price,
    currency: 'INR',
  });
  trackContentViewAction(productId, price, 'INR');
};

export const trackAddToCart = (productId: string, productName?: string, price?: number, quantity?: number) => {
  trackEvent('Add to Cart', {
    productId,
    productName,
    price,
    quantity: quantity || 1,
    content_id: extractNumericId(productId),
    content_type: 'product',
    value: price,
    currency: 'INR',
  });
  if (price != null && Number.isFinite(price)) {
    trackAddToCartAction(productId, 'product', price, quantity || 1);
  }
};

export const trackCheckoutStarted = (cartValue: number, itemCount: number, productIds?: string[]) => {
  trackEvent('Checkout Started', {
    cartValue,
    itemCount,
    value: cartValue,
    currency: 'INR',
    content_ids: productIds?.map(id => extractNumericId(id)) || [],
    content_type: 'product',
    num_items: itemCount,
  });
  trackInitiatedCheckoutAction(cartValue, itemCount, productIds, 'INR');
};

export const trackPaymentSuccess = (orderId: string, amount: number, paymentMethod: string, productIds?: string[]) => {
  trackEvent('Payment Success', {
    event_id: orderId,
    orderId,
    amount,
    paymentMethod,
    value: amount,
    currency: 'INR',
    content_ids: productIds?.map(id => extractNumericId(id)) || [],
    content_type: 'product',
  });
};

export const trackPaymentFailed = (orderId: string, amount: number, reason?: string) => {
  trackEvent('Payment Failed', {
    orderId,
    amount,
    reason,
  });
};

// ============================================
// ONBOARDING / ACTIVATION EVENTS
// ============================================

export const trackSignupStarted = (method?: string) => {
  trackEvent('Signup Started', { method: method || 'phone' });
};

export const trackSignupCompleted = (userId: string, method?: string) => {
  trackEvent('Signup Completed', { 
    userId,
    method: method || 'phone' 
  });
  trackRegistrationAction(method || 'phone');
};

export const trackMobileOTPVerified = (phoneNumber: string) => {
  trackEvent('Mobile OTP Verified', { phoneNumber });
};

export const trackProfileCreated = (properties: {
  babyAge?: number;
  babyGender?: string;
  babyName?: string;
  hasParentInfo?: boolean;
}) => {
  trackEvent('Profile Created', properties);
};

export const trackFirstProductViewed = (productId: string, productName?: string) => {
  trackEvent('First Product Viewed', {
    productId,
    productName,
  });
  trackContentViewAction(productId);
};

export const trackFirstAddToCart = (productId: string, productName?: string, price?: number) => {
  trackEvent('First Add to Cart', {
    productId,
    productName,
    price,
  });
};

export const trackFirstOrderPlaced = (orderId: string, amount: number) => {
  trackEvent('First Order Placed', {
    event_id: orderId,
    orderId,
    amount,
    value: amount,
    currency: 'INR',
  });
};

export const trackSecondOrderPlaced = (orderId: string, amount: number) => {
  trackEvent('Second Order Placed', {
    event_id: orderId,
    orderId,
    amount,
    value: amount,
    currency: 'INR',
  });
};

export const trackThirdOrderPlaced = (orderId: string, amount: number) => {
  trackEvent('Third Order Placed', {
    event_id: orderId,
    orderId,
    amount,
    value: amount,
    currency: 'INR',
  });
};


// ============================================
// BROWSING & ENGAGEMENT EVENTS
// ============================================

export const trackOpenedWishlist = (itemCount: number, wishlistedCategories: string[], wishlistedItems: string[], wishlistValue: number, availability: string[]) => {
  trackEvent('opened_wishlist', {
    item_count: itemCount,
    wishlisted_categories: wishlistedCategories,
    wishlisted_items: wishlistedItems,
    wishlist_value: wishlistValue,
    availability: availability,
  });
};

export const trackTappedInHomescreen = (icon: string) => {
  trackEvent('tapped_in_homescreen', { icon });
};

export const trackNavbarTapped = (icon: string) => {
  trackEvent('navbar_tapped', { icon });
};

export const trackTappedInCategory = (category: string) => {
  trackEvent('tapped_in_category', { category });
};

export const trackTappedInTicketing = (ticket: string) => {
  trackEvent('tapped_in_ticketing', { ticket });
};

export const trackTappedInProfile = (option: string) => {
  trackEvent('tapped_in_profile', { Option: option });
};

export const trackCategoryViewed = (categoryName: string, categoryId?: string) => {
  trackEvent('Category Viewed', {
    categoryName,
    categoryId,
  });
  trackListViewAction(categoryName);
};

export const trackSearchPerformed = (query: string, resultsCount?: number) => {
  trackEvent('Search Performed', {
    query,
    search_string: query,
    resultsCount,
  });
  trackSearchAction(query);
};

export const trackFiltersApplied = (filters: {
  ageGroup?: string;
  brand?: string;
  priceRange?: string;
  [key: string]: any;
}) => {
  trackEvent('Filters Applied', filters);
};

export const trackRecommendationClicked = (recommendationType: string, itemId: string, itemName?: string) => {
  trackEvent('Recommendation Clicked', {
    recommendationType,
    itemId,
    itemName,
  });
};

export const trackWishlistAdded = (productId: string, productName?: string, price?: number) => {
  trackEvent('Wishlist Added', {
    productId,
    productName,
    price,
    content_id: extractNumericId(productId),
    content_type: 'product',
    value: price,
    currency: 'INR',
  });
  trackAddToWishlistAction(productId, price, 'INR');
};

export const trackProductShareClicked = (productId: string, productName?: string, shareMethod?: string) => {
  trackEvent('Product Share Clicked', {
    productId,
    'product id': extractNumericId(productId) || productId,
    productName,
    shareMethod,
  });
};

export const trackProductImageSwiped = (productId: string, imageIndex: number) => {
  trackEvent('Product Image Swiped', {
    productId,
    imageIndex,
  });
};

export const trackSizeSelected = (productId: string, size: string) => {
  trackEvent('Size Selected', {
    productId,
    size,
  });
};

// ============================================
// CART EVENTS
// ============================================

export const trackRemoveFromCart = (productId: string, productName?: string, price?: number) => {
  trackEvent('Remove from Cart', {
    productId,
    productName,
    price,
  });
};

export const trackCartViewed = (itemCount: number, cartValue: number) => {
  trackEvent('Cart Viewed', {
    itemCount,
    cartValue,
  });
};

export const trackQuantityIncreased = (productId: string, oldQty: number, newQty: number) => {
  trackEvent('Quantity Increased', {
    productId,
    oldQty,
    newQty,
  });
};

export const trackQuantityDecreased = (productId: string, oldQty: number, newQty: number) => {
  trackEvent('Quantity Decreased', {
    productId,
    oldQty,
    newQty,
  });
};

export const trackCouponApplied = (couponCode: string, discountAmount?: number) => {
  trackEvent('Coupon Applied', {
    couponCode,
    discountAmount,
    value: discountAmount,
  });
};

export const trackCouponFailed = (couponCode: string, reason?: string) => {
  trackEvent('Coupon Failed', {
    couponCode,
    reason,
  });
};

export const trackCouponRemoved = (couponCode: string) => {
  trackEvent('Coupon Removed', {
    couponCode,
  });
};

export const trackDeliveryETAChecked = (address?: string, estimatedTime?: number) => {
  trackEvent('Delivery ETA Checked', {
    address,
    estimatedTime,
  });
};

// ============================================
// CHECKOUT EVENTS
// ============================================

export const trackPaymentMethodSelected = (paymentMethod: string) => {
  trackEvent('Payment Method Selected', {
    paymentMethod,
  });
};

export const trackOrderPlaced = (orderId: string, amount: number, itemCount: number, paymentMethod: string, productIds?: string[]) => {
  trackEvent('Order Placed', {
    event_id: orderId,
    orderId,
    amount,
    itemCount,
    paymentMethod,
    value: amount,
    currency: 'INR',
    content_ids: productIds?.map(id => extractNumericId(id)) || [],
    content_type: 'product',
  });
  clevertapService.recordCharged(orderId, amount, itemCount, paymentMethod, 'INR');
  trackPurchaseCompletion(orderId, amount, itemCount, productIds, 'INR');
};

export const trackOrderConfirmed = (orderId: string, amount: number) => {
  trackEvent('Order Confirmed', {
    event_id: orderId,
    orderId,
    amount,
    value: amount,
    currency: 'INR',
  });
};

export const trackAddressAdded = (addressId: string, city?: string, pincode?: string) => {
  trackEvent('Address Added', {
    addressId,
    city,
    pincode,
  });
};

export const trackAddressSelected = (addressId: string) => {
  trackEvent('Address Selected', {
    addressId,
  });
};

export const trackDeliverySlotSelected = (slotDate: string, slotTime: string) => {
  trackEvent('Delivery Slot Selected', {
    slotDate,
    slotTime,
  });
};

// ============================================
// WALLET EVENTS
// ============================================

export const trackWalletApplied = (walletAmountUsed: number) => {
  trackEvent('Wallet Applied', {
    walletAmountUsed,
    value: walletAmountUsed,
    currency: 'INR',
  });
};

// ============================================
// CART ABANDONMENT EVENTS
// ============================================

export const trackCartAbandoned = (cartValue: number, itemCount: number) => {
  trackEvent('Cart Abandoned', {
    cartValue,
    itemCount,
    value: cartValue,
    currency: 'INR',
  });
};

// ============================================
// GRID CLICK EVENTS
// ============================================

export const trackGridCellClicked = (gridId: string, cellPosition: number, collectionId?: string, collectionName?: string, categoryKey?: string, categoryLabel?: string, gridSize?: number, numColumns?: number) => {
  trackEvent('Grid Cell Clicked', {
    gridId,
    cellPosition,
    collectionId,
    collectionName,
    categoryKey,
    categoryLabel,
    gridSize,
    numColumns,
  });
};

