import { configService } from './configService';

const PRODUCTION_BACKEND_URL = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

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
  const envBase = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_API_BASE;
  if (envBase && String(envBase).trim()) {
    return String(envBase).trim().replace(/\/+$/, '');
  }

  const raw = configService.getRawConfig();
  const base = raw?.providers?.backend?.baseUrl || PRODUCTION_BACKEND_URL;
  return String(base).replace(/\/+$/, '');
}

export function getBackendApiPath(path: string): string {
  const base = getBackendBase();
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return `${prefix}/${path.replace(/^\//, '')}`;
}
