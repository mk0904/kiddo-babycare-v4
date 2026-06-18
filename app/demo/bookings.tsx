import { DemoCancelModal } from '@/components/demo/DemoCancelModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useUserStore, type UserProfile } from '@/store/userStore';
import { storefrontVariantImageUrl } from '@/utils/storefrontVariantImage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DEMO_ORDER_ATTR_KEYS = ['isDemoOrder', 'demo_request'];

/** Check if an order is a demo booking by line item or order custom attributes */
const isDemoOrder = (order: any): boolean => {
    const orderAttrs = order?.customAttributes || [];
    if (
        orderAttrs.some(
            (a: any) =>
                DEMO_ORDER_ATTR_KEYS.includes(a.key) && String(a.value).toLowerCase() === 'true',
        )
    ) {
        return true;
    }
    const edges = order?.lineItems?.edges || [];
    return edges.some((edge: any) => {
        const attrs = edge?.node?.customAttributes || [];
        return attrs.some(
            (a: any) => a.key === 'demo_request' && String(a.value).toLowerCase() === 'true',
        );
    });
};

const toShopifyOrderGid = (id: string): string => {
    if (id.includes('gid://')) return id;
    const num = String(id).match(/\d+/)?.[0];
    return num ? `gid://shopify/Order/${num}` : id;
};

const isCancelledOrder = (order: any): boolean => {
    if (order?.canceledAt || order?.cancelReason) return true;
    const financialStatus = String(order?.financialStatus ?? '').toUpperCase();
    if (financialStatus === 'VOIDED') return true;
    const orderAttrs = order?.customAttributes || [];
    return orderAttrs.some((a: any) => {
        const value = String(a.value).toLowerCase();
        if (a.key === 'demo_cancelled' && value === 'true') return true;
        if (['cancelled', 'order_status'].includes(a.key) && value === 'cancelled') return true;
        return false;
    });
};

const isCancelledFromDeliveryApi = async (shopifyOrderId: string): Promise<boolean> => {
    try {
        const { getDeliveryPartnerOrderStatus, extractShopifyOrderNumericId } = await import('@/services/deliveryPartnerService');
        const numericId = extractShopifyOrderNumericId(shopifyOrderId);
        console.log('[Bookings] Checking delivery API status for order:', shopifyOrderId, 'numeric ID:', numericId);
        const status = await getDeliveryPartnerOrderStatus(numericId);
        const isCancelled = status?.status?.toLowerCase() === 'cancelled';
        console.log('[Bookings] Delivery API status for', numericId, ':', status?.status, 'isCancelled:', isCancelled);
        return isCancelled;
    } catch (error) {
        console.warn('[Bookings] Failed to check delivery partner cancel status:', error);
        return false;
    }
};

/** Extract price info from line item custom attributes (stored when demo was booked) */
const getDemoPriceInfo = (order: any) => {
    const edges = order?.lineItems?.edges || [];
    for (const edge of edges) {
        const attrs = edge?.node?.customAttributes || [];
        const price = attrs.find((a: any) => a.key === 'product_price')?.value;
        const comparePrice = attrs.find((a: any) => a.key === 'product_compare_price')?.value;
        const discount = attrs.find((a: any) => a.key === 'product_discount')?.value;
        if (price) {
            return {
                price: parseFloat(price) || 0,
                comparePrice: parseFloat(comparePrice || '0') || 0,
                discount: parseInt(discount || '0', 10) || 0,
            };
        }
    }
    return null;
};

/** Extract demo date from order-level or line item custom attributes */
const getDemoDate = (order: any): string | null => {
    // Check order-level custom attributes first
    const orderAttrs = order?.customAttributes || [];
    const orderDateAttr = orderAttrs.find((a: any) => a.key === 'scheduled_date' || a.key === 'delivery_date' || a.key === 'demo_date');
    if (orderDateAttr?.value) return orderDateAttr.value;

    // Fallback to line item custom attributes
    const edges = order?.lineItems?.edges || [];
    for (const edge of edges) {
        const attrs = edge?.node?.customAttributes || [];
        const dateAttr = attrs.find((a: any) => a.key === 'scheduled_date' || a.key === 'delivery_date' || a.key === 'demo_date');
        if (dateAttr?.value) return dateAttr.value;
    }
    return null;
};

