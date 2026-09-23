/**
 * App config service – fetches cart/checkout config from kiddo-service only.
 * No kiddoAppConfig fallback; all cart/checkout and free shoes config comes from backend.
 *
 * Request: GET /api/v1/app/config?phone=...&customerId=...&appVersion=...&deviceType=...
 * (e.g. https://kiddo-service-874125225773.asia-south1.run.app/api/v1/app/config?phone=%2B917607235050&customerId=12345&appVersion=1.0.0&deviceType=ios)
 */
import type {
  AppConfigResponse,
  AppDownloadConfig,
  CartConfig,
  CartFeatures,
  EntryScreenItem,
  FreePuzzleOfferConfig,
  FreePuzzlePickerConfig,
  FreeShoesOfferConfig,
  FreeShoesPickerConfig,
  GiftWrapConfig,
  HelpSupportConfig,
  MilestoneUIConfig,
  MysteryGiftOfferConfig,
  OrderDetailConfig,
  ReferralConfig,
  ScheduledDeliveryOfferConfig,
  SpecialDealConfig,
  WalletConfig,
} from '@/types/appConfig';
import { normalizeSpecialDealConfig } from '@/utils/normalizeSpecialDealConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { backendFetch, getBackendApiPath } from './backendBase';

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

const CACHED_ANDROID_SPLASH_KEY = '@cached_splash_url_android';
const CACHED_IOS_SPLASH_KEY = '@cached_splash_url_ios';

class AppConfigService {
  private config: AppConfigResponse | null = null;
  private loadPromise: Promise<AppConfigResponse | null> | null = null;
  private readonly listeners = new Set<() => void>();
  private cachedAndroidSplashUrl: string | null = null;
  private cachedIosSplashUrl: string | null = null;

  constructor() {
    this.initCachedSplashUrls();
  }

  private async initCachedSplashUrls(): Promise<void> {
    try {
      const [androidUrl, iosUrl] = await Promise.all([
        AsyncStorage.getItem(CACHED_ANDROID_SPLASH_KEY),
        AsyncStorage.getItem(CACHED_IOS_SPLASH_KEY),
      ]);
      if (androidUrl) this.cachedAndroidSplashUrl = androidUrl;
      if (iosUrl) this.cachedIosSplashUrl = iosUrl;
      if (androidUrl || iosUrl) {
        this.emitConfigListeners();
      }
    } catch (e) {
      if (__DEV__) console.warn('[AppConfigService] Failed to load cached splash URLs:', e);
    }
  }

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
        const res = await backendFetch(url, {
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (!res.ok) throw new Error(`App config HTTP ${res.status}`);
        const data: AppConfigResponse = await res.json();
        if (__DEV__) {
          // console.log('[AppConfigService] GET app/config response (incl. milestoneUI for getMilestoneUI):', JSON.stringify(data, null, 2));
        }
        this.config = data;

        const androidSplash = data.androidSplashUrl ?? (data as any).android_splash_url;
        if (androidSplash != null) {
          const trimmed = String(androidSplash).trim();
          this.cachedAndroidSplashUrl = trimmed;
          AsyncStorage.setItem(CACHED_ANDROID_SPLASH_KEY, trimmed).catch(() => {});
        }
        const iosSplash = data.iosSplashUrl ?? (data as any).ios_splash_url;
        if (iosSplash != null) {
          const trimmed = String(iosSplash).trim();
          this.cachedIosSplashUrl = trimmed;
          AsyncStorage.setItem(CACHED_IOS_SPLASH_KEY, trimmed).catch(() => {});
        }

        this.emitConfigListeners();
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

  isConfigLoaded(): boolean {
    return this.config !== null;
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
    return this.config?.hotWheelConfigV2 ?? null;
  }

  getHelpSupportConfig(): HelpSupportConfig | null {
    return this.config?.helpSupportConfig ?? null;
  }

  getForceUpdateConfig(): import('@/types/appConfig').ForceUpdateConfig | null {
    return this.config?.forceUpdateConfig ?? null;
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

  getScheduledDeliveryOfferConfig(): ScheduledDeliveryOfferConfig | null {
    const offer =
      this.config?.cart?.scheduledDeliveryOffer ??
      (this.config?.cart as any)?.scheduled_delivery_offer ??
      (this.config as any)?.scheduledDeliveryOffer ??
      null;
    if (__DEV__) {
      console.log('[AppConfigService] scheduledDeliveryOffer from backend:', offer);
    }
    return offer;
  }

  getCheckoutConfig() {
    return this.config?.checkout ?? null;
  }

  getOrderDetailConfig(): OrderDetailConfig | null {
    return this.config?.orderDetail ?? null;
  }

  getOrderSummaryConfig() {
    return this.config?.orderSummaryConfig ?? null;
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

  /** 
   * Placeholder implementation for location serviceability.
   * Full ETA-based serviceability is typically resolved in delivery routes.
   */
  isLocationServiceable(latitude: number, longitude: number): boolean {
    // If backend provides a max distance, we'd compare it here if we had the dark store lat/lng.
    // For now, assume true to allow users to add addresses. ETA check will validate later.
    return true;
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

  isFreshChatEnabled(): boolean {
    return this.config?.isFreshChatEnabled === true;
  }

  isBackendGeocodingEnabled(): boolean {
    return this.config?.isBackendGeocodingEnabled === true;
  }

  isHelpSupportEnabled(): boolean {
    return this.config?.isHelpSupportEnabled === true;
  }

  getMinOrderValue(): number {
    return this.config?.minOrderValueV2 ?? 0;
  }

  getReferralConfig(): ReferralConfig | null {
    return this.config?.referralConfig ?? null;
  }

  getWalletConfig(): WalletConfig | null {
    return this.config?.walletConfig ?? null;
  }

  getAppDownloadConfig(): AppDownloadConfig | null {
    return this.config?.appDownloadConfig ?? null;
  }

  isCodAvailable(): boolean {
    return this.config?.isCodAvailable ?? true;
  }

  getReturnExchangeConfig(): import('@/types/appConfig').ReturnExchangeConfig | null {
    return this.config?.returnExchangeConfig ?? null;
  }

  getAndroidSplashUrl(): string | null {
    const raw = this.config?.androidSplashUrl ?? (this.config as any)?.android_splash_url ?? null;
    if (typeof raw === 'string' && raw.trim() && raw !== 'null' && raw !== 'undefined') return raw.trim();
    if (this.cachedAndroidSplashUrl && this.cachedAndroidSplashUrl.trim() && this.cachedAndroidSplashUrl !== 'null' && this.cachedAndroidSplashUrl !== 'undefined') {
      return this.cachedAndroidSplashUrl.trim();
    }
    return null;
  }

  getIosSplashUrl(): string | null {
    const raw = this.config?.iosSplashUrl ?? (this.config as any)?.ios_splash_url ?? null;
    if (typeof raw === 'string' && raw.trim() && raw !== 'null' && raw !== 'undefined') return raw.trim();
    if (this.cachedIosSplashUrl && this.cachedIosSplashUrl.trim() && this.cachedIosSplashUrl !== 'null' && this.cachedIosSplashUrl !== 'undefined') {
      return this.cachedIosSplashUrl.trim();
    }
    return null;
  }

  getSplashUrl(): string | null {
    if (Platform.OS === 'android') {
      return this.getAndroidSplashUrl();
    }
    return this.getIosSplashUrl();
  }
}

export const appConfigService = new AppConfigService();
