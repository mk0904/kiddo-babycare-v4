// Config Service - Loads and manages remote config
import { getAppVersionForApi } from '@/constants/versionConfig';
import { AppConfig, ContentBlock, ScreenConfig } from '@/types/content';
import { TabBarConfig } from '@/types/tabBarTypes';
import { Platform } from 'react-native';

/** Production API base (must stay in sync with `services/backendBase.ts` when env is unset). */
const PRODUCTION_BACKEND_API_V1 = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

/**
 * GET /api/v1/remote-config?appVersion=...&deviceType=...
 * Returns { configUrl: "https://..." }. Do not import `backendBase` here (circular with configService).
 */
function getRemoteConfigApiUrl(): string {
  /*
  const envBase =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BACKEND_API_BASE
      ? String(process.env.EXPO_PUBLIC_BACKEND_API_BASE).trim()
      : '';
  if (envBase) {
    const base = envBase.replace(/\/+$/, '');
    const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
    return `${prefix}/remote-config`;
  }
  */
  return `${PRODUCTION_BACKEND_API_V1}/remote-config`;
}

/** Fallback JSON URL if remote-config API fails (offline / new field). */
const FALLBACK_CONFIG_JSON_URL =
  'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/kiddoAppConfig.json?v=1768512538';

// Default config - will be loaded from Kiddo's appConfig.json
const defaultConfig: AppConfig = {
  version: 1,
  home: {
    all: [],
  },
};

class ConfigService {
  private config: AppConfig = defaultConfig;
  private rawConfig: any = null; // Store the full raw config object
  private tabBarConfig: TabBarConfig | null = null;
  private listeners: Set<(config: AppConfig) => void> = new Set();
  private isLoading: boolean = false;
  private loadPromise: Promise<AppConfig> | null = null;
  /** Set when config is successfully loaded; used to cache-bust sidebar images so they refresh each app session */
  private configLoadedAt: number | null = null;

