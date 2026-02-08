// Payment Service - Razorpay Integration
// Full implementation matching Kiddo app

import { Alert } from 'react-native';
import { configService } from './configService';
import { OrderItem } from './orderService';
import { shopifyAdminApi } from './shopifyAdminApi';

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

    try {
        // If this is a Try & Buy order, always create a draft order
        if (orderData.isTryAndBuy) {
            if (paymentMethod === 'razorpay') {
                // For Try & Buy with Razorpay, process payment first
                const paymentResult = await initiateRazorpayPayment(
                    orderData.totalAmount,
                    orderData.currencyCode || 'INR',
                    orderData
                );

                if (!paymentResult.success) {
                    return {
                        success: false,
                        error: paymentResult.error || 'Payment failed',
                        cancelled: paymentResult.cancelled || false,
                    };
                }

                // Verify payment signature (basic client-side check)
                if (paymentResult.paymentId && paymentResult.orderId && paymentResult.signature) {
                    const isVerified = await verifyRazorpayPayment(
                        paymentResult.orderId,
                        paymentResult.paymentId,
                        paymentResult.signature
                    );
                    
                    if (!isVerified) {
                        console.error('[PaymentService] Payment verification failed');
                        return {
                            success: false,
                            error: 'Payment verification failed. Please contact support.',
                            cancelled: false,
                        };
                    }
                } else {
                    console.warn('[PaymentService] Missing payment verification data');
                }

                // Payment successful - create draft order for Try & Buy with paid status
                const draftOrder = await createDraftOrder(orderData, {
                    paymentId: paymentResult.paymentId,
                    paymentStatus: 'paid',
                    paymentMethod: 'razorpay',
                });

                return {
                    success: true,
                    order: draftOrder,
                    payment: paymentResult,
                };
            } else if (paymentMethod === 'cod') {
                // For Try & Buy with COD, create draft order with pending payment
                const draftOrder = await createDraftOrder(orderData, {
                    paymentStatus: 'pending',
                    paymentMethod: 'cod',
                });

                return {
                    success: true,
                    order: draftOrder,
                };
            }
        }

        // Normal order flow (not Try & Buy)
        if (paymentMethod === 'razorpay') {
            // Initiate Razorpay payment
            const paymentResult = await initiateRazorpayPayment(
                orderData.totalAmount,
                orderData.currencyCode || 'INR',
                orderData
            );

            if (!paymentResult.success) {
                return {
                    success: false,
                    error: paymentResult.error || 'Payment failed',
                    cancelled: paymentResult.cancelled || false,
                };
            }

            // Verify payment signature (basic client-side check)
            // NOTE: In production, this should be done on your backend for security
            if (paymentResult.paymentId && paymentResult.orderId && paymentResult.signature) {
                const isVerified = await verifyRazorpayPayment(
                    paymentResult.orderId,
                    paymentResult.paymentId,
                    paymentResult.signature
                );
                
                if (!isVerified) {
                    console.error('[PaymentService] Payment verification failed');
                    return {
                        success: false,
                        error: 'Payment verification failed. Please contact support.',
                        cancelled: false,
                    };
                }
            } else {
                console.warn('[PaymentService] Missing payment verification data');
            }

            // Payment successful and verified - create order in Shopify
            // CRITICAL: If order creation fails here, payment has already been processed
            let shopifyOrder;
            let orderCreationAttempts = 0;
            const maxRetries = 2;
            
            while (orderCreationAttempts <= maxRetries) {
                try {
                    shopifyOrder = await createShopifyOrder(orderData, {
                        paymentId: paymentResult.paymentId,
                        paymentStatus: 'paid',
                        paymentMethod: 'razorpay',
                    });
                    
                    // Validate that order was actually created
                    if (!shopifyOrder || !shopifyOrder.id) {
                        throw new Error('Order creation returned invalid response: missing order ID');
                    }
                    
                    // Validate order has required fields
                    if (!shopifyOrder.name && !shopifyOrder.orderNumber) {
                        console.warn('[PaymentService] Order created but missing name/orderNumber:', shopifyOrder);
                    }
                    
                    console.log('[PaymentService] ✅ Order successfully created in Shopify:', {
                        orderId: shopifyOrder.id,
                        orderName: shopifyOrder.name || shopifyOrder.orderNumber,
                        paymentId: paymentResult.paymentId,
                    });
                    
                    // Success - break out of retry loop
                    break;
                } catch (orderError: any) {
                    orderCreationAttempts++;
                    console.error(`[PaymentService] ⚠️ Order creation attempt ${orderCreationAttempts} failed:`, {
                        error: orderError.message,
                        paymentId: paymentResult.paymentId,
                        paymentStatus: 'SUCCESS (payment already processed)',
                        stack: orderError.stack,
                    });
                    
                    if (orderCreationAttempts > maxRetries) {
                        // All retries exhausted - this is a critical error
                        // Payment was successful but order creation failed
                        console.error('[PaymentService] 🚨 CRITICAL: Payment successful but order creation failed after all retries', {
                            paymentId: paymentResult.paymentId,
                            orderId: paymentResult.orderId,
                            customerId: orderData.customerId,
                            totalAmount: orderData.totalAmount,
                            items: orderData.items?.length || 0,
                            error: orderError.message,
                        });
                        
                        // Return error but include payment info for manual recovery
                        return {
                            success: false,
                            error: `Payment was successful (ID: ${paymentResult.paymentId}), but order creation failed. Please contact support with payment ID: ${paymentResult.paymentId}`,
                            payment: paymentResult, // Include payment info for recovery
                            orderCreationFailed: true,
                        };
                    }
                    
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 1000 * orderCreationAttempts));
                }
            }

            return {
                success: true,
                order: shopifyOrder,
                payment: paymentResult,
            };
        } else if (paymentMethod === 'cod') {
            // COD - Create order directly
            const shopifyOrder = await createShopifyOrder(orderData, {
                paymentStatus: 'pending',
                paymentMethod: 'cod',
            });

            return {
                success: true,
                order: shopifyOrder,
            };
        } else if (paymentMethod === 'try_and_buy') {
            // Try & Buy - Create draft order only
            const draftOrder = await createDraftOrder(orderData, {
                paymentStatus: 'pending',
                paymentMethod: 'try_and_buy',
            });

            return {
                success: true,
                order: draftOrder,
            };
        } else if (paymentMethod === 'free') {
            // Free order - Create order directly
            const shopifyOrder = await createShopifyOrder(orderData, {
                paymentStatus: 'paid',
                paymentMethod: 'free',
            });

            return {
                success: true,
                order: shopifyOrder,
            };
        }

        return {
            success: false,
            error: 'Invalid payment method',
        };
    } catch (error: any) {
        console.error('[PaymentService] createOrderWithPayment error:', {
            error: error.message,
            stack: error.stack,
            paymentMethod,
            orderData: {
                customerId: orderData.customerId,
                totalAmount: orderData.totalAmount,
                itemsCount: orderData.items?.length || 0,
            },
        });
        
        // Check if this error occurred after payment was processed
        // (This would be indicated by error containing payment info or orderCreationFailed flag)
        if (error.orderCreationFailed && error.payment) {
            return {
                success: false,
                error: error.message || 'Payment successful but order creation failed',
                payment: error.payment,
                orderCreationFailed: true,
            };
        }
        
        return {
            success: false,
            error: error.message || 'Failed to create order',
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

        // Prepare line items
        const lineItems = orderData.items.map((item) => {
            const variantId = item.variantId.replace('gid://shopify/ProductVariant/', '');
            return {
                variantId: variantId,
                quantity: item.quantity,
                originalUnitPrice: item.price.toString(),
            };
        });

        // Build tags
        const tags = ['try-and-buy'];
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
        ];

        // Create draft order via Admin API
        const draftOrder = await shopifyAdminApi.createDraftOrder({
            customerId: orderData.customerId,
            lineItems,
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
            note: 'Try & Buy Order - Customer will select items to keep after delivery',
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

        // Prepare line items
        const lineItems = orderData.items.map((item) => {
            const variantId = item.variantId.replace('gid://shopify/ProductVariant/', '');
            return {
                variantId: variantId,
                quantity: item.quantity,
                originalUnitPrice: item.price.toString(),
            };
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
            ...(orderData.deliverySchedule
                ? [
                    { key: 'delivery_date', value: orderData.deliverySchedule.date },
                    { key: 'delivery_time', value: orderData.deliverySchedule.time },
                    { key: 'delivery_day', value: orderData.deliverySchedule.day },
                    { key: 'date_format', value: orderData.deliverySchedule.dateFormat },
                ]
                : []),
        ];

        // Create draft order first
        const draftOrder = await shopifyAdminApi.createDraftOrder({
            customerId: orderData.customerId,
            lineItems,
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
