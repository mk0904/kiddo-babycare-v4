// Return Detail Screen
// Shows return status and tracking

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
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
    ReturnRequest,
    ReturnItem,
    RETURN_REASONS,
    getReturnStatusText,
    getReturnStatusColor,
} from '@/services/returnsService';
import { Colors } from '@/constants/theme';

export default function ReturnDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadReturn();
    }, [id]);

    const loadReturn = async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const fetchedReturn = await returnsService.getReturnById(id);
            setReturnRequest(fetchedReturn);
        } catch (error) {
            console.error('Error loading return:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelReturn = async () => {
        if (!returnRequest) return;

        Alert.alert(
            'Cancel Return',
            'Are you sure you want to cancel this return request?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await returnsService.cancelReturn(returnRequest.id);
                        if (success) {
                            Alert.alert('Return Cancelled', 'Your return request has been cancelled.', [
                                { text: 'OK', onPress: () => router.back() },
                            ]);
                        } else {
                            Alert.alert('Error', 'Could not cancel return at this stage.');
                        }
                    },
                },
            ]
        );
    };

    const getReasonLabel = (reasonId: string): string => {
        const reason = RETURN_REASONS.find((r) => r.id === reasonId);
        return reason?.label || reasonId;
    };

    const renderTimelineItem = (
        item: ReturnRequest['statusHistory'][number],
        index: number,
        isLast: boolean
    ) => {
        const isActive = index === 0;
        return (
            <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineDot}>
                    <View
                        style={[
                            styles.dot,
                            { backgroundColor: isActive ? Colors.primary : '#ccc' },
                        ]}
                    />
                    {!isLast && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                    <Text style={[styles.timelineStatus, isActive && styles.activeStatus]}>
                        {item.message || getReturnStatusText(item.status)}
                    </Text>
                    <Text style={styles.timelineDate}>
                        {new Date(item.timestamp).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </Text>
                </View>
            </View>
        );
    };

    const renderItem = ({ item }: { item: ReturnItem }) => (
        <View style={styles.itemCard}>
            <Image
                source={{ uri: item.image || 'https://via.placeholder.com/50' }}
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
                <Text style={styles.itemPrice}>₹{item.price.toFixed(0)} × {item.quantity}</Text>
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </SafeAreaView>
        );
    }

    if (!returnRequest) {
        return (
            <SafeAreaView style={styles.errorContainer}>
                <Ionicons name="alert-circle-outline" size={48} color="#999" />
                <Text style={styles.errorText}>Return not found</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Text style={styles.backBtnText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const canCancel = ['requested', 'approved'].includes(returnRequest.status);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>Return #{returnRequest.id.slice(-8)}</Text>
                    <Text
                        style={[
                            styles.statusBadge,
                            { color: getReturnStatusColor(returnRequest.status) },
                        ]}
                    >
                        {getReturnStatusText(returnRequest.status)}
                    </Text>
                </View>
                <View style={styles.headerRight} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Status Card */}
                <View style={styles.statusCard}>
                    <View
                        style={[
                            styles.statusIcon,
                            { backgroundColor: getReturnStatusColor(returnRequest.status) + '20' },
                        ]}
                    >
                        <Ionicons
                            name={
                                returnRequest.status === 'refund_completed'
                                    ? 'checkmark-circle'
                                    : returnRequest.status === 'rejected'
                                        ? 'close-circle'
                                        : 'time'
                            }
                            size={32}
                            color={getReturnStatusColor(returnRequest.status)}
                        />
                    </View>
                    <Text style={styles.statusTitle}>
                        {getReturnStatusText(returnRequest.status)}
                    </Text>
                    <Text style={styles.statusSubtitle}>
                        {returnRequest.status === 'requested' &&
                            'We are reviewing your return request'}
                        {returnRequest.status === 'approved' &&
                            'Your return has been approved. Pickup will be scheduled soon.'}
                        {returnRequest.status === 'pickup_scheduled' &&
                            'Our rider will pick up the item soon'}
                        {returnRequest.status === 'picked_up' &&
                            'Item has been picked up. Processing refund...'}
                        {returnRequest.status === 'refund_initiated' &&
                            'Refund is being processed'}
                        {returnRequest.status === 'refund_completed' &&
                            'Refund has been credited to your account'}
                        {returnRequest.status === 'rejected' &&
                            'Unfortunately, your return request was not approved'}
                    </Text>
                </View>

                {/* Refund Amount */}
                <View style={styles.refundCard}>
                    <Text style={styles.refundLabel}>Refund Amount</Text>
                    <Text style={styles.refundAmount}>
                        ₹{returnRequest.totalRefundAmount.toFixed(0)}
                    </Text>
                    <Text style={styles.refundNote}>
                        Will be credited to original payment method
                    </Text>
                </View>

                {/* Items */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Return Items</Text>
                    <FlatList
                        data={returnRequest.items}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.itemId}
                        scrollEnabled={false}
                        contentContainerStyle={styles.itemsList}
                    />
                </View>

                {/* Reason */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Return Reason</Text>
                    <View style={styles.reasonCard}>
                        <Text style={styles.reasonText}>
                            {getReasonLabel(returnRequest.reason)}
                        </Text>
                        {returnRequest.reasonText && (
                            <Text style={styles.reasonDetail}>{returnRequest.reasonText}</Text>
                        )}
                    </View>
                </View>

                {/* Timeline */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Tracking</Text>
                    <View style={styles.timeline}>
                        {returnRequest.statusHistory
                            .slice()
                            .reverse()
                            .map((item, index, arr) =>
                                renderTimelineItem(item, index, index === arr.length - 1)
                            )}
                    </View>
                </View>

                {/* Spacer */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Cancel Button */}
            {canCancel && (
                <View style={styles.footer}>
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancelReturn}>
                        <Text style={styles.cancelButtonText}>Cancel Return Request</Text>
                    </TouchableOpacity>
                </View>
            )}
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
        fontFamily: 'Metropolis-SemiBold',
        color: '#333',
    },
    statusBadge: {
        fontSize: 12,
        fontFamily: 'Metropolis-Medium',
    },
    headerRight: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    statusCard: {
        backgroundColor: '#fff',
        margin: 12,
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    statusIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    statusTitle: {
        fontSize: 18,
        fontFamily: 'Metropolis-SemiBold',
        color: '#333',
        marginBottom: 4,
    },
    statusSubtitle: {
        fontSize: 13,
        fontFamily: 'Metropolis-Regular',
        color: '#888',
        textAlign: 'center',
    },
    refundCard: {
        backgroundColor: '#E8F5E9',
        marginHorizontal: 12,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    refundLabel: {
        fontSize: 12,
        fontFamily: 'Metropolis-Regular',
        color: '#4CAF50',
    },
    refundAmount: {
        fontSize: 28,
        fontFamily: 'Metropolis-Bold',
        color: '#2E7D32',
        marginVertical: 4,
    },
    refundNote: {
        fontSize: 11,
        fontFamily: 'Metropolis-Regular',
        color: '#666',
    },
    section: {
        backgroundColor: '#fff',
        marginTop: 12,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 15,
        fontFamily: 'Metropolis-SemiBold',
        color: '#333',
        marginBottom: 12,
    },
    itemsList: {
        gap: 8,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fafafa',
        borderRadius: 8,
        padding: 10,
        gap: 10,
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
    },
    itemPrice: {
        fontSize: 13,
        fontFamily: 'Metropolis-SemiBold',
        color: Colors.primary,
        marginTop: 2,
    },
    reasonCard: {
        backgroundColor: '#fafafa',
        borderRadius: 8,
        padding: 12,
    },
    reasonText: {
        fontSize: 14,
        fontFamily: 'Metropolis-Medium',
        color: '#333',
    },
    reasonDetail: {
        fontSize: 12,
        fontFamily: 'Metropolis-Regular',
        color: '#888',
        marginTop: 4,
    },
    timeline: {
        paddingLeft: 8,
    },
    timelineItem: {
        flexDirection: 'row',
    },
    timelineDot: {
        alignItems: 'center',
        width: 20,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#ddd',
        marginVertical: 4,
    },
    timelineContent: {
        flex: 1,
        paddingLeft: 12,
        paddingBottom: 20,
    },
    timelineStatus: {
        fontSize: 13,
        fontFamily: 'Metropolis-Medium',
        color: '#666',
    },
    activeStatus: {
        color: Colors.primary,
        fontFamily: 'Metropolis-SemiBold',
    },
    timelineDate: {
        fontSize: 11,
        fontFamily: 'Metropolis-Regular',
        color: '#999',
        marginTop: 2,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    cancelButton: {
        backgroundColor: '#fff',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F44336',
    },
    cancelButtonText: {
        fontSize: 15,
        fontFamily: 'Metropolis-SemiBold',
        color: '#F44336',
    },
});
