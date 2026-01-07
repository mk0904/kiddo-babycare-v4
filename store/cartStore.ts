// Zustand Store - Cart Slice
// Enhanced cart state management with gift items, multiple discounts, and sync

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shopifyApi } from '@/services/shopifyApi';

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
    appliedAt: number;
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
    lineItems: CartItem[];
    giftItems: GiftItem[];
    discountCodes: DiscountCode[];
    note: string;
    payment: CartPayment | null;
    status: CartStatus;
    error: string | null;
    lastSyncedAt: number | null;

    // Computed getters
    itemCount: () => number;
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

    // Sync
    syncCartPrices: () => Promise<void>;
    fetchCart: () => Promise<void>;

    // Note
    updateNote: (note: string) => void;
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
            lineItems: [],
            giftItems: [],
            discountCodes: [],
            note: '',
            payment: null,
            status: 'init',
            error: null,
            lastSyncedAt: null,

            // Computed getters
            itemCount: () => {
                return get().lineItems.reduce((sum, item) => sum + item.quantity, 0);
            },

            subtotal: () => {
                return get().lineItems.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                );
            },

            discountAmount: () => {
                const state = get();
                let discount = 0;

                state.discountCodes.forEach((dc) => {
                    if (dc.type === 'percentage') {
                        discount += (state.subtotal() * dc.value) / 100;
                    } else if (dc.type === 'fixed') {
                        discount += dc.value;
                    }
                });

                return Math.min(discount, state.subtotal());
            },

            total: () => {
                const state = get();
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
                    const newLineItems = state.lineItems.filter((li) => li.id !== itemId);

                    set({
                        lineItems: newLineItems,
                        status: 'idle',
                        error: null,
                    });

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
                const state = get();
                const normalizedCode = code.trim().toUpperCase();

                // Check if already applied
                if (state.discountCodes.some((dc) => dc.code === normalizedCode)) {
                    return { success: false, error: 'Discount code already applied' };
                }

                set({ status: 'loading' });

                try {
                    // Try to apply via Shopify API if cart exists
                    // For now, we'll simulate validation
                    // In production, call your backend to validate the code

                    const newDiscount: DiscountCode = {
                        code: normalizedCode,
                        type: 'percentage', // Would come from API
                        value: 10, // Would come from API
                        appliedAt: Date.now(),
                    };

                    set({
                        discountCodes: [...state.discountCodes, newDiscount],
                        status: 'idle',
                        error: null,
                    });

                    return { success: true };
                } catch (error: any) {
                    set({ status: 'idle', error: error.message });
                    return { success: false, error: error.message };
                }
            },

            removeDiscountCode: (code) => {
                set({
                    discountCodes: get().discountCodes.filter(
                        (dc) => dc.code !== code.toUpperCase()
                    ),
                });
            },

            removeAllDiscountCodes: () => {
                set({ discountCodes: [] });
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
                            };
                        }) || [];

                        set({
                            lineItems,
                            webUrl: cart.checkoutUrl,
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
        }),
        {
            name: 'cart-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                lineItems: state.lineItems,
                giftItems: state.giftItems,
                discountCodes: state.discountCodes,
                note: state.note,
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
