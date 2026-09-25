import localKiddoAppConfig from '@/config/kiddoAppConfig.json';
import { getAppVersionForApi } from '@/constants/versionConfig';
import { AppConfig, ContentBlock, ScreenConfig } from '@/types/content';
import { TabBarConfig } from '@/types/tabBarTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/** Production API base (must stay in sync with `services/backendBase.ts` when env is unset). */
const PRODUCTION_BACKEND_API_V1 = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';
const CACHED_KIDDO_CONFIG_KEY = '@cached_kiddo_remote_config';

/**
 * GET /api/v1/remote-config?appVersion=...&deviceType=...
 * Returns { configUrl: "https://..." }. Do not import `backendBase` here (circular with configService).
 */
function getRemoteConfigApiUrl(): string {
  return `${PRODUCTION_BACKEND_API_V1}/remote-config`;
}

/** TEMP: bundled `config/kiddoAppConfig.json` instead of kiddo-service → CDN. Set false before release. */
const USE_LOCAL_KIDDO_APP_CONFIG = false;

const defaultConfig: AppConfig = {
  version: 1,
  home: {
    all: [],
  },
};

class ConfigService {
  private config: AppConfig = defaultConfig;
  private rawConfig: any = null;
  private tabBarConfig: TabBarConfig | null = null;
  private listeners: Set<(config: AppConfig) => void> = new Set();
  private isLoading: boolean = false;
  private loadPromise: Promise<AppConfig> | null = null;
  private configLoadedAt: number | null = null;

  constructor() {
    // 1. Immediately hydrate with bundled config so app renders with zero delay
    if (localKiddoAppConfig) {
      this._applyRawConfig(localKiddoAppConfig as Record<string, unknown>);
    }
    // 2. Asynchronously load cached remote config from previous session
    this.initCachedConfig();
  }

