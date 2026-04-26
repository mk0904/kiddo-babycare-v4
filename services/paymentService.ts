// Payment Service - Razorpay Integration
// Checkout (draft + complete) runs via backend; only Razorpay SDK runs on device.

import { getAppVersionForApi } from '@/constants/versionConfig';
import { Alert, Platform } from 'react-native';
import { checkoutService } from './checkoutService';
import { configService } from './configService';
import { OrderItem } from './orderService';

// Helper to format phone number to E.164
const formatPhone = (phone: string): string => {
    if (!phone) return phone;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) return `+91${cleaned}`;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
    return phone.startsWith('+') ? phone : `+91${cleaned}`; // Default fallback
};


// Safely import Razorpay (won't work in Expo Go)
let RazorpayCheckout: any = null;
try {
    RazorpayCheckout = require('react-native-razorpay').default;
} catch (e) {
    console.log('[PaymentService] Razorpay native module not found (Expo Go mode)');
}

// Get Razorpay Configuration from config file
const getRazorpayKeyId = (): string => {
    // First try environment variable
    if (process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID) {
        return process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;
    }
    
    // Then try config file
    try {
        const razorpayConfig = configService.getRazorpayConfig();
        if (razorpayConfig?.keyId) {
            console.log('[PaymentService] Using Razorpay key from config:', razorpayConfig.keyId.substring(0, 10) + '...');
            return razorpayConfig.keyId;
        }
    } catch (e) {
        console.warn('[PaymentService] Could not load Razorpay config from configService');
    }
    
    // Fallback to test key (should not be used in production)
    console.warn('[PaymentService] Using fallback test key - this should not happen in production!');
    return 'rzp_test_RulXvHRLkzOuuj';
};

// Types
export interface PaymentOptions {
    description: string;
    image?: string;
    currency: string;
    key: string;
    amount: number; // In paise (smallest unit)
    name: string;
    prefill: {
        email: string;
        contact: string;
        name: string;
    };
    theme: {
        color: string;
    };
    notes?: Record<string, string>;
    order_id?: string;
}

export interface PaymentResult {
    success: boolean;
    paymentId?: string;
    orderId?: string;
    signature?: string;
    data?: any;
    cancelled?: boolean;
    error?: string;
}

/** Bill breakdown for backend to persist on Shopify order (note/metafields). */
export interface OrderBillDetails {
    subtotal: number;
    subtotalAfterDiscount: number;
    deliveryFee: number;
    giftWrappingFee: number;
    discount: number;
    total: number;
    currencyCode: string;
}

export interface OrderData {
    items: OrderItem[];
    totalAmount: number;
    currencyCode?: string;
    email?: string;
    phone?: string;
    name?: string;
    customerId?: string;
    orderId?: string;
    razorpayOrderId?: string;
    /** When provided (e.g. from draft response), use this key so it matches the Razorpay order created by backend. */
    razorpayKeyId?: string;
    address?: {
        name: string;
        address: string;
        city: string;
        state: string;
        pincode: string;
        phone: string;
        /** Save as: Home/Work/Other/Events – backend sets on Shopify order shipping address */
        addressType?: string;
    };
    isTryAndBuy?: boolean;
    giftWrapping?: { name: string; price: number };
    couponCode?: string;
    discountAmount?: number;
    selectedShoe?: string;
    /** Free shoes offer: selected size (e.g. S1, S2) – sent to backend for Shopify */
    selectedShoeSize?: string;
    /** Free puzzle (milestone 2) – product variant id */
    selectedPuzzleId?: string;
    /** Chosen age label (e.g. `2-3 Years`) */
    selectedPuzzleAge?: string;
    /** When provided, backend should persist scheduled date/time on order; otherwise treat as instant. */
    deliverySchedule?: {
        date: string; // DD/MM/YYYY
        time: string; // HH:MM AM/PM
        day: string;
        dateFormat: string; // dd/mm/yy
        timeSlotLabel?: string; // e.g. "11AM - 12PM"
    };
    /** 'scheduled' = user chose a slot; 'instant' = no schedule (deliver as soon as possible). */
    deliveryType?: 'scheduled' | 'instant';
    /** Payment method for this order (backend stores on Shopify order). */
    paymentMethod?: 'razorpay' | 'cod' | 'free' | 'try_and_buy';
    /** Full bill breakdown for backend to store in Shopify order. */
    billDetails?: OrderBillDetails;
    /** School coupon data for Shopify order attributes. */
    schoolCouponData?: {
        childName: string;
        parentName: string;
        dob: string;
        gender: string;
    } | null;
}

