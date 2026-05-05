// Zustand Store - Cart Slice
// Enhanced cart state management with gift items, multiple discounts, and sync
// Coupon values come from backend API only (not config)

import { getAppVersionForApi } from '@/constants/versionConfig';
import { appConfigService } from '@/services/appConfigService';
import { getSubtotalForAllowedCategories, pickSchoolNameFromCouponRaw } from '@/services/couponService';
import { shopifyApi } from '@/services/shopifyApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Types
export interface CartItem {
    id: string;
    productId: string;
    variantId: string;
    title: string;
    variantTitle?: string;
    price: number;
    compareAtPrice?: number;
    currencyCode: string;
    image: string;
    quantity: number;
    availableForSale: boolean;
    /** Max quantity that can be in cart for this variant (from inventory). Enforced on add/update. */
    quantityAvailable?: number;
    tags?: string[];
    customAttributes?: Record<string, string>;
    bookingDate?: string; // ISO date string for ticketing products
}

/**
 * Line attribute: percent off the **Shopify selling price** (e.g. `50` = pay half). Used for
 * special-deal promo grid adds; persisted on the Shopify cart line and reapplied after fetch/sync.
 */
export const SPECIAL_DEAL_PROMO_CART_ATTR = 'kiddo_special_deal_promo';

export function specialDealPromoPercentFromItem(item: Pick<CartItem, 'customAttributes'>): number | null {
    const raw = item.customAttributes?.[SPECIAL_DEAL_PROMO_CART_ATTR];
    if (raw == null) return null;
    const p = parseFloat(String(raw));
    if (!Number.isFinite(p) || p < 0 || p >= 100) return null;
    return p;
}

export function applySellingPriceWithSpecialDealPromo(
    sellingUnit: number,
    item: Pick<CartItem, 'customAttributes'>,
): number {
    const p = specialDealPromoPercentFromItem(item);
    if (p == null) return sellingUnit;
    return Math.max(0, Math.round(sellingUnit * (1 - p / 100)));
}

/** Same variant + same special-deal promo state → merge quantity; otherwise keep separate lines. */
export function cartItemSameLineIdentity(
    a: { variantId: string; customAttributes?: Record<string, string> },
    b: { variantId: string; customAttributes?: Record<string, string> },
): boolean {
    const ak = canonicalVariantKeyForMerge(a.variantId);
    const bk = canonicalVariantKeyForMerge(b.variantId);
    if (!ak || !bk || ak !== bk) return false;

    const tbA = String(a.customAttributes?.try_buy_trial_variant_id ?? '').trim();
    const tbB = String(b.customAttributes?.try_buy_trial_variant_id ?? '').trim();
    if (tbA !== tbB) return false;

    const ap = String(a.customAttributes?.[SPECIAL_DEAL_PROMO_CART_ATTR] ?? '').trim();
    const bp = String(b.customAttributes?.[SPECIAL_DEAL_PROMO_CART_ATTR] ?? '').trim();
    if (ap === bp) return true;
    /** Fresh add often omits the marker; {@link syncDealPricing} stamps it on eligible lines — still one physical line. */
    if (ap === '' || bp === '') return true;
    return false;
}

export function canonicalVariantKeyForMerge(id: string | number | undefined | null): string | null {
    if (id === undefined || id === null) return null;
    const s =
        typeof id === 'number' && Number.isFinite(id)
            ? String(Math.trunc(id))
            : String(id).trim();
    if (!s) return null;
    return s.includes('/') ? (s.split('/').pop() ?? s) : s;
}

/** Admin URL, numeric id, or Shopify Collection GID → Storefront API id. */
export function parseShopifyCollectionGid(raw: string | undefined | null): string | null {
    if (raw == null || typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s) return null;
    if (s.startsWith('gid://shopify/Collection/')) return s;
    const adminMatch = s.match(/\/collections\/(\d+)/);
    if (adminMatch) return `gid://shopify/Collection/${adminMatch[1]}`;
    if (/^\d+$/.test(s)) return `gid://shopify/Collection/${s}`;
    return null;
}

/** Match cart variantId / product id to hydrated product variant nodes. */
export function variantBelongsToListingProducts(
    products: any[],
    variantId: CartItem['variantId'],
): boolean {
    const target = canonicalVariantKeyForMerge(variantId);
    if (!target) return false;
    for (const p of products) {
        const edges = p?.variants?.edges ?? [];
        for (const e of edges) {
            const vid = e?.node?.id;
            if (vid && canonicalVariantKeyForMerge(vid) === target) return true;
        }
        if (edges.length === 0 && Array.isArray(p?.variants)) {
            for (const v of p.variants) {
                const id = v?.id ?? v?.node?.id;
                if (id && canonicalVariantKeyForMerge(id) === target) return true;
            }
        }
    }
    return false;
}

/** Subtotal of cart lines whose variant is in hydrated deal-collection products (matches syncDealPricing eligibility). */
export function getSubtotalForDealCollectionLines(lineItems: CartItem[], dealProducts: any[]): number {
    if (!dealProducts?.length) return 0;
    return lineItems.reduce((sum, item) => {
        if (!variantBelongsToListingProducts(dealProducts, item.variantId)) return sum;
        return sum + Number(item.price ?? 0) * Number(item.quantity ?? 0);
    }, 0);
}

/** Parsed `gid://shopify/Collection/...` ids from active special-deal config tabs (see {@link parseShopifyCollectionGid}). */
function collectSpecialDealTabCollectionGids(): string[] {
    const dealConfig = appConfigService.getSpecialDealConfig();
    const tabs = dealConfig?.tabs;
    if (!Array.isArray(tabs)) return [];
    const gids: string[] = [];
    for (const tab of tabs) {
        const raw = tab.collectionId ?? tab.collection_id;
        const gid = parseShopifyCollectionGid(raw != null ? String(raw) : null);
        if (gid) gids.push(gid);
    }
    return gids;
}

/**
 * Whether `variantId` belongs to any of `specialDealTabCollectionGids` — always queries Shopify Storefront (no client cache).
 */
export async function variantBelongsToSpecialDealTabCollections(
    variantId: CartItem['variantId'],
    specialDealTabCollectionGids: readonly string[],
): Promise<boolean> {
    if (specialDealTabCollectionGids.length === 0) return false;
    return shopifyApi.variantBelongsToAnySpecialDealCollections(variantId, specialDealTabCollectionGids);
}

/** Selling subtotal of cart lines eligible for the active deal coupon (hydrated tab collection products). */
export async function getSubtotalForDealEligibleLines(
    lineItems: CartItem[],
    dc: DiscountCode,
    dealProducts: any[],
    couponAllowedCategories: string[],
    options: { limitToOne?: boolean } = {},
): Promise<number> {
    if (dc.isDealCoupon !== true) return 0;
    const tabCollectionGids = collectSpecialDealTabCollectionGids();
    if (tabCollectionGids.length === 0) return 0;

    // HIGH-PERFORMANCE: Batch all items into one single network request
    const productIds = lineItems.map(item => item.productId).filter(Boolean);
    const eligibilityMap = await shopifyApi.batchGetProductsCollectionEligibility(productIds, tabCollectionGids);

    const results = lineItems.map((item) => {
        const isEligible = eligibilityMap.get(item.productId) === true;

        if (__DEV__) {
            console.log(`[DealEligibility] Item: "${item.title}" | Eligible: ${isEligible}`);
        }

        if (!isEligible) return 0;
        const exists = item?.tags?.some(tag => couponAllowedCategories.includes(tag));
        const qty = exists ? (Number(item.quantity ?? 0) > 0 ? 1 : 0) : Number(item.quantity ?? 0);
        return Number(item.price ?? 0) * qty;
    });

    const subtotal = results.reduce((a, b) => a + b, 0);
    if (__DEV__) {
        console.log(`[DealEligibility] Final Eligible Subtotal: ${subtotal}`);
    }
    return subtotal;
}

/** True if a Shopify-mapped line already represents this local row (GID vs numeric variant ids differ). */
function localCartLineCoveredByShopifyFetch(local: CartItem, shopifyLines: CartItem[]): boolean {
    const lk = canonicalVariantKeyForMerge(local.variantId);
    if (!lk) return false;
    return shopifyLines.some((sl) => {
        const sk = canonicalVariantKeyForMerge(sl.variantId);
        if (sk !== lk) return false;
        if (
            String(local.customAttributes?.[SPECIAL_DEAL_PROMO_CART_ATTR] ?? '') !==
            String(sl.customAttributes?.[SPECIAL_DEAL_PROMO_CART_ATTR] ?? '')
        ) {
            return false;
        }
        const bdLocal = local.bookingDate ?? '';
        const bdShop = sl.bookingDate ?? '';
        return bdLocal === bdShop;
    });
}

/**
 * Rows created only in Zustand (`item_*` ids) that are not yet on Shopify — `fetchCart` must not drop them
 * (e.g. existing cart lines before apply-deal `fetchCart`, or adds that have not been synced yet).
 */
function orphanLocalLinesAfterShopifyFetch(prev: CartItem[], shopifyMapped: CartItem[]): CartItem[] {
    return prev.filter(
        (li) =>
            typeof li.id === 'string' &&
            li.id.startsWith('item_') &&
            !localCartLineCoveredByShopifyFetch(li, shopifyMapped),
    );
}

/** Strip deal-promo attr for comparing Shopify vs local line identity when resolving CartLine ids. */
function cartLineAttrSignatureWithoutDealPromo(customAttributes: Record<string, string> | undefined): string {
    const o = { ...(customAttributes || {}) };
    delete o[SPECIAL_DEAL_PROMO_CART_ATTR];
    const keys = Object.keys(o).sort();
    return keys.map((k) => `${k}=${o[k]}`).join('&');
}

/**
 * Re-map local rows to current Shopify CartLine ids before cartLinesUpdate.
 * Avoids userErrors when Zustand still holds ids from a recreated cart or when sync races fetchCart.
 */
async function mergeShopifyCartLineIdsFromRemote(cartId: string, lines: CartItem[]): Promise<CartItem[]> {
    if (!cartId.startsWith('gid://shopify/Cart/')) return lines;
    let cart: any;
    try {
        cart = await shopifyApi.getCart(cartId);
    } catch {
        return lines;
    }
    type Row = { id: string; variantId: string; bookingDate: string; attrSig: string };
    const shopifyRows: Row[] = [];
    for (const edge of cart?.lines?.edges ?? []) {
        const node = edge?.node;
        if (!node?.id || !node.merchandise?.id) continue;
        const attrList = node.attributes || node.merchandise?.customAttributes || [];
        const bookingDate = String(attrList.find((a: any) => a.key === 'booking_date')?.value ?? '');
        const customAttributes: Record<string, string> = {};
        for (const a of attrList) {
            if (a?.key && a.key !== 'booking_date' && a.value != null) {
                customAttributes[a.key] = String(a.value);
            }
        }
        shopifyRows.push({
            id: node.id,
            variantId: node.merchandise.id,
            bookingDate,
            attrSig: cartLineAttrSignatureWithoutDealPromo(customAttributes),
        });
    }

    const used = new Set<string>();
    return lines.map((li) => {
        if (!li.id?.startsWith('gid://shopify/CartLine/')) return li;
        const lk = canonicalVariantKeyForMerge(li.variantId);
        if (!lk) return li;
        const bd = li.bookingDate ?? '';
        const attrSig = cartLineAttrSignatureWithoutDealPromo(li.customAttributes);
        const match = shopifyRows.find(
            (sr) =>
                !used.has(sr.id) &&
                canonicalVariantKeyForMerge(sr.variantId) === lk &&
                sr.bookingDate === bd &&
                sr.attrSig === attrSig,
        );
        if (match) {
            used.add(match.id);
            return { ...li, id: match.id };
        }
        return li;
    });
}

export interface GiftItem {
    id: string;
    productId: string;
    variantId: string;
    title: string;
    image: string;
    price: number; // Original price (for display)
    discountedPrice: number; // 0 for free gifts
    minCartValue?: number; // Minimum cart value to qualify
    isApplied: boolean;
}

export interface DiscountCode {
    code: string;
    type: 'percentage' | 'fixed' | 'shipping' | 'bogo';
    value: number;
    applicable?: boolean;
    appliedAt: number;
    /** Max discount in currency units; cap applied discount at this amount when set. */
    maxDiscountAmount?: number | null;
    /** Original price for display (e.g. free-shoes gift – show struck in bill details). */
    originalPrice?: number;
    /** When set, discount is applied on this category's subtotal only (e.g. "toys", "fashion"). */
    applicableCategory?: string | null;
    /** When set, discount is applied on combined cart value of products in any of these categories. */
    allowedCategories?: string[] | null;
    /** If true, this coupon requires school/child details. */
    isSchoolCoupon?: boolean;
    /** From coupons API / validate response (e.g. `title` for bill row). */
    couponTitle?: string;
    /** From coupons API (e.g. "Mystery gift above ₹999"). */
    couponDescription?: string;
    /** If true, this coupon is treated as a milestone reward in the UI. */
    isMilestone?: boolean;
    /** From coupons API: opens deal upsell modal when this code is applied. */
    isDealCoupon?: boolean;
    /** From coupons API: school label for deal promo copy. */
    schoolName?: string;
}

/** One row of {@link computeDiscountBreakdown} for Bill / analytics. */
export type DiscountBreakdownPerCode = {
    code: string;
    codeDiscount: number;
    isDealCoupon: boolean;
    isMilestone: boolean;
    applicable: boolean;
    type: DiscountCode['type'];
    value: number;
    baseAmount: number;
};

export type DiscountBreakdown = {
    total: number;
    perCode: DiscountBreakdownPerCode[];
};

function schoolNameFromCouponApi(c: unknown): string | undefined {
    return pickSchoolNameFromCouponRaw(c);
}

