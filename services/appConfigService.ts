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
  FreePuzzleOfferConfig,
  FreePuzzlePickerConfig,
  FreeShoesOfferConfig,
  FreeShoesPickerConfig,
  GiftWrapConfig,
  MilestoneUIConfig,
  MysteryGiftOfferConfig,
  OrderDetailConfig,
  SpecialDealConfig,
} from '@/types/appConfig';
import { normalizeSpecialDealConfig } from '@/utils/normalizeSpecialDealConfig';
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

function parseServicableDistanceFromRecord(rec: Record<string, unknown>): number | null {
  const v =
    rec.servicableDistance ??
    rec.serviceableDistance ??
    rec.servicable_distance ??
    rec.maxServiceRadiusKm ??
    rec.max_service_radius_km;
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

class AppConfigService {
  private config: AppConfigResponse | null = null;
  private loadPromise: Promise<AppConfigResponse | null> | null = null;
  private readonly listeners = new Set<() => void>();

  async loadAppConfig(forceReload = false, payload?: AppConfigPayload): Promise<AppConfigResponse | null> {
    if (!forceReload && this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const url = getAppConfigUrl(payload);
        if (__DEV__) {
          console.log('[AppConfigService] GET app/config request:', {
            url,
            payload: payload || 'no payload',
          });
        }
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!res.ok) throw new Error(`App config HTTP ${res.status}`);
        const data: AppConfigResponse = await res.json();
        if (__DEV__) {
          // console.log('[AppConfigService] GET app/config response (incl. milestoneUI for getMilestoneUI):', JSON.stringify(data, null, 2));
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

  getHotWheelConfig(): import('@/types/appConfig').HotWheelConfig | null {
    return this.config?.hotWheelConfig ?? null;
  }

  getCartConfig(): CartConfig | null {
    return this.config?.cart ?? null;
  }

  /** Special-deal promo modal config (`speacialDealConfig` / `specialDealConfig` on cart or root payload). */
  getSpecialDealConfig(): SpecialDealConfig | null {
    const cfg = this.config;
    if (!cfg) return null;
    const raw =
      cfg.cart?.speacialDealConfig ??
      cfg.cart?.specialDealConfig ??
      cfg.speacialDealConfig ??
      cfg.specialDealConfig ??
      null;
    if (raw == null) return null;
    return normalizeSpecialDealConfig(raw);
  }

  getFreeShoesOfferConfig(): FreeShoesOfferConfig | null {
    return this.config?.cart?.freeShoesOffer ?? null;
  }

  getFreeShoesPickerConfig(): FreeShoesPickerConfig | null {
    return this.config?.cart?.freeShoesPicker ?? null;
  }

  getFreePuzzleOfferConfig(): FreePuzzleOfferConfig | null {
    return this.config?.cart?.freePuzzleOffer ?? null;
  }

  getFreePuzzlePickerConfig(): FreePuzzlePickerConfig | null {
    return this.config?.cart?.freePuzzlePicker ?? null;
  }

  getMysteryGiftOfferConfig(): MysteryGiftOfferConfig | null {
    return this.config?.cart?.mysteryGiftOffer ?? null;
  }

  /**
   * 4th milestone gift code (display/original casing) — from config when set; otherwise fallback.
   */
  getMysteryGiftDiscountCode(): string {
    const c = this.config?.cart?.mysteryGiftOffer?.discountCode;
    if (c != null && String(c).trim() !== '') {
      return String(c).trim();
    }
    return 'FOURTHMILESTONE';
  }

  getMysteryGiftDiscountCodeUppercase(): string {
    return this.getMysteryGiftDiscountCode().toUpperCase();
  }

  /**
   * 3rd milestone free-shoes code (display/original casing) — from config when set; otherwise fallback.
   * The cart only applies this when the active free-gift step is shoes (`getMilestoneFreeGiftKind` in the cart screen).
   */
  getFreeShoesGiftDiscountCode(): string {
    const c = this.config?.cart?.freeShoesOffer?.discountCode;
    if (c != null && String(c).trim() !== '') {
      return String(c).trim();
    }
    return 'THIRDMILESTONE';
  }

  getFreeShoesGiftDiscountCodeUppercase(): string {
    return this.getFreeShoesGiftDiscountCode().toUpperCase();
  }

  /**
   * 2nd milestone free-puzzle code (display/original casing) — from config when set; otherwise fallback.
   */
  getFreePuzzleGiftDiscountCode(): string {
    const c = this.config?.cart?.freePuzzleOffer?.discountCode;
    if (c != null && String(c).trim() !== '') {
      return String(c).trim();
    }
    return 'SECONDMILESTONE';
  }

  getFreePuzzleGiftDiscountCodeUppercase(): string {
    return this.getFreePuzzleGiftDiscountCode().toUpperCase();
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

  /**
   * Max straight-line km from dark store (`delivery.servicableDistance` or root-level alias).
   * Returns null when unset or invalid — ETA `isServiceable` is used alone in that case.
   */
  getServicableDistanceKm(): number | null {
    const cfg = this.config;
    if (!cfg) return null;
    const fromDelivery =
      cfg.delivery && typeof cfg.delivery === 'object'
        ? parseServicableDistanceFromRecord(cfg.delivery as Record<string, unknown>)
        : null;
    if (fromDelivery != null) return fromDelivery;
    return parseServicableDistanceFromRecord(cfg as Record<string, unknown>);
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