export interface CreateOrderResult {
    success: boolean;
    order?: any;
    payment?: PaymentResult;
    error?: string;
    cancelled?: boolean;
    orderCreationFailed?: boolean; // True when payment succeeded but order creation failed
}

function orderDataToCheckoutDraftRequest(
    orderData: OrderData,
    paymentMethod: string
): import('./checkoutService').CheckoutDraftRequest {
    const items = orderData.items.map((item: any) => ({
        variantId: (item.variantId || '').replace('gid://shopify/ProductVariant/', ''),
        quantity: item.quantity,
        price: item.price,
        title: item.title,
        variantTitle: item.variantTitle ?? undefined,
        image: item.image ?? undefined,
        compareAtPrice: item.compareAtPrice ?? undefined,
        tags: item.tags ?? [],
        bookingDate: item.bookingDate ?? '',
        ...(item.customAttributes && Object.keys(item.customAttributes).length > 0
            ? { customAttributes: item.customAttributes as Record<string, string> }
            : {}),
    }));
    return {
        items,
        totalAmount: orderData.totalAmount,
        currencyCode: orderData.currencyCode ?? 'INR',
        email: orderData.email ?? '',
        phone: orderData.phone ?? '',
        name: orderData.name ?? '',
        customerId: orderData.customerId ?? '',
        address: orderData.address,
        giftWrapping: orderData.giftWrapping,
        couponCode: orderData.couponCode ?? '',
        discountAmount: orderData.discountAmount ?? 0,
        deliverySchedule: orderData.deliverySchedule,
        deliveryType: orderData.deliveryType ?? (orderData.deliverySchedule?.date && orderData.deliverySchedule?.time ? 'scheduled' : 'instant'),
        paymentMethod: (orderData.paymentMethod ?? paymentMethod) as 'razorpay' | 'cod' | 'free' | 'try_and_buy',
        billDetails: orderData.billDetails,
        selectedShoe: orderData.selectedShoe ?? '',
        selectedShoeSize: orderData.selectedShoeSize ?? '',
        selectedPuzzleId: orderData.selectedPuzzleId ?? '',
        selectedPuzzleAge: orderData.selectedPuzzleAge ?? '',
        schoolCouponData: orderData.schoolCouponData,
        isTryAndBuy: paymentMethod === 'try_and_buy' || orderData.isTryAndBuy === true,
        appVersion: getAppVersionForApi(),
        deviceType: Platform.OS ?? '',
    };
}

/**
 * Create Razorpay order and initiate payment
 * @param amount - Amount in rupees (will be converted to paise)
 * @param currency - Currency code (default: INR)
 * @param orderData - Order details for metadata
 */