/** Extract demo time slot from order-level or line item custom attributes */
const getDemoTimeSlot = (order: any): string | null => {
    // Check order-level custom attributes first
    const orderAttrs = order?.customAttributes || [];
    const orderTime = orderAttrs.find((a: any) => a.key === 'scheduled_time' || a.key === 'delivery_time' || a.key === 'demo_time_slot' || a.key === 'demo_time');
    if (orderTime?.value) return orderTime.value;

    // Fallback to line item custom attributes
    const edges = order?.lineItems?.edges || [];
    for (const edge of edges) {
        const attrs = edge?.node?.customAttributes || [];
        const time = attrs.find((a: any) => a.key === 'scheduled_time' || a.key === 'delivery_time' || a.key === 'demo_time_slot' || a.key === 'demo_time');
        if (time?.value) return time.value;
    }
    return null;
};

function formatDemoDate(dateStr: string | null): string {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const monthNames = ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
        const month = monthNames[d.getMonth()];
        const day = d.getDate();
        let suffix = "th";
        if (day === 1 || day === 21 || day === 31) suffix = "st";
        else if (day === 2 || day === 22) suffix = "nd";
        else if (day === 3 || day === 23) suffix = "rd";
        
        return `${day}${suffix} ${month}`;
    } catch {
        return dateStr;
    }
}

/** Get the first line item's details (variant info, price, etc.) */
const getLineItemDetails = (order: any) => {
    const firstEdge = order?.lineItems?.edges?.[0];
    const node = firstEdge?.node;
    if (!node) return null;

    const variant = node.variant;
    const variantTitle = variant?.title || '';
    const price = variant?.price?.amount || node?.originalTotalPrice?.amount || '0';
    
    // Use imageUrl from delivery API if available, otherwise try storefrontVariantImageUrl
    const imageUrl = node.imageUrl || (variant ? storefrontVariantImageUrl(variant) : null);

    return {
        title: node.title || 'Demo Product',
        variantTitle: variantTitle !== 'Default Title' ? variantTitle : '',
        price,
        imageUrl: imageUrl || 'https://via.placeholder.com/80',
    };
};

function getShopifyCustomerAccessToken(user: UserProfile | null): string {
    const persisted = useUserStore.getState().accessToken;
    return String(user?.customerAccessToken ?? user?.accessToken ?? persisted ?? '').trim();
}

