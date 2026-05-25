// Content block types - similar to gauntlet's block system

import type { HeaderGlassConfig } from '@/types/headerGlassTypes';

/**
 * Block styles (e.g. styles.title, styles.text, styles.heading) support config-driven typography:
 * - fontFamily: alias ("bold" | "medium" | "semiBold" | "regular") or exact name ("Metropolis-Bold")
 * - fontWeight: "400" | "500" | "600" | "700" | "900" or number
 * - fontStyle: "normal" | "italic"
 * - fontSize, color, etc. as usual
 */
export interface BaseBlock {
  id: string;
  type: string;
  order?: number;
  visible?: boolean; // If false, block won't render. Defaults to true if not specified.
  styles?: Record<string, any>;
}

export interface ImageBannerBlock extends BaseBlock {
  type: 'banner' | 'imageBanner';
  data?: {
    imageUrl: string;
    link?: string;
    title?: string;
    subtitle?: string;
  };
  imageBannerConfig?: {
    imageUrl: string;
    height?: number;
    borderRadius?: number;
    resizeMode?: 'cover' | 'contain';
    alignSelf?: string;
  };
}

export interface ImageCarouselBlock extends BaseBlock {
  type: 'carousel';
  data: Array<
    | string
    | {
      imageUrl: string;
      link?: string;
      title?: string;
      subtitle?: string;
    }
  >;
  carouselConfig?: {
    autoPlay?: boolean;
    autoPlayInterval?: number;
    loop?: boolean;
    height?: number;
    resizeMode?: 'cover' | 'contain';
  };
}

export interface ImageGridBlock extends BaseBlock {
  type: 'grid';
  collectionIds?: Array<{
    id: string;
    name?: string;
    imageUrl?: string;
  }>;
  data?: Array<{
    imageUrl: string;
    link?: string;
    title?: string;
  }>;
  title?: string;
  gridConfig?: {
    numColumns?: number;
    /** Irregular rows: e.g. [2, 3] = first row 2 columns, second row 3 columns. Repeats for more items. */
    columnsPerRow?: number[];
    colGap?: number;
    rowGap?: number;
    limit?: number;
    resizeMode?: 'cover' | 'contain';
    aspectRatio?: number;
  };
}

export interface CategoryGridBlock extends BaseBlock {
  type: 'categoryGrid';
  title?: string;
  categoryKeys?: string[]; // Which categories to include (empty = all)
  collectionIds?: Array<{
    id: string;
    name?: string;
    imageUrl?: string;
  }>; // Collections to display (similar to ImageGrid)
  gridConfig?: {
    // Layout options
    layout?: 'uniform' | 'first-item-2-col' | 'first-item-2-row' | 'first-item-2x2' | 'masonry' | 'featured-left' | 'featured-top';
    
    // Grid structure (matching ImageGrid)
    numColumns?: number;
    colGap?: number; // Column gap (horizontal spacing between items)
    rowGap?: number; // Row gap (vertical spacing between items)
    limit?: number; // Limit number of items to show (0 = show all)
    
    // Item sizing
    aspectRatio?: number; // Aspect ratio for items (default: 1 for square)
    resizeMode?: 'cover' | 'contain'; // Image resize mode (matching ImageGrid)
    
    // Legacy/FlexibleGrid specific options (for backwards compatibility)
    gap?: number; // Single gap value (used if colGap/rowGap not specified)
    padding?: number; // Container padding (overridden by styles.container.paddingHorizontal)
    showLabels?: boolean; // Show category labels below images
    borderRadius?: number; // Border radius for items
    imageResizeMode?: 'cover' | 'contain' | 'stretch'; // Alternative to resizeMode
    
    // First item customization
    firstItemSpan?: {
      colSpan?: number; // How many columns the first item should span
      rowSpan?: number; // How many rows the first item should span
    };
  };
  // Styles matching ImageGrid structure
  styles?: {
    container?: Record<string, any>;
    title?: Record<string, any>;
    imageContainer?: Record<string, any>;
    image?: Record<string, any>;
    text?: Record<string, any>;
    listContent?: Record<string, any>;
    itemWrapper?: Record<string, any>;
    placeholder?: Record<string, any>;
  };
}