  /**
   * Resolves the Shopify CDN JSON URL via backend:
   * GET /api/v1/remote-config?appVersion=1.9.0&deviceType=android
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

  // Load config from remote or local
  async loadConfig(remoteUrl?: string, forceReload: boolean = false): Promise<AppConfig> {
    // If already loading and not forcing reload, return the existing promise
    if (!forceReload && this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    // If forcing reload, clear existing config
    if (forceReload) {
      this.rawConfig = null;
      this.config = defaultConfig;
      this.configLoadedAt = null;
    }

    const resolveUrl = async (): Promise<string> => {
      if (remoteUrl?.trim()) return remoteUrl.trim();

      // Wrap resolution in a timeout to avoid blocking app start
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 2000)
      );

      try {
        return await Promise.race([this.resolveConfigJsonUrl(), timeoutPromise]);
      } catch (e: any) {
        if (e.message === 'TIMEOUT') {
          console.warn('[ConfigService] remote-config resolution timed out (2s), using fallback...');
          // Continue resolving in background
          this.resolveConfigJsonUrl()
            .then((url) => {
              console.log('[ConfigService] Background remote-config resolved:', url);
              this._loadConfig(url).catch(() => { });
            })
            .catch((bgError) => {
              console.warn('[ConfigService] Background remote-config resolution failed:', bgError);
            });
        } else {
          console.warn('[ConfigService] remote-config resolution failed, using fallback:', e);
        }
        return FALLBACK_CONFIG_JSON_URL;
      }
    };

    this.isLoading = true;
    this.loadPromise = resolveUrl().then((url) => this._loadConfig(url));

    try {
      const result = await this.loadPromise;
      return result;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  // Force reload config (useful after updating local config file)
  async reloadConfig(): Promise<AppConfig> {
    return this.loadConfig(undefined, true);
  }

  private async _loadConfig(url: string): Promise<AppConfig> {
    // Fetch config from remote only (allows updates without app release)
    // Add cache-busting timestamp to ensure fresh config is loaded
    const cacheBuster = `&_t=${Date.now()}`;
    const urlWithCacheBust = url.includes('?') ? `${url}${cacheBuster}` : `${url}?${cacheBuster.substring(1)}`;

    let response: Response;
    try {
      response = await fetch(urlWithCacheBust, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      if (response.ok) {
        const remoteConfig = await response.json();
        console.log('[ConfigService] ✅ Loaded config from remote URL (allows updates without release)');
        console.log('[ConfigService] Config loaded at:', new Date().toISOString());
        this.rawConfig = remoteConfig;
        this.configLoadedAt = Date.now();
      } else {
        const error = new Error(`Failed to load remote config: HTTP ${response.status} ${response.statusText}`);
        console.error('[ConfigService] ❌ Remote config fetch failed:', error);
        throw error;
      }
    } catch (fetchError: any) {
      const error = new Error(`Failed to fetch remote config: ${fetchError.message}`);
      console.error('[ConfigService] ❌ Remote config fetch failed:', error);
      throw error;
    }

    if (!this.rawConfig) {
      throw new Error('Failed to load config from remote source');
    }

    const remoteConfig = this.rawConfig;

    // Dynamically build home config from all category arrays in config
    const categoryKeys = remoteConfig.categories?.order || [];
    const homeConfig: ScreenConfig = {};

    // Load all categories dynamically
    categoryKeys.forEach((key: string) => {
      if (Array.isArray(remoteConfig[key])) {
        homeConfig[key] = remoteConfig[key];
      }
    });

    // Also include known categories if they exist (for backwards compatibility)
    ['all', 'girls', 'boys', 'toys', 'babycare'].forEach((key) => {
      if (Array.isArray(remoteConfig[key]) && !homeConfig[key]) {
        homeConfig[key] = remoteConfig[key];
      }
    });

    // Transform Kiddo's structure to our structure
    this.config = {
      version: 1,
      home: homeConfig,
      header: remoteConfig.header,
      categories: remoteConfig.categories,
    };
    // Store tabBar config separately
    this.tabBarConfig = remoteConfig.tabBar || null;

    this.notifyListeners();
    return this.config;
  }

  // Get the raw config object (for accessing properties not in AppConfig)
  getRawConfig(): any {
    return this.rawConfig;
  }

  // Get tab bar configuration
  getTabBarConfig(): TabBarConfig | null {
    return this.tabBarConfig;
  }

  // Get blocks for a screen and category
  getScreenBlocks(screenId: string, category: string = 'all'): ContentBlock[] {
    // Handle both structures: { home: { all: [...] } } and { all: [...] }
    let screenConfig: ScreenConfig | undefined;

    if (this.config[screenId]) {
      screenConfig = this.config[screenId] as ScreenConfig;
    } else if (this.config.all) {
      // Direct structure like Kiddo's appConfig.json
      screenConfig = this.config as any;
    }

    if (!screenConfig) return [];

    const categoryBlocks = screenConfig[category] || screenConfig.all || [];

    // Filter visible blocks and sort by order
    return categoryBlocks
      .filter((block) => block.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  // Get category screen blocks
  getCategoryScreenBlocks(): ContentBlock[] {
    if (!this.rawConfig) return [];

    const categoryBlocks = this.rawConfig.categoryScreen?.blocks || [];

    // Filter visible blocks and sort by order
    return categoryBlocks
      .filter((block: ContentBlock) => block.visible !== false)
      .sort((a: ContentBlock, b: ContentBlock) => (a.order || 0) - (b.order || 0));
  }

  // Get header config for category
  getCategoryHeaderConfig(category: string = 'all') {
    const categories = this.config.categories;
    if (!categories?.items) return null;

    return categories.items[category]?.header || null;
  }

  /**
   * Scroll/page background for the home tab content area (below the category header).
   * Remote-configurable: `categories.defaultPageBackgroundColor` and per-tab
   * `categories.items.<key>.pageBackgroundColor`.
   */
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

