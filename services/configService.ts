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
          // Transform Kiddo's structure to our structure
          this.config = {
            version: 1,
            home: {
              all: kiddoConfig.all || [],
              girls: kiddoConfig.girls || [],
              boys: kiddoConfig.boys || [],
              toys: kiddoConfig.toys || [],
              babycare: kiddoConfig.babycare || [],
            },
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

  // Get config
  getConfig(): AppConfig {
    return this.config;
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

