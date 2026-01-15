// Try & Buy Order Detail Screen
// Used by riders or customers to select items to keep/return

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTryAndBuy, TryAndBuyOrder } from '@/context/TryAndBuyContext';
import { orderService, OrderItem, getStatusText, getStatusColor } from '@/services/orderService';
import { Colors, Fonts } from '@/constants/theme';

export default function TryAndBuyOrderDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { selectItemsToKeep, markOrderPaid, refreshOrders } = useTryAndBuy();

    const [order, setOrder] = useState<TryAndBuyOrder | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadOrder();
    }, [id]);

    const loadOrder = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const fetchedOrder = await orderService.getOrderById(id);
            if (fetchedOrder) {
                setOrder(fetchedOrder as TryAndBuyOrder);
                // Pre-select kept items if already selected
                if (fetchedOrder.keptItems) {
                    setSelectedItems(new Set(fetchedOrder.keptItems));
                }
            }
        } catch (error) {
            console.error('Error loading order:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleItemSelection = (itemId: string) => {
        setSelectedItems((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    const calculateSelectedTotal = (): number => {
        if (!order) return 0;
        return order.items
            .filter((item) => selectedItems.has(item.id))
            .reduce((sum, item) => sum + item.price * item.quantity, 0);
    };

    const handleConfirmSelection = async () => {
        if (!order) return;

        const keptItemIds = Array.from(selectedItems);

        if (keptItemIds.length === 0) {
            Alert.alert(
                'No Items Selected',
                'Are you sure you want to return all items?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Return All',
                        style: 'destructive',
                        onPress: () => confirmSelection(keptItemIds),
                    },
                ]
            );
            return;
        }

        confirmSelection(keptItemIds);
    };

    const confirmSelection = async (keptItemIds: string[]) => {
        setIsSubmitting(true);
        try {
            const updatedOrder = await selectItemsToKeep(order!.id, keptItemIds);
            if (updatedOrder) {
                setOrder(updatedOrder);
                Alert.alert(
                    'Selection Confirmed',
                    `You're keeping ${keptItemIds.length} item(s). Total: ₹${calculateSelectedTotal().toFixed(0)}`,
                    [
                        {
                            text: 'Collect Payment',
                            onPress: () => handleCollectPayment(),
                        },
                    ]
                );
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to confirm selection');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCollectPayment = async () => {
        if (!order) return;

        // In real app, this would trigger Razorpay or UPI collection
        // For now, we'll simulate payment collection
        Alert.alert(
            'Collect Payment',
            `Amount to collect: ₹${order.finalAmount || calculateSelectedTotal()}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark as Paid',
                    onPress: async () => {
                        setIsSubmitting(true);
                        try {
                            const paymentId = `pay_${Date.now()}`;
                            const paidOrder = await markOrderPaid(order.id, paymentId);
                            if (paidOrder) {
                                setOrder(paidOrder);
                                Alert.alert('Payment Collected', 'Order completed successfully!', [
                                    { text: 'OK', onPress: () => router.back() },
                                ]);
                            }
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        } finally {
                            setIsSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    const renderItem = ({ item }: { item: OrderItem }) => {
        const isSelected = selectedItems.has(item.id);
        const isAlreadyKept = order?.keptItems?.includes(item.id);
        const isAlreadyReturned = order?.returnedItems?.includes(item.id);

        return (
            <TouchableOpacity
                style={[
                    styles.itemCard,
                    isSelected && styles.selectedCard,
                    isAlreadyReturned && styles.returnedCard,
                ]}
                onPress={() => !order?.tryAndBuyStatus?.includes('payment') && toggleItemSelection(item.id)}
                disabled={order?.tryAndBuyStatus === 'payment_collected'}
            >
                <View style={styles.checkboxContainer}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                </View>
                <Image
                    source={{ uri: item.image || 'https://via.placeholder.com/60' }}
                    style={styles.itemImage}
                    contentFit="cover"
                />
                <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                        {item.title}
                    </Text>
                    {item.variantTitle && (
                        <Text style={styles.variantTitle}>{item.variantTitle}</Text>
                    )}
                    <View style={styles.priceRow}>
                        <Text style={styles.itemPrice}>₹{item.price.toFixed(0)}</Text>
                        <Text style={styles.quantity}>x{item.quantity}</Text>
                    </View>
                </View>
                {isAlreadyKept && (
                    <View style={styles.statusBadge}>
                        <Text style={styles.statusBadgeText}>KEPT</Text>
                    </View>
                )}
                {isAlreadyReturned && (
                    <View style={[styles.statusBadge, styles.returnedBadge]}>
                        <Text style={styles.statusBadgeText}>RETURNED</Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </SafeAreaView>
        );
    }

    if (!order) {
        return (
            <SafeAreaView style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#999" />
                <Text style={styles.errorText}>Order not found</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const canEdit = order.tryAndBuyStatus === 'delivered_awaiting_selection' ||
        order.tryAndBuyStatus === 'pending_delivery';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Order #{order.id.slice(-8)}</Text>
                    <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                        {getStatusText(order.status)}
                    </Text>
                </View>
                <View style={styles.headerRight} />
            </View>

            {/* Instructions */}
            {canEdit && (
                <View style={styles.instructionBanner}>
                    <Ionicons name="hand-left" size={20} color="#FF9800" />
                    <Text style={styles.instructionText}>
                        Select items the customer wants to keep
                    </Text>
                </View>
            )}

            {/* Items */}
            <FlatList
                data={order.items}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Selected Items:</Text>
                    <Text style={styles.summaryValue}>{selectedItems.size}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Amount to Pay:</Text>
                    <Text style={styles.summaryAmount}>₹{calculateSelectedTotal().toFixed(0)}</Text>
                </View>
                {canEdit && (
                    <TouchableOpacity
                        style={[styles.confirmButton, isSubmitting && styles.disabledButton]}
                        onPress={handleConfirmSelection}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Confirm Selection</Text>
                        )}
                    </TouchableOpacity>
                )}
                {order.tryAndBuyStatus === 'selection_confirmed' && (
                    <TouchableOpacity
                        style={[styles.paymentButton, isSubmitting && styles.disabledButton]}
                        onPress={handleCollectPayment}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Collect Payment</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f8f8',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f8f8',
        gap: 16,
    },
    errorText: {
        fontSize: 16,
        fontFamily: Fonts.Medium,
        color: '#666',
    },
    backBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: Colors.primary,
        borderRadius: 8,
    },
    backBtnText: {
        color: '#fff',
        fontFamily: Fonts.SemiBold,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        gap: 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#333',
    },
    statusText: {
        fontSize: 12,
        fontFamily: Fonts.Medium,
    },
    headerRight: {
        flex: 1,
    },
    instructionBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3E0',
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
    },
    instructionText: {
        fontSize: 13,
        fontFamily: Fonts.Medium,
        color: '#E65100',
        flex: 1,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        gap: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCard: {
        borderColor: Colors.primary,
        backgroundColor: '#F0FFF4',
    },
    returnedCard: {
        opacity: 0.5,
        backgroundColor: '#fafafa',
    },
    checkboxContainer: {
        padding: 4,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#ccc',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    itemImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
    itemInfo: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: '#333',
    },
    variantTitle: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#888',
        marginTop: 2,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 8,
    },
    itemPrice: {
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    quantity: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#888',
    },
    statusBadge: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    returnedBadge: {
        backgroundColor: '#F44336',
    },
    statusBadgeText: {
        fontSize: 10,
        fontFamily: Fonts.Bold,
        color: '#fff',
    },
    footer: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        gap: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#666',
    },
    summaryValue: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#333',
    },
    summaryAmount: {
        fontSize: 20,
        fontFamily: Fonts.Bold,
        color: Colors.primary,
    },
    confirmButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8,
    },
    paymentButton: {
        backgroundColor: '#4CAF50',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8,
    },
    confirmButtonText: {
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
        color: '#fff',
    },
    disabledButton: {
        opacity: 0.5,
    },
});
