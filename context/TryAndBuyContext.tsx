// Try & Buy Context
// Manages the Try & Buy cart and order lifecycle

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shopifyAdminApi, DraftOrder } from '@/services/shopifyAdminApi';
import { orderService, Order, OrderItem, calculateETA } from '@/services/orderService';

// Constants
const TRY_AND_BUY_CART_KEY = 'kiddo_try_and_buy_cart';
const MAX_TRY_AND_BUY_ITEMS = 5;

// Non-returnable categories (diapers, formula, food)
const NON_RETURNABLE_TAGS = [
    'diaper',
    'diapers',
    'formula',
    'food',
    'feeding',
    'non-returnable',
];

// Types
export interface TryAndBuyItem {
    id: string;
    productId: string;
    variantId: string;
    title: string;
    variantTitle?: string;
    price: number;
    currencyCode: string;
    image?: string;
    quantity: number;
    tags?: string[];
}

export interface TryAndBuyOrder extends Order {
    shopifyDraftOrderId: string;
    tryAndBuyStatus: 'pending_delivery' | 'delivered_awaiting_selection' | 'selection_confirmed' | 'payment_collected' | 'completed' | 'cancelled';
    keptItems?: string[];
    returnedItems?: string[];
    finalAmount?: number;
}

interface TryAndBuyContextType {
    // Cart
    cartItems: TryAndBuyItem[];
    cartTotal: number;
    cartItemCount: number;
    isLoading: boolean;

    // Cart actions
    addItem: (item: Omit<TryAndBuyItem, 'id'>) => Promise<boolean>;
    removeItem: (itemId: string) => void;
    updateQuantity: (itemId: string, quantity: number) => void;
    clearCart: () => void;
    isProductReturnable: (tags?: string[]) => boolean;
    canAddMoreItems: () => boolean;

    // Order actions
    createOrder: (
        shippingAddress: Order['shippingAddress'],
        customerId?: string
    ) => Promise<TryAndBuyOrder | null>;

    // Active order
    activeOrders: TryAndBuyOrder[];
    refreshOrders: () => Promise<void>;

    // Selection (rider-side)
    selectItemsToKeep: (orderId: string, keptItemIds: string[]) => Promise<TryAndBuyOrder | null>;

    // Payment
    markOrderPaid: (orderId: string, paymentId: string) => Promise<TryAndBuyOrder | null>;
}

const TryAndBuyContext = createContext<TryAndBuyContextType | undefined>(undefined);

export const useTryAndBuy = () => {
    const context = useContext(TryAndBuyContext);
    if (!context) {
        throw new Error('useTryAndBuy must be used within a TryAndBuyProvider');
    }
    return context;
};

