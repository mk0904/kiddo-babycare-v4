import { GridLayoutType } from '@/components/ui/FlexibleGrid';

/**
 * Category Screen Configuration
 * 
 * To configure the category screen with multiple grid sections, add a "categoryScreen" object to your kiddoAppConfig.json:
 * 
 * {
 *   "categoryScreen": {
 *     "sections": [
 *       {
 *         "id": "fashion-categories",
 *         "title": "Fashion",
 *         "showTitle": true,
 *         "categoryKeys": ["girls", "boys"],  // Optional: filter specific categories. If empty/omitted, shows all
 *         "grid": {
 *           "layout": "first-item-2-col",  // Options: "uniform", "first-item-2-col", "first-item-2-row", "first-item-2x2", "masonry", "featured-left", "featured-top"
 *           "numColumns": 3,
 *           "gap": 12,
 *           "padding": 16,
 *           "aspectRatio": 1,
 *           "showLabels": true,
 *           "borderRadius": 12,
 *           "imageResizeMode": "cover"  // Options: "cover", "contain", "stretch"
 *         }
 *       },
 *       {
 *         "id": "other-categories",
 *         "title": "Other Categories",
 *         "showTitle": true,
 *         "categoryKeys": ["babycare", "toys"],
 *         "grid": {
 *           "layout": "uniform",
 *           "numColumns": 4,
 *           "gap": 12,
 *           "padding": 16,
 *           "aspectRatio": 1,
 *           "showLabels": true,
 *           "borderRadius": 12,
 *           "imageResizeMode": "cover"
 *         }
 *       }
 *     ],
 *     "banner": {
 *       "enabled": true,
 *       "subtitle": "LAUNCHING",
 *       "title": "Fashion Store",
 *       "buttonText": "Shop now →",
 *       "backgroundColor": "#8B5CF6",
 *       "textColor": "#FFFFFF",
 *       "buttonBackgroundColor": "#FFFFFF",
 *       "buttonTextColor": "#8B5CF6"
 *     },
 *     "header": {
 *       "title": "All Categories",
 *       "showSearch": true
 *     }
 *   }
 * }
 * 
 * Note: If "sections" is not provided, it will fall back to a single grid using the legacy "grid" config.
 */
export interface GridSectionConfig {
  id: string;
  title?: string;
  showTitle?: boolean;
  categoryKeys?: string[]; // Which categories to include in this grid (if not specified, shows all)
  grid: {
    layout: GridLayoutType;
    numColumns: number;
    gap: number;
    padding: number;
    aspectRatio: number;
    showLabels: boolean;
    borderRadius: number;
    imageResizeMode: 'cover' | 'contain' | 'stretch';
  };
}

export interface CategoryScreenConfig {
  // Multiple Grid Sections
  sections?: GridSectionConfig[];

  // Legacy single grid configuration (for backwards compatibility)
  grid?: {
    layout: GridLayoutType;
    numColumns: number;
    gap: number;
    padding: number;
    aspectRatio: number;
    showLabels: boolean;
    borderRadius: number;
    imageResizeMode: 'cover' | 'contain' | 'stretch';
  };

  // Banner Configuration
  banner: {
    enabled: boolean;
    title?: string;
    subtitle?: string;
    buttonText?: string;
    backgroundColor?: string;
    textColor?: string;
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
  };

  // Header Configuration
  header: {
    title: string;
    showSearch: boolean;
  };

  // Legacy section configuration (for backwards compatibility)
  section?: {
    title: string;
    showTitle: boolean;
  };
}

// Default configuration
export const defaultCategoryConfig: CategoryScreenConfig = {
  sections: [
    {
      id: 'all-categories',
      title: 'All Categories',
      showTitle: true,
      grid: {
        layout: 'first-item-2-col',
        numColumns: 3,
        gap: 12,
        padding: 16,
        aspectRatio: 1,
        showLabels: true,
        borderRadius: 12,
        imageResizeMode: 'cover',
      },
    },
  ],
  banner: {
    enabled: true,
    subtitle: 'LAUNCHING',
    title: 'Fashion Store',
    buttonText: 'Shop now →',
    backgroundColor: '#8B5CF6',
    textColor: '#FFFFFF',
    buttonBackgroundColor: '#FFFFFF',
    buttonTextColor: '#8B5CF6',
  },
  header: {
    title: 'All Categories',
    showSearch: true,
  },
};
