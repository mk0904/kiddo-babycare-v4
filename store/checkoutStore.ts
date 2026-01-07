// Checkout Store - Zustand slice for checkout flow state
// Handles checkout steps, selected address, payment method, and order creation

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface ShippingAddress {
    id: string;
    firstName: string;
    lastName: string;
    address1: string;
    address2?: string;
    city: string;
    province: string;
    provinceCode?: string;
    country: string;
    countryCode: string;
    zip: string;
    phone?: string;
    isDefault?: boolean;
}

export type PaymentMethod = 'razorpay' | 'cod' | 'try_and_buy' | 'upi';

export type CheckoutStep =
    | 'cart'
    | 'address_selection'
    | 'payment_selection'
    | 'processing'
    | 'success'
    | 'failed';

interface AppliedDiscount {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    amountOff: number;
}

interface CheckoutState {
    // Flow state
    step: CheckoutStep;
    isProcessing: boolean;

    // Selections
    selectedAddressId: string | null;
    selectedAddress: ShippingAddress | null;
    paymentMethod: PaymentMethod | null;

    // Discounts
    appliedDiscounts: AppliedDiscount[];
    nectorCoinsApplied: number;
    nectorDiscountCode: string | null;

    // Order info
    orderId: string | null;
    orderNumber: string | null;
    checkoutUrl: string | null;

    // Try & Buy specific
    isTryAndBuy: boolean;
    tryAndBuyItems: string[]; // variant IDs

    // Error handling
    error: string | null;
}

interface CheckoutActions {
    // Step navigation
    setStep: (step: CheckoutStep) => void;
    nextStep: () => void;
    prevStep: () => void;

    // Address
    selectAddress: (address: ShippingAddress) => void;
    clearAddress: () => void;

    // Payment
    selectPaymentMethod: (method: PaymentMethod) => void;

    // Discounts
    applyDiscount: (discount: AppliedDiscount) => void;
    removeDiscount: (code: string) => void;
    applyNectorCoins: (coins: number, discountCode: string) => void;
    removeNectorCoins: () => void;

    // Order
    setOrderInfo: (orderId: string, orderNumber?: string) => void;
    setCheckoutUrl: (url: string) => void;

    // Try & Buy
    setTryAndBuy: (enabled: boolean, variantIds?: string[]) => void;

    // State management
    setProcessing: (processing: boolean) => void;
    setError: (error: string | null) => void;
    reset: () => void;

    // Computed
    getTotalDiscount: () => number;
    hasAppliedDiscounts: () => boolean;
}

export type CheckoutStore = CheckoutState & CheckoutActions;

const STEP_ORDER: CheckoutStep[] = [
    'cart',
    'address_selection',
    'payment_selection',
    'processing',
    'success',
];

const initialState: CheckoutState = {
    step: 'cart',
    isProcessing: false,
    selectedAddressId: null,
    selectedAddress: null,
    paymentMethod: null,
    appliedDiscounts: [],
    nectorCoinsApplied: 0,
    nectorDiscountCode: null,
    orderId: null,
    orderNumber: null,
    checkoutUrl: null,
    isTryAndBuy: false,
    tryAndBuyItems: [],
    error: null,
};

export const useCheckoutStore = create<CheckoutStore>()(
    persist(
        (set, get) => ({
            ...initialState,

            // Set specific step
            setStep: (step: CheckoutStep) => {
                set({ step, error: null });
            },

            // Navigate to next step
            nextStep: () => {
                const { step } = get();
                const currentIndex = STEP_ORDER.indexOf(step);
                if (currentIndex >= 0 && currentIndex < STEP_ORDER.length - 1) {
                    set({ step: STEP_ORDER[currentIndex + 1], error: null });
                }
            },

            // Navigate to previous step
            prevStep: () => {
                const { step } = get();
                const currentIndex = STEP_ORDER.indexOf(step);
                if (currentIndex > 0) {
                    set({ step: STEP_ORDER[currentIndex - 1], error: null });
                }
            },

            // Select shipping address
            selectAddress: (address: ShippingAddress) => {
                set({
                    selectedAddressId: address.id,
                    selectedAddress: address,
                });
            },

            // Clear selected address
            clearAddress: () => {
                set({
                    selectedAddressId: null,
                    selectedAddress: null,
                });
            },

            // Select payment method
            selectPaymentMethod: (method: PaymentMethod) => {
                set({ paymentMethod: method });
            },

            // Apply discount code
            applyDiscount: (discount: AppliedDiscount) => {
                const { appliedDiscounts } = get();
                // Prevent duplicates
                if (!appliedDiscounts.find(d => d.code === discount.code)) {
                    set({ appliedDiscounts: [...appliedDiscounts, discount] });
                }
            },

            // Remove discount code
            removeDiscount: (code: string) => {
                const { appliedDiscounts } = get();
                set({
                    appliedDiscounts: appliedDiscounts.filter(d => d.code !== code),
                });
            },

            // Apply Nector coins
            applyNectorCoins: (coins: number, discountCode: string) => {
                set({
                    nectorCoinsApplied: coins,
                    nectorDiscountCode: discountCode,
                });
            },

            // Remove Nector coins
            removeNectorCoins: () => {
                set({
                    nectorCoinsApplied: 0,
                    nectorDiscountCode: null,
                });
            },

            // Set order info after successful checkout
            setOrderInfo: (orderId: string, orderNumber?: string) => {
                set({
                    orderId,
                    orderNumber: orderNumber || null,
                    step: 'success',
                });
            },

            // Set checkout URL
            setCheckoutUrl: (url: string) => {
                set({ checkoutUrl: url });
            },

            // Set Try & Buy mode
            setTryAndBuy: (enabled: boolean, variantIds?: string[]) => {
                set({
                    isTryAndBuy: enabled,
                    tryAndBuyItems: variantIds || [],
                    paymentMethod: enabled ? 'try_and_buy' : null,
                });
            },

            // Set processing state
            setProcessing: (processing: boolean) => {
                set({ isProcessing: processing });
            },

            // Set error
            setError: (error: string | null) => {
                set({ error, step: error ? 'failed' : get().step });
            },

            // Reset checkout state
            reset: () => {
                set(initialState);
            },

            // Get total discount amount
            getTotalDiscount: () => {
                const { appliedDiscounts, nectorCoinsApplied } = get();
                const discountTotal = appliedDiscounts.reduce(
                    (sum, d) => sum + d.amountOff,
                    0
                );
                return discountTotal + nectorCoinsApplied;
            },

            // Check if any discounts applied
            hasAppliedDiscounts: () => {
                const { appliedDiscounts, nectorCoinsApplied } = get();
                return appliedDiscounts.length > 0 || nectorCoinsApplied > 0;
            },
        }),
        {
            name: 'checkout-storage',
            storage: createJSONStorage(() => AsyncStorage),
            // Only persist essential checkout data, not transient states
            partialize: (state) => ({
                selectedAddressId: state.selectedAddressId,
                selectedAddress: state.selectedAddress,
                paymentMethod: state.paymentMethod,
            }),
        }
    )
);

// Selectors
export const selectCheckoutStep = (state: CheckoutStore) => state.step;
export const selectSelectedAddress = (state: CheckoutStore) => state.selectedAddress;
export const selectPaymentMethod = (state: CheckoutStore) => state.paymentMethod;
export const selectIsProcessing = (state: CheckoutStore) => state.isProcessing;
export const selectIsTryAndBuy = (state: CheckoutStore) => state.isTryAndBuy;

export default useCheckoutStore;