export const initiateRazorpayPayment = async (
    amount: number,
    currency: string = 'INR',
    orderData: Partial<OrderData> = {}
): Promise<PaymentResult> => {
    try {
        // Validate amount
        if (!amount || amount <= 0) {
            throw new Error('Invalid payment amount');
        }

        // Check if Razorpay is available
        // Check if Razorpay is available
        // Check if Razorpay is available
        if (!RazorpayCheckout) {
            // Mock mode for development/Expo Go where native modules are missing
            return new Promise((resolve) => {
                Alert.alert(
                    'Native Module Missing',
                    `Razorpay SDK is not loaded. To verify "Real" payments, you must rebuild the app (npx expo run:ios/android).\n\nFor now, we can simulate a successful payment to test the Order Creation & Navigation flow.`,
                    [
                        {
                            text: 'Cancel',
                            style: 'cancel',
                            onPress: () =>
                                resolve({
                                    success: false,
                                    cancelled: true,
                                    error: 'Payment cancelled by user',
                                }),
                        },
                        {
                            text: 'Simulate Success (Dev Mode)',
                            onPress: () =>
                                resolve({
                                    success: true,
                                    paymentId: `pay_mock_${Date.now()}`,
                                    orderId: `order_mock_${Date.now()}`,
                                    signature: `sig_mock_${Date.now()}`,
                                    data: { mock: true },
                                }),
                        },
                    ]
                );
            });
        }

        // Use backend's key when provided so it matches the Razorpay order; otherwise fall back to config
        const razorpayKeyId = orderData.razorpayKeyId || getRazorpayKeyId();
        if (orderData.razorpayKeyId) {
            console.log('[PaymentService] Using Razorpay key from backend (matches draft order)');
        }
        if (razorpayKeyId.startsWith('rzp_test_')) {
            console.warn('[PaymentService] ⚠️ WARNING: Using TEST Razorpay key - payments will not charge real money!');
        } else if (razorpayKeyId.startsWith('rzp_live_')) {
            console.log('[PaymentService] ✓ Using LIVE Razorpay key - real payments enabled');
        }

        // Razorpay requires a non-empty contact; use phone or placeholder to avoid checkout closing immediately
        const contact = orderData.phone || orderData.address?.phone || '';
        const contactForRazorpay = contact ? formatPhone(contact) : '+919999999999';

        const options: PaymentOptions = {
            description: orderData.orderId
                ? `Order payment for ${orderData.items?.length || 0} items`
                : 'Order Payment',
            image: 'https://kiddo.app/logo.png', // Your app logo
            currency: currency,
            key: razorpayKeyId,
            amount: Math.round(amount * 100), // Convert to paise
            name: 'Kiddo',
            prefill: {
                email: orderData.email || 'guest@kiddo.app',
                contact: contactForRazorpay,
                name: orderData.name || 'Customer',
            },
            theme: { color: '#2c6975' }, // Primary color
            notes: {
                order_id: orderData.orderId || '',
                customer_id: orderData.customerId || '',
            },
        };

        // Include Razorpay order ID if provided (ensure string for SDK)
        if (orderData.razorpayOrderId) {
            options.order_id = String(orderData.razorpayOrderId).trim();
            console.log('[PaymentService] Using Razorpay order_id from backend');
        }

        // On Android, a short delay before opening can prevent the checkout from closing immediately
        // (activity transition / WebView readiness)
        if (Platform.OS === 'android') {
            await new Promise((r) => setTimeout(r, 300));
        }

        // Open Razorpay payment gateway
        console.log('[PaymentService] Opening Razorpay checkout...');
        const raw = await RazorpayCheckout.open(options);
        const d = raw?.data ?? raw;
        const paymentId = raw?.razorpay_payment_id ?? d?.razorpay_payment_id ?? null;
        const orderId = raw?.razorpay_order_id ?? d?.razorpay_order_id ?? null;
        const signature = raw?.razorpay_signature ?? d?.razorpay_signature ?? null;

        return {
            success: true,
            paymentId: paymentId ?? undefined,
            orderId: orderId ?? undefined,
            signature: signature ?? undefined,
            data: raw,
        };
    } catch (error: any) {
        const errCode = error?.code;
        const errDesc = error?.description || error?.message || error?.error?.description || '';
        console.warn('[PaymentService] Razorpay checkout error:', {
            code: errCode,
            description: errDesc,
            reason: error?.error?.reason,
        });
        // Check if user cancelled payment
        const isCancelled =
            errCode === 2 ||
            errCode === 0 ||
            error.description === 'User cancelled the payment' ||
            error.description === 'Payment processing cancelled by user' ||
            error.error?.reason === 'payment_cancelled' ||
            error.error?.description === 'Payment processing cancelled by user' ||
            (error.error?.code === 'BAD_REQUEST_ERROR' &&
                error.error?.reason === 'payment_cancelled');

        if (isCancelled) {
            return {
                success: false,
                cancelled: true,
                error: 'Payment cancelled by user',
            };
        }

        // Show user why checkout closed (helps debug "opens and closes" issue)
        const userMsg = errDesc || `Error code: ${errCode}`;
        Alert.alert(
            'Payment could not be opened',
            userMsg + '\n\nIf this keeps happening, try Pay on Delivery or contact support.',
            [{ text: 'OK' }]
        );

        // Handle BAD_REQUEST_ERROR
        if (
            error.code === 'BAD_REQUEST_ERROR' ||
            error.error?.code === 'BAD_REQUEST_ERROR'
        ) {
            const errorDescription =
                error.description || error.error?.description || 'Payment authentication failed';

            if (
                error.error?.step === 'payment_authentication' &&
                error.error?.reason !== 'payment_cancelled'
            ) {
                return {
                    success: false,
                    cancelled: false,
                    error: 'Payment authentication failed. Please check your payment details.',
                };
            }

            if (errorDescription === 'undefined' || !errorDescription) {
                return {
                    success: false,
                    cancelled: true,
                    error: 'Payment cancelled',
                };
            }

            return {
                success: false,
                cancelled: false,
                error: errorDescription,
            };
        }

        return {
            success: false,
            cancelled: false,
            error:
                error.description || error.message || error.error?.description || 'Payment failed',
        };
    }
};

