/**
 * Backend app config (cart/checkout) – returned by GET /api/v1/app/config.
 * All cart/checkout feature flags, copy, and options come from backend; nothing from kiddoAppConfig.
 */

export interface SizeOption {
  size: string;
  isAvailable: boolean;
}

export interface FreeShoesOfferShoe {
  id: string;
  name: string;
  imageUrl: string;
}

export interface FreeShoesPickerSizeOption {
  size: string;
  isAvailable: boolean;
  shoeIds?: string[];
}

export interface FreeShoesPickerConfig {
  enabled: boolean;
  shoes: FreeShoesOfferShoe[];
  sizes: FreeShoesPickerSizeOption[];
  copy?: {
    sizeTitle?: string;
    shoeTitle?: string;
  };
}

export interface FreeShoesOfferConfig {
  enabled: boolean;
  /** When false, offer is hidden. When true or undefined, offer is shown (if enabled). Computed by backend from cart context (cartSubtotal, cartCategories). */
  visible?: boolean;
  originalPrice?: number;
  sizes: SizeOption[];
  shoes: FreeShoesOfferShoe[];
  copy?: {
    title?: string;
    subtitle?: string;
    cta?: string;
    selectedLabel?: string;
    freeLabel?: string;
    sizeModalTitle?: string;
    sizeModalSubtitle?: string;
    confirmLabel?: string;
  };
}

export interface GiftWrapOption {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  color?: string;
}

export interface GiftWrapConfig {
  enabled: boolean;
  perItemPrice?: number;
  options: GiftWrapOption[];
  cardCopy?: {
    cta?: string;
    appliedTitle?: string;
    appliedSubtitle?: string;
  };
  ribbonImageUrl?: string;
  modalHeaderImageUrl?: string;
}

export interface CartFeatures {
  showGiftWrap: boolean;
  showFreePairShoes: boolean;
  showDeliveryCard: boolean;
  showSavingsCorner: boolean;
  showCompletePurchaseSection: boolean;
}

export interface CartConfig {
  deliveryCard?: {
    instantLabel?: string;
    scheduleCta?: string;
    scheduledTitle?: string;
  };
  giftWrap?: GiftWrapConfig;
  freeShoesOffer?: FreeShoesOfferConfig;
  freeShoesPicker?: FreeShoesPickerConfig;
  savingsCorner?: { title?: string; applyCta?: string };
  billDetails?: {
    subtotalLabel?: string;
    deliveryLabel?: string;
    giftWrapLabel?: string;
    discountLabel?: string;
    totalLabel?: string;
  };
}

export interface CheckoutConfig {
  payButtonLabel?: string;
  scheduleModalTitle?: string;
}

export interface OrderDetailConfig {
  /** Banner image above order content (JPEG/PNG). */
  imageUrl?: string;
  /**
   * Hero image for event orders — shown on order summary instead of the map when `isEventOrder` is true.
   * Remote JSON may use typo key `eventOrderurl`; the app reads both.
   */
  eventOrderUrl?: string;
  /** Dark store / pickup hub marker on tracking map (SVG or raster URL). */
  darkStoreIconUrl?: string;
  /** Customer / delivery location marker on tracking map (SVG or raster URL). */
  cusLocUrl?: string;
  /** Rider / partner position on map (SVG or raster). */
  partnerIconUrl?: string;
  /** Partner avatar in delivery card (PNG preferred). */
  partnerImageUrl?: string;
}

export interface EntryScreenItem {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
}

export interface AppConfigResponse {
  version?: number;
  updatedAt?: string;
  /** When true, show "Events" in address Save as (Home/Work/Other/Events) and persist in Shopify. */
  isEvent?: boolean;
  features?: {
    cart?: CartFeatures;
    checkout?: Record<string, boolean>;
  };
  cart?: CartConfig;
  checkout?: CheckoutConfig;
  orderDetail?: OrderDetailConfig;
  entryScreens?: EntryScreenItem[];
}
