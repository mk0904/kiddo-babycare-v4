import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { orderService } from '@/services/orderService';
import { shopifyApi } from '@/services/shopifyApi';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const formatOrderId = (orderIdOrName: string | number) => {
    if (typeof orderIdOrName === 'number') {
        return `#${orderIdOrName}`;
    }
    if (typeof orderIdOrName === 'string') {
        const match = orderIdOrName.match(/\d+/);
        if (match) {
            return `#${match[0]}`;
        }
    }
    return `#${orderIdOrName}`;
};

const getStatusText = (status: string) => {
    switch (status) {
        case 'FULFILLED':
            return 'Delivered';
        case 'UNFULFILLED':
            return 'Processing';
        case 'PAID':
            return 'Paid';
        case 'PENDING':
            return 'Pending';
        default:
            return status;
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'FULFILLED':
        case 'PAID':
            return Colors.success;
        case 'UNFULFILLED':
        case 'PENDING':
            return '#FFA500';
        default:
            return Colors.textSecondary;
    }
};

const looksLikeTicketingDate = (value: string) => {
    const s = String(value || '').trim();
    if (!s) return false;
    const lower = s.toLowerCase();
    if (lower === 'default' || lower === 'default title') return false;

    // ISO-like date embedded in text
    if (/\d{4}-\d{2}-\d{2}/.test(lower)) return true;

    // Month names commonly used for event variants ("15th Feb", "Feb 15", etc.)
    const month =
        '(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)';
    const ordinal = '(?:st|nd|rd|th)?';
    const day = '(?:[0-3]?\\d)';
    if (new RegExp(`\\b${day}${ordinal}\\s+${month}\\b`, 'i').test(s)) return true;
    if (new RegExp(`\\b${month}\\s+${day}${ordinal}\\b`, 'i').test(s)) return true;

    return false;
};

const isTicketingOrder = (order: any) => {
    const edges = order?.lineItems?.edges || [];
    return edges.some((edge: any) => {
        const itemTitle = edge?.node?.title || '';
        const variantTitle = edge?.node?.variant?.title || '';
        // Has booking_date in customAttributes = definitely Events/Playhouses/Petting Farms
        const attrs = edge?.node?.customAttributes || [];
        if (attrs.some((a: any) => a.key === 'booking_date' || a.key === 'booking_date_display')) return true;
        // Heuristics: variant title looks like a date, or item title contains ticketing keywords
        if (looksLikeTicketingDate(variantTitle)) return true;
        if (/(event|workshop|playhouse|petting|farm|ticket|zoo)/i.test(String(itemTitle))) return true;
        return false;
    });
};