  private async initCachedConfig(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem(CACHED_KIDDO_CONFIG_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          this._applyRawConfig(parsed);
        }
      }
    } catch (e) {
      if (__DEV__) console.warn('[ConfigService] Failed to load cached config from storage:', e);
    }
  }

  /**
   * Resolves the JSON URL via kiddo-service:
   * GET /api/v1/remote-config?appVersion=...&deviceType=...
   */
  private async resolveConfigJsonUrl(): Promise<string> {
    const appVersion = getAppVersionForApi();
    const deviceType = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    const apiUrl = `${getRemoteConfigApiUrl()}?${new URLSearchParams({ appVersion, deviceType }).toString()}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`remote-config HTTP ${response.status} ${response.statusText}`);
    }
    const body = (await response.json()) as { configUrl?: string };
    const configUrl = typeof body?.configUrl === 'string' ? body.configUrl.trim() : '';
    if (!configUrl) {
      throw new Error('remote-config response missing configUrl');
    }
    return configUrl;
  }

  async loadConfig(remoteUrl?: string, forceReload: boolean = false): Promise<AppConfig> {
    if (!forceReload && this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    if (forceReload) {
      this.rawConfig = null;
      this.config = defaultConfig;
      this.configLoadedAt = null;
    }

    if (USE_LOCAL_KIDDO_APP_CONFIG && !remoteUrl?.trim()) {
      this.isLoading = true;
      this.loadPromise = Promise.resolve().then(() => {
        if (__DEV__) {
          const lensPreset = (localKiddoAppConfig as { tabBar?: TabBarConfig })?.tabBar?.styles
            ?.lensPreset;
          console.warn(
            `[KIDDO] config source: LOCAL config/kiddoAppConfig.json | lensPreset=${lensPreset ?? 'apple (default)'}`
          );
        }
        return this._applyRawConfig(localKiddoAppConfig as Record<string, unknown>);
      });

      try {
        return await this.loadPromise;
      } finally {
        this.isLoading = false;
        this.loadPromise = null;
      }
    }

    const resolveUrlWithRetry = async (retries = 3, delayMs = 1000): Promise<string> => {
      if (remoteUrl?.trim()) return remoteUrl.trim();

      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 5000)
          );
          const url = await Promise.race([this.resolveConfigJsonUrl(), timeoutPromise]);
          if (__DEV__) {
            console.warn(`[KIDDO] config URL resolved via kiddo-service remote-config (attempt ${attempt}): ${url}`);
          }
          return url;
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          console.warn(`[ConfigService] remote-config resolution attempt ${attempt}/${retries} failed: ${message}`);
          if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
          } else {
            throw new Error(`Failed to resolve remote-config URL after ${retries} attempts: ${message}`);
          }
        }
      }
      throw new Error('Failed to resolve remote-config URL');
    };

    this.isLoading = true;
    this.loadPromise = resolveUrlWithRetry().then((url) => this._loadRemoteConfig(url));

    try {
      return await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  async reloadConfig(): Promise<AppConfig> {
    return this.loadConfig(undefined, true);
  }

  private async _loadRemoteConfig(url: string): Promise<AppConfig> {
    const cacheBuster = `&_t=${Date.now()}`;
    const urlWithCacheBust = url.includes('?') ? `${url}${cacheBuster}` : `${url}?${cacheBuster.substring(1)}`;

    const response = await fetch(urlWithCacheBust, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to load remote config: HTTP ${response.status} ${response.statusText}`);
    }

    const remoteConfig = await response.json();
    if (remoteConfig && typeof remoteConfig === 'object') {
      AsyncStorage.setItem(CACHED_KIDDO_CONFIG_KEY, JSON.stringify(remoteConfig)).catch(() => {});
    }
    if (__DEV__) {
      const lensPreset = (remoteConfig as { tabBar?: TabBarConfig })?.tabBar?.styles?.lensPreset;
      console.warn(
        `[KIDDO] config loaded from ${url} | lensPreset=${lensPreset ?? 'apple (default)'}`
      );
    }
    return this._applyRawConfig(remoteConfig);
  }

  private _applyRawConfig(remoteConfig: Record<string, unknown>): AppConfig {
    this.rawConfig = remoteConfig;
    this.configLoadedAt = Date.now();

    const categoryKeys = (remoteConfig.categories as { order?: string[] })?.order || [];
    const homeConfig: ScreenConfig = {};

    categoryKeys.forEach((key: string) => {
      if (Array.isArray(remoteConfig[key])) {
        homeConfig[key] = remoteConfig[key] as ContentBlock[];
      }
    });

    ['all', 'girls', 'boys', 'toys', 'babycare'].forEach((key) => {
      if (Array.isArray(remoteConfig[key]) && !homeConfig[key]) {
        homeConfig[key] = remoteConfig[key] as ContentBlock[];
      }
    });

    this.config = {
      version: 1,
      home: homeConfig,
      header: remoteConfig.header as AppConfig['header'],
      categories: remoteConfig.categories as AppConfig['categories'],
    };
    this.tabBarConfig = (remoteConfig.tabBar as TabBarConfig) || null;

    this.notifyListeners();
    return this.config;
  }

  getRawConfig(): any {
    return this.rawConfig;
  }

  getGiftWrapConfig(): any | null {
    return this.rawConfig?.giftWrap ?? null;
  }

  getTabBarConfig(): TabBarConfig | null {
    return this.tabBarConfig;
  }

  getScreenBlocks(screenId: string, category: string = 'all'): ContentBlock[] {
    let screenConfig: ScreenConfig | undefined;

    if (this.config[screenId]) {
      screenConfig = this.config[screenId] as ScreenConfig;
    } else if (this.config.all) {
      screenConfig = this.config as any;
    }

    if (!screenConfig) return [];

    const categoryBlocks = screenConfig[category] || screenConfig.all || [];

    return categoryBlocks
      .filter((block) => block.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  getCategoryScreenBlocks(): ContentBlock[] {
    if (!this.rawConfig) return [];

    const categoryBlocks = this.rawConfig.categoryScreen?.blocks || [];

    return categoryBlocks
      .filter((block: ContentBlock) => block.visible !== false)
      .sort((a: ContentBlock, b: ContentBlock) => (a.order || 0) - (b.order || 0));
  }

  getCategoryHeaderConfig(category: string = 'all') {
    const categories = this.config.categories;
    if (!categories?.items) return null;

    return categories.items[category]?.header || null;
  }

  /** Global home header defaults (text colors, glass, etc.). */
  getGlobalHeaderConfig() {
    return this.config.header ?? null;
  }

  getCategoryPageBackgroundColor(category: string = 'all'): string {
    const fallback = '#F5F5F5';
    const cats = this.rawConfig?.categories;
    if (!cats) return fallback;

    const perItem = cats.items?.[category]?.pageBackgroundColor;
    if (typeof perItem === 'string' && perItem.trim().length > 0) {
      return perItem.trim();
    }
    const globalDefault = cats.defaultPageBackgroundColor;
    if (typeof globalDefault === 'string' && globalDefault.trim().length > 0) {
      return globalDefault.trim();
    }
    return fallback;
  }

  getCategories() {
    return this.config.categories;
  }

  getProductDetailConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.productDetail || null;
  }

  getProductGridDefaults() {
    if (!this.rawConfig) {
      return {
        gap: 16,
        rowGap: 16,
        colGap: 16,
        paddingHorizontal: 20,
      };
    }
    return this.rawConfig.productGridDefaults || {
      gap: 16,
      rowGap: 16,
      colGap: 16,
      paddingHorizontal: 20,
    };
  }

  getCategoryScreenConfig() {
    if (!this.rawConfig) return {};
    return this.rawConfig.categoryScreen || {};
  }

  getTicketingScreenConfig() {
    if (!this.rawConfig) return {};
    return this.rawConfig.ticketingScreen || {};
  }

  getTicketingScreenBlocks(): ContentBlock[] {
    if (!this.rawConfig) return [];
    const blocks = this.rawConfig.ticketingScreen?.blocks || [];
    return blocks
      .filter((block: ContentBlock) => block.visible !== false)
      .sort((a: ContentBlock, b: ContentBlock) => (a.order ?? 0) - (b.order ?? 0));
  }

  getBabycareCollectionSidebar(collectionId: string): { collectionId: string; label: string; imageUrl?: string }[] | null {
    if (this.rawConfig?.babycareSidebarEnabled === false) return null;
    if (!this.rawConfig?.babycareCollectionSidebar || !collectionId) return null;
    const map = this.rawConfig.babycareCollectionSidebar as Record<string, { subcategories?: Array<{ collectionId: string; label: string; imageUrl?: string }> }>;
    const normalized = collectionId.replace(/^gid:\/\/shopify\/Collection\//i, '').split('?')[0];
    const entry = map[normalized] || map[collectionId];
    if (!entry?.subcategories?.length) return null;
    return entry.subcategories;
  }

  getConfigLoadedAt(): number | null {
    return this.configLoadedAt;
  }

  getConfig(): AppConfig {
    return this.config;
  }

  getProvidersConfig() {
    if (!this.rawConfig) return {};
    return this.rawConfig.providers || {};
  }

  getRazorpayConfig() {
    try {
      const providers = this.getProvidersConfig();
      return providers.razorpay || null;
    } catch {
      return null;
    }
  }

  getDiscountsConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.discounts || null;
  }

  getProductCardStyles(): Record<string, Record<string, any>> | null {
    if (!this.rawConfig) return null;
    return this.rawConfig.productCard?.styles ?? this.rawConfig.productCard ?? null;
  }

  getAccountConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.account || null;
  }

  getDeliveryConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.delivery || null;
  }

  getDemoConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.demo || null;
  }

  updateConfig(config: AppConfig) {
    this.config = config;
    this.notifyListeners();
  }

  subscribe(listener: (config: AppConfig) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.config));
  }
}

export const configService = new ConfigService();
