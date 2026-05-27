import axios from 'axios';
import { getBackendApiPath } from './backendBase';

/**
 * Cleanly integrates Analytics with our existing backend.
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
   * Tracks an event across all configured analytics providers.
   * @param event - The name of the event (e.g., 'Product Viewed')
   * @param properties - Optional metadata for the event
   * @param distinctId - Optional user identifier
   */
  async track(event: string, properties?: Record<string, any>, distinctId?: string): Promise<void> {
    postToBackend('analytics/track', {
      event,
      properties: properties ?? {},
      distinct_id: distinctId ?? '',
    });
  },

  /**
   * Identifies a user across analytics providers.
   */
  async identify(distinctId: string, properties?: Record<string, any>): Promise<void> {
    postToBackend('analytics/identify', {
      distinct_id: distinctId,
      properties: properties ?? {},
    });
  },

  /**
   * Resets analytics data for the current user.
   */
  async reset(): Promise<void> {
    postToBackend('analytics/reset', {});
  },
  
  /**
   * Standard ecommerce events
   */

  async logAddToCart(params: any): Promise<void> {
    this.track('Add to Cart', params);
  },

  async logAddToWishlist(params: any): Promise<void> {
    this.track('Add to Wishlist', params);
  },

  async logAddPaymentInfo(params: any): Promise<void> {
    this.track('Add Payment Info', params);
  },

  async logPurchase(params: any): Promise<void> {
    this.track('Purchase', params);
  },

  async logViewItem(params: any): Promise<void> {
    this.track('View Item', params);
  },

  async logViewCart(params: any): Promise<void> {
    this.track('View Cart', params);
  },

  async logBeginCheckout(params: any): Promise<void> {
    this.track('Begin Checkout', params);
  },

  async logAddShippingInfo(params: any): Promise<void> {
    this.track('Add Shipping Info', params);
  },

  async logRemoveFromCart(params: any): Promise<void> {
    this.track('Remove From Cart', params);
  },

  async logViewItemList(params: any): Promise<void> {
    this.track('View Item List', params);
  },

  async logSelectItem(params: any): Promise<void> {
    this.track('Select Item', params);
  },
};
