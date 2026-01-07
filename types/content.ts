// Content block types - similar to gauntlet's block system

export interface BaseBlock {
  id: string;
  type: string;
  order: number;
  visible: boolean;
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
  }>;
  data?: Array<{
    imageUrl: string;
    link?: string;
    title?: string;
  }>;
  title?: string;
  gridConfig?: {
    numColumns?: number;
    colGap?: number;
    rowGap?: number;
    limit?: number;
    resizeMode?: 'cover' | 'contain';
    aspectRatio?: number;
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
    startTime?: string; // ISO string. If present & future -> Waiting state.
    endTime: string; // ISO string
    backgroundImage?: string;
    link?: string;
  };
  flashSaleConfig?: {
    showSeconds?: boolean;
    label?: string;
    subtitle?: string;
    layout?: 'basic' | 'modern' | 'cinematic';
    height?: number;
    aspectRatio?: number;
  };
}

export interface CategoryRailBlock extends BaseBlock {
  type: 'categoryRail';
  data: Array<{
    id: string;
    imageUrl: string;
    label: string;
    link?: string;
    collectionId?: string;
  }>;
  railConfig?: {
    size?: number; // width/height of circle
    gap?: number;
    showLabel?: boolean;
    shape?: 'circle' | 'square' | 'rounded';
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
  | FeatureStripBlock
  | VideoBannerBlock
  | NoInternetBlock;

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
  };
  categories?: {
    order?: string[];
    items?: Record<string, {
      label?: string;
      header?: {
        textColor?: string;
        backgroundColor?: string;
        backgroundImage?: string;
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

