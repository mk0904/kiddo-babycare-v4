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

export interface FreePuzzleItem {
  id: string;
  name: string;
  imageUrl: string;
}

export interface FreePuzzlePickerAge {
  age: string;
  isAvailable: boolean;
  itemIds: string[];
}

export interface FreePuzzlePickerConfig {
  enabled: boolean;
  items: FreePuzzleItem[];
  ages: FreePuzzlePickerAge[];
  copy?: {
    ageTitle?: string;
    itemTitle?: string;
  };
}

/**
 * 1st / 4th-order `isGift` steps — no product picker; user taps Add to apply the hidden coupon (same flow as free shoes / free puzzle gift codes).
 */
export interface MysteryGiftOfferConfig {
  enabled: boolean;
  /** Shopify / kiddo discount code (e.g. “Mystery gift”); may be `isVisible: false` in coupons API. */
  discountCode?: string;
  visible?: boolean;
  originalPrice?: number;
  copy?: {
    title?: string;
    subtitle?: string;
    cta?: string;
    freeLabel?: string;
    /** Shown in the “applied” state under the title */
    selectedLabel?: string;
  };
}

export interface FreePuzzleOfferConfig {
  enabled: boolean;
  /** Shopify / kiddo discount code for this free-puzzle line (used when milestone 2 is the active free-gift step). */
  discountCode?: string;
  visible?: boolean;
  showWhen?: { cartMinValue?: number; cartHasAnyCategory?: string[] };
  originalPrice?: number;
  items?: FreePuzzleItem[];
  copy?: {
    title?: string;
    subtitle?: string;
    cta?: string;
    selectedLabel?: string;
    freeLabel?: string;
    itemModalTitle?: string;
    itemModalSubtitle?: string;
    confirmLabel?: string;
  };
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
  /** Shopify / kiddo discount code for this free-shoes line (used when milestone 3 is the active free-gift step). */
  discountCode?: string;
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

/** Single condition row in the special-deal promo modal (icon + copy). */
export interface SpecialDealCondition {
  iconUrl?: string;
  text?: string;
}

/** Tab driving a Shopify collection in the special-deal promo grid. */
export interface SpecialDealTab {
  /** Admin URL, numeric id, or `gid://shopify/Collection/...` — used only to load products. */
  collectionId?: string;
  /** Backend snake_case alias for {@link collectionId}. */
  collection_id?: string;
  isActive?: boolean;
  /** Shown as the tab title in the promo modal. */
  label?: string;
  /** Stable id for analytics / keys (not shown as the tab title). */
  value?: string;
}

/**
 * Cart “special deal” promo modal — driven by app config.
 * Backend JSON key is historically misspelled `speacialDealConfig`; {@link CartConfig.specialDealConfig} is an optional alias.
 */
export interface SpecialDealConfig {
  actualPrice?: number;
  bannerText?: string;
  conditions?: SpecialDealCondition[];
  /** Interpreted as percentage off for grid “offer price” when 0 &lt; discount ≤ 100. */
  discount?: number;
  discountedPrice?: number;
  firstLineText?: string;
  footerCta?: string;
  isEnabled?: boolean;
  minCartValue?: number;
  /** Countdown duration in minutes. */
  offerTime?: number;
  /** Fixed rupee component in deal-coupon discount math (before %-of-eligible add-on). Backend may send `deal_coupon_fixed_amount`. */
  dealCouponFixedAmount?: number;
  secondLineText?: string;
  successIconUrl?: string;
  tabs?: SpecialDealTab[];
  thirdLineText?: string;
  title?: string;
}

export interface CartConfig {
  /** Backend typo preserved — special deal promo (`getSpecialDealConfig` also reads `specialDealConfig`). */
  speacialDealConfig?: SpecialDealConfig;
  /** Correct spelling alias for {@link speacialDealConfig}. */
  specialDealConfig?: SpecialDealConfig;
  /** Gift bill only (1st/4th `isGift`); pairs with `milestoneIsGiftBillDiscountLineTitle` / manual coupon apply. */
  mysteryGiftOffer?: MysteryGiftOfferConfig;
  deliveryCard?: {
    instantLabel?: string;
    scheduleCta?: string;
    scheduledTitle?: string;
  };
  giftWrap?: GiftWrapConfig;
  freePuzzleOffer?: FreePuzzleOfferConfig;
  freePuzzlePicker?: FreePuzzlePickerConfig;
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
  /**
   * Hero image when `isSchoolsDeliveredEventOrder` is true — overrides {@link eventOrderUrl} for that banner.
   * Remote JSON may use typo key `schoolsDeliveredEventOrderurl`; the app reads both.
   */
  schoolsDeliveredEventOrderUrl?: string;
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

/** Single milestone step assets + copy (backend `milestoneUI.milestoneFirst` … `milestoneFourth`). */
export interface MilestoneSlotConfig {
  activeColor?: string;
  inactiveColor?: string;
  /** Primary icon URL (new API); used with `activeIconUrl` / `inactiveIconUrl`. */
  iconUrl?: string;
  activeIconUrl?: string;
  inactiveIconUrl?: string;
  /** Welcome modal entry icon (used when `KiddoRewardsWelcomeModal` opens). */
  entryIconUrl?: string;
  /** Legacy casing fallback for entry icon. */
  entryiconUrl?: string;
  /** Default / outline glyph when step is inactive (new API). */
  defaultIconUrl?: string;
  /** Primary headline in expanded milestone row (preferred over `title`). */
  header?: string;
  /** Supporting copy under the headline (preferred over `description`). */
  body?: string;
  /** Unlock headline/sub-copy shown when cart crosses `minCartValue`. */
  unlockedTitle?: string;
  unlockedSubTitle?: string;
  /** Minimum cart value needed to unlock this milestone (string/number from backend). */
  minCartValue?: string | number;
  /** Optional order label (e.g. `1ST ORDER`) from backend. */
  orderNumber?: string;
  /** Optional accent color from backend payload. */
  color?: string;
  title?: string;
  description?: string;
  /** When true, this step is done; used with `currentStepIndex` to infer active step. */
  isCompleted?: boolean;
  completedHorLine?: string;
  completedVerLine?: string;
  /** Current-step horizontal segment (latest API key shape). */
  horizontallineUrl?: string;
  /** Current-step vertical segment (latest API key shape). */
  verticallineUrl?: string;
  /** Active horizontal segment (PascalCase `L` variant, legacy). */
  horizontalLineUrl?: string;
  /** Active vertical segment (PascalCase `L` variant, legacy). */
  verticalLineUrl?: string;
  /** Backend typo — prefer this key when present. */
  horActiveLIne?: string;
  horActiveLine?: string;
  pendingHorLine?: string;
  pendingVerLine?: string;
  verActiveLine?: string;
  /** When true, this step is a free-gift offer; use `header` / `title` for the free-item row in bill details. */
  isGift?: boolean;
  /**
   * When `isGift` is not true, milestone-level discount (same rules as stackable coupons: % or fixed on item subtotal, optional cap).
   * JSON may use snake_case: `discount_type`, `discount_value`, `max_discount`.
   */
  discount_type?: 'percentage' | 'fixed' | string;
  discount_value?: string | number;
  max_discount?: string | number;
}

export interface HotWheelConfig {
  deliveryFee: number;
  isEnabled: boolean;
  minCartValue: number;
}

export interface MilestoneUIConfig {
  /** Expanded panel header (e.g. “On your next 4 orders”). */
  expandedTitle?: string;
  /** Expanded panel subtitle. */
  expandedSubTitle?: string;
  /** Optional animation/video URL. */
  animationUrl?: string;
  /** Optional server-driven progress; when set, overrides `isCompleted`-based step. */
  currentStepIndex?: number;
  /** Shared completed horizontal segment when a slot omits `completedHorLine`. */
  horizontalCompletedLineUrl?: string;
  /** Shared completed vertical segment when a slot omits `completedVerLine`. */
  verticalCompletedLineUrl?: string;
  milestoneFirst?: MilestoneSlotConfig;
  milestoneSecond?: MilestoneSlotConfig;
  milestoneThird?: MilestoneSlotConfig;
  milestoneFourth?: MilestoneSlotConfig;
  firstMilestoneIcon?: string;
  secondMilestoneIcon?: string;
  thirdMilestoneIcon?: string;
  fourthMilestoneIcon?: string;
}

/**
 * Delivery zone hints from GET app/config.
 * When `servicableDistance` is set (km), the app compares it to distance (km) from POST /eta;
 * ETA distance greater than this → unserviceable (see `resolveDeliveryServiceable`).
 */
export interface DeliveryZoneConfig {
  /** Max straight-line km from dark store; over this → unserviceable (preferred key). */
  servicableDistance?: number;
  /** Alias if backend uses corrected spelling. */
  serviceableDistance?: number;
  /** @deprecated Prefer `servicableDistance`; kept for older payloads. */
  maxServiceRadiusKm?: number;
}

export interface AppConfigResponse {
  version?: number;
  updatedAt?: string;
  /** Same as `delivery.servicableDistance` if backend sends at root (km). */
  servicableDistance?: number;
  serviceableDistance?: number;
  /** When true, show "Events" in address Save as (Home/Work/Other/Events) and persist in Shopify. */
  isEvent?: boolean;
  /** Some backends send special-deal promo at root instead of under `cart`. */
  speacialDealConfig?: SpecialDealConfig;
  specialDealConfig?: SpecialDealConfig;
  features?: {
    cart?: CartFeatures;
    checkout?: Record<string, boolean>;
  };
  cart?: CartConfig;
  checkout?: CheckoutConfig;
  orderDetail?: OrderDetailConfig;
  entryScreens?: EntryScreenItem[];
  milestoneUI?: MilestoneUIConfig;
  hotWheelConfig?: HotWheelConfig;
  delivery?: DeliveryZoneConfig;
}
