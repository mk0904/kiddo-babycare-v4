import { NeedHelpChatCard, openSupportCall } from '@/components/orders/NeedHelpChatCard';
import {
    calculateDistance,
    DARK_STORE_LOCATION,
    DEFAULT_ETA_MINUTES,
    estimateDeliveryTime,
    geocodeAddress,
    getDeliveryTimeFromGoogleMaps,
} from '@/config/deliveryConfig';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { appConfigService } from '@/services/appConfigService';
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

const HEADER_BG = '#FFFFFF';
const CARD_RADIUS = 12;

// Same images as GiftWrappingModal – used for gift wrap line items on order detail
const GIFT_WRAP_IMAGES: Record<string, any> = {
    'Wrap-1': require('@/assets/images/giftwrap1.jpeg'),
    'Wrap-2': require('@/assets/images/giftwrap2.jpeg'),
    'Wrap-3': require('@/assets/images/giftwrap3.jpeg'),
};
function getGiftWrapImageSource(title: string): any {
    if (!title || typeof title !== 'string') return null;
    const match = title.match(/Wrap-[123]/);
    return match ? GIFT_WRAP_IMAGES[match[0]] ?? GIFT_WRAP_IMAGES['Wrap-1'] : (/gift wrap/i.test(title) ? GIFT_WRAP_IMAGES['Wrap-1'] : null);
}

function looksLikeTicketingDate(s: string): boolean {
    if (!s || typeof s !== 'string') return false;
    const month =
        '(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)';
    const ordinal = '(?:st|nd|rd|th)?';
    const day = '(?:[0-3]?\\d)';
    if (new RegExp(`\\b${day}${ordinal}\\s+${month}\\b`, 'i').test(s)) return true;
    if (new RegExp(`\\b${month}\\s+${day}${ordinal}\\b`, 'i').test(s)) return true;
    return false;
}

function isTicketingLineItem(node: any): boolean {
    const itemTitle = node?.title || '';
    const variantTitle = node?.variant?.title || '';
    const attrs = node?.customAttributes || [];
    if (attrs.some((a: any) => a.key === 'booking_date' || a.key === 'booking_date_display')) return true;
    if (looksLikeTicketingDate(variantTitle)) return true;
    if (/(event|workshop|playhouse|petting|farm|ticket|zoo)/i.test(String(itemTitle))) return true;
    return false;
}

function isOnlyTicketingOrder(o: any): boolean {
    const edges = o?.lineItems?.edges || [];
    if (edges.length === 0) return false;
    return edges.every((edge: any) => isTicketingLineItem(edge?.node));
}

function getBookingDateDisplay(node: any): string | null {
    const attrs = node?.customAttributes || [];
    const display = attrs.find((a: any) => a.key === 'booking_date_display')?.value;
    const raw = attrs.find((a: any) => a.key === 'booking_date')?.value;
    if (display) return display;
    if (raw) return new Date(raw).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return null;
}

