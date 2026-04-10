import { configService } from './configService';

const PRODUCTION_BACKEND_URL = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

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
