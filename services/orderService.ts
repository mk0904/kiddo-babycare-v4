// Order Service
// Manages local order state, tracking, and ETA calculations

import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants
const ORDERS_STORAGE_KEY = 'kiddo_orders';
const TRY_AND_BUY_ORDERS_KEY = 'kiddo_try_and_buy_orders';

// Types
export type OrderStatus =
    | 'placed'
    | 'confirmed'
    | 'packed'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
    | 'return_requested'
    | 'returned';

export type OrderType = 'regular' | 'try_and_buy';

export type TryAndBuyStatus =
    | 'pending_delivery'
    | 'delivered_awaiting_selection'
    | 'selection_confirmed'
    | 'payment_collected'
    | 'completed'
    | 'cancelled';

export interface OrderItem {
    id: string;
    variantId: string;
    productId: string;
    title: string;
    variantTitle?: string;
    price: number;
    quantity: number;
    image?: string;
    // For Try & Buy
    isKept?: boolean;
    isReturned?: boolean;
}

export interface Order {
    id: string;
    type: OrderType;
    status: OrderStatus;
    items: OrderItem[];
    totalAmount: number;
    subtotal: number;
    deliveryFee: number;
    discount: number;
    currencyCode: string;

    // Shopify references
    shopifyOrderId?: string;
    shopifyOrderName?: string;
    shopifyDraftOrderId?: string;

    // Address
    shippingAddress: {
        name: string;
        address: string;
        city: string;
        state: string;
        pincode: string;
        phone: string;
    };

    // Payment
    paymentMethod: 'razorpay' | 'cod' | 'try_and_buy';
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
    paymentId?: string;

    // Dates
    createdAt: string;
    updatedAt: string;
    deliveredAt?: string;

    // ETA
    estimatedDeliveryMinutes?: number;

    // Try & Buy specific
    tryAndBuyStatus?: TryAndBuyStatus;
    keptItems?: string[]; // IDs of items customer decided to keep
    returnedItems?: string[]; // IDs of items to return
    finalAmount?: number; // Amount after selection

    // Tracking
    trackingUpdates?: Array<{
        status: OrderStatus;
        timestamp: string;
        message?: string;
    }>;

    // Notes
    note?: string;
    couponCode?: string;
}

export interface CreateOrderInput {
    items: OrderItem[];
    shippingAddress: Order['shippingAddress'];
    paymentMethod: Order['paymentMethod'];
    paymentStatus?: Order['paymentStatus'];
    paymentId?: string;
    type?: OrderType;
    shopifyOrderId?: string;
    shopifyOrderName?: string;
    shopifyDraftOrderId?: string;
    deliveryFee?: number;
    discount?: number;
    couponCode?: string;
    note?: string;
    estimatedDeliveryMinutes?: number;
}

// Utility functions
const generateOrderId = (): string => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `ORD_${timestamp}_${random}`.toUpperCase();
};

/**
 * Calculate ETA based on distance
 * Formula: 10 minutes base + (distance_km * 2 minutes)
 */
export const calculateETA = (distanceKm: number): number => {
    const baseTime = 10; // 10 minutes base
    const timePerKm = 2; // 2 minutes per km
    return Math.round(baseTime + distanceKm * timePerKm);
};

/**
 * Get human-readable status text
 */
export const getStatusText = (status: OrderStatus): string => {
    const statusMap: Record<OrderStatus, string> = {
        placed: 'Order Placed',
        confirmed: 'Order Confirmed',
        packed: 'Packed at Store',
        out_for_delivery: 'Out for Delivery',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
        return_requested: 'Return Requested',
        returned: 'Returned',
    };
    return statusMap[status] || status;
};

/**
 * Get status color
 */
export const getStatusColor = (status: OrderStatus): string => {
    const colorMap: Record<OrderStatus, string> = {
        placed: '#FF9800',
        confirmed: '#2196F3',
        packed: '#9C27B0',
        out_for_delivery: '#00BCD4',
        delivered: '#4CAF50',
        cancelled: '#F44336',
        return_requested: '#FF5722',
        returned: '#795548',
    };
    return colorMap[status] || '#666';
};

