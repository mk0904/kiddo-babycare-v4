// Try & Buy Context
// Manages the Try & Buy cart and order lifecycle

import { Order, OrderItem, calculateETA, orderService } from '@/services/orderService';
import { shopifyAdminApi } from '@/services/shopifyAdminApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ReactNode,
    createContext,
    useContext,
    useEffect,
    useState
} from 'react';

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
        customerId?: string,
        paymentMethod?: 'cod' | 'razorpay',
        paymentId?: string,
        items?: TryAndBuyItem[], // Optional: pass items directly to avoid state sync issues
        deliverySchedule?: {
            date: string;
            time: string;
            day: string;
            dateFormat: string;
        },
        selectedShoe?: string,
        couponCode?: string,
        discountAmount?: number
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
        console.log('[TryAndBuy] Attempting to add item:', {
            title: item.title,
            productId: item.productId,
            variantId: item.variantId,
            tags: item.tags,
            currentCartCount: cartItemCount,
        });

        // Check if product is returnable
        if (!isProductReturnable(item.tags)) {
            console.log('[TryAndBuy] Cannot add non-returnable item:', item.title, 'Tags:', item.tags);
            return false;
        }

        // Check max items
        if (!canAddMoreItems()) {
            console.log('[TryAndBuy] Max items reached. Current count:', cartItemCount, 'Max:', MAX_TRY_AND_BUY_ITEMS);
            return false;
        }

        setCartItems((prev) => {
            // Check if same product variant already in cart
            // Match by both variantId AND productId to ensure we're matching the exact same product
            const existing = prev.find(
                (i) => i.variantId === item.variantId && i.productId === item.productId
            );
            if (existing) {
                // Update quantity for existing item
                return prev.map((i) =>
                    i.variantId === item.variantId && i.productId === item.productId
                        ? { ...i, quantity: Math.min(i.quantity + item.quantity, MAX_TRY_AND_BUY_ITEMS) }
                        : i
                );
            }

            // Add new item (different product or variant)
            const newItem: TryAndBuyItem = {
                ...item,
                id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            };
            console.log('[TryAndBuy] Adding new item to cart. New cart size will be:', prev.length + 1);
            return [...prev, newItem];
        });

        console.log('[TryAndBuy] Item added successfully:', item.title);
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
        customerId?: string,
        paymentMethod: 'cod' | 'razorpay' = 'cod',
        paymentId?: string,
        items?: TryAndBuyItem[], // Optional: use provided items or fallback to cartItems
        deliverySchedule?: {
            date: string;
            time: string;
            day: string;
            dateFormat: string;
        },
        selectedShoe?: string,
        couponCode?: string,
        discountAmount?: number
    ): Promise<TryAndBuyOrder | null> => {
        // Use provided items if available, otherwise use cartItems from state
        const orderItems = items && items.length > 0 ? items : cartItems;
        
        if (orderItems.length === 0) {
            console.error('[TryAndBuy] Cannot create order with empty cart');
            throw new Error('Cannot create Try & Buy order: Cart is empty');
        }

        setIsLoading(true);

        try {
            console.log('[TryAndBuy] Creating order with:', {
                cartItemsCount: orderItems.length,
                usingProvidedItems: !!(items && items.length > 0),
                paymentMethod,
                hasCustomerId: !!customerId,
                shippingAddress,
                selectedShoe: selectedShoe || 'none',
            });

            // Build custom attributes with payment method and payment ID
            const customAttributes = [
                { key: 'order_type', value: 'try_and_buy' },
                { key: 'max_items', value: orderItems.length.toString() },
                { key: 'payment_method', value: paymentMethod },
                ...(paymentId ? [{ key: 'payment_id', value: paymentId }] : []),
                ...(deliverySchedule
                    ? [
                        { key: 'delivery_date', value: deliverySchedule.date },
                        { key: 'delivery_time', value: deliverySchedule.time },
                        { key: 'delivery_day', value: deliverySchedule.day },
                        { key: 'date_format', value: deliverySchedule.dateFormat },
                    ]
                    : []),
                ...(selectedShoe ? [{ key: 'selected_shoe', value: selectedShoe }] : []),
                ...(couponCode ? [{ key: 'coupon_code', value: couponCode }] : []),
                ...(discountAmount !== undefined && discountAmount > 0 ? [{ key: 'discount_amount', value: discountAmount.toString() }] : []),
            ];

            // Format customer ID if provided
            let formattedCustomerId: string | undefined = undefined;
            if (customerId) {
                // Handle different customer ID formats
                const customerIdStr = String(customerId);
                if (customerIdStr.includes('gid://shopify/Customer/')) {
                    formattedCustomerId = customerIdStr;
                } else if (customerIdStr.startsWith('shopify-')) {
                    // Extract numeric ID from shopify- prefix
                    formattedCustomerId = `gid://shopify/Customer/${customerIdStr.replace('shopify-', '')}`;
                } else {
                    // Assume it's a numeric ID
                    formattedCustomerId = `gid://shopify/Customer/${customerIdStr}`;
                }
            }

            // 1. Create Shopify Draft Order (use appliedDiscount for exact amount when available)
            const tryAndBuyDiscountAmount = discountAmount ?? 0;
            console.log('[TryAndBuy] Creating draft order with formatted customerId:', formattedCustomerId);
            const draftOrder = await shopifyAdminApi.createDraftOrder({
                customerId: formattedCustomerId,
                ...(tryAndBuyDiscountAmount > 0
                    ? {
                        appliedDiscount: {
                            valueType: 'FIXED_AMOUNT' as const,
                            value: tryAndBuyDiscountAmount,
                            title: couponCode ? `Discount (${couponCode})` : 'Discount',
                        },
                    }
                    : couponCode
                        ? { discountCodes: [couponCode] }
                        : {}),
                lineItems: orderItems.map((item) => ({
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
                customAttributes,
            });

            console.log('[TryAndBuy] Draft order created successfully:', draftOrder.id);

            // 2. Complete the draft order to convert it to a regular order in Shopify
            // This makes it appear in Shopify Orders section
            let completedOrder = null;
            let shopifyOrderId = draftOrder.id;
            try {
                console.log('[TryAndBuy] Completing draft order to convert to regular order...');
                const completed = await shopifyAdminApi.completeDraftOrder(
                    draftOrder.id,
                    paymentMethod === 'cod' // paymentPending = true for COD, false for online payment
                );
                
                if (completed?.order?.id) {
                    completedOrder = completed.order;
                    shopifyOrderId = completed.order.id;
                    console.log('[TryAndBuy] Draft order completed successfully. Order ID:', completed.order.id);
                } else {
                    console.warn('[TryAndBuy] Draft order completed but no order ID returned');
                }
            } catch (completeError: any) {
                console.error('[TryAndBuy] Error completing draft order:', completeError);
                // Don't fail the entire order creation if completion fails
                // The draft order still exists and can be completed manually
                console.warn('[TryAndBuy] Continuing with draft order. Order may need to be completed manually.');
            }

            // 3. Create local order
            const localOrderItems: OrderItem[] = orderItems.map((item) => ({
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
                items: localOrderItems,
                shippingAddress,
                paymentMethod: paymentMethod === 'cod' ? 'cod' : 'razorpay',
                paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
                paymentId: paymentId,
                type: 'try_and_buy',
                shopifyDraftOrderId: draftOrder.id,
                shopifyOrderId: shopifyOrderId !== draftOrder.id ? shopifyOrderId : undefined, // Use completed order ID if available
                shopifyOrderName: completedOrder?.name || undefined,
                estimatedDeliveryMinutes: calculateETA(2), // Default 2km
                note: `Try & Buy Order - Payment: ${paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}`,
            });

            const tryAndBuyOrder: TryAndBuyOrder = {
                ...localOrder,
                shopifyDraftOrderId: draftOrder.id,
                shopifyOrderId: shopifyOrderId !== draftOrder.id ? shopifyOrderId : undefined,
                shopifyOrderName: completedOrder?.name || undefined,
                tryAndBuyStatus: 'pending_delivery',
            };

            // 3. Clear cart
            clearCart();

            // 4. Refresh orders
            await refreshOrders();

            console.log('[TryAndBuy] Order created:', tryAndBuyOrder.id);
            return tryAndBuyOrder;
        } catch (error: any) {
            console.error('[TryAndBuy] Error creating order:', error);
            console.error('[TryAndBuy] Error details:', {
                message: error.message,
                stack: error.stack,
                response: error.response?.data,
                userErrors: error.userErrors,
                data: error.data,
            });
            
            // Extract a more user-friendly error message
            let errorMessage = error.message || 'Failed to create Try & Buy order';
            
            // Check for GraphQL errors
            if (error.response?.data?.errors) {
                const graphqlError = error.response.data.errors[0];
                errorMessage = graphqlError.message || errorMessage;
            }
            
            // Check for user errors from Shopify
            if (error.userErrors && error.userErrors.length > 0) {
                errorMessage = error.userErrors[0].message || errorMessage;
            }
            
            // Check for data errors
            if (error.response?.data?.data?.draftOrderCreate?.userErrors) {
                const userError = error.response.data.data.draftOrderCreate.userErrors[0];
                errorMessage = userError.message || errorMessage;
            }
            
            // Re-throw with user-friendly message
            const friendlyError = new Error(errorMessage);
            (friendlyError as any).originalError = error;
            throw friendlyError;
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
