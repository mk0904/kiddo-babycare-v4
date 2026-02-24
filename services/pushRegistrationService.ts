/**
 * Registers the device's push subscription ID with the backend.
 * Backend can then send notifications via the configured provider (e.g. OneSignal);
 * switching provider later requires only backend changes, no app release.
 */
import axios from 'axios';
import { Platform } from 'react-native';
import { configService } from './configService';

const PRODUCTION_BACKEND_URL = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';
const LOCAL_BACKEND_URL_ANDROID = 'http://10.0.2.2:8080/api/v1';
const LOCAL_BACKEND_URL_IOS = 'http://localhost:8080/api/v1';

function getBackendBase(): string {
  if (__DEV__) {
    return Platform.OS === 'android' ? LOCAL_BACKEND_URL_ANDROID : LOCAL_BACKEND_URL_IOS;
  }
  const raw = configService.getRawConfig();
  const base = raw?.providers?.backend?.baseUrl || PRODUCTION_BACKEND_URL;
  return (base as string).replace(/\/+$/, '');
}

function getPushRegisterUrl(): string {
  const base = getBackendBase();
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return `${prefix}/push/register`;
}

/**
 * Register the current device's push subscription for the given user with the backend.
 * Call after OneSignal init when you have a subscription ID and a logged-in user.
 */
export async function registerWithBackend(userId: string, subscriptionId: string): Promise<void> {
  if (!userId || !subscriptionId) return;
  const url = getPushRegisterUrl();
  await axios.post(
    url,
    { user_id: userId, subscription_id: subscriptionId },
    { timeout: 10000, validateStatus: () => true }
  );
}

export const pushRegistrationService = {
  registerWithBackend,
};
