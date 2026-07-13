import { configService } from './configService';
import { useUserStore } from '@/store/userStore';

const PRODUCTION_BACKEND_URL = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

let warnedMissingBackendEnv: boolean | undefined;

/**
 * Base URL for kiddo-service (no trailing slash). Override with env in dev:
 *
 * - **`.env`** (project root): `EXPO_PUBLIC_BACKEND_API_BASE=http://…`
 * - **Android emulator** → host machine: `http://10.0.2.2:PORT` (not `localhost`)
 * - **iOS simulator** → `http://127.0.0.1:PORT` or `http://localhost:PORT`
 * - If the server already mounts at `/api/v1`, you can set the base to `http://10.0.2.2:3000/api/v1`
 *
 * Restart Metro after changing `.env`. Cleartext HTTP to localhost / 10.0.2.2 is allowed on Android via `network_security_config.xml`.
 */
export function getBackendBase(): string {
  // const envBase = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_API_BASE;
  // if (envBase && String(envBase).trim()) {
  //   return String(envBase).trim().replace(/\/+$/, '');
  // }

  const raw = configService.getRawConfig();
  const base = raw?.providers?.backend?.baseUrl || PRODUCTION_BACKEND_URL;
  const resolved = String(base).replace(/\/+$/, '');
  if (__DEV__ && !warnedMissingBackendEnv) {
    warnedMissingBackendEnv = true;
    console.warn(
      '[backendBase] EXPO_PUBLIC_BACKEND_API_BASE is unset — using remote app config or production URL:',
      resolved,
      '\nAdd a project-root `.env` (copy `.env.example`) and restart Metro with `npx expo start --clear`.',
    );
  }
  return resolved;
}

export function getBackendApiPath(path: string): string {
  const base = getBackendBase();
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return `${prefix}/${path.replace(/^\//, '')}`;
}

/**
 * A wrapper around `fetch` that automatically adds the Authorization Bearer token
 * for requests going to the kiddo backend.
 */
export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = path.startsWith('http') ? path : getBackendApiPath(path);
  const token = useUserStore.getState().accessToken;
  const headers = new Headers(init?.headers);
  
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

/**
 * Helper to get authorization headers for backend requests.
 */
export function getBackendAuthHeaders(existingHeaders?: HeadersInit | Record<string, string>): Record<string, string> {
  const token = useUserStore.getState().accessToken;
  const headers: Record<string, string> = {};
  
  if (existingHeaders) {
    if (existingHeaders instanceof Headers) {
      existingHeaders.forEach((val, key) => headers[key] = val);
    } else if (Array.isArray(existingHeaders)) {
      existingHeaders.forEach(([key, val]) => headers[key] = val);
    } else {
      Object.assign(headers, existingHeaders);
    }
  }

  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}
