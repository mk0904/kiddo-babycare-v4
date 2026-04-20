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
  EntryScreenItem,
  FreeShoesOfferConfig,
  FreeShoesPickerConfig,
  GiftWrapConfig,
  MilestoneUIConfig,
  OrderDetailConfig,
} from '@/types/appConfig';
import { getBackendApiPath } from './backendBase';

function getAppConfigUrl(payload?: AppConfigPayload): string {
  const url = getBackendApiPath('app/config');
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

function parseEntryScreenItem(raw: unknown): EntryScreenItem | null {
  if (typeof raw === 'string') {
    const imageUrl = raw.trim();
    if (!imageUrl) return null;
    return { imageUrl };
  }
  if (raw == null || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const imageCandidate =
    rec.imageUrl ?? rec.image_url ?? rec.image ?? rec.bannerUrl ?? rec.banner_url ?? rec.url;
  const imageUrl = imageCandidate != null ? String(imageCandidate).trim() : '';
  if (!imageUrl) return null;
  const title = rec.title != null ? String(rec.title).trim() : '';
  const subtitle = rec.subtitle != null ? String(rec.subtitle).trim() : '';
  const ctaRaw = rec.ctaLabel ?? rec.cta_label ?? rec.ctaText ?? rec.cta_text ?? rec.buttonText;
  const ctaLabel = ctaRaw != null ? String(ctaRaw).trim() : '';
  return {
    imageUrl,
    ...(title ? { title } : {}),
    ...(subtitle ? { subtitle } : {}),
    ...(ctaLabel ? { ctaLabel } : {}),
  };
}

class AppConfigService {
  private config: AppConfigResponse | null = null;
  private loadPromise: Promise<AppConfigResponse | null> | null = null;
  private readonly listeners = new Set<() => void>();

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
        if (__DEV__) {
          console.log('[AppConfigService] GET app/config response (incl. milestoneUI for getMilestoneUI):', JSON.stringify(data, null, 2));
        }
        this.config = data;
        this.emitConfigListeners();
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

  /** Subscribe to successful app-config loads (same tick as `getConfig()` update). */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitConfigListeners(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        if (__DEV__) console.warn('[AppConfigService] listener error:', e);
      }
    });
  }

  getMilestoneUI(): MilestoneUIConfig | null {
    return this.config?.milestoneUI ?? null;
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

  getFreeShoesPickerConfig(): FreeShoesPickerConfig | null {
    return this.config?.cart?.freeShoesPicker ?? null;
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

  getEntryScreens(): EntryScreenItem[] {
    const raw = this.config?.entryScreens;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    return raw.map((it) => parseEntryScreenItem(it)).filter((it): it is EntryScreenItem => it != null);
  }

  /** When true, show "Events" in address Save as and sync addressType to Shopify. */
  isEventEnabled(): boolean {
    return this.config?.isEvent === true;
  }
}

export const appConfigService = new AppConfigService();