/** Backend may send camelCase or snake_case. */
function couponIsDealCouponFromApi(c: { isDealCoupon?: boolean; is_deal_coupon?: boolean } | null | undefined, code?: string): boolean {
    // if (c?.isDealCoupon === true || c?.is_deal_coupon === true) return true;
    // const upper = (code || '').toUpperCase();
    // return upper.includes('DEAL') || upper.includes('PROMO') || upper === 'DEALPECIAL';
    return Boolean(c?.isDealCoupon === true || c?.is_deal_coupon === true);
}

/** Deal coupons are client-only (modal trigger); never sent to Shopify discount APIs. */
function discountCodesForShopifyApply(codes: DiscountCode[]): string[] {
    return codes.filter((dc) => dc.applicable !== false && dc.isDealCoupon !== true).map((dc) => dc.code);
}

export interface GiftWrapping {
    name: string;
    description: string;
    price: number;
    productIds: string[];
}

export interface CartPayment {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
    currencyCode: string;
}

export type CartStatus = 'init' | 'idle' | 'loading' | 'error';

// Cart State
interface CartState {
    // Core state
    id: string | null;
    webUrl: string | null;
    checkoutUrl: string | null;
    lineItems: CartItem[];
    giftItems: GiftItem[];
    discountCodes: DiscountCode[];
    note: string;
    payment: CartPayment | null;
    status: CartStatus;
    error: string | null;
    lastSyncedAt: number | null;

    // Additional features
    isTryAndBuy: boolean;
    giftWrapping: GiftWrapping | null;
    selectedShoe: string | null;
    /** Free shoes offer: selected size (e.g. S1, S2) – sent to Shopify with selectedShoe */
    selectedShoeSize: string | null;
    /** Free puzzle (milestone 2) – variant `id` from `freePuzzle*`. */
    selectedPuzzleId: string | null;
    /** Chosen age band label (e.g. `2-3 Years`) for filtering puzzles */
    selectedPuzzleAge: string | null;

    /** School coupon data: collected when isSchoolCoupon is applied. */
    schoolCouponData: {
        childName: string;
        parentName: string;
        dob: string;
        gender: string;
    } | null;

    deliverySchedule: {
        date: string;
        time: string;
        day: string;
        dateFormat: string;
        timeSlotLabel?: string;
    } | null;

    /** Hydrated products from deal collections (isDealCoupon). Used to automatically discount cart items. */
    dealProducts: any[];

    /** Last async discount breakdown (deal lines resolved via Storefront API). Kept in sync by {@link refreshComputedDiscountFromCodes}. */
    discountBreakdownSnapshot: DiscountBreakdown;

    // Computed getters
    itemCount: () => number;
    mrp: () => number;
    subtotal: () => number;
    discountAmount: () => number;
    shippingFee: () => number;
    total: () => number;

    // Actions
    setStatus: (status: CartStatus) => void;
    setError: (error: string | null) => void;

    // Cart operations
    addItem: (item: Omit<CartItem, 'id'>) => Promise<void>;
    removeItem: (itemId: string) => Promise<void>;
    updateQuantity: (itemId: string, quantity: number) => Promise<void>;
    /** Merge fields into a line (e.g. Try & Buy trial attributes). Pass `customAttributes: {}` to clear attributes. */
    updateCartItem: (itemId: string, patch: Partial<CartItem>) => Promise<void>;
    clearCart: () => void;

    // Gift items
    addGiftItem: (gift: Omit<GiftItem, 'isApplied'>) => void;
    removeGiftItem: (giftId: string) => void;
    applyEligibleGifts: () => void;

    // Discount codes
    applyDiscountCode: (code: string, options?: { preloadedCoupons?: any[]; originalPrice?: number }) => Promise<{ success: boolean; error?: string }>;
    removeDiscountCode: (code: string) => Promise<void>;
    removeAllDiscountCodes: () => Promise<void>;
    validateAppliedDiscountCodes: () => Promise<void>;

    // Sync
    syncCartPrices: () => Promise<void>;
    fetchCart: () => Promise<void>;

    // Note
    updateNote: (note: string) => void;

    // Try & Buy
    toggleTryAndBuy: () => void;
    setTryAndBuy: (enabled: boolean) => void;

    // Gift Wrapping
    setGiftWrapping: (wrapping: GiftWrapping | null) => void;
    getGiftWrappingPrice: () => number;

    // Free Shoes Offer
    setSelectedShoe: (shoeId: string | null) => void;
    setSelectedShoeSize: (size: string | null) => void;
    setSelectedPuzzle: (puzzleId: string | null, age?: string | null) => void;

    // School Coupon
    setSchoolCouponData: (data: CartState['schoolCouponData']) => void;

    // Cart management
    ensureCart: () => Promise<string | null>;
    getCheckoutUrl: () => Promise<string | null>;
    syncDeliveryFeeToShopify: () => Promise<void>;
    setDeliverySchedule: (schedule: CartState['deliverySchedule']) => void;

    /**
     * Scan cart items and apply/remove deal pricing (50% off) based on active isDealCoupon.
     * Fetches products from deal collections if dealProducts state is empty.
     */
    syncDealPricing: (options?: { forceFetch?: boolean }) => Promise<void>;

    /** Recompute {@link discountBreakdownSnapshot} from current line items + codes (await deal collection checks via Shopify). */
    refreshComputedDiscountFromCodes: () => Promise<void>;
}

// Available gift items (configure based on your store)
const AVAILABLE_GIFTS: Omit<GiftItem, 'isApplied'>[] = [
    // Example: Free gift for orders over ₹999
    // {
    //   id: 'gift_1',
    //   productId: 'gid://shopify/Product/xxx',
    //   variantId: 'gid://shopify/ProductVariant/xxx',
    //   title: 'Free Gift - Mini Sample',
    //   image: 'https://...',
    //   price: 199,
    //   discountedPrice: 0,
    //   minCartValue: 999,
    // },
];

/** Parse Shopify "merchandise does not exist" error and return the invalid variant id (GID or numeric). */
function parseInvalidVariantFromError(message: string): string | null {
    if (!message || !message.includes('does not exist')) return null;
    const match = message.match(/gid:\/\/shopify\/ProductVariant\/(\d+)/);
    return match ? match[1] : null; // numeric id; lineItems may store full GID or just id
}

/** Unique lowercase category/tag strings from line items for coupon eligibility. */
function getCartCategoriesFromLineItems(items: { tags?: string[] }[]): string[] {
    const set = new Set<string>();
    for (const item of items) {
        for (const t of item.tags ?? []) {
            const s = String(t).trim().toLowerCase();
            if (s) set.add(s);
        }
    }
    return Array.from(set);
}

