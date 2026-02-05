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

