// Config Service - Loads and manages remote config
import { AppConfig, ContentBlock, ScreenConfig } from '@/types/content';
import { TabBarConfig } from '@/types/tabBarTypes';

// Remote config URL
const REMOTE_CONFIG_URL = 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/kiddoAppConfig.json?v=1768512538';

// Set to true to use local config file in development (useful for testing config changes)
const USE_LOCAL_CONFIG_IN_DEV = __DEV__ && true; // Change to false to use remote config

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
    }

    const url = remoteUrl || REMOTE_CONFIG_URL;
    this.isLoading = true;
    this.loadPromise = this._loadConfig(url);
    
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
    let remoteConfig: any = null;
    
    // Always try local config first (bundled with app) - works in both dev and production
    try {
      const localConfig = require('@/config/kiddoAppConfig.json');
      remoteConfig = localConfig;
      console.log('[ConfigService] ✅ Loaded config from LOCAL file (bundled with app)');
    } catch (localError) {
      console.warn('[ConfigService] Failed to load local config, falling back to remote:', localError);
      // Fall through to try remote
    }
    
    // If local config wasn't loaded, try remote
    if (!remoteConfig) {
      let response: Response;
      try {
        response = await fetch(url);
        if (response.ok) {
          remoteConfig = await response.json();
          console.log('[ConfigService] ✅ Loaded config from remote URL');
        } else {
          console.warn(`[ConfigService] Remote config returned ${response.status}`);
          if (!USE_LOCAL_CONFIG_IN_DEV) {
            throw new Error(`Failed to fetch config: ${response.status} ${response.statusText}`);
          }
        }
      } catch (fetchError: any) {
        // Network error
        if (USE_LOCAL_CONFIG_IN_DEV) {
          // Try local as fallback
          try {
            const localConfig = require('@/config/kiddoAppConfig.json');
            remoteConfig = localConfig;
            console.log('[ConfigService] ✅ Loaded config from local file (network error fallback)');
          } catch (localError) {
            const error = new Error(`Failed to load config: Network error and local fallback failed. ${fetchError.message}`);
            console.error('[ConfigService] Failed to load config:', error);
            throw error;
          }
        } else {
          const error = new Error(`Network error: ${fetchError.message || 'Failed to fetch config. Please check your internet connection.'}`);
          console.error('[ConfigService] Network error loading remote config:', error);
          throw error;
        }
      }
    }
    
    if (!remoteConfig) {
      throw new Error('Failed to load config from both remote and local sources');
    }
    
    this.rawConfig = remoteConfig;
    
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

  // Get category screen configuration
  getCategoryScreenConfig() {
    if (!this.rawConfig) return {};
    return this.rawConfig.categoryScreen || {};
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

  // Get free shoes offer configuration
  getFreeShoesOfferConfig() {
    if (!this.rawConfig) return null;
    return this.rawConfig.freeShoesOffer || null;
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

