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
};
