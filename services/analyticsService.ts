/**
 * Analytics Service - Sends events to the backend; backend forwards to Mixpanel.
 * This allows changing event names, properties, or flow without an app release.
 */
import axios from 'axios';
import { getBackendApiPath } from './backendBase';

async function post(endpoint: string, body: object): Promise<void> {
  try {
    const url = getBackendApiPath(endpoint);
    await axios.post(url, body, { timeout: 5000 });
  } catch (e) {
    if (__DEV__) {
      console.warn('[Analytics] backend request failed:', endpoint, e);
    }
  }
}

export const analyticsService = {
  track(event: string, properties?: Record<string, unknown>, distinctId?: string): void {
    post('analytics/track', {
      event,
      properties: properties ?? {},
      distinct_id: distinctId ?? '',
    });
  },

  identify(distinctId: string, properties?: Record<string, unknown>): void {
    post('analytics/identify', {
      distinct_id: distinctId,
      properties: properties ?? {},
    });
  },

  reset(): void {
    post('analytics/reset', {});
  },
};
