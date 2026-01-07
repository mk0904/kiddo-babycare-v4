// Request Return Screen
// Allows users to select items to return and specify reason

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
    returnsService,
    RETURN_REASONS,
    ReturnReasonId,
    ReturnItem,
} from '@/services/returnsService';
import { orderService, Order, OrderItem } from '@/services/orderService';
import { Colors } from '@/constants/theme';

export default function RequestReturnScreen() {
    const { orderId } = useLocalSearchParams<{ orderId: string }>();

    const [order, setOrder] = useState<Order | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectedReason, setSelectedReason] = useState<ReturnReasonId | null>(null);
    const [otherReason, setOtherReason] = useState('');
    const [additionalNotes, setAdditionalNotes] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadOrder();
    }, [orderId]);

    const loadOrder = async () => {
        if (!orderId) return;
        setIsLoading(true);
        try {
            const fetchedOrder = await orderService.getOrderById(orderId);
            if (fetchedOrder && fetchedOrder.status === 'delivered') {
                setOrder(fetchedOrder);
            } else if (fetchedOrder) {
                Alert.alert('Cannot Return', 'You can only return delivered orders.', [
                    { text: 'OK', onPress: () => router.back() },
                ]);
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

    const handleSubmitReturn = async () => {
        if (selectedItems.size === 0) {
            Alert.alert('Select Items', 'Please select at least one item to return.');
            return;
        }

        if (!selectedReason) {
            Alert.alert('Select Reason', 'Please select a reason for the return.');
            return;
        }

        if (selectedReason === 'other' && !otherReason.trim()) {
            Alert.alert('Specify Reason', 'Please specify the reason for your return.');
            return;
        }

        setIsSubmitting(true);

        try {
            const itemsToReturn: ReturnItem[] = order!.items
                .filter((item) => selectedItems.has(item.id))
                .map((item) => ({
                    itemId: item.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    title: item.title,
                    variantTitle: item.variantTitle,
                    price: item.price,
                    quantity: item.quantity,
                    image: item.image,
                }));

            const returnRequest = await returnsService.createReturnRequest(
                order!.id,
                order!.shopifyOrderName,
                itemsToReturn,
                selectedReason,
                selectedReason === 'other' ? otherReason : undefined,
                additionalNotes || undefined
            );

            // Update order status
            await orderService.updateOrderStatus(order!.id, 'return_requested');

            Alert.alert(
                'Return Requested',
                `Your return request #${returnRequest.id} has been submitted. We'll schedule a pickup soon.`,
                [
                    {
                        text: 'View Return',
                        onPress: () => router.replace(`/returns/${returnRequest.id}`),
                    },
                ]
            );
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to submit return request.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const calculateRefundAmount = (): number => {
        if (!order) return 0;
        return order.items
            .filter((item) => selectedItems.has(item.id))
            .reduce((sum, item) => sum + item.price * item.quantity, 0);
    };

    const renderItem = ({ item }: { item: OrderItem }) => {
        const isSelected = selectedItems.has(item.id);

        return (
            <TouchableOpacity
                style={[styles.itemCard, isSelected && styles.selectedCard]}
                onPress={() => toggleItemSelection(item.id)}
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
                    <Text style={styles.itemPrice}>₹{item.price.toFixed(0)}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderReasonItem = ({ item }: { item: typeof RETURN_REASONS[number] }) => {
        const isSelected = selectedReason === item.id;

        return (
            <TouchableOpacity
                style={[styles.reasonCard, isSelected && styles.reasonSelected]}
                onPress={() => setSelectedReason(item.id)}
            >
                <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={isSelected ? Colors.primary : '#666'}
                />
                <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                    {item.label}
                </Text>
                {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Request Return</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Select Items Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Select Items to Return</Text>
                    <Text style={styles.sectionSubtitle}>
                        Tap items you want to return ({selectedItems.size} selected)
                    </Text>
                    <FlatList
                        data={order.items}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                        contentContainerStyle={styles.itemsList}
                    />
                </View>

                {/* Reason Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Reason for Return</Text>
                    <FlatList
                        data={RETURN_REASONS}
                        renderItem={renderReasonItem}
                        keyExtractor={(item) => item.id}
                        scrollEnabled={false}
                        contentContainerStyle={styles.reasonsList}
                    />
                    {selectedReason === 'other' && (
                        <TextInput
                            style={styles.textInput}
                            placeholder="Please specify your reason..."
                            placeholderTextColor="#999"
                            value={otherReason}
                            onChangeText={setOtherReason}
                            multiline
                            numberOfLines={2}
                        />
                    )}
                </View>

                {/* Additional Notes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Any additional information..."
                        placeholderTextColor="#999"
                        value={additionalNotes}
                        onChangeText={setAdditionalNotes}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Refund Info */}
                <View style={styles.refundInfo}>
                    <Ionicons name="information-circle" size={20} color="#2196F3" />
                    <Text style={styles.refundText}>
                        Refund will be processed to your original payment method within 5-7
                        business days after item pickup.
                    </Text>
                </View>

                {/* Spacer for footer */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <View style={styles.refundSummary}>
                    <Text style={styles.refundLabel}>Estimated Refund</Text>
                    <Text style={styles.refundAmount}>₹{calculateRefundAmount().toFixed(0)}</Text>
                </View>
                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        (selectedItems.size === 0 || !selectedReason || isSubmitting) &&
                        styles.disabledButton,
                    ]}
                    onPress={handleSubmitReturn}
                    disabled={selectedItems.size === 0 || !selectedReason || isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Return Request</Text>
                    )}
                </TouchableOpacity>
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
        fontFamily: 'Metropolis-Medium',
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
        fontFamily: 'Metropolis-SemiBold',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Metropolis-SemiBold',
        color: '#333',
    },
    headerRight: {
        width: 32,
    },
    scrollView: {
        flex: 1,
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 12,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: 'Metropolis-SemiBold',
        color: '#333',
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        fontFamily: 'Metropolis-Regular',
        color: '#888',
        marginBottom: 12,
    },
    itemsList: {
        gap: 10,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderRadius: 10,
        padding: 10,
        gap: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedCard: {
        borderColor: Colors.primary,
        backgroundColor: '#F0FFF4',
    },
    checkboxContainer: {
        padding: 2,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 11,
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
        width: 50,
        height: 50,
        borderRadius: 6,
        backgroundColor: '#eee',
    },
    itemInfo: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 13,
        fontFamily: 'Metropolis-Medium',
        color: '#333',
    },
    variantTitle: {
        fontSize: 11,
        fontFamily: 'Metropolis-Regular',
        color: '#888',
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 14,
        fontFamily: 'Metropolis-SemiBold',
        color: Colors.primary,
        marginTop: 2,
    },
    reasonsList: {
        gap: 8,
    },
    reasonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderRadius: 10,
        padding: 14,
        gap: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    reasonSelected: {
        borderColor: Colors.primary,
        backgroundColor: '#F0FFF4',
    },
    reasonText: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Metropolis-Medium',
        color: '#333',
    },
    reasonTextSelected: {
        color: Colors.primary,
    },
    textInput: {
        backgroundColor: '#fafafa',
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        fontFamily: 'Metropolis-Regular',
        color: '#333',
        marginTop: 12,
        textAlignVertical: 'top',
        minHeight: 60,
    },
    refundInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#E3F2FD',
        margin: 12,
        padding: 12,
        borderRadius: 10,
        gap: 10,
    },
    refundText: {
        flex: 1,
        fontSize: 12,
        fontFamily: 'Metropolis-Regular',
        color: '#1976D2',
        lineHeight: 18,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        gap: 12,
    },
    refundSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    refundLabel: {
        fontSize: 14,
        fontFamily: 'Metropolis-Regular',
        color: '#666',
    },
    refundAmount: {
        fontSize: 20,
        fontFamily: 'Metropolis-Bold',
        color: Colors.primary,
    },
    submitButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: 15,
        fontFamily: 'Metropolis-SemiBold',
        color: '#fff',
    },
    disabledButton: {
        opacity: 0.5,
    },
});
