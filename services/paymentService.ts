// Payment Service - Razorpay Integration
// Full implementation matching Kiddo app

import { Alert } from 'react-native';
import { configService } from './configService';
import { OrderItem } from './orderService';
import { shopifyAdminApi } from './shopifyAdminApi';

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
    address?: {
        name: string;
        address: string;
        city: string;
        state: string;
        pincode: string;
        phone: string;
    };
    isTryAndBuy?: boolean;
    giftWrapping?: { name: string; price: number };
    couponCode?: string;
    discountAmount?: number;
    selectedShoe?: string;
    deliverySchedule?: {
        date: string; // Format: DD/MM/YYYY
        time: string; // Format: HH:MM AM/PM
        day: string; // Day name (e.g., "Saturday")
        dateFormat: string; // Format: "dd/mm/yy"
    };
}

export interface CreateOrderResult {
    success: boolean;
    order?: any;
    payment?: PaymentResult;
    error?: string;
    cancelled?: boolean;
    orderCreationFailed?: boolean; // True when payment succeeded but order creation failed
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

        // Get Razorpay key (live or test based on config)
        const razorpayKeyId = getRazorpayKeyId();
        
        // Log which key is being used (for debugging)
        if (razorpayKeyId.startsWith('rzp_test_')) {
            console.warn('[PaymentService] ⚠️ WARNING: Using TEST Razorpay key - payments will not charge real money!');
        } else if (razorpayKeyId.startsWith('rzp_live_')) {
            console.log('[PaymentService] ✓ Using LIVE Razorpay key - real payments enabled');
        }

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
                email: orderData.email || '',
                contact: orderData.phone || '',
                name: orderData.name || '',
            },
            theme: { color: '#2c6975' }, // Primary color
            notes: {
                order_id: orderData.orderId || '',
                customer_id: orderData.customerId || '',
            },
        };

        // Include Razorpay order ID if provided
        if (orderData.razorpayOrderId) {
            options.order_id = orderData.razorpayOrderId;
        }

        // Open Razorpay payment gateway
        const paymentResult = await RazorpayCheckout.open(options);

        return {
            success: true,
            paymentId: paymentResult.razorpay_payment_id,
            orderId: paymentResult.razorpay_order_id,
            signature: paymentResult.razorpay_signature,
            data: paymentResult,
        };
    } catch (error: any) {
        // Check if user cancelled payment
        const isCancelled =
            error.code === 2 ||
            error.code === 0 ||
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
 * Verify Razorpay payment signature
 * In production, this should be done on your backend
 */
export const verifyRazorpayPayment = async (
    orderId: string,
    paymentId: string,
    signature: string
): Promise<boolean> => {
    try {
        // In production, verify signature on your backend
        // For now, return true if we have all required fields
        if (orderId && paymentId && signature) {
            // TODO: Implement server-side signature verification
            console.log('[PaymentService] Signature verification skipped (implement on backend)');
            return true;
        }
        return false;
    } catch (error) {
        console.error('[PaymentService] Verification error:', error);
        return false;
    }
};

/**
 * Create order in Shopify and process payment
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
        // STEP 1: CREATE DRAFT ORDER FIRST (Validates Inventory & Data)
        // ---------------------------------------------------------
        console.log('[PaymentService] Creating Draft Order first...');
        
        // Use the local createDraftOrder helper to create the draft
        // This helper already formats the input for shopifyAdminApi
        const draftOrder = await createDraftOrder(sanitizedOrderData, {
            paymentStatus: 'pending',
            paymentMethod: paymentMethod,
        });

        console.log('[PaymentService] Draft Order Created:', draftOrder.id);

        // ---------------------------------------------------------
        // STEP 2: PROCESS PAYMENT
        // ---------------------------------------------------------
        
        if (paymentMethod === 'razorpay') {
            const paymentResult = await initiateRazorpayPayment(
                sanitizedOrderData.totalAmount,
                sanitizedOrderData.currencyCode || 'INR',
                {
                    ...sanitizedOrderData,
                    orderId: draftOrder.id // Pass draft ID as note to Razorpay
                }
            );

            if (!paymentResult.success) {
                // Payment Failed
                return {
                    success: false,
                    error: paymentResult.error || 'Payment failed',
                    cancelled: paymentResult.cancelled
                };
            }

            // ---------------------------------------------------------
            // STEP 3: COMPLETE ORDER (Convert Draft to Real Order)
            // ---------------------------------------------------------
            
            console.log('[PaymentService] Completing draft order after payment...');
            
            // Mark as paid when completing (paymentPending = false)
            const completionResult = await shopifyAdminApi.completeDraftOrder(
                draftOrder.id, 
                false
            );

            return {
                success: true,
                order: completionResult.order,
                payment: paymentResult
            };

        } else if (paymentMethod === 'cod') {
            // COD Flow - Complete the draft order immediately
            // paymentPending = true for COD
            const completionResult = await shopifyAdminApi.completeDraftOrder(
                draftOrder.id, 
                true
            );
             
            return { 
                success: true, 
                order: completionResult.order 
            };

        } else if (paymentMethod === 'try_and_buy') {
             // Try & Buy - Just return the draft order (it stays as draft until later)
             return { success: true, order: draftOrder };

        } else if (paymentMethod === 'free') {
             // Free Order - Complete immediately as paid
             const completionResult = await shopifyAdminApi.completeDraftOrder(
                draftOrder.id, 
                false
            );
             
            return { 
                success: true, 
                order: completionResult.order 
            };
        }

        return { success: false, error: 'Invalid payment method' };

    } catch (error: any) {
        console.error('[PaymentService] Error:', error);
        
        // Improve error message for user
        let userMessage = error.message;
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

/**
 * Create order in Shopify (draft order for Try & Buy, regular order for normal)
 */
const createShopifyOrder = async (
    orderData: OrderData,
    paymentData: {
        paymentId?: string;
        paymentStatus: string;
        paymentMethod: string;
    }
): Promise<any> => {
    try {
        // For Try & Buy, create draft order
        if (orderData.isTryAndBuy) {
            return await createDraftOrder(orderData, paymentData);
        } else {
            // For normal orders, create regular order
            return await createRegularOrder(orderData, paymentData);
        }
    } catch (error) {
        console.error('[PaymentService] createShopifyOrder error:', error);
        throw error;
    }
};

/**
 * Create draft order for Try & Buy
 */
export const createDraftOrder = async (
    orderData: OrderData,
    paymentData: {
        paymentId?: string;
        paymentStatus: string;
        paymentMethod: string;
    }
): Promise<any> => {
    try {
        // Check if any items have Fashion tag
        const hasFashionTag =
            orderData.items?.some((item: any) =>
                item.tags?.some((tag: string) => tag.toLowerCase() === 'fashion')
            ) || false;

        // Prepare line items (include booking date for Events, Playhouses, Petting Farms)
        const lineItems = orderData.items.map((item) => {
            const variantId = item.variantId.replace('gid://shopify/ProductVariant/', '');
            const lineItem: { variantId: string; quantity: number; originalUnitPrice: string; customAttributes?: Array<{ key: string; value: string }> } = {
                variantId: variantId,
                quantity: item.quantity,
                originalUnitPrice: item.price.toString(),
            };
            if (item.bookingDate) {
                lineItem.customAttributes = [
                    { key: 'booking_date', value: item.bookingDate },
                    { key: 'booking_date_display', value: new Date(item.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                ];
            }
            return lineItem;
        });

        // Build tags
        const tags: string[] = [];
        if (orderData.isTryAndBuy) {
            tags.push('try-and-buy');
        }
        if (hasFashionTag) {
            tags.push('Fashion');
        }

        // Determine note
        let note = '';
        if (orderData.isTryAndBuy) {
            note = 'Try & Buy Order - Customer will select items to keep after delivery';
        } else if (orderData.giftWrapping) {
            note = `Gift Wrapping: ${orderData.giftWrapping.name}`;
        }


        // Custom attributes
        const customAttributes = [
            { key: 'payment_method', value: paymentData.paymentMethod },
            { key: 'payment_status', value: paymentData.paymentStatus },
            ...(paymentData.paymentId
                ? [{ key: 'payment_id', value: paymentData.paymentId }]
                : []),
            ...(orderData.giftWrapping
                ? [{ key: 'gift_wrapping', value: orderData.giftWrapping.name }]
                : []),
            ...(orderData.couponCode
                ? [{ key: 'coupon_code', value: orderData.couponCode }]
                : []),
            ...(orderData.discountAmount !== undefined && orderData.discountAmount > 0
                ? [{ key: 'discount_amount', value: orderData.discountAmount.toString() }]
                : []),
            ...(orderData.selectedShoe
                ? [{ key: 'selected_shoe', value: orderData.selectedShoe }]
                : []),
            ...(orderData.deliverySchedule
                ? [
                    { key: 'delivery_date', value: orderData.deliverySchedule.date },
                    { key: 'delivery_time', value: orderData.deliverySchedule.time },
                    { key: 'delivery_day', value: orderData.deliverySchedule.day },
                    { key: 'date_format', value: orderData.deliverySchedule.dateFormat },
                ]
                : []),
        ];

        // Use appliedDiscount for exact amount when we have it; otherwise discountCodes
        const discountAmount = orderData.discountAmount ?? 0;
        const draftOrder = await shopifyAdminApi.createDraftOrder({
            customerId: orderData.customerId,
            email: orderData.email,
            lineItems,
            ...(discountAmount > 0
                ? {
                    appliedDiscount: {
                        valueType: 'FIXED_AMOUNT' as const,
                        value: discountAmount,
                        title: orderData.couponCode ? `Discount (${orderData.couponCode})` : 'Discount',
                    },
                }
                : orderData.couponCode
                    ? { discountCodes: [orderData.couponCode] }
                    : {}),
            shippingAddress: orderData.address
                ? {
                    address1: orderData.address.address,
                    city: orderData.address.city,
                    province: orderData.address.state,
                    country: 'India',
                    zip: orderData.address.pincode,
                    firstName: orderData.address.name.split(' ')[0] || orderData.address.name,
                    lastName: orderData.address.name.split(' ').slice(1).join(' ') || '',
                    phone: orderData.address.phone,
                }
                : undefined,
            tags,
            note: note,
            customAttributes,
        });

        return draftOrder;
    } catch (error) {
        console.error('[PaymentService] createDraftOrder error:', error);
        throw error;
    }
};

/**
 * Create regular order in Shopify
 */
export const createRegularOrder = async (
    orderData: OrderData,
    paymentData: {
        paymentId?: string;
        paymentStatus: string;
        paymentMethod: string;
    }
): Promise<any> => {
    try {
        // Check if any items have Fashion tag
        const hasFashionTag =
            orderData.items?.some((item: any) =>
                item.tags?.some((tag: string) => tag.toLowerCase() === 'fashion')
            ) || false;

        // Prepare line items (include booking date for Events, Playhouses, Petting Farms)
        const lineItems = orderData.items.map((item) => {
            const variantId = item.variantId.replace('gid://shopify/ProductVariant/', '');
            const lineItem: { variantId: string; quantity: number; originalUnitPrice: string; customAttributes?: Array<{ key: string; value: string }> } = {
                variantId: variantId,
                quantity: item.quantity,
                originalUnitPrice: item.price.toString(),
            };
            if (item.bookingDate) {
                lineItem.customAttributes = [
                    { key: 'booking_date', value: item.bookingDate },
                    { key: 'booking_date_display', value: new Date(item.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                ];
            }
            return lineItem;
        });

        // Build tags
        const tags: string[] = [];
        if (hasFashionTag) {
            tags.push('Fashion');
        }

        // Custom attributes
        const customAttributes = [
            { key: 'payment_method', value: paymentData.paymentMethod },
            { key: 'payment_status', value: paymentData.paymentStatus },
            ...(paymentData.paymentId
                ? [{ key: 'payment_id', value: paymentData.paymentId }]
                : []),
            ...(orderData.giftWrapping
                ? [{ key: 'gift_wrapping', value: orderData.giftWrapping.name }]
                : []),
            ...(orderData.couponCode
                ? [{ key: 'coupon_code', value: orderData.couponCode }]
                : []),
            ...(orderData.discountAmount !== undefined && orderData.discountAmount > 0
                ? [{ key: 'discount_amount', value: orderData.discountAmount.toString() }]
                : []),
            ...(orderData.selectedShoe
                ? [{ key: 'selected_shoe', value: orderData.selectedShoe }]
                : []),
            ...(orderData.deliverySchedule
                ? [
                    { key: 'delivery_date', value: orderData.deliverySchedule.date },
                    { key: 'delivery_time', value: orderData.deliverySchedule.time },
                    { key: 'delivery_day', value: orderData.deliverySchedule.day },
                    { key: 'date_format', value: orderData.deliverySchedule.dateFormat },
                ]
                : []),
        ];

        // Create draft order - use appliedDiscount for exact amount when available
        const regularDiscountAmount = orderData.discountAmount ?? 0;
        const draftOrder = await shopifyAdminApi.createDraftOrder({
            customerId: orderData.customerId,
            lineItems,
            ...(regularDiscountAmount > 0
                ? {
                    appliedDiscount: {
                        valueType: 'FIXED_AMOUNT' as const,
                        value: regularDiscountAmount,
                        title: orderData.couponCode ? `Discount (${orderData.couponCode})` : 'Discount',
                    },
                }
                : orderData.couponCode
                    ? { discountCodes: [orderData.couponCode] }
                    : {}),
            shippingAddress: orderData.address
                ? {
                    address1: orderData.address.address,
                    city: orderData.address.city,
                    province: orderData.address.state,
                    country: 'India',
                    zip: orderData.address.pincode,
                    firstName: orderData.address.name.split(' ')[0] || orderData.address.name,
                    lastName: orderData.address.name.split(' ').slice(1).join(' ') || '',
                    phone: orderData.address.phone,
                }
                : undefined,
            tags,
            note: orderData.giftWrapping
                ? `Gift Wrapping: ${orderData.giftWrapping.name}`
                : '',
            customAttributes,
        });

        // Complete the draft order to create a regular order
        const completionResult = await shopifyAdminApi.completeDraftOrder(
            draftOrder.id,
            paymentData.paymentStatus === 'pending'
        );

        // Validate that order was actually created
        if (!completionResult || !completionResult.order) {
            console.error('[PaymentService] Draft order completion returned no order:', {
                draftOrderId: draftOrder.id,
                completionResult,
            });
            throw new Error('Draft order completion failed: No order returned from Shopify');
        }

        const order = completionResult.order;

        // Validate order has required ID
        if (!order.id) {
            console.error('[PaymentService] Completed order missing ID:', order);
            throw new Error('Order creation failed: Completed order missing ID');
        }

        console.log('[PaymentService] Draft order completed successfully:', {
            draftOrderId: draftOrder.id,
            orderId: order.id,
            orderName: order.name,
            paymentId: paymentData.paymentId,
        });

        return order;
    } catch (error) {
        console.error('[PaymentService] createRegularOrder error:', error);
        throw error;
    }
};

/**
 * Complete a draft order (convert Try & Buy to real order after payment)
 */
export const completeTryAndBuyOrder = async (
    draftOrderId: string,
    paymentId: string
): Promise<any> => {
    try {
        // Complete the draft order
        const { order } = await shopifyAdminApi.completeDraftOrder(draftOrderId, false);

        // Update with payment info (you might need Admin API order update for this)
        console.log('[PaymentService] Try & Buy order completed:', order?.id);

        return order;
    } catch (error) {
        console.error('[PaymentService] completeTryAndBuyOrder error:', error);
        throw error;
    }
};

// Default export for compatibility
export default {
    initiateRazorpayPayment,
    verifyRazorpayPayment,
    createOrderWithPayment,
    createDraftOrder,
    createRegularOrder,
    completeTryAndBuyOrder,
};
