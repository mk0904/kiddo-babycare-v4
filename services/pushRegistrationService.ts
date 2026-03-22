/**
 * Registers device push identifiers with the backend.
 * - OneSignal: subscription_id (backend sends via OneSignal REST API).
 * - CleverTap: native FCM/APNs token + platform (backend forwards to CleverTap Upload Profiles / push APIs).
 * Provider swaps stay server-side; the app keeps sending the same shape.
 */
import axios from 'axios';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { configService } from './configService';

const PRODUCTION_BACKEND_URL = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

function getBackendBase(): string {
  const raw = configService.getRawConfig();
  const base = raw?.providers?.backend?.baseUrl || PRODUCTION_BACKEND_URL;
  return (base as string).replace(/\/+$/, '');
}

function getPushRegisterUrl(): string {
  const base = getBackendBase();
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return `${prefix}/push/register`;
}

export type NativePushForBackend = { token: string; platform: 'ios' | 'android' };

/**
 * Native token from the OS (same source as CleverTap / FCM / APNs). Does not request permission —
 * only returns a token if notifications are already granted.
 */
export async function getNativePushTokenForBackend(): Promise<NativePushForBackend | null> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const devicePush = await Notifications.getDevicePushTokenAsync();
    const token = typeof devicePush?.data === 'string' ? devicePush.data : null;
    if (!token) return null;
    return { token, platform: Platform.OS as 'ios' | 'android' };
  } catch {
    return null;
  }
}

/**
 * Register push identifiers for the logged-in user with the backend.
 * Sends at least one of: OneSignal subscription_id, or native_push_token + platform for CleverTap.
 */
export async function registerWithBackend(
  userId: string,
  subscriptionId: string | null | undefined
): Promise<void> {
  if (!userId) return;

  const native = await getNativePushTokenForBackend();
  const sub = subscriptionId?.trim() || '';

  if (!sub && !native) return;

  const body: Record<string, string> = {
    user_id: userId,
    subscription_id: sub,
  };
  if (native) {
    body.native_push_token = native.token;
    body.platform = native.platform;
  }

  const url = getPushRegisterUrl();
  await axios.post(url, body, { timeout: 10000, validateStatus: () => true });
}

export const pushRegistrationService = {
  registerWithBackend,
  getNativePushTokenForBackend,
};
