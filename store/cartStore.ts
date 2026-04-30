// Zustand Store - Cart Slice
// Enhanced cart state management with gift items, multiple discounts, and sync
// Coupon values come from backend API only (not config)

import { getAppVersionForApi } from '@/constants/versionConfig';
import { appConfigService } from '@/services/appConfigService';
import { getSubtotalForAllowedCategories } from '@/services/couponService';
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
    removeDiscountCode: (code: string) => void;
    removeAllDiscountCodes: () => void;
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

/** Per-category subtotals for category-wise coupons: sum of (price * quantity) for items that have each tag. */
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
                console.log('[CartStore] discountAmount() called');
                console.log('[CartStore] Current payment:', state.payment);
                console.log('[CartStore] Current discountCodes:', state.discountCodes);
                console.log('[CartStore] Current subtotal:', state.subtotal());

                // When we have discount codes, always compute from current lineItems so amount stays in sync when cart changes (e.g. remove item from allowed category). Use payment.discount only when there are no codes.
                const hasApplicableCodes = state.discountCodes.some((dc) => dc.applicable !== false && Number(dc.value ?? 0) > 0);
                if (!hasApplicableCodes && state.payment && state.payment.discount > 0) {
                    console.log('[CartStore] Using payment.discount from Shopify:', state.payment.discount);
                    return state.payment.discount;
                }

                // Calculate from discount codes + current lineItems (category-aware)
                let discount = 0;
                const subtotalVal = state.subtotal();
                const categorySubtotals = getCartCategorySubtotalsFromLineItems(state.lineItems);
                state.discountCodes.forEach((dc) => {
                    if (dc.applicable !== false) {
                        const val = Number(dc.value ?? 0);
                        const isMilestoneOrGift = dc.isMilestone || dc.code.toUpperCase().includes('MILESTONE') || dc.code.toUpperCase().includes('FREE');

                        if (val <= 0 && (!isMilestoneOrGift || !dc.originalPrice)) return;

                        const categoryKey = dc.applicableCategory?.trim().toLowerCase();
                        const baseAmount = dc.allowedCategories?.length
                            ? getSubtotalForAllowedCategories(state.lineItems, dc.allowedCategories)
                            : categoryKey
                                ? (categorySubtotals[categoryKey] ?? 0)
                                : subtotalVal;
                        let codeDiscount = 0;

                        if (val > 0) {
                            if (dc.type === 'percentage') {
                                codeDiscount = (baseAmount * val) / 100;
                            } else {
                                codeDiscount = Math.min(val, baseAmount);
                            }
                        } else if (isMilestoneOrGift && dc.originalPrice) {
                            // Fallback to original price for zero-value milestone gifts
                            codeDiscount = Math.min(Number(dc.originalPrice), baseAmount);
                        }

                        if (dc.maxDiscountAmount != null && dc.maxDiscountAmount > 0) {
                            codeDiscount = Math.min(codeDiscount, dc.maxDiscountAmount);
                        }
                        if (codeDiscount > 0) {
                            const scope = dc.allowedCategories?.length ? dc.allowedCategories.join(',') : (categoryKey ? categoryKey : 'cart');
                            console.log(`[CartStore] Code ${dc.code}: ${dc.type} ${val}${dc.type === 'percentage' ? '%' : ''} (or gift) on ${scope} = ${codeDiscount}${dc.maxDiscountAmount != null ? ` (capped at ${dc.maxDiscountAmount})` : ''}`);
                            discount += codeDiscount;
                        }
                    } else {
                        console.log(`[CartStore] Code ${dc.code} is not applicable, skipping`);
                    }
                });
                // Cap discount to not exceed subtotal (prevent negative totals)
                const finalDiscount = Math.min(discount, subtotalVal);
                console.log('[CartStore] Calculated total discount:', discount, 'Final (capped):', finalDiscount);
                return finalDiscount;
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
                            state.lineItems
                        );
                        if (conditionsResult.isValid) {
                            const apiTitle = (configDiscount as { title?: string }).title;
                            const apiDesc = (configDiscount as { description?: string }).description;
                            const couponTitle = apiTitle != null && String(apiTitle).trim() !== '' ? String(apiTitle).trim() : undefined;
                            const couponDescription =
                                apiDesc != null && String(apiDesc).trim() !== '' ? String(apiDesc).trim() : undefined;
                            stillValid.push({
                                ...dc,
                                ...(couponTitle != null ? { couponTitle } : {}),
                                ...(couponDescription != null ? { couponDescription } : {}),
                            });
                        }
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
                        await shopifyApi.applyDiscountCodes(cartId, stillValid.map((dc) => dc.code));
                    } catch (e) {
                        console.warn('[CartStore] Failed to sync discount codes to Shopify after revalidation', e);
                    }
                }
            },

            total: () => {
                const state = get();
                // Use payment.total from Shopify if available (most accurate)
                if (state.payment && state.payment.total > 0) {
                    return state.payment.total;
                }

                // Fallback: calculate from subtotal, discount and shipping
                return Math.max(0, state.subtotal() - state.discountAmount() + state.shippingFee());
            },

            // Status actions
            setStatus: (status) => set({ status }),
            setError: (error) => set({ error }),

            // Add item
            addItem: async (item) => {
                set({ status: 'loading' });

                try {
                    const state = get();
                    const existingIndex = state.lineItems.findIndex(
                        (li) => li.variantId === item.variantId
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
                        status: 'idle',
                        error: null,
                    });
                    get().validateAppliedDiscountCodes();
                    get().syncDeliveryFeeToShopify();

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
                        status: 'idle',
                        error: null,
                    });
                    get().validateAppliedDiscountCodes();
                    get().syncDeliveryFeeToShopify();

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
                        status: 'idle',
                        error: null,
                    });
                    get().validateAppliedDiscountCodes();
                    get().syncDeliveryFeeToShopify();

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
                        status: 'idle',
                        error: null,
                    });
                    get().validateAppliedDiscountCodes();
                    get().applyEligibleGifts();
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

                let nextDiscountCodes: DiscountCode[];
                const newEntryStub: DiscountCode = {
                    code: codeToApply,
                    type: 'percentage',
                    value: 0,
                    appliedAt: Date.now(),
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
                        cartForCost = newCart;
                    }

                } else if (isShopifyCartId) {
                    try {
                        const lines = state.lineItems.map(shopifyLineFromCartItem);

                        const newCart = await shopifyApi.createCart(lines);
                        if (newCart && newCart.id) {
                            set({ id: newCart.id, webUrl: newCart.checkoutUrl, checkoutUrl: newCart.checkoutUrl });
                            // Use the new Shopify cart ID
                            const shopifyCartId = newCart.id;

                            // Apply ONLY the new discount code to the cart
                            const codesToApply = [codeToApply];
                            const updatedCart = await shopifyApi.applyDiscountCodes(shopifyCartId, codesToApply);

                            if (!updatedCart) {
                                throw new Error('Failed to apply discount code');
                            }

                            // Process the response (same logic as below)
                            console.log('[CartStore] Updated cart from Shopify:', {
                                discountAllocations: updatedCart.discountAllocations,
                                discountCodes: updatedCart.discountCodes,
                                cost: updatedCart.cost,
                            });

                            const totalDiscountAmount = (updatedCart.discountAllocations || []).reduce((sum: number, allocation: any) => {
                                return sum + parseFloat(allocation.discountedAmount?.amount || '0');
                            }, 0);
                            console.log('[CartStore] Total discount amount calculated:', totalDiscountAmount);

                            // subtotalAmount from Shopify is the subtotal BEFORE discount (current selling prices)
                            const subtotalBeforeDiscount = parseFloat(updatedCart.cost?.subtotalAmount?.amount || '0');
                            const subtotalAfterDiscount = subtotalBeforeDiscount - totalDiscountAmount;
                            console.log('[CartStore] Subtotal calculations:', {
                                subtotalBeforeDiscount,
                                subtotalAfterDiscount,
                                totalDiscountAmount,
                            });

                            // Fetch eligible coupons from backend (source of truth for values)
                            const { couponService } = await import('@/services/couponService');
                            const { useUserStore } = await import('@/store/userStore');
                            const userStore = useUserStore.getState();
                            const phone = userStore.user?.phone ?? null;
                            const lineItemsForCoupons = get().lineItems;
                            const eligibleCoupons = await couponService.getEligibleCouponsFromBackend({
                                phone,
                                cartSubTotal: cartSubtotal,
                                cartItemCount,
                                hasTicketing: hasTicketingProducts,
                                hasClothing: hasClothingItems,
                                cartCategories: getCartCategoriesFromLineItems(lineItemsForCoupons),
                                appVersion: getAppVersionForApi(),
                                deviceType: Platform.OS ?? '',
                                includeHiddenCoupons: true,
                            });
                            const backendCouponMap = new Map(eligibleCoupons.map((c: any) => [c.code?.toUpperCase(), c]));

                            const discountCodesFromCart = (updatedCart.discountCodes || []).map((dc: any) => {
                                console.log(`[CartStore] Processing discount code: ${dc.code}, Shopify applicable: ${dc.applicable}`);

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
                                        discountValue = discountApp.value.percentage;
                                        discountType = 'percentage';
                                        console.log(`[CartStore] ${dc.code}: Using Shopify percentage discount ${discountValue}%`);
                                    } else if (discountApp?.value?.amount) {
                                        discountValue = parseFloat(discountApp.value.amount);
                                        discountType = 'fixed';
                                        console.log(`[CartStore] ${dc.code}: Using Shopify fixed discount ${discountValue}`);
                                    } else if (matchingAllocation.discountedAmount?.amount) {
                                        const discountAmount = parseFloat(matchingAllocation.discountedAmount.amount);
                                        if (subtotalBeforeDiscount > 0 && discountAmount > 0) {
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
                                const maxCap = backendCoupon?.maxDiscountAmount != null ? Number(backendCoupon.maxDiscountAmount) : undefined;
                                const rawOrig = backendCoupon?.originalPrice ?? (backendCoupon as any)?.original_price;
                                const origPrice = typeof rawOrig === 'number' && Number.isFinite(rawOrig) ? rawOrig : typeof rawOrig === 'string' ? parseFloat(rawOrig) : undefined;
                                const existing = state.discountCodes.find((d) => d.code.toUpperCase() === dc.code?.toUpperCase());
                                const originalPrice = origPrice ?? existing?.originalPrice;
                                const btT = (backendCoupon as { title?: string } | undefined)?.title;
                                const btD = (backendCoupon as { description?: string } | undefined)?.description;
                                const ct =
                                    (btT != null && String(btT).trim() !== '' ? String(btT).trim() : undefined) ?? existing?.couponTitle;
                                const cdesc =
                                    (btD != null && String(btD).trim() !== '' ? String(btD).trim() : undefined)
                                    ?? existing?.couponDescription;
                                return {
                                    code: String(dc.code ?? '').trim(),
                                    type: discountType,
                                    value: Number(discountValue),
                                    applicable: isApplicable,
                                    appliedAt: Date.now(),
                                    maxDiscountAmount: maxCap,
                                    ...(originalPrice != null ? { originalPrice } : {}),
                                    ...(backendCoupon?.applicableCategory != null ? { applicableCategory: backendCoupon.applicableCategory } : {}),
                                    ...(backendCoupon?.allowedCategories?.length ? { allowedCategories: backendCoupon.allowedCategories } : {}),
                                    ...(ct != null && ct !== '' ? { couponTitle: ct } : {}),
                                    ...(cdesc != null && cdesc !== '' ? { couponDescription: cdesc } : {}),
                                };
                            });

                            // Calculate subtotal from lineItems (like gauntlet does)
                            // Don't use Shopify's cost.subtotalAmount as it may not match our lineItems
                            const lineItemsSubtotal = state.lineItems.reduce((sum, item) => {
                                return sum + (Number(item.price ?? 0) * Number(item.quantity));
                            }, 0);

                            const currentShipping = get().shippingFee();
                            const updatedPayment: CartPayment = {
                                subtotal: lineItemsSubtotal, // Calculate from lineItems, not Shopify's cost.subtotalAmount
                                discount: totalDiscountAmount,
                                shipping: currentShipping,
                                tax: parseFloat(updatedCart.cost?.totalTaxAmount?.amount || '0'),
                                total: parseFloat(updatedCart.cost?.totalAmount?.amount || '0') + currentShipping,
                                currencyCode: updatedCart.cost?.totalAmount?.currencyCode || 'INR',
                            };
                            console.log('[CartStore] Updated payment object:', updatedPayment);
                            console.log('[CartStore] Discount codes to save:', discountCodesFromCart);

                            // If code not in Shopify response (Shopify rejected it), add from backend.
                            // If code is in response but applicable is false (Shopify doesn't have it), override with backend so it stays applied.
                            const codeInResponse = discountCodesFromCart.find(
                                (dc: DiscountCode) => dc.code.toUpperCase() === normalizedCode
                            );

                            if (configDiscount) {
                                const backendValue = Number(configDiscount.value ?? 0);
                                const bt = (configDiscount.valueType ?? 'percentage').toString().toLowerCase();
                                const backendType: 'percentage' | 'fixed' =
                                    bt === 'fixed' || bt === 'fixed_amount' || bt === 'fixed amount' ? 'fixed' : 'percentage';
                                const rawBackendOrig1 = configDiscount.originalPrice ?? (configDiscount as any).original_price;
                                const backendOrig1 = typeof rawBackendOrig1 === 'number' && Number.isFinite(rawBackendOrig1) ? rawBackendOrig1 : typeof rawBackendOrig1 === 'string' ? parseFloat(rawBackendOrig1) : undefined;
                                const cfgT1 = (configDiscount as { title?: string }).title;
                                const cfgD1 = (configDiscount as { description?: string }).description;
                                const cTitle1 = cfgT1 != null && String(cfgT1).trim() !== '' ? String(cfgT1).trim() : undefined;
                                const cDesc1 = cfgD1 != null && String(cfgD1).trim() !== '' ? String(cfgD1).trim() : undefined;
                                const backendEntry: DiscountCode = {
                                    code: codeToApply,
                                    type: backendType,
                                    value: backendValue,
                                    applicable: true,
                                    appliedAt: Date.now(),
                                    maxDiscountAmount: configDiscount.maxDiscountAmount != null ? Number(configDiscount.maxDiscountAmount) : undefined,
                                    ...(backendOrig1 != null ? { originalPrice: backendOrig1 } : {}),
                                    ...(configDiscount.applicableCategory != null ? { applicableCategory: configDiscount.applicableCategory } : {}),
                                    ...(configDiscount.allowedCategories?.length ? { allowedCategories: configDiscount.allowedCategories } : {}),
                                    isSchoolCoupon: configDiscount.isSchoolCoupon === true,
                                    isMilestone: configDiscount.isMilestone === true || codeToApply.toUpperCase() === 'FOURTHMILESTONE',
                                    ...(cTitle1 != null ? { couponTitle: cTitle1 } : {}),
                                    ...(cDesc1 != null ? { couponDescription: cDesc1 } : {}),
                                };
                                if (!codeInResponse) {
                                    console.log('[CartStore] Code not in Shopify response, adding from backend:', normalizedCode);
                                    discountCodesFromCart.push(backendEntry);
                                } else if (codeInResponse.applicable === false || codeInResponse.value === 0) {
                                    console.log('[CartStore] Code in response but not applicable/zero, overriding from backend:', normalizedCode);
                                    const idx = discountCodesFromCart.findIndex(
                                        (dc: DiscountCode) => dc.code.toUpperCase() === normalizedCode
                                    );
                                    if (idx !== -1) discountCodesFromCart[idx] = backendEntry;
                                } else {
                                    // Code in response and applicable: keep entry but preserve category scope so discount stays on category subtotal
                                    const idx = discountCodesFromCart.findIndex(
                                        (dc: DiscountCode) => dc.code.toUpperCase() === normalizedCode
                                    );
                                    if (idx !== -1) {
                                        const tMerge = (configDiscount as { title?: string }).title;
                                        const dMerge = (configDiscount as { description?: string }).description;
                                        const ctM = tMerge != null && String(tMerge).trim() !== '' ? String(tMerge).trim() : undefined;
                                        const cdM = dMerge != null && String(dMerge).trim() !== '' ? String(dMerge).trim() : undefined;
                                        discountCodesFromCart[idx] = {
                                            ...discountCodesFromCart[idx],
                                            ...(configDiscount.applicableCategory != null ? { applicableCategory: configDiscount.applicableCategory } : {}),
                                            ...(configDiscount.allowedCategories?.length ? { allowedCategories: configDiscount.allowedCategories } : {}),
                                            isSchoolCoupon: configDiscount.isSchoolCoupon === true,
                                            isMilestone: configDiscount.isMilestone === true || codeToApply.toUpperCase() === 'FOURTHMILESTONE',
                                            ...(ctM != null ? { couponTitle: ctM } : {}),
                                            ...(cdM != null ? { couponDescription: cdM } : {}),
                                        };
                                    }
                                }
                            }

                            // Recalc payment from final discount codes (use category/allowed baseAmount per code)
                            const recalcCategorySubtotals = getCartCategorySubtotalsFromLineItems(state.lineItems);
                            let recalcDiscount = 0;
                            for (const dc of discountCodesFromCart) {
                                const val = Number(dc.value ?? 0);
                                if (dc.applicable !== false && val > 0) {
                                    const baseAmount = dc.allowedCategories?.length
                                        ? getSubtotalForAllowedCategories(state.lineItems, dc.allowedCategories)
                                        : dc.applicableCategory?.trim()
                                            ? (recalcCategorySubtotals[dc.applicableCategory.trim().toLowerCase()] ?? 0)
                                            : lineItemsSubtotal;
                                    let contrib = dc.type === 'percentage' ? (baseAmount * val) / 100 : Math.min(val, baseAmount);
                                    if (dc.maxDiscountAmount != null && dc.maxDiscountAmount > 0) contrib = Math.min(contrib, dc.maxDiscountAmount);
                                    recalcDiscount += contrib;
                                }
                            }
                            recalcDiscount = Math.min(recalcDiscount, lineItemsSubtotal);
                            const taxAmount = parseFloat(updatedCart.cost?.totalTaxAmount?.amount || '0');
                            updatedPayment.discount = recalcDiscount;
                            updatedPayment.total = Math.max(0, lineItemsSubtotal - recalcDiscount) + taxAmount;

                            const hasSchoolCoupon = discountCodesFromCart.some((dc: any) => dc.isSchoolCoupon);
                            set({
                                discountCodes: discountCodesFromCart,
                                payment: updatedPayment,
                                checkoutUrl: updatedCart.checkoutUrl || state.checkoutUrl,
                                status: 'idle',
                                error: null,
                                lastSyncedAt: Date.now(),
                                ...(!hasSchoolCoupon ? { schoolCouponData: null } : {}),
                            });
                            console.log('[CartStore] ✅ State updated with new discount codes and payment');

                            const appliedCode = discountCodesFromCart.find(
                                (dc: DiscountCode) =>
                                    dc.code.toUpperCase() === normalizedCode && dc.applicable !== false
                            );
                            console.log('[CartStore] Applied code check:', { normalizedCode, codeToApply, appliedCode });

                            if (!appliedCode) {
                                // If code was validated by backend, it should have been added above
                                if (configDiscount) {
                                    console.log('[CartStore] Code in config but not applied, forcing application');
                                    // This shouldn't happen, but just in case
                                    return { success: true };
                                }

                                const errorCode = discountCodesFromCart.find(
                                    (dc: DiscountCode) =>
                                        dc.code.toUpperCase() === normalizedCode && dc.applicable === false
                                );
                                console.log('[CartStore] ❌ Code not applied. Error code:', errorCode);
                                return {
                                    success: false,
                                    error: errorCode
                                        ? 'This discount code is not valid or not applicable to your cart.'
                                        : 'Failed to apply discount code',
                                };
                            }

                            console.log('[CartStore] ✅ Code successfully applied:', appliedCode);
                            console.log('[CartStore] ========== APPLY DISCOUNT CODE END (SUCCESS) ==========');
                            return { success: true };
                        }
                    } catch (error: any) {
                        console.error('[CartStore] Error creating Shopify cart for discount:', error);
                        const msg = error?.message || '';
                        const invalidVariantId = parseInvalidVariantFromError(msg);
                        if (invalidVariantId) {
                            const state = get();
                            const kept = state.lineItems.filter((item) => !lineItemMatchesVariant(item, invalidVariantId));
                            if (kept.length < state.lineItems.length) {
                                set({ lineItems: kept, status: 'idle', error: null });
                                return {
                                    success: false,
                                    error: 'An item in your cart is no longer available and was removed. Please try applying your discount again.',
                                };
                            }
                        }
                        set({ status: 'idle', error: msg });
                        return { success: false, error: msg || 'Failed to apply discount code' };
                    }
                }

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

                    // Only apply the new code
                    codesToApply = [codeToApply];
                    console.log('[CartStore] Codes to apply to Shopify:', codesToApply);

                    // Apply discount codes via Shopify API
                    console.log('[CartStore] Calling shopifyApi.applyDiscountCodes with:', { cartId, codesToApply });
                    const updatedCart = await shopifyApi.applyDiscountCodes(cartId, codesToApply);
                    console.log('[CartStore] Shopify API response:', {
                        hasCart: !!updatedCart,
                        discountCodes: updatedCart?.discountCodes,
                        discountAllocations: updatedCart?.discountAllocations,
                        cost: updatedCart?.cost,
                    });

                    if (!updatedCart) {
                        throw new Error('Failed to apply discount code');
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

                    // Fetch eligible coupons from backend (source of truth for values)
                    const { couponService } = await import('@/services/couponService');
                    const { useUserStore } = await import('@/store/userStore');
                    const userStore = useUserStore.getState();
                    const phone = userStore.user?.phone ?? null;
                    const lineItemsForCoupons = get().lineItems;
                    const eligibleCoupons = await couponService.getEligibleCouponsFromBackend({
                        phone,
                        cartSubTotal: cartSubtotal,
                        cartItemCount,
                        hasTicketing: hasTicketingProducts,
                        hasClothing: hasClothingItems,
                        cartCategories: getCartCategoriesFromLineItems(lineItemsForCoupons),
                        appVersion: getAppVersionForApi(),
                        deviceType: Platform.OS ?? '',
                        includeHiddenCoupons: true,
                    });
                    const backendCouponMap = new Map(eligibleCoupons.map((c: any) => [c.code?.toUpperCase(), c]));

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
                        const maxCap2 = backendCoupon?.maxDiscountAmount != null ? Number(backendCoupon.maxDiscountAmount) : undefined;
                        const rawOrig2 = backendCoupon?.originalPrice ?? (backendCoupon as any)?.original_price;
                        const origPrice2 = typeof rawOrig2 === 'number' && Number.isFinite(rawOrig2) ? rawOrig2 : typeof rawOrig2 === 'string' ? parseFloat(rawOrig2) : undefined;
                        const existing2 = state.discountCodes.find((d) => d.code.toUpperCase() === dc.code?.toUpperCase());
                        const originalPrice2 = options?.originalPrice ?? origPrice2 ?? existing2?.originalPrice;
                        const bT2 = (backendCoupon as { title?: string } | undefined)?.title;
                        const bD2 = (backendCoupon as { description?: string } | undefined)?.description;
                        const cTitle2 =
                            (bT2 != null && String(bT2).trim() !== '' ? String(bT2).trim() : undefined) ?? existing2?.couponTitle;
                        const cDesc2 =
                            (bD2 != null && String(bD2).trim() !== '' ? String(bD2).trim() : undefined)
                            ?? existing2?.couponDescription;
                        return {
                            code: String(dc.code ?? '').trim(),
                            type: discountType,
                            value: discountValue,
                            applicable: isApplicable,
                            appliedAt: Date.now(),
                            maxDiscountAmount: maxCap2,
                            ...(originalPrice2 != null ? { originalPrice: originalPrice2 } : {}),
                            ...(backendCoupon?.applicableCategory != null ? { applicableCategory: backendCoupon.applicableCategory } : {}),
                            ...(backendCoupon?.allowedCategories?.length ? { allowedCategories: backendCoupon.allowedCategories } : {}),
                            ...(cTitle2 != null && cTitle2 !== '' ? { couponTitle: cTitle2 } : {}),
                            ...(cDesc2 != null && cDesc2 !== '' ? { couponDescription: cDesc2 } : {}),
                        };
                    });

                    // If code not in Shopify response (Shopify rejected it), add from backend.
                    // If code is in response but applicable is false (Shopify doesn't have it), override with backend so it stays applied.
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
                            ...(cT2 != null ? { couponTitle: cT2 } : {}),
                            ...(cD2 != null ? { couponDescription: cD2 } : {}),
                        };
                        if (!codeInResponse) {
                            console.log('[CartStore] Code not in Shopify response, adding from backend:', normalizedCode);
                            discountCodesFromCart.push(backendEntry);
                        } else if (codeInResponse.applicable === false || codeInResponse.value === 0) {
                            console.log('[CartStore] Code in response but not applicable/zero, overriding from backend:', normalizedCode);
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
                                discountCodesFromCart[idx] = {
                                    ...discountCodesFromCart[idx],
                                    ...(configDiscount.applicableCategory != null ? { applicableCategory: configDiscount.applicableCategory } : {}),
                                    ...(configDiscount.allowedCategories?.length ? { allowedCategories: configDiscount.allowedCategories } : {}),
                                    isSchoolCoupon: configDiscount.isSchoolCoupon === true,
                                    isMilestone: configDiscount.isMilestone === true || codeToApply.toUpperCase() === 'FOURTHMILESTONE',
                                    ...(ct2 != null ? { couponTitle: ct2 } : {}),
                                    ...(cd2 != null ? { couponDescription: cd2 } : {}),
                                };
                            }
                        }
                    }

                    const lineItemsSubtotal = state.lineItems.reduce((sum, item) => {
                        return sum + (Number(item.price ?? 0) * Number(item.quantity));
                    }, 0);
                    const recalcCategorySubtotals = getCartCategorySubtotalsFromLineItems(state.lineItems);
                    let recalcDiscount = 0;
                    for (const dc of discountCodesFromCart) {
                        const val = Number(dc.value ?? 0);
                        if (dc.applicable !== false && val > 0) {
                            const baseAmount = dc.allowedCategories?.length
                                ? getSubtotalForAllowedCategories(state.lineItems, dc.allowedCategories)
                                : dc.applicableCategory?.trim()
                                    ? (recalcCategorySubtotals[dc.applicableCategory.trim().toLowerCase()] ?? 0)
                                    : lineItemsSubtotal;
                            let contrib = dc.type === 'percentage' ? (baseAmount * val) / 100 : Math.min(val, baseAmount);
                            if (dc.maxDiscountAmount != null && dc.maxDiscountAmount > 0) contrib = Math.min(contrib, dc.maxDiscountAmount);
                            recalcDiscount += contrib;
                        }
                    }
                    recalcDiscount = Math.min(recalcDiscount, lineItemsSubtotal);
                    const taxAmount = parseFloat(updatedCart.cost?.totalTaxAmount?.amount || '0');
                    const updatedPayment: CartPayment = {
                        subtotal: lineItemsSubtotal,
                        discount: recalcDiscount,
                        shipping: 0,
                        tax: taxAmount,
                        total: Math.max(0, lineItemsSubtotal - recalcDiscount) + taxAmount,
                        currencyCode: updatedCart.cost?.totalAmount?.currencyCode || 'INR',
                    };
                    const hasSchoolCoupon = discountCodesFromCart.some((dc: any) => dc.isSchoolCoupon);
                    set({
                        discountCodes: discountCodesFromCart,
                        payment: updatedPayment,
                        checkoutUrl: updatedCart.checkoutUrl || state.checkoutUrl,
                        status: 'idle',
                        error: null,
                        lastSyncedAt: Date.now(),
                        ...(!hasSchoolCoupon ? { schoolCouponData: null } : {}),
                    });
                    console.log('[CartStore] ✅ Code successfully applied (existing cart path)');
                    return { success: true };
                } catch (error: any) {
                    console.error('[CartStore] Error applying discount code to existing cart:', error);
                    set({ status: 'idle', error: error.message });
                    return { success: false, error: error.message || 'Failed to apply discount code' };
                }

            },

            removeDiscountCode: async (code) => {
                const state = get();
                const normalizedCode = code.toUpperCase();
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
                        const codesToApply = updatedDiscountCodes.map((dc) => dc.code);
                        await shopifyApi.applyDiscountCodes(cartId, codesToApply);
                    } catch (e) {
                        console.warn('[CartStore] Failed to sync discount codes to Shopify cart after remove', e);
                    }
                }

                let subtotal = state.subtotal();
                let tax = state.payment?.tax ?? 0;
                const currencyCode = state.payment?.currencyCode || 'INR';
                if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                    try {
                        const cart = await shopifyApi.getCart(cartId);
                        subtotal = parseFloat(cart.cost?.subtotalAmount?.amount || '0');
                        tax = parseFloat(cart.cost?.totalTaxAmount?.amount || '0');
                    } catch {
                        // keep subtotal/tax from state
                    }
                }

                let discount = 0;
                updatedDiscountCodes.forEach((dc) => {
                    if (dc.applicable !== false) {
                        const val = Number(dc.value ?? 0);
                        if (dc.type === 'percentage') discount += (subtotal * val) / 100;
                        else discount += val;
                    }
                });
                const currentShipping = state.shippingFee();
                discount = Math.min(discount, subtotal);
                const total = Math.max(0, subtotal - discount + currentShipping + tax);

                set({
                    payment: {
                        subtotal,
                        discount,
                        shipping: currentShipping,
                        tax,
                        total,
                        currencyCode,
                    },
                    status: 'idle',
                    error: null,
                    lastSyncedAt: Date.now(),
                });
                get().syncDeliveryFeeToShopify();
            },

            removeAllDiscountCodes: async () => {
                const state = get();
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

                let subtotal = state.subtotal();
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
                    status: 'idle',
                    error: null,
                    lastSyncedAt: Date.now(),
                });
                get().syncDeliveryFeeToShopify();
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
                                return {
                                    ...item,
                                    price: parseFloat(updated.price?.amount || item.price),
                                    compareAtPrice: updated.compareAtPrice?.amount
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

            // Fetch cart from Shopify
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
                        const lineItems: CartItem[] = cart.lines?.edges?.map((edge: any) => {
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
                            return {
                                id: node.id,
                                productId: node.merchandise?.product?.id,
                                variantId: node.merchandise?.id,
                                title: node.merchandise?.product?.title,
                                variantTitle: node.merchandise?.title,
                                price: parseFloat(node.cost?.amountPerQuantity?.amount || '0'),
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
                            const maxCapFetch = backendCoupon?.maxDiscountAmount != null ? Number(backendCoupon.maxDiscountAmount) : undefined;
                            return {
                                code: String(dc.code ?? '').trim(),
                                type: discountType,
                                value: discountValue,
                                applicable: isApplicable,
                                appliedAt: Date.now(),
                                maxDiscountAmount: maxCapFetch,
                                isMilestone: backendCoupon?.isMilestone === true || dc.code.toUpperCase() === 'FOURTHMILESTONE',
                                ...(backendCoupon?.applicableCategory != null ? { applicableCategory: backendCoupon.applicableCategory } : {}),
                                ...(backendCoupon?.allowedCategories?.length ? { allowedCategories: backendCoupon.allowedCategories } : {}),
                            };
                        });

                        // Re-inject missing milestone coupons (e.g. FOURTHMILESTONE) if they were applied but Shopify didn't return them
                        state.discountCodes.forEach(dc => {
                            if (dc.isMilestone && !discountCodesFromCart.some(newDc => newDc.code.toUpperCase() === dc.code.toUpperCase())) {
                                discountCodesFromCart.push(dc);
                            }
                        });

                        const lineItemsSubtotal = lineItems.reduce((sum, item) => {
                            return sum + (Number(item.price ?? 0) * Number(item.quantity));
                        }, 0);
                        const fetchCategorySubtotals = getCartCategorySubtotalsFromLineItems(lineItems);
                        let discount = 0;
                        discountCodesFromCart.forEach((dc: DiscountCode) => {
                            if (dc.applicable !== false) {
                                const val = Number(dc.value ?? 0);
                                const baseAmount = dc.allowedCategories?.length
                                    ? getSubtotalForAllowedCategories(lineItems, dc.allowedCategories)
                                    : dc.applicableCategory?.trim()
                                        ? (fetchCategorySubtotals[dc.applicableCategory.trim().toLowerCase()] ?? 0)
                                        : lineItemsSubtotal;
                                let contrib = dc.type === 'percentage' ? (baseAmount * val) / 100 : Math.min(val, baseAmount);
                                if (dc.maxDiscountAmount != null && dc.maxDiscountAmount > 0) contrib = Math.min(contrib, dc.maxDiscountAmount);
                                discount += contrib;
                            }
                        });
                        discount = Math.min(discount, lineItemsSubtotal);
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
                            status: 'idle',
                            lastSyncedAt: Date.now(),
                        });
                        get().syncDeliveryFeeToShopify();
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