export interface InfiniteProductGridBlock extends BaseBlock {
  type: 'infiniteProductGrid';
  collectionIds?: Array<string>;
  title?: string;
  productGridConfig?: {
    numColumns?: number;
    pageSize?: number;
    initialLoad?: number;
    gap?: number; // Gap between items (used for both row and column if rowGap/colGap not specified)
    rowGap?: number; // Gap between rows
    colGap?: number; // Gap between columns
    paddingHorizontal?: number; // Horizontal padding for the grid container
  };
  styles?: Record<string, any>;
}

export interface ImageListBlock extends BaseBlock {
  type: 'list' | 'horizontalProductList';
  collectionIds?: Array<string | {
    id: string;
    name?: string;
  }>;
  data?: Array<{
    imageUrl: string;
    link?: string;
    title?: string;
    subtitle?: string;
  }>;
  title?: string;
  listConfig?: {
    limit?: number;
    itemsPerView?: number;
    resizeMode?: 'cover' | 'contain';
  };
  productListConfig?: {
    limit?: number;
    itemsPerView?: number;
    filters?: any;
    sort?: any;
    seeAllText?: string; // Configurable "See All" button text
    showSeeAll?: boolean; // Show "See All" button
  };
}

export interface ModalBlock extends BaseBlock {
  type: 'modal';
  data: {
    content: any;
    height?: number | string;
    title?: string;
  };
  modalConfig?: {
    dismissible?: boolean;
    fullScreen?: boolean;
  };
}

export interface AnnouncementCarouselBlock extends BaseBlock {
  type: 'announcementCarousel' | 'announcementStrip';
  data?: Array<{
    text: string;
    link?: string;
    hidden?: boolean;
  }>;
  announcementConfig?: {
    autoPlay?: boolean;
    autoPlayInterval?: number;
    icon?: boolean;
  };
}

export interface PromoCarouselBlock extends BaseBlock {
  type: 'promoCarousel';
  data?: Array<{
    imageUrl: string;
    link?: string;
    title?: string;
    subtitle?: string;
    hidden?: boolean;
  }>;
  heading?: string;
  subHeading?: string;
  promoCarouselConfig?: {
    autoPlay?: boolean;
    autoPlayInterval?: number;
    roundness?: number;
    hideIndicator?: boolean;
  };
}

export interface SearchProductListBlock extends BaseBlock {
  type: 'searchProductList';
  collectionId?: string;
  searchQuery?: string;
  title?: string;
  searchListConfig?: {
    limit?: number;
    itemsPerView?: number;
    disappearOnSearch?: boolean;
  };
}

export interface CollectionListBlock extends BaseBlock {
  type: 'collectionList';
  data?: Array<{
    collectionId: string;
    collectionName: string;
    image: string;
    link?: string;
  }>;
  title?: string;
  collectionListConfig?: {
    itemsPerRow?: number;
    roundness?: number;
  };
}

export interface FlashSaleBlock extends BaseBlock {
  type: 'flashSale';
  data: {
    startTime: string; // ISO string - required for sale start
    endTime: string; // ISO string
    backgroundImage?: string;
    link?: string;
  };
  flashSaleConfig?: {
    showSeconds?: boolean;
    // Text for when sale is live (before end)
    label?: string;
    subtitle?: string;
    // Text for when sale is upcoming (before start)
    startTitle?: string;
    startSubtitle?: string;
    // Visibility flags
    showBeforeSaleStart?: boolean; // Show timer and text before sale starts
    showBeforeSaleEnd?: boolean; // Show timer and text before sale ends
    layout?: 'basic' | 'modern' | 'cinematic';
    height?: number;
    aspectRatio?: number;
  };
}

export interface CategoryRailBlock extends BaseBlock {
  type: 'rail';
  title?: string;
  data: Array<{
    id: string;
    imageUrl?: string; // Optional if collectionId is provided
    label?: string; // Optional if collectionId is provided (will use collection title), manual label overrides collection title
    link?: string;
    collectionId?: string; // If provided, will fetch image and label from collection
  }>;
  railConfig?: {
    size?: number; // width/height of circle or width for rectangular (deprecated, use width/height)
    width?: number; // Width of the item
    height?: number; // Height of the item
    gap?: number;
    showLabel?: boolean;
    shape?: 'circle' | 'square' | 'rounded';
    itemsPerView?: number; // Number of items visible at a time (default: auto)
    aspectRatio?: number; // Aspect ratio (width/height) for rectangular shapes, e.g., 2/3 = 0.667 (used if width/height not provided)
    bgImageUrl?: string; // Background image URL for the rail container
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center'; // Resize mode for background image
  };
  styles?: {
    container?: any;
    item?: any;
    imageContainer?: any;
    image?: any;
    text?: any;
    label?: any;
    title?: any;
  };
}

