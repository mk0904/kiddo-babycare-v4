import { mixpanel } from '@/mixpanel';

/**
 * Mixpanel Analytics Helpers
 * 
 * Usage examples:
 * - trackEvent('Add to Cart', { productId: '123', price: 499 })
 * - identifyUser('user123')
 * - trackScreenView('Home')
 */

/**
 * Track a custom event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  try {
    mixpanel.track(eventName, properties);
  } catch (error) {
    console.error('Mixpanel tracking error:', error);
  }
};

/**
 * Identify a user (call after login)
 * ⚠️ Never call before login
 */
export const identifyUser = (userId: string, userProperties?: {
  name?: string;
  email?: string;
  [key: string]: any;
}) => {
  try {
    mixpanel.identify(userId);
    if (userProperties) {
      mixpanel.people.set(userProperties);
    }
  } catch (error) {
    console.error('Mixpanel identify error:', error);
  }
};

/**
 * Track screen views
 */
export const trackScreenView = (screenName: string, additionalProperties?: Record<string, any>) => {
  try {
    mixpanel.track('Screen View', {
      screen: screenName,
      ...additionalProperties,
    });
  } catch (error) {
    console.error('Mixpanel screen tracking error:', error);
  }
};

/**
 * Reset user identity (call on logout)
 */
export const resetUser = () => {
  try {
    mixpanel.reset();
  } catch (error) {
    console.error('Mixpanel reset error:', error);
  }
};

// Pre-defined event trackers for common actions

export const trackLoginSuccess = (userId: string) => {
  trackEvent('Login Success', { userId });
  identifyUser(userId);
};

export const trackLoginFailed = (reason?: string) => {
  trackEvent('Login Failed', { reason });
};

export const trackProductViewed = (productId: string, productName?: string, price?: number) => {
  trackEvent('Product Viewed', {
    productId,
    productName,
    price,
  });
};

export const trackAddToCart = (productId: string, productName?: string, price?: number, quantity?: number) => {
  trackEvent('Add to Cart', {
    productId,
    productName,
    price,
    quantity: quantity || 1,
  });
};

export const trackCheckoutStarted = (cartValue: number, itemCount: number) => {
  trackEvent('Checkout Started', {
    cartValue,
    itemCount,
  });
};

export const trackPaymentSuccess = (orderId: string, amount: number, paymentMethod: string) => {
  trackEvent('Payment Success', {
    orderId,
    amount,
    paymentMethod,
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
    orderId,
    amount,
  });
};

// ============================================
// BROWSING & ENGAGEMENT EVENTS
// ============================================

export const trackCategoryViewed = (categoryName: string, categoryId?: string) => {
  trackEvent('Category Viewed', {
    categoryName,
    categoryId,
  });
};

export const trackSearchPerformed = (query: string, resultsCount?: number) => {
  trackEvent('Search Performed', {
    query,
    resultsCount,
  });
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

export const trackWishlistAdded = (productId: string, productName?: string) => {
  trackEvent('Wishlist Added', {
    productId,
    productName,
  });
};

export const trackProductShareClicked = (productId: string, productName?: string, shareMethod?: string) => {
  trackEvent('Product Share Clicked', {
    productId,
    productName,
    shareMethod,
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

export const trackCouponApplied = (couponCode: string, discountAmount?: number) => {
  trackEvent('Coupon Applied', {
    couponCode,
    discountAmount,
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

export const trackOrderPlaced = (orderId: string, amount: number, itemCount: number, paymentMethod: string) => {
  trackEvent('Order Placed', {
    orderId,
    amount,
    itemCount,
    paymentMethod,
  });
};

export const trackOrderConfirmed = (orderId: string, amount: number) => {
  trackEvent('Order Confirmed', {
    orderId,
    amount,
  });
};

