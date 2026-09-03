import { ScheduleBottomSheet } from '@/components/orders/return-exchange/ScheduleBottomSheet';
import { StepProductSelection } from '@/components/orders/return-exchange/StepProductSelection';
import { StepReasonSelection } from '@/components/orders/return-exchange/StepReasonSelection';
import { StepSuccess } from '@/components/orders/return-exchange/StepSuccess';
import { StepSummary } from '@/components/orders/return-exchange/StepSummary';
import { Fonts } from '@/constants/theme';
import { scheduleReturnExchange, getExternalOrderStatus } from '@/services/deliveryPartnerService';
import { shopifyApi } from '@/services/shopifyApi';
import { useUserStore } from '@/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ItemDetails } from '@/components/orders/return-exchange/types';

export default function ReturnExchangeScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const persistedAccessToken = useUserStore((s) => s.accessToken);

    const [currentStep, setCurrentStep] = useState(1);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [itemDetails, setItemDetails] = useState<Record<string, ItemDetails>>({});
    const [schedule, setSchedule] = useState<{ date: string; time: string } | null>(null);
    const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
    const [orderData, setOrderData] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        let orderId = Array.isArray(id) ? id[0] : id;
        if (!orderId) return;
        orderId = decodeURIComponent(orderId).trim();
        if (!orderId.startsWith('gid://shopify/Order/')) {
            orderId = `gid://shopify/Order/${orderId.split('?')[0]}`;
        }

        shopifyApi.getOrderById(orderId).then((res) => {
            if (res) {
                setOrderData(res);
            }
        });
    }, [id]);

    const goBack = () => {
        if (currentStep > 1 && currentStep < 4) {
            setCurrentStep(currentStep - 1);
        } else {
            router.back();
        }
    };

    const handleConfirmSelection = (items: string[]) => {
        setSelectedItems(items);
        setCurrentStep(2);
    };

    const handleConfirmReasons = (details: Record<string, ItemDetails>) => {
        setItemDetails(details);
        setIsScheduleModalVisible(true);
    };

    const handleConfirmSchedule = (selectedSchedule: { date: string; time: string }) => {
        setSchedule(selectedSchedule);
        setIsScheduleModalVisible(false);
        setCurrentStep(4);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            let is_exchange = false;
            let is_return = false;
            const return_product_ids: string[] = [];
            const exchange_product_ids: string[] = [];
            let combinedReason = '';
            const images: string[] = [];

            selectedItems.forEach(id => {
                const detail = itemDetails[id];
                if (!detail) return;

                const numericId = id.split('/').pop()?.split('?')[0] || id;

                if (detail.type === 'Exchange') {
                    is_exchange = true;
                    exchange_product_ids.push(numericId);
                } else if (detail.type === 'Return') {
                    is_return = true;
                    return_product_ids.push(numericId);
                    if (detail.reason) {
                        combinedReason = combinedReason ? `${combinedReason}, ${detail.reason}` : detail.reason;
                    }
                    if (detail.images) {
                        detail.images.forEach(img => images.push(img.uri));
                    }
                }
            });

            const numericShopifyId = orderData.id.split('/').pop().split('?')[0];
            const externalStatus = await getExternalOrderStatus(numericShopifyId);
            const db_order_id = externalStatus?.order?.id;

            if (!db_order_id) {
                Alert.alert("Error", "Internal order ID not found.");
                setIsSubmitting(false);
                return;
            }

            const payload = {
                order_id: db_order_id,
                date: schedule!.date,
                time: schedule!.time,
                is_exchange,
                is_return,
                return_product_ids,
                exchange_product_ids,
                reason: combinedReason || undefined,
                images: images.length > 0 ? images : undefined
            };

            // IMMEDIATELY update local storage for instant UI reflection
            try {
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const orders = JSON.parse(await AsyncStorage.getItem('kiddo_orders') || '[]');
                const idx = orders.findIndex((o: any) => o.id === db_order_id || o.shopifyOrderId === String(db_order_id).trim());
                if (idx !== -1) {
                    orders[idx].isReturn = is_return;
                    orders[idx].isExchange = is_exchange;
                    orders[idx].returnProductIds = return_product_ids;
                    orders[idx].exchangeProductIds = exchange_product_ids;
                    await AsyncStorage.setItem('kiddo_orders', JSON.stringify(orders));
                }
            } catch (err) {
                console.error('Failed to update local storage for return/exchange', err);
            }

            const success = await scheduleReturnExchange(payload);
            console.log(payload.order_id, '---')
            if (success) {
                setCurrentStep(5);
            } else {
                Alert.alert("Error", "Could not schedule return/exchange. Please try again.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Something went wrong.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!orderData) return null;

    return (
        <SafeAreaView style={styles.container}>
            {currentStep !== 5 && (
                <View style={styles.header}>
                    <TouchableOpacity onPress={goBack} style={styles.backBtn} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Return/Exchange</Text>
                    </View>
                </View>
            )}

            <View style={styles.content}>
                {currentStep === 5 && (
                    <StepSuccess
                        selectedItems={selectedItems}
                        itemDetails={itemDetails}
                        onClose={() => router.replace(`/orders/${Array.isArray(id) ? id[0] : id}`)}
                    />
                )}
                {currentStep === 1 && (
                    <StepProductSelection
                        order={orderData}
                        selectedItems={selectedItems}
                        onNext={handleConfirmSelection}
                    />
                )}
                {currentStep === 2 && (
                    <StepReasonSelection
                        order={orderData}
                        selectedItems={selectedItems}
                        initialDetails={itemDetails}
                        onNext={handleConfirmReasons}
                    />
                )}
                {currentStep === 4 && schedule && (
                    <StepSummary
                        order={orderData}
                        selectedItems={selectedItems}
                        itemDetails={itemDetails}
                        schedule={schedule!}
                        onSubmit={handleSubmit}
                        isSubmitting={isSubmitting}
                    />
                )}
            </View>

            <ScheduleBottomSheet
                visible={isScheduleModalVisible}
                onClose={() => setIsScheduleModalVisible(false)}
                onSelect={handleConfirmSchedule}
            />
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
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
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
    helpBtn: {
        padding: 4,
    },
    content: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
});