// Order Service
export const orderService = {
    /**
     * Create a new order
     */
    createOrder: async (input: CreateOrderInput): Promise<Order> => {
        try {
            const subtotal = input.items.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            );
            const deliveryFee = input.deliveryFee || 0;
            const discount = input.discount || 0;
            const totalAmount = subtotal + deliveryFee - discount;

            const now = new Date().toISOString();

            const order: Order = {
                id: generateOrderId(),
                type: input.type || 'regular',
                status: 'placed',
                items: input.items,
                totalAmount,
                subtotal,
                deliveryFee,
                discount,
                currencyCode: 'INR',
                shippingAddress: input.shippingAddress,
                paymentMethod: input.paymentMethod,
                paymentStatus: input.paymentStatus || 'pending',
                paymentId: input.paymentId,
                shopifyOrderId: input.shopifyOrderId,
                shopifyOrderName: input.shopifyOrderName,
                shopifyDraftOrderId: input.shopifyDraftOrderId,
                createdAt: now,
                updatedAt: now,
                estimatedDeliveryMinutes: input.estimatedDeliveryMinutes,
                couponCode: input.couponCode,
                note: input.note,
                trackingUpdates: [
                    {
                        status: 'placed',
                        timestamp: now,
                        message: 'Order placed successfully',
                    },
                ],
                ...(input.type === 'try_and_buy' && {
                    tryAndBuyStatus: 'pending_delivery',
                }),
            };

            // Save to appropriate storage
            const storageKey =
                input.type === 'try_and_buy' ? TRY_AND_BUY_ORDERS_KEY : ORDERS_STORAGE_KEY;
            const existingOrders = await orderService.getOrdersFromStorage(storageKey);
            existingOrders.unshift(order);
            await AsyncStorage.setItem(storageKey, JSON.stringify(existingOrders));

            console.log('[OrderService] Order created:', order.id);
            return order;
        } catch (error: any) {
            console.error('[OrderService] Error creating order:', error.message);
            throw error;
        }
    },

    /**
     * Get all orders (regular + try & buy)
     */
    getAllOrders: async (): Promise<Order[]> => {
        try {
            const [regularOrders, tryAndBuyOrders] = await Promise.all([
                orderService.getOrdersFromStorage(ORDERS_STORAGE_KEY),
                orderService.getOrdersFromStorage(TRY_AND_BUY_ORDERS_KEY),
            ]);

            const allOrders = [
                ...regularOrders.map((o) => ({ ...o, type: 'regular' as OrderType })),
                ...tryAndBuyOrders.map((o) => ({ ...o, type: 'try_and_buy' as OrderType })),
            ];

            // Sort by creation date (newest first)
            allOrders.sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            return allOrders;
        } catch (error: any) {
            console.error('[OrderService] Error fetching orders:', error.message);
            return [];
        }
    },

    /**
     * Get order by ID
     */
    getOrderById: async (orderId: string): Promise<Order | null> => {
        try {
            const allOrders = await orderService.getAllOrders();
            return (
                allOrders.find(
                    (o) =>
                        o.id === orderId ||
                        o.shopifyOrderId === orderId ||
                        o.shopifyDraftOrderId === orderId
                ) || null
            );
        } catch (error: any) {
            console.error('[OrderService] Error fetching order:', error.message);
            return null;
        }
    },

    /**
     * Update order status
     */
    updateOrderStatus: async (
        orderId: string,
        status: OrderStatus,
        message?: string
    ): Promise<Order | null> => {
        try {
            const order = await orderService.getOrderById(orderId);
            if (!order) return null;

            const now = new Date().toISOString();
            order.status = status;
            order.updatedAt = now;

            if (!order.trackingUpdates) order.trackingUpdates = [];
            order.trackingUpdates.push({
                status,
                timestamp: now,
                message: message || getStatusText(status),
            });

            // Track order confirmed when status changes to confirmed
            if (status === 'confirmed') {
                try {
                    const { trackOrderConfirmed } = require('@/utils/mixpanelHelpers');
                    trackOrderConfirmed(order.id, order.totalAmount);
                } catch (e) {
                    console.warn('Mixpanel tracking error:', e);
                }
            }

            if (status === 'delivered') {
                order.deliveredAt = now;
            }

            // Save updated order
            const storageKey =
                order.type === 'try_and_buy' ? TRY_AND_BUY_ORDERS_KEY : ORDERS_STORAGE_KEY;
            const orders = await orderService.getOrdersFromStorage(storageKey);
            const index = orders.findIndex((o) => o.id === orderId);
            if (index !== -1) {
                orders[index] = order;
                await AsyncStorage.setItem(storageKey, JSON.stringify(orders));
            }

            return order;
        } catch (error: any) {
            console.error('[OrderService] Error updating order status:', error.message);
            return null;
        }
    },

    /**
     * Update Try & Buy order with kept/returned items
     */
    updateTryAndBuySelection: async (
        orderId: string,
        keptItemIds: string[],
        returnedItemIds: string[]
    ): Promise<Order | null> => {
        try {
            const orders = await orderService.getOrdersFromStorage(TRY_AND_BUY_ORDERS_KEY);
            const index = orders.findIndex((o) => o.id === orderId);
            if (index === -1) return null;

            const order = orders[index];
            order.keptItems = keptItemIds;
            order.returnedItems = returnedItemIds;
            order.tryAndBuyStatus = 'selection_confirmed';
            order.updatedAt = new Date().toISOString();

            // Calculate final amount based on kept items
            const keptItemsTotal = order.items
                .filter((item) => keptItemIds.includes(item.id))
                .reduce((sum, item) => sum + item.price * item.quantity, 0);
            order.finalAmount = keptItemsTotal + order.deliveryFee;

            // Update items with kept/returned status
            order.items = order.items.map((item) => ({
                ...item,
                isKept: keptItemIds.includes(item.id),
                isReturned: returnedItemIds.includes(item.id),
            }));

            orders[index] = order;
            await AsyncStorage.setItem(TRY_AND_BUY_ORDERS_KEY, JSON.stringify(orders));

            return order;
        } catch (error: any) {
            console.error('[OrderService] Error updating T&B selection:', error.message);
            return null;
        }
    },

    /**
     * Mark Try & Buy order as payment collected
     */
    markTryAndBuyPaid: async (
        orderId: string,
        paymentId: string
    ): Promise<Order | null> => {
        try {
            const orders = await orderService.getOrdersFromStorage(TRY_AND_BUY_ORDERS_KEY);
            const index = orders.findIndex((o) => o.id === orderId);
            if (index === -1) return null;

            const order = orders[index];
            order.tryAndBuyStatus = 'payment_collected';
            order.paymentStatus = 'paid';
            order.paymentId = paymentId;
            order.updatedAt = new Date().toISOString();

            orders[index] = order;
            await AsyncStorage.setItem(TRY_AND_BUY_ORDERS_KEY, JSON.stringify(orders));

            return order;
        } catch (error: any) {
            console.error('[OrderService] Error marking T&B paid:', error.message);
            return null;
        }
    },

    /**
     * Request return for an order
     */
    requestReturn: async (
        orderId: string,
        itemIds: string[],
        reason: string
    ): Promise<Order | null> => {
        try {
            const order = await orderService.getOrderById(orderId);
            if (!order) return null;

            order.status = 'return_requested';
            order.updatedAt = new Date().toISOString();
            order.note = `Return requested for items: ${itemIds.join(', ')}. Reason: ${reason}`;

            if (!order.trackingUpdates) order.trackingUpdates = [];
            order.trackingUpdates.push({
                status: 'return_requested',
                timestamp: order.updatedAt,
                message: `Return requested: ${reason}`,
            });

            const storageKey =
                order.type === 'try_and_buy' ? TRY_AND_BUY_ORDERS_KEY : ORDERS_STORAGE_KEY;
            const orders = await orderService.getOrdersFromStorage(storageKey);
            const index = orders.findIndex((o) => o.id === orderId);
            if (index !== -1) {
                orders[index] = order;
                await AsyncStorage.setItem(storageKey, JSON.stringify(orders));
            }

            return order;
        } catch (error: any) {
            console.error('[OrderService] Error requesting return:', error.message);
            return null;
        }
    },

    // Helper: Get orders from storage
    getOrdersFromStorage: async (key: string): Promise<Order[]> => {
        try {
            const data = await AsyncStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    // Helper: Clear all orders (for testing)
    clearAllOrders: async (): Promise<void> => {
        await AsyncStorage.multiRemove([ORDERS_STORAGE_KEY, TRY_AND_BUY_ORDERS_KEY]);
    },
};