/**
 * Create order in Shopify and process payment (via backend)
 * @param orderData - Order details
 * @param paymentMethod - 'razorpay', 'cod', or 'try_and_buy'
 */
export const createOrderWithPayment = async (
    orderData: OrderData,
    paymentMethod: 'razorpay' | 'cod' | 'try_and_buy' | 'free' = 'cod'
): Promise<CreateOrderResult> => {
    // Override payment method if total is 0 (safeguard)
    if (orderData.totalAmount === 0 && paymentMethod !== 'try_and_buy') {
        paymentMethod = 'free';
    }

    // 1. Sanitize Data
    const sanitizedOrderData = { ...orderData };
    
    // Fix Phone Format
    if (sanitizedOrderData.address?.phone) {
        sanitizedOrderData.address.phone = formatPhone(sanitizedOrderData.address.phone);
    }
    if (sanitizedOrderData.phone) {
        sanitizedOrderData.phone = formatPhone(sanitizedOrderData.phone);
    }

    // Fix Customer ID (Remove placeholder IDs that cause crashes)
    if (sanitizedOrderData.customerId && 
       (sanitizedOrderData.customerId.includes('existing') || 
        sanitizedOrderData.customerId.includes('mock'))) {
        sanitizedOrderData.customerId = undefined;
    }

    try {
        // ---------------------------------------------------------
        // STEP 1: CREATE DRAFT ORDER VIA BACKEND
        // ---------------------------------------------------------
        console.log('[PaymentService] Creating draft order via backend...');
        const draftReq = orderDataToCheckoutDraftRequest(sanitizedOrderData, paymentMethod);
        const draftRes = await checkoutService.createDraft(draftReq);
        const draftOrderId = draftRes.draft_order_id;
        console.log('[PaymentService] Draft order created:', draftOrderId);

        // ---------------------------------------------------------
        // STEP 2: PROCESS PAYMENT (Razorpay only – SDK on device)
        // ---------------------------------------------------------
        if (paymentMethod === 'razorpay') {
            const paymentResult = await initiateRazorpayPayment(
                draftRes.total,
                draftRes.currency || sanitizedOrderData.currencyCode || 'INR',
                {
                    ...sanitizedOrderData,
                    orderId: draftOrderId,
                    razorpayOrderId: draftRes.razorpay_order_id || undefined,
                    razorpayKeyId: draftRes.razorpay_key_id || undefined,
                }
            );

            if (!paymentResult.success) {
                return {
                    success: false,
                    error: paymentResult.error || 'Payment failed',
                    cancelled: paymentResult.cancelled,
                };
            }
            if (!paymentResult.paymentId || !paymentResult.orderId || !paymentResult.signature) {
                console.error('[PaymentService] Razorpay did not return order_id/signature. Ensure backend returns razorpay_order_id in draft and app passes it to Razorpay.');
                return {
                    success: false,
                    error: 'Payment succeeded but verification data was missing. Please contact support with Payment ID: ' + (paymentResult.paymentId || 'unknown'),
                    orderCreationFailed: true,
                    payment: paymentResult,
                };
            }

            // ---------------------------------------------------------
            // STEP 3: COMPLETE VIA BACKEND (verifies signature + completes draft)
            // ---------------------------------------------------------
            console.log('[PaymentService] Completing draft order via backend...');
            let completeRes: Awaited<ReturnType<typeof checkoutService.completeDraft>>;
            try {
                completeRes = await checkoutService.completeDraft({
                    draft_order_id: draftOrderId,
                    payment_method: 'razorpay',
                    razorpay_payment_id: paymentResult.paymentId!,
                    razorpay_order_id: paymentResult.orderId!,
                    razorpay_signature: paymentResult.signature!,
                });
            } catch (completeErr: any) {
                const msg = completeErr?.message || 'Order completion failed';
                console.error('[PaymentService] Complete draft failed (payment already taken):', msg);
                return {
                    success: false,
                    error: msg,
                    orderCreationFailed: true,
                    payment: paymentResult,
                };
            }
            if (!completeRes.success) {
                return {
                    success: false,
                    error: 'Order completion failed',
                    orderCreationFailed: true,
                    payment: paymentResult,
                };
            }
            const orderFromBackend = completeRes.order;
            const hasValidOrder = orderFromBackend && (orderFromBackend.id || orderFromBackend.name);
            const order = hasValidOrder
                ? orderFromBackend
                : { id: draftOrderId, name: draftRes.draft_order_name || `#${draftOrderId}` };
            return {
                success: true,
                order,
                payment: paymentResult,
            };
        }

        if (paymentMethod === 'cod' || paymentMethod === 'free' || paymentMethod === 'try_and_buy') {
            const completeRes = await checkoutService.completeDraft({
                draft_order_id: draftOrderId,
                payment_method: paymentMethod,
            });
            if (!completeRes.success) {
                return { success: false, error: 'Complete failed' };
            }
            const draftFallback = { id: draftOrderId, name: draftRes.draft_order_name || `#${draftOrderId}` };
            const fromBackend = completeRes.order ?? (completeRes.draft ? { id: completeRes.draft.id, name: completeRes.draft.name } : null);
            const order = (fromBackend && (fromBackend.id ?? fromBackend.name))
                ? fromBackend
                : draftFallback;
            return { success: true, order: order ?? draftFallback };
        }

        return { success: false, error: 'Invalid payment method' };

    } catch (error: any) {
        console.error('[PaymentService] Error:', error);

        // Prefer backend message for 4xx (e.g. 422 validation)
        const status = error.response?.status;
        const data = error.response?.data;
        let userMessage = error.message;
        if (status === 422 || status === 400) {
            const backendMsg = typeof data === 'string' ? data : (data?.message ?? data?.error ?? data?.details);
            if (backendMsg) {
                userMessage = typeof backendMsg === 'string' ? backendMsg : JSON.stringify(backendMsg);
            } else {
                userMessage = 'Validation failed. Please check your address, cart items, and try again.';
            }
        }
        if (userMessage.includes('inventory') || userMessage.includes('unavailable') || userMessage.includes('Variant')) {
            userMessage = 'Some items in your cart are no longer available. Please check your cart.';
        } else if (userMessage.includes('phone') || userMessage.includes('Phone')) {
            userMessage = 'Invalid phone number format. Please check your address.';
        } else if (userMessage.includes('zip') || userMessage.includes('Zip')) {
            userMessage = 'Invalid PIN code. Please check your address.';
        }

        return {
            success: false,
            error: userMessage
        };
    }
};

// Default export for compatibility
export default {
    initiateRazorpayPayment,
    createOrderWithPayment,
};