export const TryAndBuyProvider = ({ children }: { children: ReactNode }) => {
    const [cartItems, setCartItems] = useState<TryAndBuyItem[]>([]);
    const [activeOrders, setActiveOrders] = useState<TryAndBuyOrder[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Load cart on mount
    useEffect(() => {
        loadCart();
        refreshOrders();
    }, []);

    // Save cart whenever it changes
    useEffect(() => {
        saveCart();
    }, [cartItems]);

    const loadCart = async () => {
        try {
            const data = await AsyncStorage.getItem(TRY_AND_BUY_CART_KEY);
            if (data) {
                setCartItems(JSON.parse(data));
            }
        } catch (error) {
            console.error('[TryAndBuy] Error loading cart:', error);
        }
    };

    const saveCart = async () => {
        try {
            await AsyncStorage.setItem(TRY_AND_BUY_CART_KEY, JSON.stringify(cartItems));
        } catch (error) {
            console.error('[TryAndBuy] Error saving cart:', error);
        }
    };

    const cartTotal = cartItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    const isProductReturnable = (tags?: string[]): boolean => {
        if (!tags || tags.length === 0) return true;
        const lowerTags = tags.map((t) => t.toLowerCase());
        return !NON_RETURNABLE_TAGS.some((nonRet) =>
            lowerTags.some((tag) => tag.includes(nonRet))
        );
    };

    const canAddMoreItems = (): boolean => {
        return cartItemCount < MAX_TRY_AND_BUY_ITEMS;
    };

    const addItem = async (item: Omit<TryAndBuyItem, 'id'>): Promise<boolean> => {
        // Check if product is returnable
        if (!isProductReturnable(item.tags)) {
            console.log('[TryAndBuy] Cannot add non-returnable item:', item.title);
            return false;
        }

        // Check max items
        if (!canAddMoreItems()) {
            console.log('[TryAndBuy] Max items reached');
            return false;
        }

        setCartItems((prev) => {
            // Check if variant already in cart
            const existing = prev.find((i) => i.variantId === item.variantId);
            if (existing) {
                // Update quantity
                return prev.map((i) =>
                    i.variantId === item.variantId
                        ? { ...i, quantity: Math.min(i.quantity + item.quantity, MAX_TRY_AND_BUY_ITEMS) }
                        : i
                );
            }

            // Add new item
            const newItem: TryAndBuyItem = {
                ...item,
                id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            };
            return [...prev, newItem];
        });

        return true;
    };

    const removeItem = (itemId: string) => {
        setCartItems((prev) => prev.filter((i) => i.id !== itemId));
    };

    const updateQuantity = (itemId: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(itemId);
            return;
        }

        setCartItems((prev) =>
            prev.map((i) =>
                i.id === itemId ? { ...i, quantity: Math.min(quantity, MAX_TRY_AND_BUY_ITEMS) } : i
            )
        );
    };

    const clearCart = () => {
        setCartItems([]);
    };

    const createOrder = async (
        shippingAddress: Order['shippingAddress'],
        customerId?: string
    ): Promise<TryAndBuyOrder | null> => {
        if (cartItems.length === 0) {
            console.error('[TryAndBuy] Cannot create order with empty cart');
            return null;
        }

        setIsLoading(true);

        try {
            // 1. Create Shopify Draft Order
            const draftOrder = await shopifyAdminApi.createDraftOrder({
                customerId,
                lineItems: cartItems.map((item) => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    originalUnitPrice: item.price.toString(),
                })),
                shippingAddress: {
                    address1: shippingAddress.address,
                    city: shippingAddress.city,
                    province: shippingAddress.state,
                    country: 'India',
                    zip: shippingAddress.pincode,
                    firstName: shippingAddress.name.split(' ')[0] || shippingAddress.name,
                    lastName: shippingAddress.name.split(' ').slice(1).join(' ') || '',
                    phone: shippingAddress.phone,
                },
                tags: ['try-and-buy'],
                customAttributes: [
                    { key: 'order_type', value: 'try_and_buy' },
                    { key: 'max_items', value: cartItems.length.toString() },
                ],
            });

            // 2. Create local order
            const orderItems: OrderItem[] = cartItems.map((item) => ({
                id: item.id,
                variantId: item.variantId,
                productId: item.productId,
                title: item.title,
                variantTitle: item.variantTitle,
                price: item.price,
                quantity: item.quantity,
                image: item.image,
            }));

            const localOrder = await orderService.createOrder({
                items: orderItems,
                shippingAddress,
                paymentMethod: 'try_and_buy',
                paymentStatus: 'pending',
                type: 'try_and_buy',
                shopifyDraftOrderId: draftOrder.id,
                estimatedDeliveryMinutes: calculateETA(2), // Default 2km
                note: 'Try & Buy Order',
            });

            const tryAndBuyOrder: TryAndBuyOrder = {
                ...localOrder,
                shopifyDraftOrderId: draftOrder.id,
                tryAndBuyStatus: 'pending_delivery',
            };

            // 3. Clear cart
            clearCart();

            // 4. Refresh orders
            await refreshOrders();

            console.log('[TryAndBuy] Order created:', tryAndBuyOrder.id);
            return tryAndBuyOrder;
        } catch (error: any) {
            console.error('[TryAndBuy] Error creating order:', error.message);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const refreshOrders = async () => {
        try {
            const allOrders = await orderService.getAllOrders();
            const tryAndBuyOrders = allOrders.filter(
                (o) => o.type === 'try_and_buy'
            ) as TryAndBuyOrder[];
            setActiveOrders(tryAndBuyOrders);
        } catch (error) {
            console.error('[TryAndBuy] Error refreshing orders:', error);
        }
    };

    const selectItemsToKeep = async (
        orderId: string,
        keptItemIds: string[]
    ): Promise<TryAndBuyOrder | null> => {
        try {
            const order = await orderService.getOrderById(orderId);
            if (!order) return null;

            const returnedItemIds = order.items
                .filter((item) => !keptItemIds.includes(item.id))
                .map((item) => item.id);

            // Update local order
            const updatedOrder = await orderService.updateTryAndBuySelection(
                orderId,
                keptItemIds,
                returnedItemIds
            );

            if (!updatedOrder) return null;

            // Update Shopify Draft Order with only kept items
            if (order.shopifyDraftOrderId) {
                const keptItems = order.items.filter((item) =>
                    keptItemIds.includes(item.id)
                );
                await shopifyAdminApi.updateDraftOrder(order.shopifyDraftOrderId, {
                    lineItems: keptItems.map((item) => ({
                        variantId: item.variantId,
                        quantity: item.quantity,
                    })),
                    tags: ['try-and-buy', 'selection-confirmed'],
                    customAttributes: [
                        { key: 'order_type', value: 'try_and_buy' },
                        { key: 'kept_items', value: keptItemIds.join(',') },
                        { key: 'returned_items', value: returnedItemIds.join(',') },
                    ],
                });
            }

            await refreshOrders();
            return updatedOrder as TryAndBuyOrder;
        } catch (error: any) {
            console.error('[TryAndBuy] Error selecting items:', error.message);
            return null;
        }
    };

    const markOrderPaid = async (
        orderId: string,
        paymentId: string
    ): Promise<TryAndBuyOrder | null> => {
        try {
            const order = await orderService.getOrderById(orderId);
            if (!order) return null;

            // Complete the draft order
            if (order.shopifyDraftOrderId) {
                await shopifyAdminApi.completeDraftOrder(order.shopifyDraftOrderId, false);
            }

            // Update local order
            const updatedOrder = await orderService.markTryAndBuyPaid(orderId, paymentId);

            await refreshOrders();
            return updatedOrder as TryAndBuyOrder;
        } catch (error: any) {
            console.error('[TryAndBuy] Error marking order paid:', error.message);
            return null;
        }
    };

    return (
        <TryAndBuyContext.Provider
            value={{
                cartItems,
                cartTotal,
                cartItemCount,
                isLoading,
                addItem,
                removeItem,
                updateQuantity,
                clearCart,
                isProductReturnable,
                canAddMoreItems,
                createOrder,
                activeOrders,
                refreshOrders,
                selectItemsToKeep,
                markOrderPaid,
            }}
        >
            {children}
        </TryAndBuyContext.Provider>
    );
};
