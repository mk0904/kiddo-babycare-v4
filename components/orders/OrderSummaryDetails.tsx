import { Fonts } from '@/constants/theme';
import { appConfigService } from '@/services/appConfigService';
import type { DeliveryPartnerOrderStatus } from '@/services/deliveryPartnerService';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type OrderSummaryDetailsProps = {
    deliveryPartnerStatus: DeliveryPartnerOrderStatus | null;
    subtotalDisplay: number;
    shipping: number;
    total: number;
    tax: number;
    couponCode: string | null;
    order?: any;
};

export const OrderSummaryDetails: React.FC<OrderSummaryDetailsProps> = ({
    deliveryPartnerStatus,
    subtotalDisplay,
    shipping,
    total,
    tax,
    couponCode,
    order,
}) => {
    const formatCurrency = (amount: number) =>
        `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    // Check if this is a demo order
    const isDemoOrder = order?.customAttributes?.some((attr: any) =>
        attr.key === 'demo_request' || attr.value === 'true'
    ) || order?.note?.toLowerCase().includes('demo');

    const freeShoesGiftUc = appConfigService.getFreeShoesGiftDiscountCodeUppercase();
    const freePuzzleGiftUc = appConfigService.getFreePuzzleGiftDiscountCodeUppercase();
    const mysteryGiftUc = appConfigService.getMysteryGiftDiscountCodeUppercase();

    const dps = deliveryPartnerStatus;

    const billSubtotal = dps ? parseFloat(String(dps.subtotal_amount || 0)) : subtotalDisplay;
    const billShipping = dps ? parseFloat(String(dps.delivery_fee || 0)) : shipping;
    const billTotal = dps ? parseFloat(String(dps.total_amount || 0)) : total;
    const billDiscount = dps ? parseFloat(String(dps.discount_amount || 0)) : Math.max(0, subtotalDisplay + shipping + tax - total);
    const billKiddoCash = dps ? parseFloat(String(dps.kiddo_cash_spent || 0)) : 0;

    let billCouponCode = dps ? (dps.coupon_code || dps.couponCode || null) : couponCode;

    const isFreeShoesGiftCoupon = Boolean(freeShoesGiftUc) && billCouponCode?.toUpperCase() === freeShoesGiftUc;
    const isFreePuzzleGiftCoupon = Boolean(freePuzzleGiftUc) && billCouponCode?.toUpperCase() === freePuzzleGiftUc;
    const isMysteryGiftCoupon = Boolean(mysteryGiftUc) && billCouponCode?.toUpperCase() === mysteryGiftUc;

    const isGiftCoupon = isFreeShoesGiftCoupon || isFreePuzzleGiftCoupon || isMysteryGiftCoupon;
    const displayDiscount = isGiftCoupon ? 0 : billDiscount;

    let giftText = '';
    if (isFreeShoesGiftCoupon) giftText = 'Free Shoe';
    else if (isFreePuzzleGiftCoupon) giftText = 'Free Puzzle';
    else if (isMysteryGiftCoupon) giftText = 'Mystery Gift';

    return (
        <View style={styles.billCard}>
            <Text style={styles.billTitle}>Bill details</Text>
            <View style={styles.billRow}>
                <Text style={styles.billLabel}>Total</Text>
                <Text style={styles.billValue}>{formatCurrency(billTotal)}</Text>
            </View>

            {billShipping > 0 && (
                <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Delivery Fee</Text>
                    <Text style={styles.billValue}>{formatCurrency(billShipping)}</Text>
                </View>
            )}

            {(displayDiscount > 0 || billCouponCode) && (
                <View style={styles.billRow}>
                    <Text style={styles.billLabel}>
                        {billCouponCode ? `Coupon (${billCouponCode})` : 'Coupon Discount'}
                    </Text>
                    <Text style={[styles.billValue, (displayDiscount > 0 || isGiftCoupon) && styles.billDiscountValue]}>
                        {isGiftCoupon ? giftText : (displayDiscount > 0 ? `-${formatCurrency(displayDiscount)}` : formatCurrency(0))}
                    </Text>
                </View>
            )}

            {billKiddoCash > 0 && (
                <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Kiddo Cash</Text>
                    <Text style={[styles.billValue, styles.billDiscountValue]}>
                        -{formatCurrency(billKiddoCash)}
                    </Text>
                </View>
            )}

            <View style={styles.billDivider} />
            <View style={styles.billRow}>
                <Text style={styles.billTotalLabel}>
                    {isDemoOrder ? 'Amount to Pay' : 'Amount Paid'}
                </Text>
                <Text style={styles.billTotalValue}>{formatCurrency(billSubtotal)}</Text>
            </View>

            {/* Demo order note */}
            {isDemoOrder && order?.note && (
                <View style={styles.demoNoteCard}>
                    <Text style={styles.demoNoteTitle}>Demo Schedule</Text>
                    <Text style={styles.demoNoteText}>{order.note}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    billCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        marginTop: 16,
    },
    billTitle: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        marginBottom: 16,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    billLabel: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
    },
    billValue: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#111827',
    },
    billDiscountValue: {
        color: '#16A34A',
        fontFamily: Fonts.LexendSemiBold,
    },
    billDivider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 12,
    },
    billTotalLabel: {
        fontSize: 16,
        fontFamily: Fonts.LexendSemiBold,
        color: '#111827',
    },
    billTotalValue: {
        fontSize: 16,
        fontFamily: Fonts.LexendSemiBold,
        color: '#111827',
    },
    demoNoteCard: {
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
    },
    demoNoteTitle: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: '#92400E',
        marginBottom: 4,
    },
    demoNoteText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#78350F',
        lineHeight: 18,
    },
});