export default function OrderDetailV2Screen() {
    const { id, estimatedDeliveryMinutes: paramEta, from } = useLocalSearchParams<{ id: string; estimatedDeliveryMinutes?: string; from?: string }>();
    const router = useRouter();
    const goBack = () => (from === 'orders' ? router.back() : router.replace('/(tabs)'));
    const { user } = useAuth();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchedEtaMinutes, setFetchedEtaMinutes] = useState<number | null>(null);

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
                            processedAt: draftAny.createdAt,
                            createdAt: draftAny.createdAt,
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

    // Fetch delivery duration (minutes) to shipping address; "Arriving by" = order placed time + this duration
    useEffect(() => {
        if (!order?.shippingAddress) {
            setFetchedEtaMinutes(null);
            return;
        }
        const addr = order.shippingAddress;
        const addressString = [addr.address1, addr.address2, addr.city, addr.province, addr.zip, addr.country]
            .filter(Boolean)
            .join(', ')
            .trim();
        if (!addressString) {
            setFetchedEtaMinutes(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const coords = await geocodeAddress(addressString);
                if (cancelled || !coords) {
                    setFetchedEtaMinutes(null);
                    return;
                }
                let deliveryTime = await getDeliveryTimeFromGoogleMaps(coords.latitude, coords.longitude);
                if (deliveryTime == null) {
                    const distanceKm = calculateDistance(
                        DARK_STORE_LOCATION.latitude,
                        DARK_STORE_LOCATION.longitude,
                        coords.latitude,
                        coords.longitude
                    );
                    deliveryTime = estimateDeliveryTime(distanceKm);
                }
                if (!cancelled) setFetchedEtaMinutes(deliveryTime);
            } catch (e) {
                if (!cancelled) setFetchedEtaMinutes(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [order?.id, order?.shippingAddress?.address1, order?.shippingAddress?.city, order?.shippingAddress?.zip]);

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

    const etaMinutes = fetchedEtaMinutes ?? (Number(paramEta ?? order?.estimatedDeliveryMinutes ?? DEFAULT_ETA_MINUTES) || DEFAULT_ETA_MINUTES);
    const orderPlacedAt = order?.processedAt || order?.createdAt;
    const baseTime = orderPlacedAt ? new Date(orderPlacedAt) : new Date();
    const deliveryByDate = new Date(baseTime.getTime() + etaMinutes * 60 * 1000);
    const h = deliveryByDate.getHours();
    const m = deliveryByDate.getMinutes();
    const hour12 = h % 12 || 12;
    const ampm = h < 12 ? 'AM' : 'PM';
    const timeStr = `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
    const dateStr = deliveryByDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const deliveryByTimeStr = `${timeStr}, ${dateStr}`;
    const isDelivered = order?.fulfillmentStatus === 'FULFILLED';
    const hasArrivalTimePassed = deliveryByDate.getTime() < Date.now();

    const headerStatusText = (() => {
        if (hasArrivalTimePassed) {
            const arrivedDateStr = deliveryByDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
            return `Arrived at ${timeStr}, ${arrivedDateStr}`;
        }
        if (isDelivered) return `Delivered by ${deliveryByTimeStr}`;
        return `Arriving by ${deliveryByTimeStr}`;
    })();

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
                <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={12}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <View style={styles.loadingWrap}>
                    <Text style={styles.errorText}>{error || 'Order not found'}</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={goBack}>
                        <Text style={styles.primaryButtonText}>Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const displayOrderId = order.orderNumber || order.id?.split('/').pop() || id;

    const formatCurrency = (amount: number) =>
        `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

    // Coupon/discount from Shopify order (discountApplications + customAttributes fallback)
    const discountEdges = order.discountApplications?.edges ?? [];
    const orderDiscounts = Array.isArray(discountEdges) ? discountEdges : [];
    type DiscountNode = { code?: string; title?: string; applicable?: boolean; value?: { amount?: string } };
    const discountNodes: DiscountNode[] = orderDiscounts.map((e: any) => e?.node ?? e).filter(Boolean);
    const appliedCouponNode = discountNodes.find((n) => (n.applicable === undefined || n.applicable !== false) && (n.code ?? n.title));
    const couponFromApi = appliedCouponNode?.code ?? appliedCouponNode?.title ?? null;
    const customAttrs = (order.customAttributes ?? []) as { key?: string; value?: string }[];
    const couponFromAttrs = customAttrs.find((a) => {
        const k = (a?.key ?? '').toLowerCase();
        return k === 'discount_code' || k === 'coupon_code' || k === 'applied_discount_code' || k === 'coupon';
    })?.value;
    const couponCode = (couponFromApi ?? couponFromAttrs ?? null) ? String(couponFromApi ?? couponFromAttrs).trim() : null;
    const couponValue = appliedCouponNode?.value?.amount != null ? parseFloat(appliedCouponNode.value.amount) : 0;

    // Subtotal = sum of line items' original total (before order-level discount). Matches Shopify admin "Subtotal".
    const calculatedSubtotal = (order.lineItems?.edges || []).reduce((sum: number, edge: any) => {
        const item = edge.node;
        const lineTotal = parseFloat(item.originalTotalPrice?.amount || '0');
        const unitPrice = parseFloat(item.price?.amount || '0');
        const qty = item.quantity || 1;
        return sum + (lineTotal || unitPrice * qty);
    }, 0);
    const shipping = parseFloat(order.totalShippingPrice?.amount || order.totalShippingPriceV2?.amount || order.shippingPrice?.amount || '0');
    const tax = parseFloat(order.totalTax?.amount || order.totalTaxV2?.amount || order.taxPrice?.amount || '0');
    const total = parseFloat(order.currentTotalPrice?.amount || order.currentTotalPriceV2?.amount || order.totalPrice?.amount || order.totalPriceV2?.amount || '0');
    // Use calculated subtotal for bill display so discount math matches Shopify (subtotal − discount = total before tax/shipping).
    const subtotalDisplay = calculatedSubtotal > 0 ? calculatedSubtotal : parseFloat(order.subtotalPrice?.amount || order.subtotalPriceV2?.amount || '0');

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header - light beige */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={12}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>Order Summary</Text>
                </View>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Order detail banner image from app-config (orderDetail.imageUrl) */}
                {(() => {
                    const orderDetailConfig = appConfigService.getOrderDetailConfig();
                    const imageUrl = orderDetailConfig?.imageUrl;
                    if (!imageUrl) return null;
                    return (
                        <View style={styles.orderDetailImageWrap}>
                            <Image source={{ uri: imageUrl }} style={styles.orderDetailImage} contentFit="cover" />
                        </View>
                    );
                })()}

                

                {/* Line items – single card like cart */}
                <View style={styles.orderItemsSection}>
                    {/* Order summary header */}
                    <View style={styles.summaryRow}>
                        <Text style={styles.sectionTitle}>Order Items</Text>
                        <TouchableOpacity style={styles.orderIdRow} onPress={copyOrderId}>
                            <Text style={styles.orderIdText}>Order ID #{displayOrderId}</Text>
                            <Ionicons name="copy-outline" size={18} color="#717680" style={styles.copyIcon} />
                        </TouchableOpacity>
                    </View>
                    {(order.lineItems?.edges || []).map((edge: any, index: number) => {
                        const item = edge.node;
                        const price = parseFloat(item.originalTotalPrice?.amount || item.price?.amount || '0');
                        const variantTitle = item.variant?.title && item.variant.title !== 'Default Title' ? item.variant.title : null;
                        const giftWrapImage = getGiftWrapImageSource(item.title);
                        const imageSource = item.variant?.image?.url
                            ? { uri: item.variant.image.url }
                            : giftWrapImage
                                ? giftWrapImage
                                : null;
                        const edges = order.lineItems?.edges || [];
                        const isLast = index === edges.length - 1;
                        return (
                            <View key={`${item.title}-${index}`} style={[styles.itemRow, isLast && styles.itemRowLast]}>
                                {imageSource ? (
                                    <Image source={imageSource} style={styles.itemImage} contentFit="cover" />
                                ) : (
                                    <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                                        <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                                    </View>
                                )}
                                <View style={styles.itemInfo}>
                                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                                    <View style={styles.itemMetaRow}>
                                        <View style={styles.itemMetaWrap}>
                                            <Text style={styles.itemMetaPrice}>
                                                ₹{price.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                            </Text>
                                            {variantTitle ? <Text style={styles.itemMeta}>Size: {variantTitle}</Text> : null}
                                        </View>
                                        <Text style={styles.itemQty}>QTY:{item.quantity || 1}</Text>
                                    </View>
                                    {(() => {
                                        const bookingDate = getBookingDateDisplay(item);
                                        if (!bookingDate) return null;
                                        return (
                                            <View style={styles.bookingDateRow}>
                                                <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                                                <Text style={styles.bookingDateText}>Booked for: {bookingDate}</Text>
                                            </View>
                                        );
                                    })()}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Bill details – subtotal = items before discount; discount = derived or from API; total = order total */}
                {(() => {
                    const discountAmount = Math.max(0, subtotalDisplay + shipping + tax - total);
                    const isHeyKiddo = couponCode?.toUpperCase() === 'HEYKIDDO';
                    const displayDiscount = isHeyKiddo ? 0 : (couponValue > 0 ? couponValue : discountAmount);
                    return (
                        <View style={styles.billCard}>
                            <Text style={styles.billTitle}>Bill details</Text>
                            <View style={styles.billRow}>
                                <Text style={styles.billLabel}>Subtotal</Text>
                                <Text style={styles.billValue}>{formatCurrency(subtotalDisplay)}</Text>
                            </View>
                            {(displayDiscount > 0 || couponCode) && (
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>
                                        {couponCode ? `Coupon (${couponCode})` : 'Discount'}
                                    </Text>
                                    <Text style={[styles.billValue, (displayDiscount > 0 || (couponValue > 0 && !isHeyKiddo) || isHeyKiddo) && styles.billDiscountValue]}>
                                        {isHeyKiddo ? 'Free Shoe' : (displayDiscount > 0 ? `-${formatCurrency(displayDiscount)}` : formatCurrency(0))}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.billDivider} />
                            <View style={styles.billRow}>
                                <Text style={styles.billTotalLabel}>Total</Text>
                                <Text style={styles.billTotalValue}>{formatCurrency(total)}</Text>
                            </View>
                        </View>
                    );
                })()}

                {/* Payment method */}
                <View style={styles.paymentMethodCard}>
                    <Text style={styles.billTitle}>Payment method</Text>
                    <Text style={styles.paymentMethodLabel}>
                        {order?.financialStatus === 'PAID'
                            ? 'Paid online'
                            : order?.financialStatus === 'PENDING'
                                ? 'Cash on Delivery (COD)'
                                : order?.financialStatus === 'REFUNDED'
                                    ? 'Refunded'
                                    : order?.financialStatus
                                        ? `Payment: ${order.financialStatus}`
                                        : '—'}
                    </Text>
                </View>

                {/* Delivery address – hide when order has only ticketing products */}
                {order?.shippingAddress && !isOnlyTicketingOrder(order) && (
                    <View style={styles.addressCard}>
                        <Text style={styles.billTitle}>Order Details</Text>

                        {/* Status and address below bill details */}
                        <View style={styles.belowBillSection}>
                            <Text style={styles.belowBillTitle}>{headerStatusText}</Text>
                        </View>
                        <Text style={styles.billTitle}>Delivery address</Text>
                        <View style={styles.addressBlock}>
                            {[
                                order.shippingAddress.firstName || order.shippingAddress.lastName
                                    ? [order.shippingAddress.firstName, order.shippingAddress.lastName].filter(Boolean).join(' ').replace(/_+$/, '')
                                    : null,
                                order.shippingAddress.address1,
                                order.shippingAddress.address2,
                                [order.shippingAddress.city, order.shippingAddress.province].filter(Boolean).join(', '),
                                order.shippingAddress.zip,
                                order.shippingAddress.country,
                            ]
                                .filter(Boolean)
                                .map((line, i) => (
                                    <Text key={i} style={styles.addressLine}>
                                        {line}
                                    </Text>
                                ))}
                        </View>
                    </View>
                )}

                <NeedHelpChatCard onCallPress={openSupportCall} />

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 20,
        paddingTop: Platform.OS === 'ios' ? 14 : 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F5F0E8',
    },
    backBtn: {
        padding: 4,
        marginRight: 12,
    },
    headerCenter: {
        flex: 1,
    },
    headerTitle: {
        fontSize: Fonts.LargeFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#1A1A1A',
    },
    headerAddress: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
        marginTop: 4,
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
        backgroundColor: '#FDF6EC',
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
    orderDetailImageWrap: {
        marginBottom: 12,
        borderRadius: CARD_RADIUS,
        overflow: 'hidden',
        backgroundColor: '#F3F4F6',
    },
    orderDetailImage: {
        width: '100%',
        aspectRatio: 2,
        minHeight: 120,
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
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#717680',
    },
    orderIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        color: '#717680',
    },
    orderIdText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#717680',
    },
    copyIcon: {
        marginLeft: 6,
    },
    orderItemsSection: {
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        paddingHorizontal: 12,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
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
        minWidth: 0,
    },
    itemMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    itemTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        lineHeight: 20,
    },
    itemMetaWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemMetaPrice: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#414651',
    },
    itemMeta: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
    },
    itemQty: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#717680',
    },
    bookingDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    bookingDateText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: Colors.primary,
    },
    footerSpacer: {
        height: 32,
    },
    belowBillSection: {
        
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        marginBottom: 16,
    },
    belowBillTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#1A1A1A',
    },
    belowBillAddress: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        marginTop: 4,
    },
    paymentMethodCard: {
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        marginBottom: 16,
        padding: 12,
    },
    paymentMethodLabel: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
    },
    billCard: {
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        marginBottom: 16,
        marginTop: 16,
        padding: 12,
    },
    billTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#717680',
        marginBottom: 8,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    billLabel: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
    },
    billValue: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#181D27',
    },
    billDiscountValue: {
        color: '#099250',
    },
    billDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
    },
    billTotalLabel: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#1A1A1A',
    },
    billTotalValue: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#1A1A1A',
    },
    addressCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        marginTop: 0,
        padding: 12,
    },
    addressBlock: {
        marginTop: 0,
        fontFamily: Fonts.LexendRegular,
    },
    addressLine: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        lineHeight: 22,
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
