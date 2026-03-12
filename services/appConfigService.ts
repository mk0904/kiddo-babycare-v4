/**
 * App config service – fetches cart/checkout config from kiddo-service only.
 * No kiddoAppConfig fallback; all cart/checkout and free shoes config comes from backend.
 *
 * Request: GET /api/v1/app/config?phone=...&customerId=...&appVersion=...&deviceType=...
 * (e.g. https://kiddo-service-874125225773.asia-south1.run.app/api/v1/app/config?phone=%2B917607235050&customerId=12345&appVersion=1.0.0&deviceType=ios)
 */
import type {
  AppConfigResponse,
  CartConfig,
  CartFeatures,
  FreeShoesOfferConfig,
  GiftWrapConfig,
  OrderDetailConfig,
} from '@/types/appConfig';
import { configService } from './configService';

const PRODUCTION_BACKEND_URL = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

function getBackendBase(): string {
  const raw = configService.getRawConfig();
  const base = raw?.providers?.backend?.baseUrl || PRODUCTION_BACKEND_URL;
  return (base as string).replace(/\/+$/, '');
}

function getAppConfigUrl(payload?: AppConfigPayload): string {
  const base = getBackendBase();
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  const url = `${prefix}/app/config`;
  if (!payload) return url;
  const params = new URLSearchParams();
  if (payload.phone != null && payload.phone !== '') params.set('phone', payload.phone);
  if (payload.customerId != null && payload.customerId !== '') params.set('customerId', payload.customerId);
  if (payload.appVersion != null && payload.appVersion !== '') params.set('appVersion', payload.appVersion);
  if (payload.deviceType != null && payload.deviceType !== '') params.set('deviceType', payload.deviceType);
  if (payload.cartSubtotal != null && payload.cartSubtotal > 0) params.set('cartSubtotal', String(payload.cartSubtotal));
  if (payload.cartCategories != null && payload.cartCategories !== '') params.set('cartCategories', payload.cartCategories);
  const q = params.toString();
  return q ? `${url}?${q}` : url;
}

export interface AppConfigPayload {
  phone?: string | null;
  customerId?: string | null;
  appVersion?: string | null;
  deviceType?: string | null;
  /** Cart subtotal (INR) – backend uses this to compute offer visibility (e.g. freeShoesOffer.visible). */
  cartSubtotal?: number;
  /** Comma-separated cart category/tag strings – backend uses this to compute offer visibility. */
  cartCategories?: string;
}

const DEFAULT_CART_FEATURES: CartFeatures = {
  showGiftWrap: true,
  showFreePairShoes: true,
  showDeliveryCard: true,
  showSavingsCorner: true,
  showCompletePurchaseSection: true,
};

class AppConfigService {
  private config: AppConfigResponse | null = null;
  private loadPromise: Promise<AppConfigResponse | null> | null = null;

  async loadAppConfig(forceReload = false, payload?: AppConfigPayload): Promise<AppConfigResponse | null> {
    if (!forceReload && this.loadPromise) return this.loadPromise;
    if (forceReload) this.config = null;

    this.loadPromise = (async () => {
      try {
        const url = getAppConfigUrl(payload);
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!res.ok) throw new Error(`App config HTTP ${res.status}`);
        const data: AppConfigResponse = await res.json();
        this.config = data;
        if (__DEV__) console.log('[AppConfigService] Loaded app config from backend');
        return data;
      } catch (e) {
        if (__DEV__) console.warn('[AppConfigService] Failed to load app config:', e);
        this.config = null;
        return null;
      } finally {
        this.loadPromise = null;
      }
    })();
    return this.loadPromise;
  }

  getConfig(): AppConfigResponse | null {
    return this.config;
  }

  getCartFeatures(): CartFeatures {
    return this.config?.features?.cart ?? DEFAULT_CART_FEATURES;
  }

  getCartConfig(): CartConfig | null {
    return this.config?.cart ?? null;
  }

  getFreeShoesOfferConfig(): FreeShoesOfferConfig | null {
    return this.config?.cart?.freeShoesOffer ?? null;
  }

  getGiftWrapConfig(): GiftWrapConfig | null {
    return this.config?.cart?.giftWrap ?? null;
  }

  getCheckoutConfig() {
    return this.config?.checkout ?? null;
  }

  getOrderDetailConfig(): OrderDetailConfig | null {
    return this.config?.orderDetail ?? null;
  }
}

export const appConfigService = new AppConfigService();
