import { DEFAULT_ETA_MINUTES } from '@/config/deliveryConfig';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { shopifyAdminApi } from '@/services/shopifyAdminApi';
import { shopifyApi } from '@/services/shopifyApi';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const HEADER_BG = '#FDF6EC';
const CARD_RADIUS = 12;

export default function OrderDetailV2Screen() {
    const { id, estimatedDeliveryMinutes: paramEta } = useLocalSearchParams<{ id: string; estimatedDeliveryMinutes?: string }>();
    const router = useRouter();
    const { user } = useAuth();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!id || typeof id !== 'string') {
                setLoading(false);
                setError('Invalid order ID');
                return;
            }
            try {
                let orderId = decodeURIComponent(id).trim();
                const baseId = orderId.includes('?') ? orderId.split('?')[0] : orderId;
                const queryPart = orderId.includes('?') ? orderId.split('?')[1] : '';
                const isDraftOrder = baseId.startsWith('gid://shopify/DraftOrder/');

                let fetchedOrder: any = null;
                if (user?.customerAccessToken && !isDraftOrder) {
                    try {
                        const customerOrders = await shopifyApi.getCustomerOrders(user.customerAccessToken, 50);
                        const numericId = baseId.split('/').pop()?.split('?')[0];
                        const found = customerOrders?.edges?.map((e: any) => e.node).find((o: any) => {
                            const n = (o.id || '').split('/').pop()?.split('?')[0];
                            return n === numericId || o.id === orderId;
                        });
                        if (found) orderId = found.id;
                    } catch (_) {}
                }

                if (isDraftOrder || orderId.startsWith('gid://shopify/DraftOrder/')) {
                    const draft = await shopifyAdminApi.getDraftOrder(orderId);
                    if (draft) {
                        const draftAny = draft as any;
                        fetchedOrder = {
                            id: draft.id,
                            orderNumber: draft.name,
                            lineItems: {
                                edges: draft.lineItems.edges.map((e: any) => ({
                                    node: {
                                        title: e.node.title,
                                        quantity: e.node.quantity,
                                        originalTotalPrice: { amount: (parseFloat(e.node.originalUnitPrice) * e.node.quantity).toString() },
                                        price: { amount: e.node.originalUnitPrice },
                                        variant: { title: e.node.variant?.title || 'Default Title', image: e.node.variant?.image },
                                    },
                                })),
                            },
                            shippingAddress: draftAny.shippingAddress,
                            subtotalPrice: { amount: draftAny.subtotalPrice ?? '0' },
                            totalShippingPrice: { amount: draftAny.totalShippingPrice ?? '0' },
                            totalTax: { amount: draftAny.totalTax ?? '0' },
                            currentTotalPrice: { amount: draftAny.totalPrice ?? draftAny.subtotalPrice ?? '0' },
                        };
                    }
                } else {
                    fetchedOrder = await shopifyApi.getOrderById(orderId);
                    if (!fetchedOrder && queryPart) {
                        fetchedOrder = await shopifyApi.getOrderById(orderId.split('?')[0]);
                    }
                }

                if (fetchedOrder) {
                    setOrder(fetchedOrder);
                    setError(null);
                } else {
                    setError('Order not found');
                }
            } catch (err: any) {
                setError(err.message || 'Failed to load order');
            }
            setLoading(false);
        };
        fetchOrder();
    }, [id, user?.customerAccessToken]);

    const copyOrderId = async () => {
        const oid = order?.orderNumber || order?.id?.split('/').pop() || id;
        try {
            await Share.share({ message: `Order ID: ${oid}` });
        } catch (_) {
            Alert.alert('Order ID', String(oid));
        }
    };

    const addressLine = order?.shippingAddress
        ? [order.shippingAddress.address1, order.shippingAddress.address2].filter(Boolean).join(', ') || 'Address'
        : '—';

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading order...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !order) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <View style={styles.loadingWrap}>
                    <Text style={styles.errorText}>{error || 'Order not found'}</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
                        <Text style={styles.primaryButtonText}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const displayOrderId = order.orderNumber || order.id?.split('/').pop() || id;

    const formatCurrency = (amount: number) =>
        `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    const calculatedSubtotal = (order.lineItems?.edges || []).reduce((sum: number, edge: any) => {
        const item = edge.node;
        const lineTotal = parseFloat(item.originalTotalPrice?.amount || '0');
        const unitPrice = parseFloat(item.price?.amount || '0');
        const qty = item.quantity || 1;
        return sum + (lineTotal || unitPrice * qty);
    }, 0);
    const subtotal = parseFloat(order.subtotalPrice?.amount || order.subtotalPriceV2?.amount || String(calculatedSubtotal) || '0');
    const shipping = parseFloat(order.totalShippingPrice?.amount || order.totalShippingPriceV2?.amount || order.shippingPrice?.amount || '0');
    const tax = parseFloat(order.totalTax?.amount || order.totalTaxV2?.amount || order.taxPrice?.amount || '0');
    const total = parseFloat(order.currentTotalPrice?.amount || order.currentTotalPriceV2?.amount || order.totalPrice?.amount || order.totalPriceV2?.amount || String(subtotal + shipping + tax) || '0');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header - light beige */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Delivered in {order?.estimatedDeliveryMinutes ?? (paramEta != null ? Number(paramEta) : DEFAULT_ETA_MINUTES)} mins</Text>
                    <Text style={styles.headerAddress} numberOfLines={1}>{addressLine}</Text>
                </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Need help card */}
                {/* <View style={styles.card}>
                    <View style={styles.helpIconWrap}>
                        <Ionicons name="chatbubbles-outline" size={24} color="#9CA3AF" />
                    </View>
                    <View style={styles.helpTextWrap}>
                        <Text style={styles.helpTitle}>Need help?</Text>
                        <Text style={styles.helpSub}>Chat with us for any issue related to your order</Text>
                    </View>
                    <Text style={styles.chatLink}>Chat with us</Text>
                </View> */}

                {/* Map placeholder */}
                <View style={styles.mapPlaceholder}>
                    <Ionicons name="map-outline" size={40} color="#9CA3AF" />
                    <Text style={styles.mapPlaceholderText}>Map</Text>
                </View>

                {/* Delivery status card */}
                <View style={styles.card}>
                    <View style={styles.deliveryIconWrap}>
                        <Ionicons name="bicycle-outline" size={24} color="#9CA3AF" />
                    </View>
                    <Text style={styles.deliveryText}>
                        Your delivery partner has left the kiddo light store and is on the way!
                    </Text>
                </View>

                {/* Order summary header */}
                <View style={styles.summaryRow}>
                    <Text style={styles.sectionTitle}>Order summary</Text>
                    <TouchableOpacity style={styles.orderIdRow} onPress={copyOrderId}>
                        <Text style={styles.orderIdText}>Order ID #{displayOrderId}</Text>
                        <Ionicons name="copy-outline" size={18} color="#374151" style={styles.copyIcon} />
                    </TouchableOpacity>
                </View>

                {/* Line items */}
                {(order.lineItems?.edges || []).map((edge: any, index: number) => {
                    const item = edge.node;
                    const price = parseFloat(item.originalTotalPrice?.amount || item.price?.amount || '0');
                    const variantTitle = item.variant?.title && item.variant.title !== 'Default Title' ? item.variant.title : null;
                    return (
                        <View key={`${item.title}-${index}`} style={[styles.itemRow, index === (order.lineItems?.edges?.length || 0) - 1 && styles.itemRowLast]}>
                            {item.variant?.image?.url ? (
                                <Image source={{ uri: item.variant.image.url }} style={styles.itemImage} contentFit="cover" />
                            ) : (
                                <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                                    <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                                </View>
                            )}
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                                <Text style={styles.itemMeta}>
                                    ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                    {variantTitle ? ` ${variantTitle}` : ''}
                                </Text>
                            </View>
                            <Text style={styles.itemQty}>QTY:{item.quantity || 1}</Text>
                        </View>
                    );
                })}

                {/* Bill details */}
                <View style={styles.billCard}>
                    <Text style={styles.billTitle}>Bill details</Text>
                    <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Subtotal</Text>
                        <Text style={styles.billValue}>{formatCurrency(subtotal)}</Text>
                    </View>
                    <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Shipping</Text>
                        <Text style={styles.billValue}>{formatCurrency(shipping)}</Text>
                    </View>
                    <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Tax</Text>
                        <Text style={styles.billValue}>{formatCurrency(tax)}</Text>
                    </View>
                    <View style={styles.billDivider} />
                    <View style={styles.billRow}>
                        <Text style={styles.billTotalLabel}>Total</Text>
                        <Text style={styles.billTotalValue}>{formatCurrency(total)}</Text>
                    </View>
                </View>

                <View style={styles.footerSpacer} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: HEADER_BG,
        paddingHorizontal: 16,
        paddingVertical: 14,
        paddingTop: Platform.OS === 'ios' ? 14 : 18,
    },
    backBtn: {
        padding: 4,
        marginRight: 12,
    },
    headerCenter: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    headerAddress: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#374151',
        marginTop: 2,
    },
    loadingWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
    },
    errorText: {
        fontSize: 15,
        fontFamily: Fonts.Medium,
        color: '#374151',
        textAlign: 'center',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 100,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        padding: 16,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
            android: { elevation: 2 },
        }),
    },
    helpIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    helpTextWrap: {
        flex: 1,
    },
    helpTitle: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    helpSub: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
        marginTop: 2,
    },
    chatLink: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    mapPlaceholder: {
        height: 180,
        backgroundColor: '#E5E7EB',
        borderRadius: CARD_RADIUS,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapPlaceholderText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#9CA3AF',
        marginTop: 8,
    },
    deliveryIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    deliveryText: {
        flex: 1,
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#717680',
    },
    orderIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        color: '#717680',
    },
    orderIdText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#717680',
    },
    copyIcon: {
        marginLeft: 6,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: CARD_RADIUS,
        marginBottom: 8,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
            android: { elevation: 1 },
        }),
    },
    itemRowLast: {
        marginBottom: 0,
    },
    itemImage: {
        width: 64,
        height: 64,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        marginRight: 12,
    },
    itemImagePlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
    },
    itemMeta: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
        marginTop: 4,
    },
    itemQty: {
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
        color: '#374151',
    },
    footerSpacer: {
        height: 32,
    },
    billCard: {
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        padding: 20,
        marginBottom: 16,
        marginTop: 16,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
            android: { elevation: 2 },
        }),
    },
    billTitle: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
        marginBottom: 16,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    billLabel: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
    },
    billValue: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: '#1A1A1A',
    },
    billDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
    },
    billTotalLabel: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    billTotalValue: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.primary,
    },
    primaryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#fff',
    },
});
