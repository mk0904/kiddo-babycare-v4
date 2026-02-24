/**
 * Analytics Service - Sends events to the backend; backend forwards to Mixpanel.
 * This allows changing event names, properties, or flow without an app release.
 */
import axios from 'axios';
import { configService } from './configService';

const PRODUCTION_BACKEND_URL = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

function getBackendBase(): string {
  const raw = configService.getRawConfig();
  const base = raw?.providers?.backend?.baseUrl || PRODUCTION_BACKEND_URL;
  return (base as string).replace(/\/+$/, '');
}

function getApiPath(path: string): string {
  const base = getBackendBase();
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return `${prefix}/${path.replace(/^\//, '')}`;
}

async function post(endpoint: string, body: object): Promise<void> {
  try {
    const url = getApiPath(endpoint);
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