/** Horizontal image-only carousel; each slide links to a collection (or custom `link`). */
export interface CollectionImageCarouselBlock extends BaseBlock {
  type: 'collectionImageCarousel';
  title?: string;
  data: Array<{
    id: string;
    /** Image URL shown in the carousel */
    imageUrl: string;
    /** Shopify collection GID or numeric id — used with home `onBlockPress` → `/infinity/[collectionId]` */
    collectionId: string;
    /** Shown as listing screen title when navigating */
    title?: string;
    /**
     * Optional explicit route (Expo Router path), e.g. `/infinity/[collectionId]` params handled elsewhere.
     * If set, passed to `router.push` when provided; otherwise navigation uses `collectionId`.
     */
    link?: string;
  }>;
  carouselConfig?: {
    /** Fixed width per slide in px (default ~148) */
    itemWidth?: number;
    /** width / height (default 1.25). Use a lower value for portrait/tall images (e.g. 0.65 ≈ 2:3). Ignored if `itemHeight` is set. */
    aspectRatio?: number;
    /** Fixed slide height in px; when set, overrides `aspectRatio` for height. */
    itemHeight?: number;
    /** expo-image contentFit — use `contain` for tall assets to avoid top/bottom crop (default cover) */
    imageContentFit?: 'cover' | 'contain' | 'fill';
    gap?: number;
    borderRadius?: number;
    paddingHorizontal?: number;
    /** Left inset for first item / right for last (default matches paddingHorizontal) */
    contentPaddingHorizontal?: number;
  };
  styles?: {
    container?: any;
    title?: any;
    item?: any;
    image?: any;
  };
}

export interface FeatureStripBlock extends BaseBlock {
  type: 'featureStrip';
  data: Array<{
    iconUrl: string;
    label: string;
    subLabel?: string;
  }>;
  featureStripConfig?: {
    layout?: 'row' | 'scroll';
    itemsPerRow?: number;
  };
}

export interface VideoBannerBlock extends BaseBlock {
  type: 'videoBanner';
  data: {
    videoUrl: string;
    posterUrl?: string; // Loading/Thumbnail image
    link?: string;
  };
  videoConfig?: {
    autoPlay?: boolean;
    muted?: boolean;
    loop?: boolean;
    resultVolume?: number; // 0 to 1
    aspectRatio?: number;
  };
  /** Optional 1×N grid overlaid on the video (e.g. Fashion + Toys). */
  overlayGrid?: Pick<CategoryGridBlock, 'title' | 'collectionIds' | 'gridConfig' | 'styles'>;
}

export interface NoInternetBlock extends BaseBlock {
  type: 'noInternet';
  data?: {
    iconId?: string;
    heading?: string;
    text?: string;
    buttonText?: string;
    loadingText?: string;
    startIcon?: string;
  };
}

export type ContentBlock =
  | ImageBannerBlock
  | ImageCarouselBlock
  | ImageGridBlock
  | ImageListBlock
  | InfiniteProductGridBlock
  | ModalBlock
  | AnnouncementCarouselBlock
  | PromoCarouselBlock
  | SearchProductListBlock
  | CollectionListBlock
  | FlashSaleBlock
  | CategoryRailBlock
  | CollectionImageCarouselBlock
  | FeatureStripBlock
  | VideoBannerBlock
  | NoInternetBlock
  | CategoryGridBlock;

export interface ScreenConfig {
  [category: string]: ContentBlock[];
}

export interface AppConfig {
  version?: number;
  home?: ScreenConfig;
  header?: {
    textColor?: string;
    primaryColor?: string;
    backgroundColor?: string;
    backgroundImage?: string;
    glass?: HeaderGlassConfig;
  };
  categories?: {
    order?: string[];
    items?: Record<string, {
      label?: string;
      /** Icon image URL for category nav and grids. When set, overrides bundled asset. */
      icon?: string;
      header?: {
        textColor?: string;
        backgroundColor?: string;
        backgroundImage?: string;
        glass?: HeaderGlassConfig;
        labelColors?: {
          selected?: string;
          unselected?: string;
        };
      };
    }>;
    styles?: Record<string, any>;
  };
  [key: string]: any;
}

