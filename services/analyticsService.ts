import axios from 'axios';
import { getBackendApiPath } from './backendBase';
import analytics from '@react-native-firebase/analytics';

/**
 * Cleanly integrates Google Analytics (Firebase) with our existing backend analytics.
 */

async function postToBackend(endpoint: string, body: object): Promise<void> {
  try {
    const url = getBackendApiPath(endpoint);
    await axios.post(url, body, { timeout: 5000 });
  } catch (e) {
    if (__DEV__) {
      console.warn(`[Analytics] Backend request failed (${endpoint}):`, e);
    }
  }
}

export const analyticsService = {
  /**
   * Helper to safely access analytics
   */
  get instance() {
    try {
      return analytics();
    } catch (e) {
      return null;
    }
  },

  /**
   * Tracks an event across all configured analytics providers.
   * @param event - The name of the event (e.g., 'Product Viewed')
   * @param properties - Optional metadata for the event
   * @param distinctId - Optional user identifier
   */
  async track(event: string, properties?: Record<string, any>, distinctId?: string): Promise<void> {
    // 1. Track in existing custom backend
    postToBackend('analytics/track', {
      event,
      properties: properties ?? {},
      distinct_id: distinctId ?? '',
    });

    // 2. Track in Firebase Analytics (Google SDK)
    const instance = this.instance;
    if (!instance) return;

    try {
      // Firebase events use underscores and lowercase by convention
      const firebaseEventName = event.toLowerCase().replace(/\s+/g, '_').substring(0, 40);
      await instance.logEvent(firebaseEventName, properties);
    } catch (e) {
      if (__DEV__) {
        console.warn('[Analytics] Firebase logEvent failed:', e);
      }
    }
  },

  /**
   * Identifies a user across analytics providers.
   */
  async identify(distinctId: string, properties?: Record<string, any>): Promise<void> {
    postToBackend('analytics/identify', {
      distinct_id: distinctId,
      properties: properties ?? {},
    });

    const instance = this.instance;
    if (!instance) return;

    try {
      await instance.setUserId(distinctId);
      if (properties) {
        // Filter out complex objects from properties for Firebase
        const cleanProperties: Record<string, string | number | boolean | null> = {};
        for (const key in properties) {
          const val = properties[key];
          if (['string', 'number', 'boolean'].includes(typeof val) || val === null) {
            cleanProperties[key] = val;
          }
        }
        await instance.setUserProperties(cleanProperties);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[Analytics] Firebase identify failed:', e);
      }
    }
  },

  /**
   * Resets analytics data for the current user.
   */
  async reset(): Promise<void> {
    postToBackend('analytics/reset', {});
    
    const instance = this.instance;
    if (!instance) return;

    try {
      await instance.resetAnalyticsData();
    } catch (e) {
      if (__DEV__) {
        console.warn('[Analytics] Firebase reset failed:', e);
      }
    }
  },
  
  /**
   * Standard ecommerce events for Google SDK
   */

  async logAddToCart(params: {
    items: Array<{
      item_id: string;
      item_name: string;
      item_category?: string;
      price?: number;
      quantity?: number;
      currency?: string;
    }>;
    value?: number;
    currency?: string;
  }): Promise<void> {
    this.track('Add to Cart', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logAddToCart(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logAddToCart failed:', e);
      }
    }
  },

  async logAddToWishlist(params: {
    items: Array<{
      item_id: string;
      item_name: string;
      item_category?: string;
      price?: number;
      quantity?: number;
    }>;
    value?: number;
    currency?: string;
  }): Promise<void> {
    this.track('Add to Wishlist', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logAddToWishlist(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logAddToWishlist failed:', e);
      }
    }
  },

  async logAddPaymentInfo(params: {
    payment_type?: string;
    value?: number;
    currency?: string;
    items?: Array<any>;
  }): Promise<void> {
    this.track('Add Payment Info', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logAddPaymentInfo(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logAddPaymentInfo failed:', e);
      }
    }
  },

  async logPurchase(params: {
    transaction_id: string;
    value: number;
    currency: string;
    items: Array<{
      item_id: string;
      item_name: string;
      item_category?: string;
      price?: number;
      quantity?: number;
    }>;
    shipping?: number;
    tax?: number;
    coupon?: string;
  }): Promise<void> {
    this.track('Purchase', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logPurchase(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logPurchase failed:', e);
      }
    }
  },

  async logViewItem(params: {
    items: Array<{
      item_id: string;
      item_name: string;
      item_category?: string;
      price?: number;
      quantity?: number;
    }>;
    value?: number;
    currency?: string;
  }): Promise<void> {
    this.track('View Item', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logViewItem(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logViewItem failed:', e);
      }
    }
  },

  async logViewCart(params: {
    items: Array<{
      item_id: string;
      item_name: string;
      item_category?: string;
      price?: number;
      quantity?: number;
    }>;
    value?: number;
    currency?: string;
  }): Promise<void> {
    this.track('View Cart', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logViewCart(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logViewCart failed:', e);
      }
    }
  },

  async logBeginCheckout(params: {
    items: Array<{
      item_id: string;
      item_name: string;
      item_category?: string;
      price?: number;
      quantity?: number;
    }>;
    value?: number;
    currency?: string;
    coupon?: string;
  }): Promise<void> {
    this.track('Begin Checkout', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logBeginCheckout(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logBeginCheckout failed:', e);
      }
    }
  },

  async logAddShippingInfo(params: {
    shipping_tier?: string;
    value?: number;
    currency?: string;
    items?: Array<any>;
    coupon?: string;
  }): Promise<void> {
    this.track('Add Shipping Info', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logAddShippingInfo(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logAddShippingInfo failed:', e);
      }
    }
  },

  async logRemoveFromCart(params: {
    items: Array<{
      item_id: string;
      item_name: string;
      item_category?: string;
      price?: number;
      quantity?: number;
    }>;
    value?: number;
    currency?: string;
  }): Promise<void> {
    this.track('Remove From Cart', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logRemoveFromCart(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logRemoveFromCart failed:', e);
      }
    }
  },

  async logViewItemList(params: {
    item_list_id?: string;
    item_list_name?: string;
    items: Array<{
      item_id: string;
      item_name: string;
      item_category?: string;
      price?: number;
      quantity?: number;
    }>;
  }): Promise<void> {
    this.track('View Item List', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logViewItemList(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logViewItemList failed:', e);
      }
    }
  },

  async logSelectItem(params: {
    item_list_id?: string;
    item_list_name?: string;
    items: Array<{
      item_id: string;
      item_name: string;
      item_category?: string;
      price?: number;
      quantity?: number;
    }>;
  }): Promise<void> {
    this.track('Select Item', params);
    const instance = this.instance;
    if (instance) {
      try {
        await instance.logSelectItem(params);
      } catch (e) {
        console.warn('[Analytics] Firebase logSelectItem failed:', e);
      }
    }
  },
};
