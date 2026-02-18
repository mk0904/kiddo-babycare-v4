// Zustand Store - Cart Slice
// Enhanced cart state management with gift items, multiple discounts, and sync
// Coupon values come from backend API only (not config)

import { shopifyApi } from '@/services/shopifyApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

    // Computed getters
    itemCount: () => number;
    mrp: () => number;
    subtotal: () => number;
    discountAmount: () => number;
    total: () => number;

    // Actions
    setStatus: (status: CartStatus) => void;
    setError: (error: string | null) => void;

    // Cart operations
    addItem: (item: Omit<CartItem, 'id'>) => Promise<void>;
    removeItem: (itemId: string) => Promise<void>;
    updateQuantity: (itemId: string, quantity: number) => Promise<void>;
    clearCart: () => void;

    // Gift items
    addGiftItem: (gift: Omit<GiftItem, 'isApplied'>) => void;
    removeGiftItem: (giftId: string) => void;
    applyEligibleGifts: () => void;

    // Discount codes
    applyDiscountCode: (code: string) => Promise<{ success: boolean; error?: string }>;
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

    // Cart management
    ensureCart: () => Promise<string | null>;
    getCheckoutUrl: () => Promise<string | null>;
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

            discountAmount: () => {
                const state = get();
                console.log('[CartStore] discountAmount() called');
                console.log('[CartStore] Current payment:', state.payment);
                console.log('[CartStore] Current discountCodes:', state.discountCodes);
                console.log('[CartStore] Current subtotal:', state.subtotal());
                
                // Use payment.discount from Shopify if available (most accurate)
                if (state.payment && state.payment.discount > 0) {
                    console.log('[CartStore] Using payment.discount from Shopify:', state.payment.discount);
                    return state.payment.discount;
                }
                
                // Fallback: calculate from discount codes if payment not available
                let discount = 0;
                state.discountCodes.forEach((dc) => {
                    if (dc.applicable !== false) {
                        if (dc.type === 'percentage') {
                            const codeDiscount = (state.subtotal() * dc.value) / 100;
                            console.log(`[CartStore] Code ${dc.code}: ${dc.value}% = ${codeDiscount}`);
                            discount += codeDiscount;
                        } else if (dc.type === 'fixed') {
                            console.log(`[CartStore] Code ${dc.code}: Fixed ${dc.value}`);
                            discount += dc.value;
                        }
                    } else {
                        console.log(`[CartStore] Code ${dc.code} is not applicable, skipping`);
                    }
                });
                // Cap discount to not exceed subtotal (prevent negative totals)
                const finalDiscount = Math.min(discount, state.subtotal());
                console.log('[CartStore] Calculated total discount:', discount, 'Final (capped):', finalDiscount);
                return finalDiscount;
            },
            
            // Validate and remove discount codes that no longer meet conditions
            validateAppliedDiscountCodes: async () => {
                const state = get();
                if (state.discountCodes.length === 0) {
                    return;
                }
                
                console.log('[CartStore] Validating applied discount codes after cart change...');
                const cartSubtotal = state.subtotal();
                const cartItemCount = state.itemCount();
                
                try {
                    const { couponService } = await import('@/services/couponService');
                    const { useUserStore } = await import('@/store/userStore');
                    
                    // Get user ID for usage limit checking
                    const userStore = useUserStore.getState();
                    const userId = userStore.user?.id || userStore.user?.customerId || userStore.user?.email || userStore.user?.phone || null;
                    
                    // Check cart contents
                    const hasTicketingProducts = state.lineItems.some(item => {
                        if (item.bookingDate) return true;
                        const hasTicketingTag = item.tags?.some((tag: any) => {
                            const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
                            return tagLower.includes('event') || 
                                   tagLower.includes('playhouse') || 
                                   tagLower.includes('petting') ||
                                   tagLower.includes('farm') ||
                                   tagLower.includes('ticket') ||
                                   tagLower.includes('pass');
                        });
                        return hasTicketingTag;
                    });
                    
                    const hasClothingItems = state.lineItems.some(item => {
                        return item.tags?.some(
                            (tag: string) => typeof tag === 'string' && tag.toLowerCase() === 'fashion'
                        );
                    });

                    const couponParams = {
                        userId,
                        cartSubTotal: cartSubtotal,
                        cartItemCount,
                        hasTicketing: hasTicketingProducts,
                        hasClothing: hasClothingItems,
                    };
                    
                    const validCodes: DiscountCode[] = [];
                    const removedCodes: string[] = [];
                    
                    for (const discountCode of state.discountCodes) {
                        // Validate via backend (eligibility decided by backend)
                        const eligibleCoupon = await couponService.validateCouponCode(discountCode.code, couponParams);
                        if (eligibleCoupon) {
                            validCodes.push(discountCode);
                        } else {
                            console.log(`[CartStore] Removing ${discountCode.code}: No longer eligible (backend)`);
                            removedCodes.push(discountCode.code);
                        }
                    }
                    
                    // Update discount codes if any were removed
                    if (removedCodes.length > 0) {
                        console.log('[CartStore] Removed invalid discount codes:', removedCodes);
                        set({ discountCodes: validCodes });
                        
                        // Also remove from Shopify cart if we have a cart ID
                        const cartId = state.id;
                        if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                            try {
                                const { shopifyApi } = await import('@/services/shopifyApi');
                                const codesToApply = validCodes.map(dc => dc.code);
                                await shopifyApi.applyDiscountCodes(cartId, codesToApply);
                                console.log('[CartStore] Updated Shopify cart with valid codes only');
                            } catch (error) {
                                console.error('[CartStore] Error updating Shopify cart:', error);
                            }
                        }
                    }
                } catch (error) {
                    console.error('[CartStore] Error validating discount codes:', error);
                }
            },

            total: () => {
                const state = get();
                // Use payment.total from Shopify if available (most accurate)
                if (state.payment && state.payment.total > 0) {
                    return state.payment.total;
                }
                
                // Fallback: calculate from subtotal and discount
                return Math.max(0, state.subtotal() - state.discountAmount());
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

                    let newLineItems: CartItem[];

                    if (existingIndex >= 0) {
                        // Update quantity
                        newLineItems = state.lineItems.map((li, idx) =>
                            idx === existingIndex
                                ? { ...li, quantity: li.quantity + item.quantity }
                                : li
                        );
                    } else {
                        // Add new item
                        const newItem: CartItem = {
                            ...item,
                            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        };
                        newLineItems = [...state.lineItems, newItem];
                    }

                    set({
                        lineItems: newLineItems,
                        status: 'idle',
                        error: null,
                    });

                    // Track Add to Cart event
                    try {
                        const { mixpanel } = require('@/mixpanel');
                        if (mixpanel) {
                            mixpanel.track('Add to Cart', {
                                productId: item.productId,
                                productName: item.title,
                                variantId: item.variantId,
                                price: item.price,
                                quantity: item.quantity,
                                currency: item.currencyCode || 'INR',
                            });
                        }
                    } catch (e) {
                        console.warn('Mixpanel tracking error:', e);
                    }

                    // Check for eligible gifts after adding item
                    get().applyEligibleGifts();
                    
                    // Check if cart now has ticketing products - remove coupons if so
                    const hasTicketingProducts = newLineItems.some(item => {
                        if (item.bookingDate) return true;
                        const hasTicketingTag = item.tags?.some((tag: any) => {
                            const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
                            return tagLower.includes('event') || 
                                   tagLower.includes('playhouse') || 
                                   tagLower.includes('petting') ||
                                   tagLower.includes('farm');
                        });
                        return hasTicketingTag;
                    });

                    if (hasTicketingProducts && get().discountCodes.length > 0) {
                        console.log('[CartStore] Removing coupons - cart contains ticketing products');
                        await get().removeAllDiscountCodes();
                    }
                    
                    // Validate applied discount codes (they might no longer meet conditions)
                    await get().validateAppliedDiscountCodes();
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

                    // Re-check gift eligibility
                    get().applyEligibleGifts();
                    
                    // Validate applied discount codes (they might no longer meet conditions)
                    await get().validateAppliedDiscountCodes();
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

                    const newLineItems = state.lineItems.map((li) =>
                        li.id === itemId ? { ...li, quantity } : li
                    );

                    set({
                        lineItems: newLineItems,
                        status: 'idle',
                        error: null,
                    });

                    // Re-check gift eligibility
                    get().applyEligibleGifts();
                    
                    // Validate applied discount codes (they might no longer meet conditions)
                    await get().validateAppliedDiscountCodes();
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
            applyDiscountCode: async (code) => {
                console.log('[CartStore] ========== APPLY DISCOUNT CODE START ==========');
                console.log('[CartStore] Input code:', code);
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
                const hasClothingItems = state.lineItems.some(item => {
                    return item.tags?.some(
                        (tag: string) => typeof tag === 'string' && tag.toLowerCase() === 'fashion'
                    );
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

                // Validate code via backend (eligibility decided by backend)
                let configDiscount: any = null;
                try {
                    const { couponService } = await import('@/services/couponService');
                    const { useUserStore } = await import('@/store/userStore');
                    const userStore = useUserStore.getState();
                    const userId = userStore.user?.id || userStore.user?.customerId || userStore.user?.email || userStore.user?.phone || null;

                    const couponParams = {
                        userId,
                        cartSubTotal: cartSubtotal,
                        cartItemCount,
                        hasTicketing: hasTicketingProducts,
                        hasClothing: hasClothingItems,
                    };
                    configDiscount = await couponService.validateCouponCode(normalizedCode, couponParams);
                    if (configDiscount) {
                        console.log('[CartStore] ✅ Code eligible (backend):', configDiscount);
                    } else {
                        console.log('[CartStore] ❌ Code not eligible');
                        return { success: false, error: 'This discount code is not valid.' };
                    }
                } catch (error) {
                    console.error('[CartStore] Error validating code:', error);
                    return { success: false, error: 'Failed to validate discount code.' };
                }

                // Check if code is already applied
                const isAlreadyApplied = state.discountCodes.some(
                    (dc) => dc.code.toUpperCase() === normalizedCode && dc.applicable !== false
                );
                if (isAlreadyApplied) {
                    console.log('[CartStore] ❌ Code already applied');
                    return { success: false, error: 'Discount code already applied' };
                }

                // Check if this coupon is non-combinable and there are existing coupons
                if (configDiscount.nonCombinable) {
                    const existingApplicableCodes = state.discountCodes.filter(
                        (dc) => dc.applicable !== false && dc.code.toUpperCase() !== normalizedCode
                    );
                    if (existingApplicableCodes.length > 0) {
                        console.log('[CartStore] ❌ Non-combinable coupon cannot be used with existing coupons');
                        return { 
                            success: false, 
                            error: 'This coupon cannot be combined with other discount codes. Please remove existing coupons first.' 
                        };
                    }
                }

                // Check if there are existing non-combinable coupons when applying a new one
                const existingNonCombinableCodes = state.discountCodes.filter(
                    (dc) => dc.applicable !== false && dc.code.toUpperCase() !== normalizedCode
                );
                if (existingNonCombinableCodes.length > 0) {
                    // Check if any existing coupon is non-combinable
                    try {
                        const { couponService } = await import('@/services/couponService');
                        const { useUserStore } = await import('@/store/userStore');
                        const userStore = useUserStore.getState();
                        const userId = userStore.user?.id || userStore.user?.customerId || userStore.user?.email || userStore.user?.phone || null;
                        const couponParams = {
                            userId,
                            cartSubTotal: cartSubtotal,
                            cartItemCount,
                            hasTicketing: hasTicketingProducts,
                            hasClothing: hasClothingItems,
                        };
                        for (const existingCode of existingNonCombinableCodes) {
                            const existingConfigDiscount = await couponService.validateCouponCode(existingCode.code, couponParams);
                            if (existingConfigDiscount && existingConfigDiscount.nonCombinable) {
                                console.log('[CartStore] ❌ Cannot apply coupon - existing non-combinable coupon found');
                                return { 
                                    success: false, 
                                    error: 'A non-combinable coupon is already applied. Please remove it first before applying another coupon.' 
                                };
                            }
                        }
                    } catch (error) {
                        console.error('[CartStore] Error checking existing coupons for non-combinable:', error);
                    }
                }

                // Ensure cart exists
                const cartId = await get().ensureCart();
                console.log('[CartStore] Cart ID:', cartId);
                if (!cartId) {
                    console.log('[CartStore] ❌ No cart ID found');
                    return { success: false, error: 'Cart not found. Please add items to cart first.' };
                }

                // Check if cartId is a valid Shopify cart ID (starts with 'gid://shopify/Cart/')
                // If it's a local cart ID, we need to create a real Shopify cart first
                const isShopifyCartId = cartId.startsWith('gid://shopify/Cart/');
                console.log('[CartStore] Is Shopify cart ID?', isShopifyCartId);
                
                if (!isShopifyCartId) {
                    // Try to create a Shopify cart if we have items
                    if (state.lineItems.length === 0) {
                        return { success: false, error: 'Cart is empty. Please add items to cart first.' };
                    }
                    
                    try {
                        const lines = state.lineItems.map(item => ({
                            merchandiseId: item.variantId,
                            quantity: item.quantity,
                        }));
                        
                        const newCart = await shopifyApi.createCart(lines);
                        if (newCart && newCart.id) {
                            set({ id: newCart.id, webUrl: newCart.checkoutUrl, checkoutUrl: newCart.checkoutUrl });
                            // Use the new Shopify cart ID
                            const shopifyCartId = newCart.id;
                            
                            // Apply discount code to the new cart
                            const codesToApply = [normalizedCode];
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
                            const userId = userStore.user?.id || userStore.user?.customerId || userStore.user?.email || userStore.user?.phone || null;
                            const eligibleCoupons = await couponService.getEligibleCouponsFromBackend({
                                userId,
                                cartSubTotal: cartSubtotal,
                                cartItemCount,
                                hasTicketing: hasTicketingProducts,
                                hasClothing: hasClothingItems,
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
                                    discountValue = backendCoupon.value != null ? backendCoupon.value : 0;
                                    discountType = backendCoupon.valueType === 'fixed_amount' ? 'fixed' : 'percentage';
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
                                
                                return {
                                    code: dc.code.toUpperCase(),
                                    type: discountType,
                                    value: discountValue,
                                    applicable: isApplicable,
                                    appliedAt: Date.now(),
                                };
                            });
                            
                            // Calculate subtotal from lineItems (like gauntlet does)
                            // Don't use Shopify's cost.subtotalAmount as it may not match our lineItems
                            const lineItemsSubtotal = state.lineItems.reduce((sum, item) => {
                                return sum + (Number(item.price ?? 0) * Number(item.quantity));
                            }, 0);
                            
                            const updatedPayment: CartPayment = {
                                subtotal: lineItemsSubtotal, // Calculate from lineItems, not Shopify's cost.subtotalAmount
                                discount: totalDiscountAmount,
                                shipping: 0,
                                tax: parseFloat(updatedCart.cost?.totalTaxAmount?.amount || '0'),
                                total: parseFloat(updatedCart.cost?.totalAmount?.amount || '0'),
                                currencyCode: updatedCart.cost?.totalAmount?.currencyCode || 'INR',
                            };
                            console.log('[CartStore] Updated payment object:', updatedPayment);
                            console.log('[CartStore] Discount codes to save:', discountCodesFromCart);

                            // If code not in Shopify response (Shopify rejected it), add from backend
                            const codeInResponse = discountCodesFromCart.find(
                                (dc: DiscountCode) => dc.code === normalizedCode
                            );
                            
                            if (!codeInResponse && configDiscount) {
                                console.log('[CartStore] Code not in Shopify response, adding from backend:', normalizedCode);
                                const discountValue = configDiscount.value != null ? configDiscount.value : 0;
                                const discountType = configDiscount.valueType === 'fixed_amount' ? 'fixed' : 'percentage';
                                
                                discountCodesFromCart.push({
                                    code: normalizedCode,
                                    type: discountType as 'percentage' | 'fixed',
                                    value: discountValue,
                                    applicable: true,
                                    appliedAt: Date.now(),
                                });
                                console.log('[CartStore] Added code from backend:', {
                                    code: normalizedCode,
                                    type: discountType,
                                    value: discountValue,
                                });
                            }

                            set({
                                discountCodes: discountCodesFromCart,
                                payment: updatedPayment,
                                checkoutUrl: updatedCart.checkoutUrl || state.checkoutUrl,
                                status: 'idle',
                                error: null,
                                lastSyncedAt: Date.now(),
                            });
                            console.log('[CartStore] ✅ State updated with new discount codes and payment');
                            
                            const appliedCode = discountCodesFromCart.find(
                                (dc: DiscountCode) => dc.code === normalizedCode && dc.applicable !== false
                            );
                            console.log('[CartStore] Applied code check:', { normalizedCode, appliedCode });
                            
                            if (!appliedCode) {
                                // If code is in config, it should have been added above, so this shouldn't happen
                                // But if it does, check if we have the config discount
                                if (configDiscount) {
                                    console.log('[CartStore] Code in config but not applied, forcing application');
                                    // This shouldn't happen, but just in case
                                    return { success: true };
                                }
                                
                                const errorCode = discountCodesFromCart.find(
                                    (dc: DiscountCode) => dc.code === normalizedCode && dc.applicable === false
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
                        set({ status: 'idle', error: error.message });
                        return { success: false, error: error.message || 'Failed to apply discount code' };
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
                            console.warn('[CartStore] Cart fetch failed, attempting to recreate cart:', cartError.message);
                            const lines = state.lineItems.map(item => ({
                                merchandiseId: item.variantId,
                                quantity: item.quantity,
                            }));
                            
                            const newCart = await shopifyApi.createCart(lines);
                            if (newCart && newCart.id) {
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

                    // Get already applied applicable codes (preserve existing applicable codes)
                    const alreadyAppliedCodes = (currentCart.discountCodes || [])
                        .filter((dc: any) => dc.applicable && dc.code)
                        .map((dc: any) => dc.code.toUpperCase());
                    console.log('[CartStore] Already applied codes:', alreadyAppliedCodes);

                    // Check if code is already applied
                    if (alreadyAppliedCodes.includes(normalizedCode)) {
                        console.log('[CartStore] ❌ Code already applied');
                        set({ status: 'idle' });
                        return { success: false, error: 'Discount code already applied' };
                    }

                    // If this coupon is non-combinable, remove all existing coupons
                    let codesToApply: string[];
                    if (configDiscount.nonCombinable) {
                        console.log('[CartStore] Non-combinable coupon - removing existing coupons');
                        codesToApply = [normalizedCode];
                    } else {
                        // Combine new code with existing applicable codes
                        codesToApply = [normalizedCode, ...alreadyAppliedCodes];
                    }
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
                    const userId = userStore.user?.id || userStore.user?.customerId || userStore.user?.email || userStore.user?.phone || null;
                    const eligibleCoupons = await couponService.getEligibleCouponsFromBackend({
                        userId,
                        cartSubTotal: cartSubtotal,
                        cartItemCount,
                        hasTicketing: hasTicketingProducts,
                        hasClothing: hasClothingItems,
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
                            discountValue = backendCoupon.value != null ? backendCoupon.value : 0;
                            discountType = backendCoupon.valueType === 'fixed_amount' ? 'fixed' : 'percentage';
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

                        return {
                            code: dc.code.toUpperCase(),
                            type: discountType,
                            value: discountValue,
                            applicable: isApplicable,
                        appliedAt: Date.now(),
                        };
                    });
                    
                    // If code not in Shopify response (Shopify rejected it), add from backend
                    const codeInResponse = discountCodesFromCart.find(
                        (dc: DiscountCode) => dc.code === normalizedCode
                    );
                    
                    if (!codeInResponse && configDiscount) {
                        console.log('[CartStore] Code not in Shopify response, adding from backend:', normalizedCode);
                        const discountValue = configDiscount.value != null ? configDiscount.value : 0;
                        const discountType = configDiscount.valueType === 'fixed_amount' ? 'fixed' : 'percentage';
                        
                        discountCodesFromCart.push({
                            code: normalizedCode,
                            type: discountType as 'percentage' | 'fixed',
                            value: discountValue,
                            applicable: true, // Force applicable since it's in config
                            appliedAt: Date.now(),
                        });
                        console.log('[CartStore] Added code from config:', {
                            code: normalizedCode,
                            type: discountType,
                            value: discountValue,
                        });
                    }

                    // Update cart state with new discount codes and prices
                    // Note: subtotalAmount from Shopify is AFTER discounts
                    // We need to store the subtotal BEFORE discounts for proper display
                    const updatedPayment: CartPayment = {
                        subtotal: subtotalBeforeDiscount, // Store subtotal BEFORE discount for proper display
                        discount: totalDiscountAmount,
                        shipping: 0, // Will be calculated at checkout
                        tax: parseFloat(updatedCart.cost?.totalTaxAmount?.amount || '0'),
                        total: parseFloat(updatedCart.cost?.totalAmount?.amount || '0'),
                        currencyCode: updatedCart.cost?.totalAmount?.currencyCode || 'INR',
                    };
                    console.log('[CartStore] Updated payment object:', updatedPayment);
                    console.log('[CartStore] Discount codes to save:', discountCodesFromCart);

                    // Update state immediately
                    set({
                        discountCodes: discountCodesFromCart,
                        payment: updatedPayment,
                        checkoutUrl: updatedCart.checkoutUrl || state.checkoutUrl,
                        status: 'idle',
                        error: null,
                        lastSyncedAt: Date.now(),
                    });
                    console.log('[CartStore] ✅ State updated with new discount codes and payment');

                    // Check if the code was successfully applied
                    const appliedCode = discountCodesFromCart.find(
                        (dc: DiscountCode) => dc.code === normalizedCode && dc.applicable !== false
                    );
                    console.log('[CartStore] Applied code check:', { normalizedCode, appliedCode });

                    if (!appliedCode) {
                        // If code is in config, it should have been added above, so this shouldn't happen
                        // But if it does, check if we have the config discount
                        if (configDiscount) {
                            console.log('[CartStore] Code in config but not applied, forcing application');
                            // This shouldn't happen, but just in case
                            return { success: true };
                        }
                        
                        // Code was not applicable - find error message
                        const errorCode = discountCodesFromCart.find(
                            (dc: DiscountCode) => dc.code === normalizedCode && dc.applicable === false
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
                } catch (error: any) {
                    console.error('[CartStore] applyDiscountCode error:', error);
                    set({ status: 'idle', error: error.message });
                    return { success: false, error: error.message || 'Failed to apply discount code' };
                }
            },

            removeDiscountCode: async (code) => {
                console.log('[CartStore] ========== REMOVE DISCOUNT CODE START ==========');
                console.log('[CartStore] Code to remove:', code);
                const state = get();
                const normalizedCode = code.toUpperCase();
                console.log('[CartStore] Normalized code:', normalizedCode);
                console.log('[CartStore] Current discount codes:', state.discountCodes);

                // Ensure cart exists
                const cartId = await get().ensureCart();
                if (!cartId) {
                    return;
                }

                set({ status: 'loading' });

                try {
                    // Get current cart to see existing discount codes
                    const currentCart = await shopifyApi.getCart(cartId);
                    if (!currentCart) {
                        throw new Error('Failed to fetch cart');
                    }

                    // Get all applicable codes except the one to remove
                    const codesToKeep = (currentCart.discountCodes || [])
                        .filter((dc: any) => dc.applicable && dc.code && dc.code.toUpperCase() !== normalizedCode)
                        .map((dc: any) => dc.code.toUpperCase());
                    console.log('[CartStore] Codes to keep after removal:', codesToKeep);

                    // Apply remaining codes (or empty array if none)
                    console.log('[CartStore] Calling shopifyApi.applyDiscountCodes to remove code...');
                    const updatedCart = await shopifyApi.applyDiscountCodes(cartId, codesToKeep);
                    console.log('[CartStore] Updated cart after removal:', {
                        discountCodes: updatedCart?.discountCodes,
                        discountAllocations: updatedCart?.discountAllocations,
                        cost: updatedCart?.cost,
                    });

                    if (updatedCart) {
                        // Calculate total discount from all allocations
                        const totalDiscountAmount = (updatedCart.discountAllocations || []).reduce((sum: number, allocation: any) => {
                            return sum + parseFloat(allocation.discountedAmount?.amount || '0');
                        }, 0);
                        
                        // Get subtotal before discount (subtotalAmount is AFTER discounts)
                        // subtotalAmount from Shopify is the subtotal BEFORE discount (current selling prices)
                        const subtotalBeforeDiscount = parseFloat(updatedCart.cost?.subtotalAmount?.amount || '0');
                        const subtotalAfterDiscount = subtotalBeforeDiscount - totalDiscountAmount;

                        // Fetch eligible coupons from backend (source of truth for values)
                        const { couponService } = await import('@/services/couponService');
                        const { useUserStore } = await import('@/store/userStore');
                        const userStore = useUserStore.getState();
                        const userId = userStore.user?.id || userStore.user?.customerId || userStore.user?.email || userStore.user?.phone || null;
                        const removeCartSubtotal = state.subtotal();
                        const removeCartItemCount = state.itemCount();
                        const removeHasTicketing = state.lineItems.some((item: any) => item.bookingDate || item.tags?.some((t: string) => /event|playhouse|petting|farm|ticket|pass/i.test(String(t))));
                        const removeHasClothing = state.lineItems.some((item: any) => item.tags?.some((t: string) => String(t).toLowerCase() === 'fashion'));
                        const eligibleForRemove = await couponService.getEligibleCouponsFromBackend({
                            userId,
                            cartSubTotal: removeCartSubtotal,
                            cartItemCount: removeCartItemCount,
                            hasTicketing: removeHasTicketing,
                            hasClothing: removeHasClothing,
                        });
                        const backendCouponMapRemove = new Map(eligibleForRemove.map((c: any) => [c.code?.toUpperCase(), c]));

                        // Update discount codes from response
                        const discountCodesFromCart = (updatedCart.discountCodes || []).map((dc: any) => {
                            const isApplicable = dc.applicable !== false;
                            const matchingAllocation = (updatedCart.discountAllocations || []).find((alloc: any) => {
                                return alloc.code?.toUpperCase() === dc.code.toUpperCase();
                            });

                            let discountType: 'percentage' | 'fixed' | 'shipping' | 'bogo' = 'percentage';
                            let discountValue = 0;
                            let foundInBackend = false;
                            
                            const backendCoupon = backendCouponMapRemove.get(dc.code?.toUpperCase());
                            if (backendCoupon) {
                                foundInBackend = true;
                                discountValue = backendCoupon.value != null ? backendCoupon.value : 0;
                                discountType = backendCoupon.valueType === 'fixed_amount' ? 'fixed' : 'percentage';
                                console.log(`[CartStore] removeDiscountCode ${dc.code}: Using backend coupon - type: ${discountType}, value: ${discountValue}`);
                            }
                            
                            if (!foundInBackend && discountValue === 0 && matchingAllocation) {
                                const discountApp = matchingAllocation.discountApplication;
                                if (discountApp?.value?.percentage !== undefined) {
                                    discountValue = discountApp.value.percentage;
                                    discountType = 'percentage';
                                } else if (discountApp?.value?.amount) {
                                    discountValue = parseFloat(discountApp.value.amount);
                                    discountType = 'fixed';
                                } else if (matchingAllocation.discountedAmount?.amount) {
                                    const discountAmount = parseFloat(matchingAllocation.discountedAmount.amount);
                                    if (subtotalBeforeDiscount > 0 && discountAmount > 0) {
                                        discountValue = Math.round((discountAmount / subtotalBeforeDiscount) * 100);
                                        discountType = 'percentage';
                                    } else {
                                        discountValue = discountAmount;
                                        discountType = 'fixed';
                                    }
                                }
                            }

                            return {
                                code: dc.code.toUpperCase(),
                                type: discountType,
                                value: discountValue,
                                applicable: isApplicable,
                                appliedAt: Date.now(),
                            };
                        });

                        // Update payment info
                        const updatedPayment: CartPayment = {
                            subtotal: subtotalBeforeDiscount, // Store subtotal BEFORE discount
                            discount: totalDiscountAmount,
                            shipping: 0,
                            tax: parseFloat(updatedCart.cost?.totalTaxAmount?.amount || '0'),
                            total: parseFloat(updatedCart.cost?.totalAmount?.amount || '0'),
                            currencyCode: updatedCart.cost?.totalAmount?.currencyCode || 'INR',
                        };

                        set({
                            discountCodes: discountCodesFromCart,
                            payment: updatedPayment,
                            checkoutUrl: updatedCart.checkoutUrl || state.checkoutUrl,
                            status: 'idle',
                            lastSyncedAt: Date.now(),
                        });
                        console.log('[CartStore] ✅ Discount code removed. Updated state:', {
                            discountCodes: discountCodesFromCart,
                            payment: updatedPayment,
                        });
                    }
                } catch (error: any) {
                    console.error('[CartStore] ❌ removeDiscountCode error:', error);
                    // Even if API call fails, update local state to remove the code
                    const state = get();
                    const updatedDiscountCodes = state.discountCodes.filter(
                        (dc) => dc.code.toUpperCase() !== normalizedCode
                    );
                    
                    // Recalculate payment without the removed discount
                    const subtotal = state.subtotal();
                    let discount = 0;
                    updatedDiscountCodes.forEach((dc) => {
                        if (dc.applicable !== false) {
                            if (dc.type === 'percentage') {
                                discount += (subtotal * dc.value) / 100;
                            } else if (dc.type === 'fixed') {
                                discount += dc.value;
                            }
                        }
                    });
                    discount = Math.min(discount, subtotal);
                    
                    const updatedPayment: CartPayment = {
                        subtotal: subtotal,
                        discount: discount,
                        shipping: state.payment?.shipping || 0,
                        tax: state.payment?.tax || 0,
                        total: subtotal - discount,
                        currencyCode: state.payment?.currencyCode || 'INR',
                    };
                    
                    set({ 
                        status: 'idle', 
                        error: null,
                        discountCodes: updatedDiscountCodes,
                        payment: updatedPayment,
                    });
                }
                console.log('[CartStore] ========== REMOVE DISCOUNT CODE END ==========');
            },

            removeAllDiscountCodes: async () => {
                const state = get();

                // Ensure cart exists
                const cartId = await get().ensureCart();
                if (!cartId) {
                set({ discountCodes: [] });
                    return;
                }

                set({ status: 'loading' });

                try {
                    // Apply empty array to remove all codes
                    const updatedCart = await shopifyApi.applyDiscountCodes(cartId, []);

                    if (updatedCart) {
                        // Update payment info
                        const updatedPayment: CartPayment = {
                            subtotal: parseFloat(updatedCart.cost?.subtotalAmount?.amount || '0'),
                            discount: 0,
                            shipping: 0,
                            tax: parseFloat(updatedCart.cost?.totalTaxAmount?.amount || '0'),
                            total: parseFloat(updatedCart.cost?.totalAmount?.amount || '0'),
                            currencyCode: updatedCart.cost?.totalAmount?.currencyCode || 'INR',
                        };

                        set({
                            discountCodes: [],
                            payment: updatedPayment,
                            checkoutUrl: updatedCart.checkoutUrl || state.checkoutUrl,
                            status: 'idle',
                            lastSyncedAt: Date.now(),
                        });
                    } else {
                        set({ discountCodes: [], status: 'idle' });
                    }
                } catch (error: any) {
                    console.error('[CartStore] removeAllDiscountCodes error:', error);
                    set({ discountCodes: [], status: 'idle', error: error.message });
                }
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
                                return {
                                    ...item,
                                    price: parseFloat(updated.price?.amount || item.price),
                                    compareAtPrice: updated.compareAtPrice?.amount
                                        ? parseFloat(updated.compareAtPrice.amount)
                                        : item.compareAtPrice,
                                    availableForSale: updated.availableForSale ?? item.availableForSale,
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
                            return {
                                id: node.id,
                                productId: node.merchandise?.product?.id,
                                variantId: node.merchandise?.id,
                                title: node.merchandise?.product?.title,
                                variantTitle: node.merchandise?.title,
                                price: parseFloat(node.cost?.amountPerQuantity?.amount || '0'),
                                currencyCode: node.cost?.amountPerQuantity?.currencyCode || 'INR',
                                image: node.merchandise?.image?.url || '',
                                quantity: node.quantity,
                                availableForSale: node.merchandise?.availableForSale ?? true,
                                tags: node.merchandise?.product?.tags || [],
                                bookingDate: node.merchandise?.customAttributes?.find((a: any) => a.key === 'booking_date')?.value,
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
                        const userId = userStore.user?.id || userStore.user?.customerId || userStore.user?.email || userStore.user?.phone || null;
                        const fetchCartSubtotal = lineItems.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (i.quantity || 0), 0);
                        const fetchCartItemCount = lineItems.reduce((s: number, i: any) => s + (i.quantity || 0), 0);
                        const fetchHasTicketing = lineItems.some((item: any) => item.bookingDate || (item.tags || []).some((t: string) => /event|playhouse|petting|farm|ticket|pass/i.test(String(t))));
                        const fetchHasClothing = lineItems.some((item: any) => (item.tags || []).some((t: string) => String(t).toLowerCase() === 'fashion'));
                        const eligibleForFetch = await couponService.getEligibleCouponsFromBackend({
                            userId,
                            cartSubTotal: fetchCartSubtotal,
                            cartItemCount: fetchCartItemCount,
                            hasTicketing: fetchHasTicketing,
                            hasClothing: fetchHasClothing,
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
                                discountValue = backendCoupon.value != null ? backendCoupon.value : 0;
                                discountType = backendCoupon.valueType === 'fixed_amount' ? 'fixed' : 'percentage';
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
                                    // subtotalAmount is BEFORE discount
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

                            return {
                                code: dc.code.toUpperCase(),
                                type: discountType,
                                value: discountValue,
                                applicable: isApplicable,
                                appliedAt: Date.now(),
                            };
                        });

                        // Update payment info
                        // Calculate subtotal from lineItems (like gauntlet does)
                        // Don't use Shopify's cost.subtotalAmount as it may not match our lineItems
                        const lineItemsSubtotal = lineItems.reduce((sum, item) => {
                            return sum + (Number(item.price ?? 0) * Number(item.quantity));
                        }, 0);
                        
                        const updatedPayment: CartPayment = {
                            subtotal: lineItemsSubtotal, // Calculate from lineItems, not Shopify's cost.subtotalAmount
                            discount: totalDiscountAmount,
                            shipping: 0,
                            tax: parseFloat(cart.cost?.totalTaxAmount?.amount || '0'),
                            total: parseFloat(cart.cost?.totalAmount?.amount || '0'),
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
                set({ selectedShoe: shoeId });
            },

            // Ensure cart exists (create if needed)
            ensureCart: async () => {
                const state = get();
                if (state.id) {
                    return state.id;
                }

                // Create a Shopify cart if we have items
                if (state.lineItems.length > 0) {
                    try {
                        const lines = state.lineItems.map(item => ({
                            merchandiseId: item.variantId,
                            quantity: item.quantity,
                        }));

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