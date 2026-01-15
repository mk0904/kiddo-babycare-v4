// Config Service - Loads and manages remote config
import { AppConfig, ScreenConfig, ContentBlock } from '@/types/content';
import { TabBarConfig } from '@/types/tabBarTypes';

// Default config - will be loaded from Kiddo's appConfig.json
const defaultConfig: AppConfig = {
  version: 1,
  home: {
    all: [],
  },
};

class ConfigService {
  private config: AppConfig = defaultConfig;
  private tabBarConfig: TabBarConfig | null = null;
  private listeners: Set<(config: AppConfig) => void> = new Set();

  // Load config from remote or local
  async loadConfig(remoteUrl?: string): Promise<AppConfig> {
    try {
      if (remoteUrl) {
        const response = await fetch(remoteUrl);
        const remoteConfig = await response.json();
        this.config = this.mergeConfig(defaultConfig, remoteConfig);
        this.tabBarConfig = remoteConfig.tabBar || null;
      } else {
        // Try to load from Kiddo's config file
        try {
          const kiddoConfig = require('@/config/kiddoAppConfig.json');
          
          // Dynamically build home config from all category arrays in config
          // Get category keys from categories.order or find all array properties
          const categoryKeys = kiddoConfig.categories?.order || [];
          const homeConfig: ScreenConfig = {};
          
          // Load all categories dynamically
          categoryKeys.forEach((key: string) => {
            if (Array.isArray(kiddoConfig[key])) {
              homeConfig[key] = kiddoConfig[key];
            }
          });
          
          // Also include known categories if they exist (for backwards compatibility)
          ['all', 'girls', 'boys', 'toys', 'babycare'].forEach((key) => {
            if (Array.isArray(kiddoConfig[key]) && !homeConfig[key]) {
              homeConfig[key] = kiddoConfig[key];
            }
          });
          
          // Transform Kiddo's structure to our structure
          this.config = {
            version: 1,
            home: homeConfig,
            header: kiddoConfig.header,
            categories: kiddoConfig.categories,
          };
          // Store tabBar config separately
          this.tabBarConfig = kiddoConfig.tabBar || null;
        } catch (e) {
          // Fallback to default
          this.config = defaultConfig;
          this.tabBarConfig = null;
        }
      }

      this.notifyListeners();
      return this.config;
    } catch (error) {
      console.error('[ConfigService] Error loading config:', error);
      this.config = defaultConfig;
      return this.config;
    }
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
    try {
      const kiddoConfig = require('@/config/kiddoAppConfig.json');
      const categoryBlocks = kiddoConfig.categoryScreen?.blocks || [];
      
      // Filter visible blocks and sort by order
      return categoryBlocks
        .filter((block: ContentBlock) => block.visible !== false)
        .sort((a: ContentBlock, b: ContentBlock) => (a.order || 0) - (b.order || 0));
    } catch (e) {
      return [];
    }
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
    try {
      const kiddoConfig = require('@/config/kiddoAppConfig.json');
      return kiddoConfig.productDetail || null;
    } catch (e) {
      return null;
    }
  }

  // Get product grid default configuration
  getProductGridDefaults() {
    try {
      const kiddoConfig = require('@/config/kiddoAppConfig.json');
      return kiddoConfig.productGridDefaults || {
        gap: 16,
        rowGap: 16,
        colGap: 16,
        paddingHorizontal: 20,
      };
    } catch (e) {
      return {
        gap: 16,
        rowGap: 16,
        colGap: 16,
        paddingHorizontal: 20,
      };
    }
  }

  // Get category screen configuration
  getCategoryScreenConfig() {
    try {
      const kiddoConfig = require('@/config/kiddoAppConfig.json');
      const categoryConfig = kiddoConfig.categoryScreen || {};
      
      // Return only config from kiddoAppConfig.json
      return categoryConfig;
    } catch (e) {
      // Return empty config if error
      return {};
    }
  }

  // Get config
  getConfig(): AppConfig {
    return this.config;
  }

  // Get providers configuration (Razorpay, OTP, etc.)
  getProvidersConfig() {
    try {
      const kiddoConfig = require('@/config/kiddoAppConfig.json');
      return kiddoConfig.providers || {};
    } catch (e) {
      return {};
    }
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