function getCartCategorySubtotalsFromLineItems(items: { tags?: string[]; price?: number; quantity?: number }[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const item of items) {
        const amount = Number(item.price ?? 0) * Number(item.quantity ?? 1);
        const tags = (item.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
        if (tags.length === 0) continue;
        for (const tag of tags) {
            out[tag] = (out[tag] ?? 0) + amount;
        }
    }
    return out;
}

/**
 * Discount from applied codes (aligned with cart UI / Bill details), with per-code breakdown.
 * Deal coupons (`isDealCoupon`): subtract config `dealCouponFixedAmount` from eligible-line subtotal, then 50% off that remainder;
 * result capped by `maxDiscountAmount` (when set) and cart subtotal.
 */
const DEFAULT_DEAL_COUPON_FIXED_AMOUNT = 199;

function dealCouponFixedAmountFromConfig(): number {
    const n = appConfigService.getSpecialDealConfig()?.dealCouponFixedAmount;
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return n;
    return DEFAULT_DEAL_COUPON_FIXED_AMOUNT;
}

export async function computeDiscountBreakdown(
    lineItems: CartItem[],
    codes: DiscountCode[],
    dealProducts: any[] = [],
): Promise<DiscountBreakdown> {
    const subtotalVal = lineItems.reduce(
        (sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity ?? 0),
        0,
    );
    const categorySubtotals = getCartCategorySubtotalsFromLineItems(lineItems);
    const perCode: DiscountBreakdownPerCode[] = [];
    let discount = 0;
    const dealFixedRupee = dealCouponFixedAmountFromConfig();
    for (const dc of codes) {
        if (dc.applicable === false) continue;
        const isDeal = dc.isDealCoupon === true;
        const val = Number(dc.value ?? 0);
        const isMilestoneOrGift =
            dc.isMilestone ||
            dc.code.toUpperCase().includes('MILESTONE') ||
            dc.code.toUpperCase().includes('FREE');
        if (val <= 0 && (!isMilestoneOrGift || !dc.originalPrice) && !isDeal) continue;

        const categoryKey = dc.applicableCategory?.trim().toLowerCase();
        let baseAmount: number;
        if (isDeal) {
            // Requirement: "discount should be calculated from 1 only" for deal/category products
            const couponAllowedCategories = dc.allowedCategories || [];
            baseAmount = await getSubtotalForDealEligibleLines(lineItems, dc, dealProducts, couponAllowedCategories, { limitToOne: true });
        } else {
            if (dc.allowedCategories?.length) {
                baseAmount = getSubtotalForAllowedCategories(lineItems, dc.allowedCategories, { limitToOne: true });
            } else if (categoryKey) {
                // Calculate subtotal for single applicableCategory, capping to 1 unit TOTAL (highest price)
                const { lineItemMatchesApplicableCategory } = require('@/services/couponService');
                const eligiblePrices = lineItems
                    .filter(item => lineItemMatchesApplicableCategory(item, categoryKey) && Number(item.quantity ?? 0) > 0)
                    .map(item => Number(item.price ?? 0));
                baseAmount = eligiblePrices.length > 0 ? Math.max(...eligiblePrices) : 0;
            } else {
                // General coupon (no category/deal restriction) - apply to full quantity
                baseAmount = subtotalVal;
            }
        }

        let codeDiscount = 0;
        const currentVal = val;

        if (isDeal) {
            // Eligible deal-line selling subtotal (same lines as baseAmount for deal codes).
            console.log("baseAmount", baseAmount);
            const eligibleSubtotal = baseAmount + dealFixedRupee;
            const remainderAfterFixed = Math.max(0, eligibleSubtotal - dealFixedRupee);
            codeDiscount = (0.5 * remainderAfterFixed) + dealFixedRupee;
            if (dc.maxDiscountAmount != null && dc.maxDiscountAmount > 0) {
                codeDiscount = Math.min(codeDiscount, dc.maxDiscountAmount);
            }
            codeDiscount = Math.min(codeDiscount, subtotalVal);
        } else if (currentVal > 0) {
            if (dc.type === 'percentage') {
                codeDiscount = (baseAmount * currentVal) / 100;
            } else {
                codeDiscount = Math.min(currentVal, baseAmount);
            }

            if (dc.maxDiscountAmount != null && dc.maxDiscountAmount > 0) {
                codeDiscount = Math.min(codeDiscount, dc.maxDiscountAmount);
            }
            codeDiscount = Math.min(codeDiscount, subtotalVal);
        }
        const rounded = Math.round(codeDiscount);
        discount += rounded;
        console.log("rounded", rounded);
        perCode.push({
            code: dc.code,
            codeDiscount: rounded,
            isDealCoupon: isDeal,
            isMilestone: dc.isMilestone === true,
            applicable: true,
            type: dc.type,
            value: val,
            baseAmount,
        });
    }
    return {
        total: Math.min(Math.round(discount), subtotalVal),
        perCode,
    };
}

/** Total only; same as {@link computeDiscountBreakdown}(...).total — kept for existing call sites. */
export async function computeNonDealDiscountFromCodes(
    lineItems: CartItem[],
    codes: DiscountCode[],
    dealProducts: any[] = [],
): Promise<number> {
    const res = await computeDiscountBreakdown(lineItems, codes, dealProducts);
    return res.total;
}

function lineItemMatchesVariant(item: CartItem, variantIdNumeric: string): boolean {
    const id = item.variantId;
    return id === variantIdNumeric || id.endsWith(variantIdNumeric) || id === `gid://shopify/ProductVariant/${variantIdNumeric}`;
}

/** Shopify cart line input: booking_date + customAttributes (e.g. Try & Buy trial variant). */
function shopifyLineFromCartItem(item: CartItem): {
    merchandiseId: string;
    quantity: number;
    attributes?: { key: string; value: string }[];
} {
    const attributes: { key: string; value: string }[] = [];
    if (item.bookingDate) {
        attributes.push({ key: 'booking_date', value: item.bookingDate });
    }
    if (item.customAttributes) {
        for (const [key, value] of Object.entries(item.customAttributes)) {
            if (value != null && String(value).length > 0) {
                attributes.push({ key, value: String(value) });
            }
        }
    }
    const line: { merchandiseId: string; quantity: number; attributes?: { key: string; value: string }[] } = {
        merchandiseId: item.variantId,
        quantity: item.quantity,
    };
    if (attributes.length > 0) {
        line.attributes = attributes;
    }
    return line;
}

/** Shopify line attributes with `kiddo_special_deal_promo` omitted (booking_date + Try & Buy attrs preserved). */
function cartLineShopifyAttributesWithoutSpecialDealPromo(item: CartItem): { key: string; value: string }[] {
    const attributes: { key: string; value: string }[] = [];
    if (item.bookingDate) {
        attributes.push({ key: 'booking_date', value: item.bookingDate });
    }
    if (item.customAttributes) {
        for (const [key, value] of Object.entries(item.customAttributes)) {
            if (key === SPECIAL_DEAL_PROMO_CART_ATTR) continue;
            if (value != null && String(value).length > 0) {
                attributes.push({ key, value: String(value) });
            }
        }
    }
    return attributes;
}

/** Client cart row: drop deal-promo attr and restore unit price to variant selling price (stored as compareAt when promo was applied). */
function stripSpecialDealPromoFromCartLine(item: CartItem): CartItem {
    const { [SPECIAL_DEAL_PROMO_CART_ATTR]: _, ...restAttrs } = item.customAttributes || {};
    return {
        ...item,
        customAttributes: restAttrs,
    };
}

// Create store
export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            // Initial state
            id: null,
            webUrl: null,
            checkoutUrl: null,
            lineItems: [],
            giftItems: [],
            discountCodes: [],
            note: '',
            payment: null,
            status: 'init',
            error: null,
            lastSyncedAt: null,
            isTryAndBuy: false,
            giftWrapping: null,
            selectedShoe: null,
            selectedShoeSize: null,
            selectedPuzzleId: null,
            selectedPuzzleAge: null,
            schoolCouponData: null,
            deliverySchedule: null,
            dealProducts: [],
            discountBreakdownSnapshot: { total: 0, perCode: [] },

            refreshComputedDiscountFromCodes: async () => {
                const state = get();
                const breakdown = await computeDiscountBreakdown(
                    state.lineItems,
                    state.discountCodes,
                    state.dealProducts,
                );
                set({
                    discountBreakdownSnapshot: breakdown,
                });
            },

            // Computed getters
            itemCount: () => {
                return get().lineItems.reduce((sum, item) => sum + item.quantity, 0);
            },

            // Calculate MRP (Total of compareAtPrice - original price)
            mrp: () => {
                return get().lineItems.reduce(
                    (sum, item) => {
                        const itemPrice = item.compareAtPrice && item.compareAtPrice > 0
                            ? item.compareAtPrice
                            : item.price; // Fallback to current price if no compareAtPrice
                        return sum + itemPrice * item.quantity;
                    },
                    0
                );
            },
            // Calculate subtotal (Total of current selling price)
            subtotal: () => {
                return get().lineItems.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                );
            },
            shippingFee: () => {
                const state = get();
                const subtotal = state.subtotal();
                const { appConfigService } = require('@/services/appConfigService');
                const hw = appConfigService.getHotWheelConfig();
                if (hw?.isEnabled && subtotal > 0 && subtotal < hw.minCartValue) {
                    return hw.deliveryFee;
                }
                return 0;
            },

            discountAmount: () => {
                const state = get();
                // Return the pre-calculated total from the snapshot to keep this getter synchronous
                return state.discountBreakdownSnapshot?.total ?? 0;
            },

            // Revalidate applied coupons when cart changes; remove any that are no longer eligible.
            validateAppliedDiscountCodes: async () => {
                const state = get();
                const applied = state.discountCodes.filter((dc) => dc.applicable !== false);
                if (applied.length === 0) return;

                const cartSubtotal = state.subtotal();
                const cartItemCount = state.itemCount();
                const hasTicketingProducts = state.lineItems.some((item: CartItem) => {
                    if (item.bookingDate) return true;
                    const hasTicketingTag = item.tags?.some((tag: any) => {
                        const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
                        return tagLower.includes('event') || tagLower.includes('playhouse') || tagLower.includes('petting') || tagLower.includes('farm');
                    });
                    return !!hasTicketingTag;
                });
                const hasClothingItems = state.lineItems.some((item: CartItem) =>
                    item.tags?.some((tag: string) => typeof tag === 'string' && tag.toLowerCase() === 'fashion')
                );
                const categorySubtotalsForApi = getCartCategorySubtotalsFromLineItems(state.lineItems);
                const cartCategoriesForApi = Object.keys(categorySubtotalsForApi).filter(Boolean);

                let userId: string | null = null;
                let userOrderCount = 0;
                let phone: string | null = null;
                try {
                    const { useUserStore } = await import('@/store/userStore');
                    const userStore = useUserStore.getState();
                    const user = userStore.user;
                    if (userStore.status !== 'authenticated' || !user) {
                        set({ discountCodes: [], selectedShoe: null, selectedShoeSize: null, selectedPuzzleId: null, selectedPuzzleAge: null });
                        return;
                    }
                    userId = user.id ?? (user as any).customerId ?? (user as any).phone ?? null;
                    userOrderCount = (user as { numberOfOrders?: number })?.numberOfOrders ?? 0;
                    phone = (user as any).phone ?? null;
                } catch {
                    set({ discountCodes: [], selectedShoe: null, selectedShoeSize: null, selectedPuzzleId: null, selectedPuzzleAge: null });
                    return;
                }

                const couponParams = {
                    phone,
                    cartSubTotal: Math.round(Number(cartSubtotal)) || 0,
                    cartItemCount: Math.max(0, Math.floor(Number(cartItemCount))) || 0,
                    hasTicketing: hasTicketingProducts,
                    hasClothing: hasClothingItems,
                    ...(cartCategoriesForApi.length > 0 ? { cartCategories: cartCategoriesForApi } : {}),
                    ...(Object.keys(categorySubtotalsForApi).length > 0 ? { categorySubtotals: categorySubtotalsForApi } : {}),
                    appVersion: getAppVersionForApi(),
                    deviceType: Platform.OS ?? '',
                };

                const { couponService } = await import('@/services/couponService');
                const stillValid: DiscountCode[] = [];
                for (const dc of applied) {
                    try {
                        const configDiscount = await couponService.validateCouponCode(dc.code, couponParams, { useVisibleCoupons: true });
                        if (!configDiscount) continue;
                        // Same ticketing/clothing/apparel rules as UI (e.g. "Valid for apparel only" when cart has only ticketing)
                        const applicability = couponService.getCouponApplicabilityForDisplay(
                            { ...configDiscount, code: configDiscount.code ?? dc.code, valueType: (configDiscount.valueType === 'fixed_amount' || (configDiscount as any).valueType === 'fixed') ? 'fixed_amount' : (configDiscount.valueType ?? 'percentage') } as import('@/services/couponService').CouponCode,
                            {
                                hasTicketingProducts,
                                hasFashionItems: hasClothingItems,
                                cartSubtotal,
                                cartItemCount,
                                userOrderCount,
                                couponUsageCount: 0,
                                categorySubtotals: categorySubtotalsForApi,
                                lineItems: state.lineItems,
                            }
                        );
                        if (!applicability.applicable) continue;
                        const conditionsResult = await couponService.validateCouponConditions(
                            configDiscount,
                            cartSubtotal,
                            userId,
                            Math.max(0, Math.floor(Number(cartItemCount))) || 0,
                            userOrderCount,
                            categorySubtotalsForApi,
                            state.lineItems,
                        );
                        if (!conditionsResult.isValid) continue;
                        const apiTitle = (configDiscount as { title?: string }).title;
                        const apiDesc = (configDiscount as { description?: string }).description;
                        const couponTitle = apiTitle != null && String(apiTitle).trim() !== '' ? String(apiTitle).trim() : undefined;
                        const couponDescription =
                            apiDesc != null && String(apiDesc).trim() !== '' ? String(apiDesc).trim() : undefined;
                        const cfgAllowed = configDiscount.allowedCategories ?? (configDiscount as any).allowed_categories;
                        const cfgApCat = configDiscount.applicableCategory ?? (configDiscount as any).applicable_category;
                        const snValid = schoolNameFromCouponApi(configDiscount as { schoolName?: string | null; school_name?: string | null });
                        stillValid.push({
                            ...dc,
                            isDealCoupon: couponIsDealCouponFromApi(configDiscount as { isDealCoupon?: boolean; is_deal_coupon?: boolean }, dc.code),
                            ...(couponTitle != null ? { couponTitle } : {}),
                            ...(couponDescription != null ? { couponDescription } : {}),
                            ...(Array.isArray(cfgAllowed) && cfgAllowed.length
                                ? { allowedCategories: cfgAllowed }
                                : {}),
                            ...(cfgApCat != null && String(cfgApCat).trim() !== ''
                                ? { applicableCategory: String(cfgApCat).trim() }
                                : {}),
                            ...(snValid != null ? { schoolName: snValid } : {}),
                        });
                    } catch (_) {
                        // validation failed or network error -> drop this code
                    }
                }

                const shoesUc = appConfigService.getFreeShoesGiftDiscountCodeUppercase();
                const puzUc = appConfigService.getFreePuzzleGiftDiscountCodeUppercase();
                const hadFreeShoesGift = Boolean(shoesUc) && applied.some((dc) => dc.code.toUpperCase() === shoesUc);
                const hasFreeShoesGift = Boolean(shoesUc) && stillValid.some((dc) => dc.code.toUpperCase() === shoesUc);
                const hadPuzzle = applied.some((dc) => dc.code.toUpperCase() === puzUc);
                const hasPuzzle = stillValid.some((dc) => dc.code.toUpperCase() === puzUc);
                set({
                    discountCodes: stillValid,
                    ...(hadFreeShoesGift && !hasFreeShoesGift ? { selectedShoe: null, selectedShoeSize: null } : {}),
                    ...(hadPuzzle && !hasPuzzle ? { selectedPuzzleId: null, selectedPuzzleAge: null } : {}),
                    ...(applied.some(dc => dc.isSchoolCoupon) && !stillValid.some(dc => dc.isSchoolCoupon) ? { schoolCouponData: null } : {}),
                });

                const cartId = state.id;
                if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                    try {
                        await shopifyApi.applyDiscountCodes(cartId, discountCodesForShopifyApply(stillValid));
                    } catch (e) {
                        console.warn('[CartStore] Failed to sync discount codes to Shopify after revalidation', e);
                    }
                }
                get().refreshComputedDiscountFromCodes();
            },

            total: () => {
                const state = get();
                const currentSubtotal = state.subtotal();

                // Use the synchronous discountAmount() which now reads from the snapshot
                return Math.max(0, currentSubtotal - state.discountAmount() + state.shippingFee());
            },

            // Status actions
            setStatus: (status) => set({ status }),
            setError: (error) => set({ error }),

            // Add item
            addItem: async (item) => {
                set({ status: 'loading' });

                try {
                    const state = get();
                    const existingIndex = state.lineItems.findIndex((li) =>
                        cartItemSameLineIdentity(li, item),
                    );

                    const maxQty = typeof item.quantityAvailable === 'number' ? item.quantityAvailable : undefined;
                    if (maxQty !== undefined && maxQty < 1) {
                        set({ status: 'idle', error: null });
                        throw new Error('This item is currently out of stock.');
                    }

                    let newLineItems: CartItem[];

                    if (existingIndex >= 0) {
                        const existing = state.lineItems[existingIndex];
                        const requestedTotal = existing.quantity + item.quantity;
                        const effectiveMax = typeof maxQty === 'number' ? maxQty : (existing.quantityAvailable ?? requestedTotal);
                        const cappedQty = Math.min(requestedTotal, effectiveMax);
                        if (cappedQty <= 0) {
                            set({ status: 'idle', error: null });
                            throw new Error('This item is currently out of stock.');
                        }
                        if (cappedQty < requestedTotal) {
                            set({ status: 'idle', error: null });
                            throw new Error(`Only ${effectiveMax} item(s) available. You already have ${existing.quantity} in cart.`);
                        }
                        newLineItems = state.lineItems.map((li, idx) =>
                            idx === existingIndex
                                ? {
                                    ...li,
                                    quantity: li.quantity + item.quantity,
                                    quantityAvailable: maxQty ?? li.quantityAvailable,
                                }
                                : li
                        );
                    } else {
                        const addQty = maxQty !== undefined ? Math.min(item.quantity, maxQty) : item.quantity;
                        if (addQty < 1) {
                            set({ status: 'idle', error: null });
                            throw new Error('This item is currently out of stock.');
                        }
                        if (maxQty !== undefined && item.quantity > maxQty) {
                            set({ status: 'idle', error: null });
                            throw new Error(`Only ${maxQty} item(s) available.`);
                        }
                        const newItem: CartItem = {
                            ...item,
                            quantity: addQty,
                            quantityAvailable: maxQty,
                            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        };
                        newLineItems = [...state.lineItems, newItem];
                    }

                    set({
                        lineItems: newLineItems,
                        error: null,
                    });
                    
                    // Trigger sync in background to keep UI instant
                    Promise.resolve()
                        .then(() => get().validateAppliedDiscountCodes())
                        .then(() => get().syncDeliveryFeeToShopify())
                        .then(() => get().syncDealPricing())
                        .then(() => get().refreshComputedDiscountFromCodes())
                        .finally(() => set({ status: 'idle' }));

                    try {
                        const { trackEvent } = require('@/utils/mixpanelHelpers');
                        trackEvent('Add to Cart', {
                            productId: item.productId,
                            productName: item.title,
                            variantId: item.variantId,
                            price: item.price,
                            quantity: item.quantity,
                            currency: item.currencyCode || 'INR',
                        });
                    } catch (e) {
                        console.warn('Analytics tracking error:', e);
                    }

                    // Check for eligible gifts after adding item
                    get().applyEligibleGifts();
                    get().syncDealPricing();
                } catch (error: any) {
                    set({ status: 'error', error: error.message });
                }
            },

            // Remove item
            removeItem: async (itemId) => {
                set({ status: 'loading' });

                try {
                    const state = get();
                    const itemToRemove = state.lineItems.find((li) => li.id === itemId);
                    const newLineItems = state.lineItems.filter((li) => li.id !== itemId);

                    // Track remove from cart
                    if (itemToRemove) {
                        try {
                            const { trackRemoveFromCart } = require('@/utils/mixpanelHelpers');
                            trackRemoveFromCart(
                                itemToRemove.productId,
                                itemToRemove.title,
                                itemToRemove.price
                            );
                        } catch (e) {
                            console.warn('Mixpanel tracking error:', e);
                        }
                    }

                    set({
                        lineItems: newLineItems,
                        error: null,
                    });
                    await get().validateAppliedDiscountCodes();
                    await get().syncDealPricing();
                    await get().refreshComputedDiscountFromCodes();
                    await get().syncDeliveryFeeToShopify();
                    set({ status: 'idle' });

                    // Re-check gift eligibility
                    get().applyEligibleGifts();
                } catch (error: any) {
                    set({ status: 'error', error: error.message });
                }
            },

            // Update quantity
            updateQuantity: async (itemId, quantity) => {
                set({ status: 'loading' });

                try {
                    const state = get();

                    if (quantity <= 0) {
                        // Remove item
                        await get().removeItem(itemId);
                        return;
                    }

                    const newLineItems = state.lineItems.map((li) => {
                        if (li.id !== itemId) return li;
                        const maxQty = li.quantityAvailable;
                        const capped = typeof maxQty === 'number' ? Math.min(quantity, maxQty) : quantity;
                        return { ...li, quantity: capped };
                    });

                    set({
                        lineItems: newLineItems,
                        error: null,
                    });
                    
                    // Trigger sync in background to keep UI instant
                    Promise.resolve()
                        .then(() => get().validateAppliedDiscountCodes())
                        .then(() => get().syncDeliveryFeeToShopify())
                        .then(() => get().syncDealPricing())
                        .then(() => get().refreshComputedDiscountFromCodes())
                        .finally(() => set({ status: 'idle' }));

                    // Re-check gift eligibility
                    get().applyEligibleGifts();
                } catch (error: any) {
                    set({ status: 'error', error: error.message });
                }
            },

            updateCartItem: async (itemId, patch) => {
                set({ status: 'loading' });
                try {
                    const state = get();
                    const patchSansUndefined = Object.fromEntries(
                        Object.entries(patch as Record<string, unknown>).filter(([, v]) => v !== undefined),
                    ) as Partial<CartItem>;
                    const newLineItems = state.lineItems.map((li) => {
                        if (li.id !== itemId) return li;
                        const next: CartItem = { ...li, ...patchSansUndefined };
                        if (Object.prototype.hasOwnProperty.call(patchSansUndefined, 'customAttributes')) {
                            const ca = patchSansUndefined.customAttributes;
                            if (!ca || Object.keys(ca).length === 0) {
                                delete next.customAttributes;
                            } else {
                                next.customAttributes = { ...ca };
                            }
                        }
                        return next;
                    });
                    set({
                        lineItems: newLineItems,
                        error: null,
                    });
                    await get().validateAppliedDiscountCodes();
                    await get().applyEligibleGifts();
                    set({ status: 'idle' });
                } catch (error: any) {
                    set({ status: 'error', error: error.message });
                }
            },

            // Clear cart
            clearCart: () => {
                set({
                    id: null,
                    webUrl: null,
                    lineItems: [],
                    giftItems: [],
                    discountCodes: [],
                    note: '',
                    payment: null,
                    status: 'idle',
                    error: null,
                    selectedShoe: null,
                    selectedShoeSize: null,
                    selectedPuzzleId: null,
                    selectedPuzzleAge: null,
                    schoolCouponData: null,
                    deliverySchedule: null,
                });
            },

            // Gift items
            addGiftItem: (gift) => {
                const state = get();
                const exists = state.giftItems.some((g) => g.id === gift.id);
                if (!exists) {
                    set({
                        giftItems: [...state.giftItems, { ...gift, isApplied: false }],
                    });
                }
            },

            removeGiftItem: (giftId) => {
                set({
                    giftItems: get().giftItems.filter((g) => g.id !== giftId),
                });
            },

            applyEligibleGifts: () => {
                const state = get();
                const cartSubtotal = state.subtotal();

                // Check which gifts are eligible
                const updatedGifts = AVAILABLE_GIFTS.map((gift) => ({
                    ...gift,
                    isApplied: gift.minCartValue ? cartSubtotal >= gift.minCartValue : true,
                }));

                // Only add new gifts, don't remove user-selected ones
                const currentGiftIds = state.giftItems.map((g) => g.id);
                const newGifts = updatedGifts.filter(
                    (g) => g.isApplied && !currentGiftIds.includes(g.id)
                );

                // Update existing gifts' applied status
                const existingUpdated = state.giftItems.map((existing) => {
                    const match = updatedGifts.find((u) => u.id === existing.id);
                    return match ? { ...existing, isApplied: match.isApplied } : existing;
                });

                set({
                    giftItems: [...existingUpdated, ...newGifts.map((g) => ({ ...g, isApplied: true }))],
                });
            },

            // Discount codes
            applyDiscountCode: async (code, options) => {
                const state = get();
                const normalizedCode = code.trim().toUpperCase();
                console.log('[CartStore] Normalized code:', normalizedCode);
                console.log('[CartStore] Current cart state:', {
                    cartId: state.id,
                    lineItemsCount: state.lineItems.length,
                    currentDiscountCodes: state.discountCodes,
                    currentPayment: state.payment,
                });

                // Build params for backend validation
                const cartSubtotal = state.subtotal();
                const cartItemCount = state.itemCount();
                const hasTicketingProducts = state.lineItems.some(item => {
                    if (item.bookingDate) return true;
                    const hasTicketingTag = item.tags?.some((tag: any) => {
                        const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
                        return tagLower.includes('event') || tagLower.includes('playhouse') ||
                            tagLower.includes('petting') || tagLower.includes('farm');
                    });
                    return !!hasTicketingTag;
                });

                // CHECK: User must be logged in to apply coupons
                try {
                    const { useUserStore } = await import('@/store/userStore');
                    const userStore = useUserStore.getState();
                    const isAuthenticated = userStore.status === 'authenticated' && userStore.user !== null;

                    if (!isAuthenticated) {
                        console.log('[CartStore] ❌ User not logged in - cannot apply coupon');
                        return {
                            success: false,
                            error: 'Please login or create an account to use discount coupons.'
                        };
                    }
                } catch (error) {
                    console.error('[CartStore] Error checking authentication:', error);
                    return { success: false, error: 'Failed to verify authentication.' };
                }

                // Validate with backend
                let configDiscount: any = null;
                const categorySubtotalsForApi = getCartCategorySubtotalsFromLineItems(state.lineItems);
                const cartCategoriesForApi = Object.keys(categorySubtotalsForApi).filter(Boolean);

                try {
                    const { couponService } = await import('@/services/couponService');
                    const { useUserStore } = await import('@/store/userStore');
                    const userStore = useUserStore.getState();
                    const phone = userStore.user?.phone ?? null;
                    const couponParams = {
                        phone,
                        cartSubTotal: Math.round(Number(cartSubtotal)) || 0,
                        cartItemCount: Math.max(0, Math.floor(Number(cartItemCount))) || 0,
                        hasTicketing: hasTicketingProducts,
                        hasClothing: get().lineItems.some(item => item.tags?.some(tag => tag.toLowerCase() === 'fashion')),
                        ...(cartCategoriesForApi.length > 0 ? { cartCategories: cartCategoriesForApi } : {}),
                        ...(Object.keys(categorySubtotalsForApi).length > 0 ? { categorySubtotals: categorySubtotalsForApi } : {}),
                        appVersion: getAppVersionForApi(),
                        deviceType: Platform.OS ?? '',
                    };
                    configDiscount = await couponService.validateCouponCode(normalizedCode, couponParams, { useVisibleCoupons: true });
                } catch (error) {
                    console.error('[CartStore] Error validating code:', error);
                    return { success: false, error: 'Failed to validate discount code.' };
                }

                if (!configDiscount) {
                    return { success: false, error: 'This discount code is not valid.' };
                }

                const codeToApply = String(configDiscount.code ?? code).trim();

                // Check if code is already applied
                const isAlreadyApplied = state.discountCodes.some(
                    (dc) => dc.code.toUpperCase() === normalizedCode && dc.applicable !== false
                );
                if (isAlreadyApplied) {
                    return { success: false, error: 'Discount code already applied' };
                }

                /* Deal coupons: no Shopify discount — local flag only + special-offer modal in UI. */
                if (couponIsDealCouponFromApi(configDiscount)) {
                    const { couponService } = await import('@/services/couponService');
                    const { useUserStore } = await import('@/store/userStore');
                    const userStore = useUserStore.getState();
                    const user = userStore.user;
                    let userId: string | null = null;
                    let userOrderCount = 0;
                    if (userStore.status === 'authenticated' && user) {
                        userId = user.id ?? (user as any).customerId ?? (user as any).phone ?? null;
                        userOrderCount = (user as { numberOfOrders?: number })?.numberOfOrders ?? 0;
                    }

                    const hasClothingItemsDeal = state.lineItems.some((item: CartItem) =>
                        item.tags?.some((tag: string) => typeof tag === 'string' && tag.toLowerCase() === 'fashion'),
                    );

                    const couponForApplicability = {
                        ...configDiscount,
                        code: configDiscount.code ?? codeToApply,
                        valueType:
                            configDiscount.valueType === 'fixed_amount' ||
                                (configDiscount as any).valueType === 'fixed'
                                ? 'fixed_amount'
                                : (configDiscount.valueType ?? 'percentage'),
                    } as import('@/services/couponService').CouponCode;

                    const dealApplicability = couponService.getCouponApplicabilityForDisplay(couponForApplicability, {
                        hasTicketingProducts,
                        hasFashionItems: hasClothingItemsDeal,
                        cartSubtotal,
                        cartItemCount,
                        userOrderCount,
                        couponUsageCount: 0,
                        categorySubtotals: categorySubtotalsForApi,
                        lineItems: state.lineItems,
                    });
                    if (!dealApplicability.applicable) {
                        return {
                            success: false,
                            error: dealApplicability.reason || 'This offer is not applicable to your cart.',
                        };
                    }

                    const dealConditions = await couponService.validateCouponConditions(
                        couponForApplicability,
                        cartSubtotal,
                        userId,
                        Math.max(0, Math.floor(Number(cartItemCount))) || 0,
                        userOrderCount,
                        categorySubtotalsForApi,
                        state.lineItems,
                    );
                    if (!dealConditions.isValid) {
                        return {
                            success: false,
                            error: dealConditions.error || 'This offer is not valid for your cart.',
                        };
                    }

                    const cartId = await get().ensureCart();
                    if (!cartId) {
                        return { success: false, error: 'Cart not found. Please add items to cart first.' };
                    }

                    const base = state.discountCodes.filter((dc) => dc.isDealCoupon !== true);
                    const cfgT = (configDiscount as { title?: string }).title;
                    const cfgD = (configDiscount as { description?: string }).description;
                    const cTitle = cfgT != null && String(cfgT).trim() !== '' ? String(cfgT).trim() : undefined;
                    const cDesc = cfgD != null && String(cfgD).trim() !== '' ? String(cfgD).trim() : undefined;

                    const backendDealVal = Number(configDiscount.value ?? 0);
                    const btDeal = (configDiscount.valueType ?? 'percentage').toString().toLowerCase();
                    const backendDealType: 'percentage' | 'fixed' =
                        btDeal === 'fixed' || btDeal === 'fixed_amount' || btDeal === 'fixed amount'
                            ? 'fixed'
                            : 'percentage';

                    const dealSchool = schoolNameFromCouponApi(configDiscount);
                    const dealEntry: DiscountCode = {
                        code: codeToApply,
                        type: backendDealType,
                        value: Number.isFinite(backendDealVal) ? backendDealVal : 0,
                        appliedAt: Date.now(),
                        isDealCoupon: true,
                        applicable: true,
                        ...(cTitle != null ? { couponTitle: cTitle } : {}),
                        ...(cDesc != null ? { couponDescription: cDesc } : {}),
                        ...(configDiscount.applicableCategory != null &&
                            String(configDiscount.applicableCategory).trim() !== ''
                            ? { applicableCategory: String(configDiscount.applicableCategory).trim() }
                            : {}),
                        ...(configDiscount.allowedCategories?.length
                            ? { allowedCategories: configDiscount.allowedCategories }
                            : {}),
                        ...(configDiscount.maxDiscountAmount != null
                            ? { maxDiscountAmount: Number(configDiscount.maxDiscountAmount) }
                            : {}),
                        ...(configDiscount.isSchoolCoupon === true ? { isSchoolCoupon: true } : {}),
                        ...(dealSchool != null ? { schoolName: dealSchool } : {}),
                    };
                    const merged = [...base, dealEntry];

                    const shoesGift = appConfigService.getFreeShoesGiftDiscountCodeUppercase();
                    const puzzleGift = appConfigService.getFreePuzzleGiftDiscountCodeUppercase();

                    set({
                        status: 'loading',
                        discountCodes: merged,
                        ...(shoesGift && codeToApply.toUpperCase() !== shoesGift
                            ? { selectedShoe: null, selectedShoeSize: null }
                            : {}),
                        ...(puzzleGift && codeToApply.toUpperCase() !== puzzleGift
                            ? { selectedPuzzleId: null, selectedPuzzleAge: null }
                            : {}),
                    });

                    if (!cartId.startsWith('gid://shopify/Cart/')) {
                        const subtotal = get().subtotal();
                        const discount = get().discountAmount();
                        const tax = get().payment?.tax ?? 0;
                        const currencyCode = get().payment?.currencyCode || 'INR';
                        const shipping = get().shippingFee();
                        set({
                            payment: {
                                subtotal,
                                discount,
                                shipping,
                                tax,
                                total: Math.max(0, subtotal - discount + shipping + tax),
                                currencyCode,
                            },
                            error: null,
                            lastSyncedAt: Date.now(),
                        });
                        await get().syncDeliveryFeeToShopify();
                        // Trigger sync in background so modal opens instantly
                        get().syncDealPricing({ forceFetch: true }).finally(() => set({ status: 'idle' }));
                        return { success: true };
                    }

                    try {
                        const resolvedDealCartId = get().id;
                        const shopifyDealCartId: string =
                            resolvedDealCartId != null &&
                                resolvedDealCartId.startsWith('gid://shopify/Cart/')
                                ? resolvedDealCartId
                                : cartId;

                        await shopifyApi.applyDiscountCodes(
                            shopifyDealCartId,
                            discountCodesForShopifyApply(merged),
                        );

                        // Don't block on fetchCart — full Shopify hydration is slow and delays opening the deal promo UI.
                        const subtotal = get().subtotal();
                        const discount = get().discountAmount();
                        const tax = get().payment?.tax ?? 0;
                        const currencyCode = get().payment?.currencyCode || 'INR';
                        const shipping = get().shippingFee();
                        set({
                            error: null,
                            lastSyncedAt: Date.now(),
                            payment: {
                                subtotal,
                                discount,
                                shipping,
                                tax,
                                total: Math.max(0, subtotal - discount + shipping + tax),
                                currencyCode,
                            },
                        });
                        await get().syncDeliveryFeeToShopify();
                        // fetchCart in background to avoid delaying modal opening
                        get().fetchCart().finally(() => set({ status: 'idle' }));
                        return { success: true };
                    } catch (error: any) {
                        console.error('[CartStore] Deal coupon apply error:', error);
                        set({ status: 'idle', error: error?.message });
                        return { success: false, error: error?.message || 'Failed to apply offer code.' };
                    }
                }

                // Non-deal: require allowed categories + minimum purchase (and other rules) before Shopify / local state change.
                {
                    const { couponService } = await import('@/services/couponService');
                    const { useUserStore } = await import('@/store/userStore');
                    const userStore = useUserStore.getState();
                    const user = userStore.user;
                    let userIdApply: string | null = null;
                    let userOrderCountApply = 0;
                    if (userStore.status === 'authenticated' && user) {
                        userIdApply = user.id ?? (user as any).customerId ?? (user as any).phone ?? null;
                        userOrderCountApply = (user as { numberOfOrders?: number })?.numberOfOrders ?? 0;
                    }
                    const hasClothingForApply = state.lineItems.some((item) =>
                        item.tags?.some(
                            (tag: string) => typeof tag === 'string' && tag.toLowerCase() === 'fashion',
                        ),
                    );
                    const couponForApplyRules = {
                        ...configDiscount,
                        code: configDiscount.code ?? codeToApply,
                        valueType:
                            configDiscount.valueType === 'fixed_amount' ||
                                (configDiscount as any).valueType === 'fixed'
                                ? 'fixed_amount'
                                : (configDiscount.valueType ?? 'percentage'),
                    } as import('@/services/couponService').CouponCode;

                    const displayApply = couponService.getCouponApplicabilityForDisplay(couponForApplyRules, {
                        hasTicketingProducts,
                        hasFashionItems: hasClothingForApply,
                        cartSubtotal,
                        cartItemCount,
                        userOrderCount: userOrderCountApply,
                        couponUsageCount: 0,
                        categorySubtotals: categorySubtotalsForApi,
                        lineItems: state.lineItems,
                    });
                    if (!displayApply.applicable) {
                        return {
                            success: false,
                            error: displayApply.reason || 'This coupon is not applicable to your cart.',
                        };
                    }

                    const conditionsApply = await couponService.validateCouponConditions(
                        couponForApplyRules,
                        cartSubtotal,
                        userIdApply,
                        Math.max(0, Math.floor(Number(cartItemCount))) || 0,
                        userOrderCountApply,
                        categorySubtotalsForApi,
                        state.lineItems,
                    );
                    if (!conditionsApply.isValid) {
                        return {
                            success: false,
                            error: conditionsApply.error || 'This coupon is not valid for your cart.',
                        };
                    }
                }

                let nextDiscountCodes: DiscountCode[];
                const stubSchool = schoolNameFromCouponApi(configDiscount);
                const newEntryStub: DiscountCode = {
                    code: codeToApply,
                    type: 'percentage',
                    value: 0,
                    appliedAt: Date.now(),
                    isDealCoupon: couponIsDealCouponFromApi(configDiscount),
                    ...(stubSchool != null ? { schoolName: stubSchool } : {}),
                };
                nextDiscountCodes = [newEntryStub];

                const cartId = await get().ensureCart();
                if (!cartId) {
                    return { success: false, error: 'Cart not found. Please add items to cart first.' };
                }

                // Initial state update to clear conflicting gifts
                {
                    const shoesGift = appConfigService.getFreeShoesGiftDiscountCodeUppercase();
                    const puzzleGift = appConfigService.getFreePuzzleGiftDiscountCodeUppercase();

                    set({
                        discountCodes: nextDiscountCodes,
                        ...(shoesGift && codeToApply.toUpperCase() !== shoesGift
                            ? { selectedShoe: null, selectedShoeSize: null }
                            : {}),
                        ...(puzzleGift && codeToApply.toUpperCase() !== puzzleGift
                            ? { selectedPuzzleId: null, selectedPuzzleAge: null }
                            : {}),
                    });
                }

                const hasClothingItems = state.lineItems.some(item => {
                    return item.tags?.some(
                        (tag: string) => typeof tag === 'string' && tag.toLowerCase() === 'fashion'
                    );
                });

                let cartForCost: { cost?: { subtotalAmount?: { amount: string }; totalTaxAmount?: { amount: string }; totalAmount?: { amount: string; currencyCode: string } }; checkoutUrl?: string } | null = null;
                const isShopifyCartId = cartId.startsWith('gid://shopify/Cart/');
                if (!isShopifyCartId && state.lineItems.length > 0) {
                    const lines = state.lineItems.map(shopifyLineFromCartItem);
                    const newCart = await shopifyApi.createCart(lines);
                    if (newCart?.id) {
                        set({ id: newCart.id, webUrl: newCart.checkoutUrl, checkoutUrl: newCart.checkoutUrl });
                    }
                }

                let codesToApply: string[] = [];
                set({ status: 'loading' });

                try {
                    // Get current cart to see existing discount codes
                    let currentCart;
                    try {
                        currentCart = await shopifyApi.getCart(cartId);
                    } catch (cartError: any) {
                        // If cart fetch fails, it might be expired or invalid
                        // Try to recreate the cart if we have items
                        if (state.lineItems.length > 0) {
                            let lines = state.lineItems.map(shopifyLineFromCartItem);
                            let newCart = null;
                            try {
                                newCart = await shopifyApi.createCart(lines);
                            } catch (createErr: any) {
                                const invalidVariantId = parseInvalidVariantFromError(createErr?.message || '');
                                if (invalidVariantId) {
                                    const kept = state.lineItems.filter((item) => !lineItemMatchesVariant(item, invalidVariantId));
                                    if (kept.length < state.lineItems.length) {
                                        set({ lineItems: kept });
                                        lines = kept.map(shopifyLineFromCartItem);
                                        if (lines.length > 0) newCart = await shopifyApi.createCart(lines);
                                    }
                                }
                                if (!newCart) throw createErr;
                            }
                            if (newCart?.id) {
                                set({ id: newCart.id, webUrl: newCart.checkoutUrl, checkoutUrl: newCart.checkoutUrl });
                                currentCart = newCart;
                            } else {
                                throw new Error('Failed to recreate cart. Please try again.');
                            }
                        } else {
                            throw new Error(cartError.message || 'Failed to fetch cart. Please try again.');
                        }
                    }

                    if (!currentCart) {
                        throw new Error('Failed to fetch cart');
                    }

                    // Get already applied applicable codes (Shopify return casing preserved for re-submit)
                    const alreadyAppliedRaw = (currentCart.discountCodes || [])
                        .filter((dc: any) => dc.applicable && dc.code)
                        .map((dc: any) => String(dc.code).trim());
                    console.log('[CartStore] Already applied codes:', alreadyAppliedRaw);

                    // Check if code is already applied
                    if (alreadyAppliedRaw.some((c) => c.toUpperCase() === normalizedCode)) {
                        console.log('[CartStore] ❌ Code already applied');
                        set({ status: 'idle' });
                        return { success: false, error: 'Discount code already applied' };
                    }

                    const shopifyCodesBeforeApply = [...alreadyAppliedRaw];

                    // Only apply the new code
                    codesToApply = [codeToApply];
                    console.log('[CartStore] Codes to apply to Shopify:', codesToApply);

                    const lineItemsForCoupons = get().lineItems;
                    const categorySubtotalsEligible = getCartCategorySubtotalsFromLineItems(lineItemsForCoupons);
                    const { couponService } = await import('@/services/couponService');
                    const { useUserStore } = await import('@/store/userStore');
                    const phone = useUserStore.getState().user?.phone ?? null;

                    /** Runs in parallel with Shopify apply — sequential was doubling perceived latency for manual entry. */
                    const eligibleCouponsPromise = couponService.getEligibleCouponsFromBackend({
                        phone,
                        cartSubTotal: cartSubtotal,
                        cartItemCount,
                        hasTicketing: hasTicketingProducts,
                        hasClothing: hasClothingItems,
                        cartCategories: getCartCategoriesFromLineItems(lineItemsForCoupons),
                        ...(Object.keys(categorySubtotalsEligible).length > 0
                            ? { categorySubtotals: categorySubtotalsEligible }
                            : {}),
                        appVersion: getAppVersionForApi(),
                        deviceType: Platform.OS ?? '',
                        includeHiddenCoupons: true,
                    });

                    const resolvedCartId = get().id;
                    const shopifyCartIdForApply: string =
                        resolvedCartId != null &&
                            resolvedCartId.startsWith('gid://shopify/Cart/')
                            ? resolvedCartId
                            : cartId;

                    console.log('[CartStore] Calling shopifyApi.applyDiscountCodes with:', {
                        cartId: shopifyCartIdForApply,
                        codesToApply,
                    });
                    const updatedCart = await shopifyApi.applyDiscountCodes(shopifyCartIdForApply, codesToApply);
                    console.log('[CartStore] Shopify API response:', {
                        hasCart: !!updatedCart,
                        discountCodes: updatedCart?.discountCodes,
                        discountAllocations: updatedCart?.discountAllocations,
                        cost: updatedCart?.cost,
                    });

                    if (!updatedCart) {
                        throw new Error('Failed to apply discount code');
                    }

                    const revertShopifyDiscountAndRestoreLocal = async (
                        errorMessage: string,
                    ): Promise<{ success: false; error: string }> => {
                        const rid = get().id;
                        const cartIdRev: string =
                            rid != null && rid.startsWith('gid://shopify/Cart/') ? rid : cartId;
                        try {
                            await shopifyApi.applyDiscountCodes(cartIdRev, shopifyCodesBeforeApply);
                        } catch (e) {
                            console.warn('[CartStore] Failed to revert Shopify discount after rejected apply', e);
                        }
                        const lineItemsSubtotalRev = state.lineItems.reduce(
                            (sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity),
                            0,
                        );
                        const discountRev = await computeNonDealDiscountFromCodes(
                            state.lineItems,
                            state.discountCodes,
                            state.dealProducts,
                        );
                        const taxRev = parseFloat(updatedCart.cost?.totalTaxAmount?.amount || '0');
                        set({
                            discountCodes: state.discountCodes,
                            payment: {
                                subtotal: lineItemsSubtotalRev,
                                discount: discountRev,
                                shipping: 0,
                                tax: taxRev,
                                total: Math.max(0, lineItemsSubtotalRev - discountRev) + taxRev,
                                currencyCode: updatedCart.cost?.totalAmount?.currencyCode || 'INR',
                            },
                            status: 'idle',
                            error: null,
                            lastSyncedAt: Date.now(),
                        });
                        return { success: false, error: errorMessage };
                    };

                    let eligibleCoupons: import('@/services/couponService').CouponCode[] = [];
                    try {
                        eligibleCoupons = await eligibleCouponsPromise;
                    } catch (e) {
                        console.warn(
                            '[CartStore] getEligibleCouponsFromBackend failed after Shopify apply; using validation payload where needed',
                            e,
                        );
                    }
                    const backendCouponMap = new Map(eligibleCoupons.map((c: any) => [c.code?.toUpperCase(), c]));
                    const validatedCodeUpper = String(configDiscount?.code ?? codeToApply).trim().toUpperCase();
                    if (validatedCodeUpper && !backendCouponMap.has(validatedCodeUpper)) {
                        backendCouponMap.set(validatedCodeUpper, configDiscount as import('@/services/couponService').CouponCode);
                    }

                    // Calculate total discount from all allocations (sum all discountAllocations)
                    const totalDiscountAmount = (updatedCart.discountAllocations || []).reduce((sum: number, allocation: any) => {
                        return sum + parseFloat(allocation.discountedAmount?.amount || '0');
                    }, 0);
                    console.log('[CartStore] Total discount from allocations:', totalDiscountAmount);

                    // subtotalAmount from Shopify is the subtotal BEFORE discount (current selling prices)
                    const subtotalBeforeDiscount = parseFloat(updatedCart.cost?.subtotalAmount?.amount || '0');
                    const subtotalAfterDiscount = subtotalBeforeDiscount - totalDiscountAmount;
                    console.log('[CartStore] Subtotal calculations:', {
                        subtotalBeforeDiscount,
                        subtotalAfterDiscount,
                        totalDiscountAmount,
                    });

                    // Extract discount codes from response
                    console.log('[CartStore] Processing discount codes from cart response...');
                    const discountCodesFromCart = (updatedCart.discountCodes || []).map((dc: any) => {
                        console.log(`[CartStore] Processing code: ${dc.code}, Shopify applicable: ${dc.applicable}`);

                        const matchingAllocation = (updatedCart.discountAllocations || []).find((alloc: any) => {
                            return alloc.code?.toUpperCase() === dc.code.toUpperCase();
                        });
                        console.log(`[CartStore] Matching allocation for ${dc.code}:`, matchingAllocation);

                        let discountType: 'percentage' | 'fixed' | 'shipping' | 'bogo' = 'percentage';
                        let discountValue = 0;
                        let isApplicable = dc.applicable !== false;
                        let foundInBackend = false;

                        const backendCoupon = backendCouponMap.get(dc.code?.toUpperCase());
                        if (backendCoupon) {
                            foundInBackend = true;
                            discountValue = Number(backendCoupon.value ?? 0);
                            const bt = (backendCoupon.valueType ?? 'percentage').toString().toLowerCase();
                            discountType = (bt === 'fixed' || bt === 'fixed_amount' || bt === 'fixed amount') ? 'fixed' : 'percentage';
                            isApplicable = true;
                            console.log(`[CartStore] ${dc.code}: Using backend coupon - type: ${discountType}, value: ${discountValue}`);
                        }

                        if (!foundInBackend && discountValue === 0 && matchingAllocation) {
                            const discountApp = matchingAllocation.discountApplication;
                            console.log(`[CartStore] Discount application for ${dc.code}:`, discountApp);
                            if (discountApp?.value?.percentage !== undefined) {
                                // Percentage discount
                                discountValue = discountApp.value.percentage;
                                discountType = 'percentage';
                                console.log(`[CartStore] ${dc.code}: Using Shopify percentage discount ${discountValue}%`);
                            } else if (discountApp?.value?.amount) {
                                // Fixed amount discount
                                discountValue = parseFloat(discountApp.value.amount);
                                discountType = 'fixed';
                                console.log(`[CartStore] ${dc.code}: Using Shopify fixed discount ${discountValue}`);
                            } else if (matchingAllocation.discountedAmount?.amount) {
                                // Fallback: try to infer from discounted amount
                                // Note: subtotalAmount is AFTER discounts, so we need to add discount back to get original subtotal
                                const discountAmount = parseFloat(matchingAllocation.discountedAmount.amount);

                                if (subtotalBeforeDiscount > 0 && discountAmount > 0) {
                                    // Calculate percentage from original subtotal (before discount)
                                    discountValue = Math.round((discountAmount / subtotalBeforeDiscount) * 100);
                                    discountType = 'percentage';
                                    console.log(`[CartStore] ${dc.code}: Calculated percentage ${discountValue}% from amount ${discountAmount}`);
                                } else {
                                    discountValue = discountAmount;
                                    discountType = 'fixed';
                                    console.log(`[CartStore] ${dc.code}: Fixed discount ${discountValue} (fallback)`);
                                }
                            }
                        }

                        if (discountValue === 0) {
                            console.log(`[CartStore] ⚠️ No discount value found for ${dc.code}`);
                        }
                        const existing2 = state.discountCodes.find((d) => d.code.toUpperCase() === dc.code?.toUpperCase());
                        const maxCap2 =
                            backendCoupon?.maxDiscountAmount != null
                                ? Number(backendCoupon.maxDiscountAmount)
                                : existing2?.maxDiscountAmount != null
                                    ? Number(existing2.maxDiscountAmount)
                                    : undefined;
                        const rawOrig2 = backendCoupon?.originalPrice ?? (backendCoupon as any)?.original_price;
                        const origPrice2 = typeof rawOrig2 === 'number' && Number.isFinite(rawOrig2) ? rawOrig2 : typeof rawOrig2 === 'string' ? parseFloat(rawOrig2) : undefined;
                        const originalPrice2 = options?.originalPrice ?? origPrice2 ?? existing2?.originalPrice;
                        const bT2 = (backendCoupon as { title?: string } | undefined)?.title;
                        const bD2 = (backendCoupon as { description?: string } | undefined)?.description;
                        const cTitle2 =
                            (bT2 != null && String(bT2).trim() !== '' ? String(bT2).trim() : undefined) ?? existing2?.couponTitle;
                        const cDesc2 =
                            (bD2 != null && String(bD2).trim() !== '' ? String(bD2).trim() : undefined)
                            ?? existing2?.couponDescription;
                        const schoolFromBackend = schoolNameFromCouponApi(backendCoupon as { schoolName?: string | null; school_name?: string | null });
                        const schoolLine = schoolFromBackend ?? existing2?.schoolName;
                        return {
                            code: String(dc.code ?? '').trim(),
                            type: discountType,
                            value: discountValue,
                            applicable: isApplicable,
                            appliedAt: Date.now(),
                            maxDiscountAmount: maxCap2,
                            ...(originalPrice2 != null ? { originalPrice: originalPrice2 } : {}),
                            ...(backendCoupon?.applicableCategory != null
                                ? { applicableCategory: backendCoupon.applicableCategory }
                                : existing2?.applicableCategory != null
                                    ? { applicableCategory: existing2.applicableCategory }
                                    : {}),
                            ...(backendCoupon?.allowedCategories?.length
                                ? { allowedCategories: backendCoupon.allowedCategories }
                                : existing2?.allowedCategories?.length
                                    ? { allowedCategories: existing2.allowedCategories }
                                    : {}),
                            ...(cTitle2 != null && cTitle2 !== '' ? { couponTitle: cTitle2 } : {}),
                            ...(cDesc2 != null && cDesc2 !== '' ? { couponDescription: cDesc2 } : {}),
                            ...(schoolLine != null && String(schoolLine).trim() !== ''
                                ? { schoolName: String(schoolLine).trim() }
                                : {}),
                        };
                    });

                    // If code is missing from Shopify response or marked inapplicable, do not force-apply from backend
                    // (category / minimum purchase must be respected).
                    const codeInResponse = discountCodesFromCart.find(
                        (dc: DiscountCode) => dc.code.toUpperCase() === normalizedCode
                    );

                    if (configDiscount) {
                        const backendValue = Number(configDiscount.value ?? 0);
                        const bt = (configDiscount.valueType ?? 'percentage').toString().toLowerCase();
                        const backendType: 'percentage' | 'fixed' =
                            bt === 'fixed' || bt === 'fixed_amount' || bt === 'fixed amount' ? 'fixed' : 'percentage';
                        const rawBackendOrig = options?.originalPrice ?? configDiscount.originalPrice ?? (configDiscount as any).original_price;
                        const backendOrig = typeof rawBackendOrig === 'number' && Number.isFinite(rawBackendOrig) ? rawBackendOrig : typeof rawBackendOrig === 'string' ? parseFloat(rawBackendOrig) : undefined;
                        const cfgT2 = (configDiscount as { title?: string }).title;
                        const cfgD2 = (configDiscount as { description?: string }).description;
                        const cT2 = cfgT2 != null && String(cfgT2).trim() !== '' ? String(cfgT2).trim() : undefined;
                        const cD2 = cfgD2 != null && String(cfgD2).trim() !== '' ? String(cfgD2).trim() : undefined;
                        const backendSchool = schoolNameFromCouponApi(configDiscount);
                        const backendEntry: DiscountCode = {
                            code: codeToApply,
                            type: backendType,
                            value: backendValue,
                            applicable: true,
                            appliedAt: Date.now(),
                            maxDiscountAmount: configDiscount.maxDiscountAmount != null ? Number(configDiscount.maxDiscountAmount) : undefined,
                            ...(backendOrig != null ? { originalPrice: backendOrig } : {}),
                            ...(configDiscount.applicableCategory != null ? { applicableCategory: configDiscount.applicableCategory } : {}),
                            ...(configDiscount.allowedCategories?.length ? { allowedCategories: configDiscount.allowedCategories } : {}),
                            isSchoolCoupon: configDiscount.isSchoolCoupon === true,
                            isMilestone: configDiscount.isMilestone === true || codeToApply.toUpperCase() === 'FOURTHMILESTONE',
                            isDealCoupon: couponIsDealCouponFromApi(configDiscount, codeToApply),
                            ...(cT2 != null ? { couponTitle: cT2 } : {}),
                            ...(cD2 != null ? { couponDescription: cD2 } : {}),
                            ...(backendSchool != null ? { schoolName: backendSchool } : {}),
                        };
                        if (!codeInResponse) {
                            console.warn(
                                '[CartStore] Code not in Shopify response after apply (not injecting from backend):',
                                normalizedCode,
                            );
                        } else if (codeInResponse.applicable === false) {
                            // Keep Shopify row; revert happens below — never replace with backend applicable: true.
                        } else if (codeInResponse.value === 0) {
                            console.log('[CartStore] Code in response with zero value, filling from backend:', normalizedCode);
                            const idx = discountCodesFromCart.findIndex(
                                (dc: DiscountCode) => dc.code.toUpperCase() === normalizedCode
                            );
                            if (idx !== -1) discountCodesFromCart[idx] = backendEntry;
                        } else {
                            const idx = discountCodesFromCart.findIndex(
                                (dc: DiscountCode) => dc.code.toUpperCase() === normalizedCode
                            );
                            if (idx !== -1) {
                                const t2 = (configDiscount as { title?: string }).title;
                                const d2 = (configDiscount as { description?: string }).description;
                                const ct2 = t2 != null && String(t2).trim() !== '' ? String(t2).trim() : undefined;
                                const cd2 = d2 != null && String(d2).trim() !== '' ? String(d2).trim() : undefined;
                                const mergeSchool = schoolNameFromCouponApi(configDiscount);
                                discountCodesFromCart[idx] = {
                                    ...discountCodesFromCart[idx],
                                    ...(configDiscount.applicableCategory != null ? { applicableCategory: configDiscount.applicableCategory } : {}),
                                    ...(configDiscount.allowedCategories?.length ? { allowedCategories: configDiscount.allowedCategories } : {}),
                                    isSchoolCoupon: configDiscount.isSchoolCoupon === true,
                                    isMilestone: configDiscount.isMilestone === true || codeToApply.toUpperCase() === 'FOURTHMILESTONE',
                                    isDealCoupon: couponIsDealCouponFromApi(configDiscount, codeToApply),
                                    ...(ct2 != null ? { couponTitle: ct2 } : {}),
                                    ...(cd2 != null ? { couponDescription: cd2 } : {}),
                                    ...(mergeSchool != null ? { schoolName: mergeSchool } : {}),
                                };
                            }
                        }
                    }

                    const appliedNormRow = discountCodesFromCart.find(
                        (dc: DiscountCode) => dc.code.toUpperCase() === normalizedCode,
                    );
                    if (!appliedNormRow) {
                        return await revertShopifyDiscountAndRestoreLocal(
                            'This discount code could not be applied to your cart.',
                        );
                    }
                    if (appliedNormRow.applicable === false) {
                        return await revertShopifyDiscountAndRestoreLocal(
                            'This coupon does not apply to your cart. Check eligible categories and minimum purchase.',
                        );
                    }

                    const lineItemsSubtotal = state.lineItems.reduce((sum, item) => {
                        return sum + (Number(item.price ?? 0) * Number(item.quantity));
                    }, 0);
                    const recalcDiscount = await computeNonDealDiscountFromCodes(state.lineItems, discountCodesFromCart, state.dealProducts);
                    const taxAmount = parseFloat(updatedCart.cost?.totalTaxAmount?.amount || '0');
                    const updatedPayment: CartPayment = {
                        subtotal: lineItemsSubtotal,
                        discount: recalcDiscount,
                        shipping: 0,
                        tax: taxAmount,
                        total: Math.max(0, lineItemsSubtotal - recalcDiscount) + taxAmount,
                        currencyCode: updatedCart.cost?.totalAmount?.currencyCode || 'INR',
                    };

                    // Real Shopify coupons replace client-only deal stubs — do not re-attach isDealCoupon rows.

                    const hasSchoolCoupon = discountCodesFromCart.some((dc: any) => dc.isSchoolCoupon);
                    set({
                        discountCodes: discountCodesFromCart,
                        payment: updatedPayment,
                        checkoutUrl: updatedCart.checkoutUrl || state.checkoutUrl,
                        error: null,
                        lastSyncedAt: Date.now(),
                        ...(!hasSchoolCoupon ? { schoolCouponData: null } : {}),
                    });
                    await get().syncDeliveryFeeToShopify();
                    await get().syncDealPricing();
                    await get().validateAppliedDiscountCodes();
                    set({ status: 'idle' });
                    console.log('[CartStore] ✅ Code successfully applied (existing cart path)');
                    return { success: true };
                } catch (error: any) {
                    console.error('[CartStore] Error applying discount code to existing cart:', error);
                    set({ status: 'idle', error: error.message });
                    return { success: false, error: error.message || 'Failed to apply discount code' };
                }

            },

            removeDiscountCode: async (code) => {
                set({ status: 'loading' });
                const state = get();
                const normalizedCode = code.toUpperCase();
                const removedEntry = state.discountCodes.find((dc) => dc.code.toUpperCase() === normalizedCode);
                const removedDealCoupon = removedEntry?.isDealCoupon === true;

                const updatedDiscountCodes = state.discountCodes.filter((dc) => dc.code.toUpperCase() !== normalizedCode);
                const hasSchoolCoupon = updatedDiscountCodes.some(dc => dc.isSchoolCoupon);
                {
                    const s = appConfigService.getFreeShoesGiftDiscountCodeUppercase();
                    const p = appConfigService.getFreePuzzleGiftDiscountCodeUppercase();
                    set({
                        discountCodes: updatedDiscountCodes,
                        ...(s && normalizedCode === s ? { selectedShoe: null, selectedShoeSize: null } : {}),
                        ...(p && normalizedCode === p ? { selectedPuzzleId: null, selectedPuzzleAge: null } : {}),
                        ...(!hasSchoolCoupon ? { schoolCouponData: null } : {}),
                    });
                }

                const cartId = await get().ensureCart();
                // Sync Shopify cart so backend (e.g. Pay Online draft) doesn't see stale discount codes
                if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                    try {
                        const codesToApply = discountCodesForShopifyApply(updatedDiscountCodes);
                        await shopifyApi.applyDiscountCodes(cartId, codesToApply);
                    } catch (e) {
                        console.warn('[CartStore] Failed to sync discount codes to Shopify cart after remove', e);
                    }
                }

                const lineSnapshot = state.lineItems;
                const hadSpecialDealPromoLines = lineSnapshot.some((li) => specialDealPromoPercentFromItem(li) != null);


                await get().syncDealPricing();
                await get().refreshComputedDiscountFromCodes();
                const itemsNow = get().lineItems;
                const lineItemsSubtotal = itemsNow.reduce(
                    (sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity ?? 0),
                    0,
                );
                let tax = state.payment?.tax ?? 0;
                let currencyCode = state.payment?.currencyCode || 'INR';
                if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                    try {
                        const cart = await shopifyApi.getCart(cartId);
                        tax = parseFloat(cart.cost?.totalTaxAmount?.amount || '0');
                        currencyCode = cart.cost?.totalAmount?.currencyCode || currencyCode;
                    } catch {
                        // keep tax/currency from state
                    }
                }

                const discount = await computeNonDealDiscountFromCodes(itemsNow, updatedDiscountCodes, state.dealProducts);
                const currentShipping = get().shippingFee();
                const total = Math.max(0, lineItemsSubtotal - discount + currentShipping + tax);

                set({
                    payment: {
                        subtotal: lineItemsSubtotal,
                        discount,
                        shipping: currentShipping,
                        tax,
                        total,
                        currencyCode,
                    },
                    error: null,
                    lastSyncedAt: Date.now(),
                });
                await get().syncDeliveryFeeToShopify();
                set({ status: 'idle' });
            },

            removeAllDiscountCodes: async () => {
                set({ status: 'loading' });
                const state = get();
                const lineSnapshot = state.lineItems;
                const hadSpecialDealPromoLines = lineSnapshot.some(
                    (li) => specialDealPromoPercentFromItem(li) != null,
                );

                set({
                    discountCodes: [],
                    schoolCouponData: null,
                    selectedShoe: null,
                    selectedShoeSize: null,
                    selectedPuzzleId: null,
                    selectedPuzzleAge: null,
                });

                const cartId = await get().ensureCart();
                // Sync Shopify cart so backend (e.g. Pay Online draft) doesn't see stale discount codes
                if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                    try {
                        await shopifyApi.applyDiscountCodes(cartId, []);
                    } catch (e) {
                        console.warn('[CartStore] Failed to clear discount codes on Shopify cart', e);
                    }
                }


                await get().syncDealPricing();
                let subtotal = get().subtotal();
                let tax = state.payment?.tax ?? 0;
                const currencyCode = state.payment?.currencyCode || 'INR';
                if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                    try {
                        const cart = await shopifyApi.getCart(cartId);
                        subtotal = parseFloat(cart.cost?.subtotalAmount?.amount || '0');
                        tax = parseFloat(cart.cost?.totalTaxAmount?.amount || '0');
                    } catch {
                        // keep from state
                    }
                }

                const currentShipping = state.shippingFee();
                set({
                    payment: {
                        subtotal,
                        discount: 0,
                        shipping: currentShipping,
                        tax,
                        total: Math.max(0, subtotal + currentShipping + tax),
                        currencyCode,
                    },
                    error: null,
                    lastSyncedAt: Date.now(),
                });
                await get().syncDeliveryFeeToShopify();
                set({ status: 'idle' });
            },

            // Sync cart prices
            syncCartPrices: async () => {
                const state = get();
                if (state.lineItems.length === 0) return;

                set({ status: 'loading' });

                try {
                    // Get all variant IDs
                    const variantIds = state.lineItems.map((li) => li.variantId);

                    // Fetch current prices from Shopify
                    const updatedVariants = await shopifyApi.getVariantsByIds(variantIds);

                    if (updatedVariants && updatedVariants.length > 0) {
                        // Update prices in cart
                        const updatedLineItems = state.lineItems.map((item) => {
                            const updated = updatedVariants.find(
                                (v: any) => v.id === item.variantId
                            );
                            if (updated) {
                                const qtyAvail = (updated as any).quantityAvailable;
                                const quantityAvailable = typeof qtyAvail === 'number' ? qtyAvail : item.quantityAvailable;
                                const quantity = typeof quantityAvailable === 'number' ? Math.min(item.quantity, quantityAvailable) : item.quantity;
                                const sellingUnit = parseFloat(updated.price?.amount || String(item.price));
                                const promoPrice = applySellingPriceWithSpecialDealPromo(sellingUnit, item);
                                const hasPromo = specialDealPromoPercentFromItem(item) != null;
                                return {
                                    ...item,
                                    price: promoPrice,
                                    compareAtPrice: hasPromo
                                        ? sellingUnit
                                        : updated.compareAtPrice?.amount
                                            ? parseFloat(updated.compareAtPrice.amount)
                                            : item.compareAtPrice,
                                    availableForSale: updated.availableForSale ?? item.availableForSale,
                                    quantityAvailable,
                                    quantity,
                                };
                            }
                            return item;
                        });

                        set({
                            lineItems: updatedLineItems,
                            lastSyncedAt: Date.now(),
                            status: 'idle',
                        });
                    } else {
                        set({ status: 'idle' });
                    }
                } catch (error: any) {
                    console.error('[CartStore] syncCartPrices error:', error);
                    set({ status: 'idle', error: error.message });
                }
            },


            fetchCart: async () => {
                const state = get();
                if (!state.id) {
                    set({ status: 'idle' });
                    return;
                }

                set({ status: 'loading' });

                try {
                    const cart = await shopifyApi.getCart(state.id);

                    if (cart) {
                        const shopifyLineItems: CartItem[] = cart.lines?.edges?.map((edge: any) => {
                            const node = edge.node;
                            const qtyAvail = node.merchandise?.quantityAvailable;
                            const attrList = node.attributes || node.merchandise?.customAttributes || [];
                            const bookingDateAttr = attrList.find((a: any) => a.key === 'booking_date')?.value;
                            const customAttributes: Record<string, string> = {};
                            for (const a of attrList) {
                                if (a?.key && a.key !== 'booking_date' && a.value != null) {
                                    customAttributes[a.key] = String(a.value);
                                }
                            }
                            const shopifySellingUnit = parseFloat(node.cost?.amountPerQuantity?.amount || '0');
                            const promoAttrVal = customAttributes[SPECIAL_DEAL_PROMO_CART_ATTR];
                            let unitPrice = shopifySellingUnit;
                            let compareAtOut: number | undefined;
                            if (promoAttrVal != null) {
                                const pOff = parseFloat(String(promoAttrVal));
                                if (Number.isFinite(pOff) && pOff > 0 && pOff < 100) {
                                    compareAtOut = shopifySellingUnit;
                                    unitPrice = Math.max(0, Math.round(shopifySellingUnit * (1 - pOff / 100)));
                                }
                            }
                            return {
                                id: node.id,
                                productId: node.merchandise?.product?.id,
                                variantId: node.merchandise?.id,
                                title: node.merchandise?.product?.title,
                                variantTitle: node.merchandise?.title,
                                price: unitPrice,
                                compareAtPrice: compareAtOut,
                                currencyCode: node.cost?.amountPerQuantity?.currencyCode || 'INR',
                                image:
                                    node.merchandise?.image?.url ||
                                    node.merchandise?.product?.images?.edges?.[0]?.node?.url ||
                                    '',
                                quantity: node.quantity,
                                availableForSale: node.merchandise?.availableForSale ?? true,
                                quantityAvailable: typeof qtyAvail === 'number' ? qtyAvail : undefined,
                                tags: node.merchandise?.product?.tags || [],
                                bookingDate: bookingDateAttr,
                                ...(Object.keys(customAttributes).length > 0 ? { customAttributes } : {}),
                            };
                        }) || [];

                        const orphans = orphanLocalLinesAfterShopifyFetch(state.lineItems, shopifyLineItems);
                        const lineItems = orphans.length > 0 ? [...shopifyLineItems, ...orphans] : shopifyLineItems;

                        // Calculate total discount from all allocations
                        const totalDiscountAmount = (cart.discountAllocations || []).reduce((sum: number, allocation: any) => {
                            return sum + parseFloat(allocation.discountedAmount?.amount || '0');
                        }, 0);

                        // Fetch eligible coupons from backend (source of truth for values)
                        const { couponService } = await import('@/services/couponService');
                        const { useUserStore } = await import('@/store/userStore');
                        const userStore = useUserStore.getState();
                        const phone = userStore.user?.phone ?? null;
                        const fetchCartSubtotal = lineItems.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (i.quantity || 0), 0);
                        const fetchCartItemCount = lineItems.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
                        const fetchHasTicketing = lineItems.some((item: any) => item.bookingDate || (item.tags || []).some((t: string) => /event|playhouse|petting|farm|ticket|pass/i.test(String(t))));
                        const fetchHasClothing = lineItems.some((item: any) => (item.tags || []).some((t: string) => String(t).toLowerCase() === 'fashion'));
                        const eligibleForFetch = await couponService.getEligibleCouponsFromBackend({
                            phone,
                            cartSubTotal: fetchCartSubtotal,
                            cartItemCount: fetchCartItemCount,
                            hasTicketing: fetchHasTicketing,
                            hasClothing: fetchHasClothing,
                            cartCategories: getCartCategoriesFromLineItems(lineItems),
                            appVersion: getAppVersionForApi(),
                            deviceType: Platform.OS ?? '',
                            includeHiddenCoupons: true,
                        });
                        const backendCouponMapFetch = new Map(eligibleForFetch.map((c: any) => [c.code?.toUpperCase(), c]));

                        // Update discount codes from cart
                        const discountCodesFromCart = (cart.discountCodes || []).map((dc: any) => {
                            const codeNorm = String(dc.code ?? '').trim().toUpperCase();
                            const prevApplied = state.discountCodes.find((p) => p.code.toUpperCase() === codeNorm);
                            const isApplicable = dc.applicable !== false;
                            const matchingAllocation = (cart.discountAllocations || []).find((alloc: any) => {
                                return alloc.code?.toUpperCase() === dc.code.toUpperCase();
                            });

                            let discountType: 'percentage' | 'fixed' | 'shipping' | 'bogo' = 'percentage';
                            let discountValue = 0;
                            let foundInBackend = false;

                            const backendCoupon = backendCouponMapFetch.get(dc.code?.toUpperCase());
                            if (backendCoupon) {
                                foundInBackend = true;
                                discountValue = Number(backendCoupon.value ?? 0);
                                const bt = (backendCoupon.valueType ?? 'percentage').toString().toLowerCase();
                                discountType = (bt === 'fixed' || bt === 'fixed_amount' || bt === 'fixed amount') ? 'fixed' : 'percentage';
                                console.log(`[CartStore] fetchCart ${dc.code}: Using backend coupon - type: ${discountType}, value: ${discountValue}`);
                            }

                            if (!foundInBackend && discountValue === 0 && matchingAllocation) {
                                const discountApp = matchingAllocation.discountApplication;
                                if (discountApp?.value?.percentage !== undefined) {
                                    discountValue = discountApp.value.percentage;
                                    discountType = 'percentage';
                                    console.log(`[CartStore] fetchCart ${dc.code}: Using Shopify percentage discount ${discountValue}%`);
                                } else if (discountApp?.value?.amount) {
                                    discountValue = parseFloat(discountApp.value.amount);
                                    discountType = 'fixed';
                                    console.log(`[CartStore] fetchCart ${dc.code}: Using Shopify fixed discount ${discountValue}`);
                                } else if (matchingAllocation.discountedAmount?.amount) {
                                    const discountAmount = parseFloat(matchingAllocation.discountedAmount.amount);
                                    const subtotalBeforeDiscount = parseFloat(cart.cost?.subtotalAmount?.amount || '0');
                                    if (subtotalBeforeDiscount > 0 && discountAmount > 0) {
                                        discountValue = Math.round((discountAmount / subtotalBeforeDiscount) * 100);
                                        discountType = 'percentage';
                                        console.log(`[CartStore] fetchCart ${dc.code}: Calculated percentage ${discountValue}% from amount ${discountAmount}`);
                                    } else {
                                        discountValue = discountAmount;
                                        discountType = 'fixed';
                                        console.log(`[CartStore] fetchCart ${dc.code}: Fixed discount ${discountValue} (fallback)`);
                                    }
                                }
                            }

                            if (discountValue === 0) {
                                console.log(`[CartStore] fetchCart ⚠️ No discount value found for ${dc.code}`);
                            }
                            const maxCapFetch =
                                backendCoupon?.maxDiscountAmount != null
                                    ? Number(backendCoupon.maxDiscountAmount)
                                    : prevApplied?.maxDiscountAmount != null
                                        ? Number(prevApplied.maxDiscountAmount)
                                        : undefined;
                            const applicableCategory =
                                backendCoupon?.applicableCategory != null
                                    ? backendCoupon.applicableCategory
                                    : prevApplied?.applicableCategory;
                            const allowedCategories =
                                backendCoupon?.allowedCategories?.length
                                    ? backendCoupon.allowedCategories
                                    : prevApplied?.allowedCategories?.length
                                        ? prevApplied.allowedCategories
                                        : undefined;
                            const fetchSchool =
                                schoolNameFromCouponApi(backendCoupon as { schoolName?: string | null; school_name?: string | null }) ??
                                prevApplied?.schoolName;
                            return {
                                code: String(dc.code ?? '').trim(),
                                type: discountType,
                                value: discountValue,
                                applicable: isApplicable,
                                appliedAt: Date.now(),
                                maxDiscountAmount: maxCapFetch,
                                isMilestone: backendCoupon?.isMilestone === true || dc.code.toUpperCase() === 'FOURTHMILESTONE',
                                isDealCoupon:
                                    couponIsDealCouponFromApi(backendCoupon as { isDealCoupon?: boolean; is_deal_coupon?: boolean }) ||
                                    prevApplied?.isDealCoupon === true,
                                ...(applicableCategory != null && String(applicableCategory).trim() !== ''
                                    ? { applicableCategory: String(applicableCategory).trim() }
                                    : {}),
                                ...(allowedCategories?.length ? { allowedCategories } : {}),
                                ...(fetchSchool != null && String(fetchSchool).trim() !== ''
                                    ? { schoolName: String(fetchSchool).trim() }
                                    : {}),
                            };
                        });

                        // Re-inject missing milestone coupons (e.g. FOURTHMILESTONE) if they were applied but Shopify didn't return them
                        state.discountCodes.forEach(dc => {
                            if (dc.isMilestone && !discountCodesFromCart.some(newDc => newDc.code.toUpperCase() === dc.code.toUpperCase())) {
                                discountCodesFromCart.push(dc);
                            }
                        });

                        // Deal-only coupons are never on the Shopify cart — preserve from client state only when
                        // no real discount is active. After applying a normal coupon, do not re-attach deal stubs.
                        const hasNonDealApplicableDiscount = discountCodesFromCart.some(
                            (dc) => dc.applicable !== false && dc.isDealCoupon !== true,
                        );
                        if (!hasNonDealApplicableDiscount) {
                            state.discountCodes.forEach((dc) => {
                                if (
                                    dc.isDealCoupon &&
                                    !discountCodesFromCart.some(
                                        (newDc) => newDc.code.toUpperCase() === dc.code.toUpperCase(),
                                    )
                                ) {
                                    // Preserve full client row (value/type/caps/categories). Never force value: 0 —
                                    // that was for old deal "stubs" and wipes API %-off after fetchCart.
                                    discountCodesFromCart.push({ ...dc });
                                }
                            });
                        }

                        const lineItemsSubtotal = lineItems.reduce((sum, item) => {
                            return sum + (Number(item.price ?? 0) * Number(item.quantity));
                        }, 0);
                        const discount = await computeNonDealDiscountFromCodes(lineItems, discountCodesFromCart, state.dealProducts);
                        const tax = parseFloat(cart.cost?.totalTaxAmount?.amount || '0');
                        const total = Math.max(0, lineItemsSubtotal - discount + tax);

                        const currentShipping = get().shippingFee();
                        const updatedPayment: CartPayment = {
                            subtotal: lineItemsSubtotal,
                            discount,
                            shipping: currentShipping,
                            tax,
                            total: Math.max(0, lineItemsSubtotal - discount + tax) + currentShipping,
                            currencyCode: cart.cost?.totalAmount?.currencyCode || 'INR',
                        };

                        set({
                            lineItems,
                            discountCodes: discountCodesFromCart,
                            payment: updatedPayment,
                            webUrl: cart.checkoutUrl,
                            checkoutUrl: cart.checkoutUrl,
                            lastSyncedAt: Date.now(),
                        });
                        await get().syncDeliveryFeeToShopify();
                        await get().syncDealPricing();
                        await get().validateAppliedDiscountCodes();
                        set({ status: 'idle' });
                    }
                } catch (error: any) {
                    console.error('[CartStore] fetchCart error:', error);
                    set({ status: 'error', error: error.message });
                }
            },

            // Update note
            updateNote: (note) => {
                set({ note });
            },

            // Try & Buy
            toggleTryAndBuy: () => {
                set((state) => ({ isTryAndBuy: !state.isTryAndBuy }));
            },
            setTryAndBuy: (enabled) => {
                set({ isTryAndBuy: enabled });
            },

            // Gift Wrapping
            setGiftWrapping: (wrapping) => {
                set({ giftWrapping: wrapping });
            },
            getGiftWrappingPrice: () => {
                const state = get();
                return state.giftWrapping?.price || 0;
            },

            // Free Shoes Offer
            setSelectedShoe: (shoeId) => {
                set({ selectedShoe: shoeId, selectedShoeSize: shoeId ? get().selectedShoeSize : null });
            },
            setSelectedShoeSize: (size) => {
                set({ selectedShoeSize: size });
            },
            setSelectedPuzzle: (puzzleId, age) => {
                set({
                    selectedPuzzleId: puzzleId,
                    selectedPuzzleAge: puzzleId ? (age != null ? age : get().selectedPuzzleAge) : null,
                });
            },

            // Ensure cart exists (create if needed)
            ensureCart: async () => {
                const state = get();
                if (state.id) {
                    return state.id;
                }

                // Create a Shopify cart if we have items (include booking_date for ticketing lines)
                if (state.lineItems.length > 0) {
                    try {
                        const lines = state.lineItems.map(shopifyLineFromCartItem);

                        const cart = await shopifyApi.createCart(lines);
                        if (cart && cart.id) {
                            set({ id: cart.id, webUrl: cart.checkoutUrl, checkoutUrl: cart.checkoutUrl });
                            return cart.id;
                        }
                    } catch (error) {
                        console.warn('[CartStore] Error creating Shopify cart:', error);
                    }
                }

                // Fallback: Use local cart ID
                const localCartId = `local-cart-${Date.now()}`;
                set({ id: localCartId });
                return localCartId;
            },

            // Get checkout URL
            getCheckoutUrl: async () => {
                const state = get();
                if (state.checkoutUrl) {
                    return state.checkoutUrl;
                }

                // Ensure cart exists
                const cartId = await get().ensureCart();
                if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                    try {
                        const cart = await shopifyApi.getCart(cartId);
                        if (cart && cart.checkoutUrl) {
                            set({ checkoutUrl: cart.checkoutUrl, webUrl: cart.checkoutUrl });
                            return cart.checkoutUrl;
                        }
                    } catch (error) {
                        console.warn('[CartStore] Error fetching checkout URL:', error);
                    }
                }

                return null;
            },

            // School Coupon
            setSchoolCouponData: (data) => set({ schoolCouponData: data }),

            syncDeliveryFeeToShopify: async () => {
                const state = get();
                if (!state.id || !state.id.startsWith('gid://shopify/Cart/')) return;
                const shipping = state.shippingFee();
                try {
                    // Fetch the current cart attributes first so we don't overwrite others (e.g. Gift Wrapping)
                    const cart = await shopifyApi.getCart(state.id);
                    const existingAttributes = (cart.attributes || []).filter((attr: any) => attr.key !== 'Delivery Fee');
                    const nextAttributes = [...existingAttributes, { key: 'Delivery Fee', value: String(shipping) }];
                    await shopifyApi.updateCartAttributes(state.id, nextAttributes);
                } catch (e) {
                    console.warn('[CartStore] Failed to sync shipping fee to Shopify attributes:', e);
                }
            },

            setDeliverySchedule: (schedule) => set({ deliverySchedule: schedule }),

            syncDealPricing: async (options) => {
                const state = get();
                const dealCoupon = state.discountCodes.find((dc) => dc.isDealCoupon && dc.applicable !== false);

                if (!dealCoupon) {
                    const next = state.lineItems.map(stripSpecialDealPromoFromCartLine);
                    if (JSON.stringify(next) !== JSON.stringify(state.lineItems)) {
                        set({ lineItems: next });
                        // Re-sync to Shopify since prices changed
                        const cartId = await get().ensureCart();
                        if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                            const shopifyCodes = discountCodesForShopifyApply(state.discountCodes);
                            const lines = next.map(shopifyLineFromCartItem);
                            const updated = await shopifyApi.createCart(lines, undefined, shopifyCodes);
                            if (updated?.id) {
                                set({ id: updated.id, webUrl: updated.checkoutUrl, checkoutUrl: updated.checkoutUrl });
                            }
                        }
                    }
                    return;
                }

                const dealConfig = appConfigService.getSpecialDealConfig();
                /** No app special-deal tabs: discount uses coupon value + categories only — strip grid markers and stale collections. */
                if (!dealConfig) {
                    const next = state.lineItems.map(stripSpecialDealPromoFromCartLine);
                    const linesChanged = JSON.stringify(next) !== JSON.stringify(state.lineItems);
                    const hadDealProducts = state.dealProducts.length > 0;
                    if (linesChanged || hadDealProducts) {
                        const cartId = await get().ensureCart();
                        let toPersist = next;
                        if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                            const storeId = get().id;
                            const resolvedCartId =
                                typeof storeId === 'string' && storeId.startsWith('gid://shopify/Cart/')
                                    ? storeId
                                    : cartId;
                            toPersist = await mergeShopifyCartLineIdsFromRemote(resolvedCartId, next);
                        }
                        set({ lineItems: toPersist, dealProducts: [] });
                        if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                            const shopifyCodes = discountCodesForShopifyApply(get().discountCodes);
                            const allHaveIds = toPersist.every((li) => li.id && li.id.startsWith('gid://shopify/CartLine/'));
                            if (allHaveIds) {
                                try {
                                    const updateLines = toPersist.map((li) => ({
                                        id: li.id,
                                        quantity: li.quantity,
                                        attributes: Object.entries(li.customAttributes || {}).map(([k, v]) => ({
                                            key: k,
                                            value: String(v),
                                        })),
                                    }));
                                    await shopifyApi.cartLinesUpdate(cartId, updateLines);
                                } catch (e) {
                                    console.warn('[CartStore] syncDealPricing (no config) update failed, falling back to create', e);
                                    const lines = toPersist.map(shopifyLineFromCartItem);
                                    const updated = await shopifyApi.createCart(lines, undefined, shopifyCodes);
                                    if (updated?.id) {
                                        set({ id: updated.id, webUrl: updated.checkoutUrl, checkoutUrl: updated.checkoutUrl });
                                    }
                                }
                            } else {
                                const lines = toPersist.map(shopifyLineFromCartItem);
                                const updated = await shopifyApi.createCart(lines, undefined, shopifyCodes);
                                if (updated?.id) {
                                    set({ id: updated.id, webUrl: updated.checkoutUrl, checkoutUrl: updated.checkoutUrl });
                                }
                            }
                        }
                    }
                    return;
                }

                // Deal coupon marker logic (app config collections)
                let dealProducts = state.dealProducts;
                if (options?.forceFetch || dealProducts.length === 0) {
                    set({ status: 'loading' });
                    try {
                        const allProds: any[] = [];
                        for (const tab of dealConfig.tabs ?? []) {
                            const rawId = tab.collectionId ?? (tab as any).collection_id;
                            const collectionId = parseShopifyCollectionGid(rawId);
                            if (collectionId) {
                                const prods = await shopifyApi.getProductsByCollection(collectionId, 250);
                                if (Array.isArray(prods)) allProds.push(...prods);
                            }
                        }
                        dealProducts = allProds;
                        set({ dealProducts: allProds });
                    } catch (e) {
                        console.warn('[CartStore] syncDealPricing fetch error:', e);
                    } finally {
                        set({ status: 'idle' });
                    }
                }

                const tabGids = collectSpecialDealTabCollectionGids();
                const eligibilityByProduct = new Map<string, boolean>();
                if (tabGids.length > 0 && state.lineItems.length > 0 && dealProducts.length === 0) {
                    const uniqueProductIds = [...new Set(state.lineItems.map((i) => i.productId).filter(Boolean))];
                    const batchResult = await shopifyApi.batchGetProductsCollectionEligibility(uniqueProductIds as string[], tabGids);
                    batchResult.forEach((isEligible, pid) => eligibilityByProduct.set(pid, isEligible));
                }

                const next = state.lineItems.map((item) => {
                    const isEligible =
                        dealProducts.length > 0
                            ? variantBelongsToListingProducts(dealProducts, item.variantId)
                            : eligibilityByProduct.get(item.productId || '') === true;

                    // No longer reducing individual line prices by 50%. 
                    // Deal discount is now purely a coupon-based calculation in Bill Details.
                    return stripSpecialDealPromoFromCartLine(item);
                });

                if (JSON.stringify(next) !== JSON.stringify(state.lineItems)) {
                    const cartId = await get().ensureCart();
                    let toPersist = next;
                    if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                        const storeId = get().id;
                        const resolvedCartId =
                            typeof storeId === 'string' && storeId.startsWith('gid://shopify/Cart/')
                                ? storeId
                                : cartId;
                        toPersist = await mergeShopifyCartLineIdsFromRemote(resolvedCartId, next);
                    }
                    set({ lineItems: toPersist });
                    if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                        const shopifyCodes = discountCodesForShopifyApply(get().discountCodes);
                        const allHaveIds = toPersist.every(
                            (li) => li.id && li.id.startsWith('gid://shopify/CartLine/'),
                        );

                        if (allHaveIds) {
                            try {
                                const updateLines = toPersist.map((li) => ({
                                    id: li.id,
                                    quantity: li.quantity,
                                    attributes: Object.entries(li.customAttributes || {}).map(([k, v]) => ({
                                        key: k,
                                        value: String(v),
                                    })),
                                }));
                                await shopifyApi.cartLinesUpdate(cartId, updateLines);
                            } catch (e) {
                                console.warn('[CartStore] syncDealPricing update failed, falling back to create', e);
                                const lines = toPersist.map(shopifyLineFromCartItem);
                                const updated = await shopifyApi.createCart(lines, undefined, shopifyCodes);
                                if (updated?.id) {
                                    set({ id: updated.id, webUrl: updated.checkoutUrl, checkoutUrl: updated.checkoutUrl });
                                }
                            }
                        } else {
                            const lines = toPersist.map(shopifyLineFromCartItem);
                            const updated = await shopifyApi.createCart(lines, undefined, shopifyCodes);
                            if (updated?.id) {
                                set({ id: updated.id, webUrl: updated.checkoutUrl, checkoutUrl: updated.checkoutUrl });
                            }
                        }
                    }
                }
            },
        }),
        {
            name: 'cart-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                lineItems: state.lineItems,
                giftItems: state.giftItems,
                discountCodes: state.discountCodes,
                note: state.note,
                id: state.id,
                checkoutUrl: state.checkoutUrl,
                isTryAndBuy: state.isTryAndBuy,
                giftWrapping: state.giftWrapping,
                schoolCouponData: state.schoolCouponData,
                deliverySchedule: state.deliverySchedule,
            }),
        }
    )
);

// Selector hooks for optimized re-renders
export const useCartItems = () => useCartStore((s) => s.lineItems);
export const useCartItemCount = () => useCartStore((s) => s.itemCount());
export const useCartSubtotal = () => useCartStore((s) => s.subtotal());
export const useCartTotal = () => useCartStore((s) => s.total());
export const useCartStatus = () => useCartStore((s) => s.status);
export const useCartGifts = () => useCartStore((s) => s.giftItems);
export const useCartDiscounts = () => useCartStore((s) => s.discountCodes);
export const useCartId = () => useCartStore((s) => s.id);
export const useCheckoutUrl = () => useCartStore((s) => s.checkoutUrl);
export const useIsTryAndBuy = () => useCartStore((s) => s.isTryAndBuy);
export const useGiftWrapping = () => useCartStore((s) => s.giftWrapping);