export default function DemoBookingsScreen() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const [demoOrders, setDemoOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [cancellingOrder, setCancellingOrder] = useState<any>(null);
    const [cancelLoading, setCancelLoading] = useState(false);

    const loadDemoBookings = async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            // Fetch demo orders from delivery partner API using is_demo_order filter
            const { fetchAllDemoOrdersFromDeliveryPartner } = await import('@/services/deliveryPartnerService');
            const deliveryDemoOrders = await fetchAllDemoOrdersFromDeliveryPartner();
            console.log('[Bookings] Fetched demo orders from delivery API:', deliveryDemoOrders.length);

            // Transform delivery partner orders to match existing structure
            const demos = deliveryDemoOrders.map((dpOrder: any) => ({
                id: dpOrder.shopifyOrderId,
                name: dpOrder.shopifyOrderName,
                processedAt: dpOrder.createdAt,
                canceledAt: dpOrder.status === 'cancelled' ? dpOrder.updatedAt : null,
                cancelReason: dpOrder.status === 'cancelled' ? dpOrder.reasonCancelRefundDelay : null,
                customAttributes: [
                    { key: 'scheduled_date', value: dpOrder.scheduledDate },
                    { key: 'scheduled_time', value: dpOrder.scheduledTime },
                    { key: 'isDemoOrder', value: String(dpOrder.isDemoOrder) },
                ],
                lineItems: {
                    edges: dpOrder.items.map((item: any) => ({
                        node: {
                            title: item.title,
                            imageUrl: item.imageUrl,
                            variant: {
                                title: item.variantTitle,
                                price: { amount: String(item.unitPrice) },
                                product: { id: item.shopifyProductId },
                                id: item.shopifyVariantId,
                            },
                            customAttributes: [
                                { key: 'product_price', value: String(item.unitPrice) },
                            ],
                            originalTotalPrice: { amount: String(item.lineTotal) },
                        },
                    })),
                },
                // Store delivery partner order ID for edit/cancel operations
                deliveryPartnerOrderId: dpOrder.id,
                // Store delivery partner status
                isCancelledFromDelivery: dpOrder.status === 'cancelled',
            }));

            // Sort by date (newest first)
            demos.sort((a: any, b: any) => {
                const dateA = new Date(a.processedAt || 0).getTime();
                const dateB = new Date(b.processedAt || 0).getTime();
                return dateB - dateA;
            });

            setDemoOrders(demos);
            console.log('[Bookings] Set demo orders from delivery API:', demos.length);
        } catch (err: any) {
            console.error('Error loading demo bookings:', err);
            setDemoOrders([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            if (isAuthenticated) {
                loadDemoBookings();
            } else {
                setLoading(false);
            }
        }, [isAuthenticated, user])
    );

    const handleCancel = (order: any) => {
        setCancellingOrder(order);
        setCancelModalVisible(true);
    };

    const handleConfirmCancel = async (reason: string) => {
        if (!cancellingOrder) return;
        try {
            setCancelLoading(true);

            // Use delivery partner order ID directly for cancellation
            const { cancelDeliveryPartnerOrderById } = await import('@/services/deliveryPartnerService');
            const deliveryPartnerOrderId = cancellingOrder.deliveryPartnerOrderId;
            console.log('[Bookings] Cancelling with delivery partner order ID:', deliveryPartnerOrderId);
            
            if (!deliveryPartnerOrderId) {
                console.warn('[Bookings] No delivery partner order ID found');
                Alert.alert('Error', 'Failed to cancel the demo. Delivery partner order ID not found.');
                return;
            }

            const deliveryPartnerCancelled = await cancelDeliveryPartnerOrderById(deliveryPartnerOrderId, reason);

            if (!deliveryPartnerCancelled) {
                console.warn('[Bookings] Delivery-partner cancel failed');
                Alert.alert('Error', 'Failed to cancel the demo. Please try again.');
                return;
            }

            // Remove from local state for immediate feedback
            setDemoOrders((prev) => prev.filter((o) => o.id !== cancellingOrder.id));
            setCancelModalVisible(false);

            const cancelledId = cancellingOrder.name || cancellingOrder.id;
            setCancellingOrder(null);

            router.push({
                pathname: '/order-success/v2',
                params: {
                    orderId: cancelledId,
                    titleOverride: 'Demo cancelled'
                }
            } as any);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to cancel the demo.');
        } finally {
            setCancelLoading(false);
        }
    };

    const handleEdit = (order: any) => {
        const item = getLineItemDetails(order);
        const firstEdge = order?.lineItems?.edges?.[0];
        const node = firstEdge?.node;
        const variant = node?.variant;

        // Navigate to the get-demo screen with pre-filled product data and edit mode
        // Pass delivery partner order ID for direct API calls
        router.push({
            pathname: '/demo/get-demo',
            params: {
                productId: variant?.product?.id || order.id,
                variantId: variant?.id || '',
                productTitle: item?.title || '',
                productPrice: item?.price || '0',
                productImage: item?.imageUrl || '',
                editOrderId: order.id,
                editDeliveryPartnerOrderId: order.deliveryPartnerOrderId,
            },
        } as any);
    };

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
            >
                <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Demo Bookings</Text>
            <View style={styles.placeholder} />
        </View>
    );

    if (loading && !refreshing) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderHeader()}
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading your demo bookings...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                {renderHeader()}
                <EmptyState
                    icon="person-outline"
                    title="Sign in to see your demo bookings"
                    subtitle="Track your scheduled demos by signing in to your account."
                    buttonText="Log In / Sign Up"
                    onButtonPress={() => router.push('/(auth)/login' as any)}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {renderHeader()}

            {demoOrders.length === 0 ? (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={{ flex: 1 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadDemoBookings(true)}
                            colors={[Colors.primary]}
                            tintColor={Colors.primary}
                        />
                    }
                >
                    <EmptyState
                        icon="calendar-outline"
                        title="No Demo Bookings Yet"
                        subtitle="When you book a demo for a product, it will appear here."
                        buttonText="Browse Products"
                        onButtonPress={() => router.push('/' as any)}
                    />
                </ScrollView>
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadDemoBookings(true)}
                            colors={[Colors.primary]}
                            tintColor={Colors.primary}
                        />
                    }
                >
                    {demoOrders.map((order) => {
                        const item = getLineItemDetails(order);
                        const priceInfo = getDemoPriceInfo(order);
                        
                        // Use Shopify custom attributes for scheduled_date and scheduled_time
                        const demoDateRaw = getDemoDate(order);
                        const demoTime = getDemoTimeSlot(order);
                        
                        const formattedDate = formatDemoDate(demoDateRaw);

                        const actualPrice = priceInfo?.price || 0;
                        const comparePriceNum = priceInfo?.comparePrice || 0;
                        const discountPercent = priceInfo?.discount || 0;
                        const isCancelled = order.isCancelledFromDelivery || isCancelledOrder(order);
                        console.log('[Bookings] Rendering order', order.id, 'isCancelledFromDelivery:', order.isCancelledFromDelivery, 'isCancelledOrder:', isCancelledOrder(order), 'final isCancelled:', isCancelled);

                        return (
                            <View key={order.id} style={styles.demoCardContainer}>
                                {/* Header Date and Time */}
                                {(formattedDate || demoTime || order.name) && (
                                    <View style={styles.demoHeader}>
                                        {formattedDate ? <Text style={styles.demoHeaderText}>{formattedDate}</Text> : null}
                                        {formattedDate && demoTime ? <Text style={styles.demoHeaderDot}>  •  </Text> : null}
                                        {demoTime ? <Text style={styles.demoHeaderTimeText}>{demoTime}</Text> : null}
                                        {order.name && <Text style={styles.orderIdText}>{order.name}</Text>}
                                    </View>
                                )}
                                
                                <View style={styles.demoCard}>
                                    {/* Product Row */}
                                    <TouchableOpacity
                                    style={styles.productRow}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        const firstEdge = order?.lineItems?.edges?.[0];
                                        const node = firstEdge?.node;
                                        const productId = node?.variant?.product?.id;
                                        if (productId) {
                                            router.push({
                                                pathname: '/products/[id]',
                                                params: { id: productId }
                                            } as any);
                                        }
                                    }}
                                >
                                    <Image
                                        source={{
                                            uri: item?.imageUrl || 'https://via.placeholder.com/80',
                                        }}
                                        style={styles.productImage}
                                    />
                                    <View style={styles.productInfo}>
                                        <Text style={styles.productTitle} numberOfLines={1}>
                                            {item?.title || 'Demo Product'}
                                        </Text>
                                        {item?.variantTitle ? (
                                            <Text style={styles.variantText} numberOfLines={1}>
                                                {item.variantTitle}
                                            </Text>
                                        ) : null}
                                        {/* Price Row */}
                                        <View style={styles.priceRow}>
                                            {actualPrice > 0 && (
                                                <Text style={styles.price}>
                                                    ₹{actualPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </Text>
                                            )}
                                            {comparePriceNum > 0 && comparePriceNum > actualPrice && (
                                                <Text style={styles.comparePrice}>
                                                    ₹{comparePriceNum.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                                </Text>
                                            )}
                                            {discountPercent > 0 && (
                                                <Text style={styles.discount}>
                                                    {discountPercent}% OFF!
                                                </Text>
                                            )}
                                        </View>

                                    </View>
                                    <Ionicons name="chevron-forward" size={22} color={Colors.textSecondary} style={styles.chevron} />
                                </TouchableOpacity>

                                {/* Action Buttons */}
                                <View style={styles.actionRow}>
                                    {isCancelled ? (
                                        <TouchableOpacity
                                            style={styles.cancelledButton}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.cancelledButtonText}>Demo Cancelled</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <>
                                            <TouchableOpacity
                                                style={styles.actionButton}
                                                onPress={() => handleCancel(order)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.cancelText}>Cancel</Text>
                                            </TouchableOpacity>
                                            <View style={styles.actionDivider} />
                                            <TouchableOpacity
                                                style={styles.actionButton}
                                                onPress={() => handleEdit(order)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.editText}>Edit</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            </View>
                        </View>
                        );
                    })}
                </ScrollView>
            )}

            <DemoCancelModal
                visible={cancelModalVisible}
                onClose={() => {
                    setCancelModalVisible(false);
                    setCancellingOrder(null);
                }}
                onConfirmCancel={handleConfirmCancel}
                loading={cancelLoading}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
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
    loadingText: {
        marginTop: 16,
        color: Colors.textSecondary,
        fontFamily: Fonts.Medium,
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    demoCardContainer: {
        marginBottom: 24,
    },
    demoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    demoHeaderText: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    demoHeaderDot: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: Colors.textSecondary,
    },
    demoHeaderTimeText: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: Colors.textSecondary,
    },
    orderIdText: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#2E7D32',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    demoCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    productRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 14,
    },
    productImage: {
        width: 76,
        height: 76,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
    },
    productInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    productTitle: {
        fontSize: 15,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        marginBottom: 3,
        lineHeight: 20,
    },
    variantText: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    price: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    comparePrice: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        textDecorationLine: 'line-through',
    },
    discount: {
        fontSize: 12,
        fontFamily: Fonts.Bold,
        color: '#E53935',
    },
    chevron: {
        marginLeft: 4,
    },
    actionRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    actionButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    actionDivider: {
        width: 1,
        backgroundColor: '#F0F0F0',
    },
    cancelText: {
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
    },
    editText: {
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    cancelledButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
    },
    cancelledButtonText: {
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
        color: 'grey',
    },
    cancelledBadge: {
        fontSize: 11,
        fontFamily: Fonts.Bold,
        color: '#E84E4E',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        marginLeft: 8,
    },
    disabledActionButton: {
        opacity: 0.5,
    },
    disabledActionText: {
        opacity: 0.5,
    },
});