const getFirstBookingDate = (order: any): string | null => {
    const edges = order?.lineItems?.edges || [];
    for (const edge of edges) {
        const attrs = edge?.node?.customAttributes || [];
        const display = attrs.find((a: any) => a.key === 'booking_date_display')?.value;
        const raw = attrs.find((a: any) => a.key === 'booking_date')?.value;
        if (display) return display;
        if (raw) return new Date(raw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return null;
};

export default function OrdersScreen() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadOrders = async () => {
        try {
            setLoading(true);
            
            // Fetch orders from both Shopify (regular orders) and local storage (Try & Buy)
            const [shopifyOrdersResult, localOrders] = await Promise.all([
                user?.customerAccessToken 
                    ? shopifyApi.getCustomerOrders(user.customerAccessToken, 50).catch(() => null)
                    : Promise.resolve(null),
                orderService.getAllOrders().catch(() => []),
            ]);

            // Format Shopify orders
            const shopifyOrders = shopifyOrdersResult?.edges?.map((edge: any) => edge.node) || [];
            
            // Create sets of Shopify order IDs and order numbers to detect duplicates
            const shopifyOrderIds = new Set(shopifyOrders.map((o: any) => o.id));
            const shopifyOrderNumbers = new Set(
                shopifyOrders.map((o: any) => {
                    // Extract order number from orderNumber field (e.g., "#1224" or "1224")
                    const orderNum = o.orderNumber || '';
                    return typeof orderNum === 'string' ? orderNum.replace('#', '') : String(orderNum);
                }).filter((num: string) => num) // Filter out empty strings
            );
            
            // Transform local Try & Buy orders to match the expected format
            // Only include local orders that aren't already in Shopify orders
            const tryAndBuyOrders = localOrders
                .filter((o) => {
                    // Only include if it's a Try & Buy order
                    if (o.type !== 'try_and_buy') return false;
                    
                    // Check if this order already exists in Shopify orders
                    // Match by: 1) shopifyOrderId, 2) order number from shopifyOrderName, 3) local order ID
                    if (o.shopifyOrderId && shopifyOrderIds.has(o.shopifyOrderId)) {
                        return false; // Already in Shopify orders
                    }
                    
                    // Extract order number from shopifyOrderName (e.g., "#1224" or "1224")
                    if (o.shopifyOrderName) {
                        const orderNum = String(o.shopifyOrderName).replace('#', '').trim();
                        if (orderNum && shopifyOrderNumbers.has(orderNum)) {
                            return false; // Already in Shopify orders (matched by order number)
                        }
                    }
                    
                    // Check if local order ID matches any Shopify order
                    // Extract numeric part from order ID for comparison
                    const localOrderNum = String(o.id).match(/\d+/)?.[0];
                    if (localOrderNum && shopifyOrderNumbers.has(localOrderNum)) {
                        return false; // Already in Shopify orders (matched by numeric ID)
                    }
                    
                    // Include this local order only if it's not already in Shopify orders
                    return true;
                })
                .map((localOrder) => {
                    // Prefer completed Order ID over Draft Order ID
                    const orderId = localOrder.shopifyOrderId || localOrder.shopifyDraftOrderId || localOrder.id;
                    
                    return {
                        id: orderId,
                        orderNumber: localOrder.shopifyOrderName || localOrder.id,
                        processedAt: localOrder.createdAt,
                        fulfillmentStatus: localOrder.status === 'delivered' ? 'FULFILLED' : 'UNFULFILLED',
                        financialStatus: localOrder.paymentStatus === 'paid' ? 'PAID' : 'PENDING',
                        currentTotalPrice: {
                            amount: localOrder.totalAmount.toString(),
                            currencyCode: localOrder.currencyCode || 'INR',
                        },
                        lineItems: {
                            edges: localOrder.items.map((item: any) => ({
                                node: {
                                    title: item.title,
                                    variant: {
                                        title: item.variantTitle || '',
                                        image: item.image ? { url: item.image } : null,
                                    },
                                },
                            })),
                        },
                        isTryAndBuy: true, // Flag to identify Try & Buy orders
                        isCompletedOrder: !!localOrder.shopifyOrderId, // Flag to indicate if it's a completed order
                        localOrderData: localOrder, // Keep reference to local order
                    };
                });

            // Combine both types of orders
            const allOrders = [...shopifyOrders, ...tryAndBuyOrders];
            
            // Remove any remaining duplicates by order number and ID
            const seenOrderNumbers = new Set<string>();
            const seenOrderIds = new Set<string>();
            const deduplicatedOrders = allOrders.filter((order: any) => {
                // Extract order number
                const orderNum = order.orderNumber || '';
                const orderNumStr = typeof orderNum === 'string' 
                    ? orderNum.replace('#', '').trim() 
                    : String(orderNum);
                
                // Create a unique key from order ID and order number
                const orderId = order.id || '';
                const uniqueKey = `${orderId}_${orderNumStr}`;
                
                // Check if we've seen this combination before
                if (seenOrderIds.has(orderId) || (orderNumStr && seenOrderNumbers.has(orderNumStr))) {
                    return false; // Duplicate, skip it
                }
                
                // Mark as seen
                if (orderId) seenOrderIds.add(orderId);
                if (orderNumStr) seenOrderNumbers.add(orderNumStr);
                
                return true;
            });
            
            // Sort by creation date (newest first)
            deduplicatedOrders.sort((a: any, b: any) => {
                const dateA = new Date(a.processedAt || a.localOrderData?.createdAt || 0).getTime();
                const dateB = new Date(b.processedAt || b.localOrderData?.createdAt || 0).getTime();
                return dateB - dateA;
            });
            
            setOrders(deduplicatedOrders);
        } catch (error) {
            console.error('Error fetching orders:', error);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    // Refresh orders when screen comes into focus (e.g., when navigating back from order details)
    useFocusEffect(
        React.useCallback(() => {
            if (isAuthenticated) {
                loadOrders();
            } else {
                setLoading(false);
            }
        }, [isAuthenticated, user])
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Orders</Text>
                    <View style={styles.placeholder} />
                </View>
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
            </SafeAreaView>
        );
    }

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Orders</Text>
                    <View style={styles.placeholder} />
                </View>
                <EmptyState
                    icon="lock-closed-outline"
                    title="Sign in to view orders"
                    subtitle="You need to be logged in to access your order history"
                    buttonText="Sign In"
                    onButtonPress={() => router.push('/(auth)/login' as any)}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.replace('/(tabs)')}
                >
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Orders</Text>
                <View style={styles.placeholder} />
            </View>

            {orders.length === 0 ? (
                <EmptyState
                    icon="receipt-outline"
                    title="No Orders Yet"
                    subtitle="When you place your first order, it will appear here"
                    buttonText="Start Shopping"
                    onButtonPress={() => router.push('/' as any)}
                />
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {orders.map((order) => {
                        const ticketing = isTicketingOrder(order);
                        const bookingDate = getFirstBookingDate(order);
                        const statusKey = order.fulfillmentStatus || order.financialStatus;
                        // For Events, Playhouses, Petting Farms - always show "Booked"
                        const showBooked = ticketing;
                        const statusText = showBooked ? 'Booked' : getStatusText(statusKey);
                        const statusColor = showBooked ? Colors.success : getStatusColor(statusKey);
                        
                        return (
                            <TouchableOpacity
                                key={order.id}
                                style={styles.orderCard}
                                activeOpacity={0.7}
                                onPress={() => {
                                    // For Try & Buy orders, use the draft order ID or local order ID
                                    const orderId = order.isTryAndBuy 
                                        ? (order.id || order.localOrderData?.shopifyDraftOrderId || order.localOrderData?.id)
                                        : order.id;
                                    router.push(`/orders/${encodeURIComponent(orderId)}` as any);
                                }}
                            >
                                <View style={styles.orderHeader}>
                                    <View>
                                        <View style={styles.orderIdRow}>
                                            <Text style={styles.orderId}>
                                                Order {formatOrderId(order.orderNumber || order.id)}
                                            </Text>
                                            {order.isTryAndBuy && (
                                                <View style={styles.tryAndBuyBadge}>
                                                    <Text style={styles.tryAndBuyBadgeText}>Try & Buy</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.orderDate}>
                                            {new Date(order.processedAt || order.localOrderData?.createdAt).toLocaleDateString('en-IN', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </Text>
                                        {bookingDate && (
                                            <Text style={styles.bookingDateLabel}>Booked for: {bookingDate}</Text>
                                        )}
                                    </View>
                                    <View style={styles.orderStatusContainer}>
                                        <Text style={[styles.orderStatus, { color: statusColor }]}>
                                            {statusText}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.orderItems}>
                                    {order.lineItems?.edges?.slice(0, 3).map((edge: any, index: number) => (
                                        <Image
                                            key={index}
                                            source={{ uri: edge.node.variant?.image?.url || 'https://via.placeholder.com/60' }}
                                            style={styles.orderItemImage}
                                        />
                                    ))}
                                    {order.lineItems?.edges?.length > 3 && (
                                        <View style={styles.moreItemsContainer}>
                                            <Text style={styles.moreItemsText}>+{order.lineItems.edges.length - 3}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.orderFooter}>
                                    <Text style={styles.orderTotal}>
                                        {new Intl.NumberFormat('en-IN', {
                                            style: 'currency',
                                            currency: order.currentTotalPrice?.currencyCode || 'INR',
                                            minimumFractionDigits: 0,
                                        }).format(parseFloat(order.currentTotalPrice?.amount || '0'))}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: Colors.backgroundWhite,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    placeholder: {
        width: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    orderCard: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    orderIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    tryAndBuyBadge: {
        backgroundColor: Colors.primary + '20',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    tryAndBuyBadgeText: {
        fontSize: 10,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    orderId: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    orderDate: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
    },
    bookingDateLabel: {
        fontSize: 13,
        fontFamily: Fonts.Medium,
        color: Colors.primary,
        marginTop: 4,
    },
    orderStatusContainer: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    orderStatus: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
    },
    orderItems: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 8,
    },
    orderItemImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: Colors.backgroundSecondary,
    },
    moreItemsContainer: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: Colors.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreItemsText: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        color: Colors.textSecondary,
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    orderTotal: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
});
