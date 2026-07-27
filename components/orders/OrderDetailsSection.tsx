import { Fonts } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type OrderDetailsSectionProps = {
    order: any;
    isTicketingOnly: boolean;
    headerStatusText: string;
    deliveryPartnerStatus?: any;
    deliveryStatusKey?: string;
};

export const OrderDetailsSection: React.FC<OrderDetailsSectionProps> = ({
    order,
    isTicketingOnly,
    showLastMileDeliveryUi,
    headerStatusText,
    deliveryPartnerStatus,
    deliveryStatusKey,
}) => {
    // Check if this is a demo order by looking at custom attributes or notes
    const isDemoOrder = order?.customAttributes?.some((attr: any) =>
        attr.key === 'demo_request' || attr.value === 'true'
    ) || order?.note?.toLowerCase().includes('demo');

    // Extract schedule details
    const scheduledDateAttr = order?.customAttributes?.find((attr: any) => attr.key === 'scheduled_date')?.value;
    const scheduledTimeAttr = order?.customAttributes?.find((attr: any) => attr.key === 'scheduled_time')?.value;
    
    const scheduledDate = deliveryPartnerStatus?.scheduled_date || scheduledDateAttr || order?.scheduledDate || order?.deliverySchedule?.date;
    const scheduledTime = deliveryPartnerStatus?.scheduled_time || scheduledTimeAttr || order?.scheduledTime || order?.deliverySchedule?.time;
    const isScheduledOrder = deliveryPartnerStatus?.is_scheduled_order === true || order?.deliveryType === 'scheduled' || !!(scheduledDate && scheduledTime);

    const BEFORE_OUT_FOR_DELIVERY_STATUSES = new Set(['', 'placed', 'confirmed', 'packing', 'packed', 'rider_assigned']);
    const isEarlyStatus = BEFORE_OUT_FOR_DELIVERY_STATUSES.has(deliveryStatusKey || '');

    return (
        <>
            {/* Payment method */}
            <View style={styles.paymentMethodCard}>
                <Text style={styles.billTitle}>Payment method</Text>
                <Text style={styles.paymentMethodLabel}>
                    {isDemoOrder
                        ? 'Cash on Delivery (COD) - Demo Order'
                        : order?.financialStatus === 'PENDING'
                        ? 'Cash on Delivery (COD)'
                        : 'Paid online'}
                </Text>
            </View>

            {/* Delivery address – hide when order has only ticketing products */}
            {order?.shippingAddress && !isTicketingOnly && (
                <View style={styles.addressCard}>
                    {showLastMileDeliveryUi ? <Text style={styles.billTitle}>Order Details</Text> : null}

                    {/* Arrival / ETA line */}
                    {isScheduledOrder && isEarlyStatus && scheduledDate && scheduledTime ? (
                        <View style={styles.belowBillSection}>
                            <Text style={styles.belowBillTitle}>
                                Scheduled: {scheduledDate}, {scheduledTime}
                            </Text>
                        </View>
                    ) : showLastMileDeliveryUi && !!headerStatusText.trim() ? (
                        <View style={styles.belowBillSection}>
                            <Text style={styles.belowBillTitle}>{headerStatusText}</Text>
                        </View>
                    ) : null}
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
        </>
    );
};

const styles = StyleSheet.create({
    paymentMethodCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    paymentMethodLabel: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
    },
    addressCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
    },
    billTitle: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        marginBottom: 16,
    },
    belowBillSection: {
        marginBottom: 16,
    },
    belowBillTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
    },
    addressBlock: {
        marginTop: 4,
    },
    addressLine: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
        lineHeight: 20,
    },
});
