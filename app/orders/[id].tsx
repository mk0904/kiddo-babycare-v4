import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import { Button } from '@/components/ui/Button';

export default function OrderDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            if (!id || typeof id !== 'string') return;
            try {
                const fetchedOrder = await shopifyApi.getOrderById(id);
                if (fetchedOrder) {
                    setOrder(fetchedOrder);
                } else {
                    setError('Order not found');
                }
            } catch (err) {
                console.error('Error fetching order details:', err);
                setError('Failed to load order details');
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Stack.Screen options={{ headerTitle: 'Order Details' }} />
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (error || !order) {
        return (
            <View style={styles.loadingContainer}>
                <Stack.Screen options={{ headerTitle: 'Order Details' }} />
                <Text style={styles.errorText}>{error || 'Order not found'}</Text>
                <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 20 }} />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <Stack.Screen options={{ headerTitle: `Order #${order.orderNumber}` }} />

            {/* Status Section */}
            <View style={styles.section}>
                <View style={styles.statusRow}>
                    <Text style={styles.label}>Placed on</Text>
                    <Text style={styles.value}>{formatDate(order.processedAt)}</Text>
                </View>
                <View style={[styles.statusRow, { marginTop: 8 }]}>
                    <Text style={styles.label}>Status</Text>
                    <View style={styles.badgeContainer}>
                        <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                            <Text style={[styles.badgeText, { color: Colors.success }]}>{order.financialStatus}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}>
                            <Text style={[styles.badgeText, { color: Colors.text }]}>{order.fulfillmentStatus}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Items Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Items</Text>
                {order.lineItems.edges.map((edge: any) => {
                    const item = edge.node;
                    return (
                        <View key={item.title + item.variant?.title} style={styles.itemRow}>
                            <View style={styles.imageContainer}>
                                {item.variant?.image?.url ? (
                                    <Image source={{ uri: item.variant.image.url }} style={styles.itemImage} />
                                ) : (
                                    <Ionicons name="image-outline" size={24} color={Colors.textSecondary} />
                                )}
                            </View>
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemTitle}>{item.title}</Text>
                                {item.variant?.title && item.variant.title !== 'Default Title' && (
                                    <Text style={styles.variantTitle}>{item.variant.title}</Text>
                                )}
                                <View style={styles.itemPriceRow}>
                                    <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                                    <Text style={styles.itemPrice}>
                                        {item.originalTotalPrice.currencyCode} {item.originalTotalPrice.amount}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    );
                })}
            </View>

            {/* Price Breakdown */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment</Text>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Subtotal</Text>
                    <Text style={styles.rowValue}>{order.subtotalPrice?.currencyCode} {order.subtotalPrice?.amount || '0.00'}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Shipping</Text>
                    <Text style={styles.rowValue}>{order.totalShippingPrice?.currencyCode} {order.totalShippingPrice?.amount || '0.00'}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={styles.rowLabel}>Tax</Text>
                    <Text style={styles.rowValue}>{order.totalTax?.currencyCode} {order.totalTax?.amount || '0.00'}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.row}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{order.currentTotalPrice.currencyCode} {order.currentTotalPrice.amount}</Text>
                </View>
            </View>

            {/* Shipping Address */}
            {order.shippingAddress && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Shipping Address</Text>
                    <View style={styles.addressContainer}>
                        <Ionicons name="location-outline" size={20} color={Colors.textSecondary} style={{ marginTop: 2 }} />
                        <View style={{ marginLeft: 10, flex: 1 }}>
                            <Text style={styles.addressText}>{order.shippingAddress.address1}</Text>
                            {order.shippingAddress.city && <Text style={styles.addressText}>{order.shippingAddress.city}, {order.shippingAddress.province}</Text>}
                            <Text style={styles.addressText}>{order.shippingAddress.zip}, {order.shippingAddress.country}</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Order Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Actions</Text>

                {/* Try & Buy - Only show for fulfilled Fashion orders */}
                {order.fulfillmentStatus === 'FULFILLED' && (
                    <Button
                        title="Track Try & Buy Order"
                        onPress={() => router.push({ pathname: '/try-and-buy/[id]', params: { id: order.id } } as any)}
                        variant="secondary"
                        style={{ marginBottom: 12 }}
                    />
                )}

                {/* Return Request - Only show for delivered orders */}
                {order.fulfillmentStatus === 'FULFILLED' && order.financialStatus === 'PAID' && (
                    <Button
                        title="Request Return"
                        onPress={() => router.push({ pathname: '/returns/request', params: { orderId: order.id } } as any)}
                        variant="secondary"
                        style={{ marginBottom: 12 }}
                    />
                )}

                {/* View Returns - Link to returns list */}
                <Button
                    title="View My Returns"
                    onPress={() => router.push('/returns' as any)}
                    variant="secondary"
                />
            </View>

            <Button
                title="Continue Shopping"
                onPress={() => router.navigate('/')}
                variant="secondary"
                style={{ margin: 20 }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    section: {
        backgroundColor: '#fff',
        padding: 16,
        marginTop: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 16,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    label: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    value: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
    },
    badgeContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    itemRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    imageContainer: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    itemImage: {
        width: '100%',
        height: '100%',
    },
    itemInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    itemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
    },
    variantTitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    itemPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemQuantity: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    rowLabel: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    rowValue: {
        fontSize: 14,
        color: Colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 12,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
    },
    totalValue: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
    },
    addressContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    addressText: {
        fontSize: 14,
        color: Colors.text,
        lineHeight: 20,
    },
    errorText: {
        fontSize: 16,
        color: Colors.textSecondary,
    },
});