  // Get all categories
  getCategories() {
    return this.config.categories;
  }

  // Get product detail configuration
  getProductDetailConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.productDetail || null;
  }

  // Get product grid default configuration
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

  // Get category screen configuration (header, blocks, styles)
  getCategoryScreenConfig() {
    if (!this.rawConfig) return {};
    return this.rawConfig.categoryScreen || {};
  }

  // Get ticketing screen configuration (header, blocks, styles)
  getTicketingScreenConfig() {
    if (!this.rawConfig) return {};
    return this.rawConfig.ticketingScreen || {};
  }

  // Get ticketing screen blocks (same block types as home/category)
  getTicketingScreenBlocks(): ContentBlock[] {
    if (!this.rawConfig) return [];
    const blocks = this.rawConfig.ticketingScreen?.blocks || [];
    return blocks
      .filter((block: ContentBlock) => block.visible !== false)
      .sort((a: ContentBlock, b: ContentBlock) => (a.order ?? 0) - (b.order ?? 0));
  }

  /**
   * Get sidebar subcategories for a babycare collection. Used on the collection (infinity) screen
   * when viewing a collection that has sidebar config. Returns null if no config for this collection.
   * Visibility: set babycareSidebarEnabled to false in config to hide the sidebar everywhere.
   * Config keys: babycareSidebarEnabled (boolean), babycareCollectionSidebar[collectionId] = { subcategories: [...] }
   */
  getBabycareCollectionSidebar(collectionId: string): { collectionId: string; label: string; imageUrl?: string }[] | null {
    if (this.rawConfig?.babycareSidebarEnabled === false) return null;
    if (!this.rawConfig?.babycareCollectionSidebar || !collectionId) return null;
    const map = this.rawConfig.babycareCollectionSidebar as Record<string, { subcategories?: Array<{ collectionId: string; label: string; imageUrl?: string }> }>;
    const normalized = collectionId.replace(/^gid:\/\/shopify\/Collection\//i, '').split('?')[0];
    const entry = map[normalized] || map[collectionId];
    if (!entry?.subcategories?.length) return null;
    return entry.subcategories;
  }

  /** Timestamp when config was last loaded; use to cache-bust sidebar image URLs so they refresh each app session */
  getConfigLoadedAt(): number | null {
    return this.configLoadedAt;
  }

  // Get config
  getConfig(): AppConfig {
    return this.config;
  }

  // Get providers configuration (Razorpay, OTP, etc.)
  getProvidersConfig() {
    if (!this.rawConfig) return {};
    return this.rawConfig.providers || {};
  }

  // Get Razorpay configuration
  getRazorpayConfig() {
    try {
      const providers = this.getProvidersConfig();
      return providers.razorpay || null;
    } catch (e) {
      return null;
    }
  }

  // Get discounts configuration
  getDiscountsConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.discounts || null;
  }

  /** Product card font/label styles (fontSize, fontWeight, fontFamily, color, etc.) for listing cards */
  getProductCardStyles(): Record<string, Record<string, any>> | null {
    if (!this.rawConfig) return null;
    return this.rawConfig.productCard?.styles ?? this.rawConfig.productCard ?? null;
  }

  // Get account configuration
  getAccountConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.account || null;
  }

  // Get delivery configuration
  getDeliveryConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.delivery || null;
  }

  // Update config
  updateConfig(config: AppConfig) {
    this.config = config;
    this.notifyListeners();
  }

  // Subscribe to config changes
  subscribe(listener: (config: AppConfig) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.config));
  }

  private mergeConfig(defaultConfig: AppConfig, remoteConfig: Partial<AppConfig>): AppConfig {
    // Deep merge configs
    return {
      ...defaultConfig,
      ...remoteConfig,
      home: {
        ...defaultConfig.home,
        ...remoteConfig.home,
      },
    };
  }
}

export const configService = new ConfigService();
