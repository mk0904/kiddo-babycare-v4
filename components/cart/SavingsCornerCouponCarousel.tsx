import { Colors, Fonts } from '@/constants/theme';
import { couponService, type CouponCode } from '@/services/couponService';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { CouponDetailsModal } from './CouponDetailsModal';

/** Coupon row shape from Savings Corner (normalized from backend). */
export interface SavingsCornerCouponItem {
    code?: string;
    value?: number;
    valueType?: 'percentage' | 'fixed';
    title?: string;
    isVisible?: boolean;
    [key: string]: unknown;
}

/** Fixed height so carousel cards line up; reason is capped here (full text in details modal). */
const TICKET_CARD_HEIGHT = 182;

export interface SavingsCornerCouponCarouselProps {
    /** When false, renders nothing. */
    visible: boolean;
    loading: boolean;
    coupons: SavingsCornerCouponItem[];
    couponApplying: boolean;
    hasTicketingProducts: boolean;
    hasFashionItems: boolean;
    cartSubtotal: number;
    cartItemCount: number;
    userOrderCount: number;
    couponUsages: Record<string, number>;
    categorySubtotals: Record<string, number>;
    lineItems: { tags?: string[]; price?: number; quantity?: number }[];
    onApplyCoupon: (coupon: SavingsCornerCouponItem) => void;
}

function buildCouponDetailsContent(
    coupon: SavingsCornerCouponItem,
    applicability: { applicable: boolean; reason?: string },
    conditions: string[],
): { code: string; subtitle: string; bullets: string[] } {
    const code = (coupon.code?.trim() || 'Coupon').toUpperCase();
    const rawTitle = coupon.title && String(coupon.title).trim() ? String(coupon.title).trim() : '';
    const descRaw = (coupon as { description?: unknown }).description;
    const desc = typeof descRaw === 'string' && descRaw.trim() ? descRaw.trim() : '';
    const offerFallback =
        coupon.value != null && coupon.value !== 0
            ? coupon.valueType === 'percentage'
                ? `${coupon.value}% off`
                : `₹${coupon.value} off`
            : '';
    const subtitle = rawTitle || desc || offerFallback || '';

    const bullets: string[] = [];
    for (const c of conditions.slice(0, 12)) {
        const t = c?.trim();
        if (!t) continue;
        if (subtitle && t === subtitle) continue;
        bullets.push(t);
    }
    if (!applicability.applicable && applicability.reason?.trim()) {
        const r = applicability.reason.trim();
        if (!bullets.includes(r)) bullets.push(r);
    }
    if (bullets.length === 0 && !subtitle) {
        bullets.push('Use APPLY to add this coupon when your cart is eligible.');
    }

    return { code, subtitle, bullets };
}

export function SavingsCornerCouponCarousel({
    visible,
    loading,
    coupons,
    couponApplying,
    hasTicketingProducts,
    hasFashionItems,
    cartSubtotal,
    cartItemCount,
    userOrderCount,
    couponUsages,
    categorySubtotals,
    lineItems,
    onApplyCoupon,
}: SavingsCornerCouponCarouselProps) {
    const [details, setDetails] = useState<{ code: string; subtitle: string; bullets: string[] } | null>(null);
    const ticketWidth = useMemo(
        () => Math.min(292, Math.max(248, Dimensions.get('window').width * 0.78)),
        [],
    );

    if (!visible) return null;

    const list =
        loading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={styles.loading} />
        ) : coupons.length === 0 ? null : (
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {coupons.map((coupon, index) => {
                    const applicability = coupon.code
                        ? couponService.getCouponApplicabilityForDisplay(
                            {
                                ...coupon,
                                code: coupon.code,
                                valueType: coupon.valueType === 'fixed' ? 'fixed_amount' : coupon.valueType,
                            } as CouponCode,
                            {
                                hasTicketingProducts,
                                hasFashionItems,
                                cartSubtotal,
                                cartItemCount,
                                userOrderCount,
                                couponUsageCount: couponUsages[coupon.code?.toUpperCase() ?? ''] ?? 0,
                                categorySubtotals,
                                lineItems,
                            },
                        )
                        : { applicable: true };
                    const isDisabled = !applicability.applicable;
                    const conditions = coupon.code
                        ? couponService.getCouponConditionsText({
                            ...coupon,
                            code: coupon.code,
                            valueType: coupon.valueType === 'fixed' ? 'fixed_amount' : coupon.valueType,
                        } as CouponCode)
                        : [];
                    const offerTitle =
                        coupon.title ||
                        (coupon.value != null && coupon.value !== 0
                            ? coupon.valueType === 'percentage'
                                ? `Get ${coupon.value}% off`
                                : `Get ₹${coupon.value} off`
                            : coupon.code
                                ? `Use code ${coupon.code}`
                                : 'Coupon');
                    const codeStr = (coupon.code || '—').toUpperCase();

                    return (
                        <View key={coupon.code || `carousel-${index}`} style={[styles.ticketSlot, { width: ticketWidth }]}>
                            <View
                                style={[
                                    styles.ticketCard,
                                    { height: TICKET_CARD_HEIGHT },
                                    (couponApplying || isDisabled) && styles.ticketCardMuted,
                                ]}
                            >
                                <View style={styles.ticketTopRow}>
                                    <View style={styles.ticketCodeBox}>
                                        <Text
                                            style={[styles.ticketCodeText, isDisabled && styles.ticketTextMuted]}
                                            numberOfLines={1}
                                        >
                                            {codeStr}
                                        </Text>
                                    </View>
                                    {isDisabled ? (
                                        <Text style={styles.ticketApplyDisabled}>Apply</Text>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (couponApplying) return;
                                                onApplyCoupon(coupon);
                                            }}
                                            disabled={couponApplying}
                                            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                            activeOpacity={0.7}
                                        >
                                            {couponApplying ? (
                                                <ActivityIndicator size="small" color={Colors.primary} />
                                            ) : (
                                                <Text style={styles.ticketApplyActive}>Apply</Text>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View style={styles.ticketDividerWrap}>
                                    <View style={styles.ticketDividerDashed} />
                                </View>
                                <View style={styles.ticketBottomRow}>
                                    <Text
                                        style={[styles.ticketDescText, isDisabled && styles.ticketTextMuted]}
                                        numberOfLines={1}
                                    >
                                        {offerTitle}
                                    </Text>
                                    {!isDisabled ? (
                                        <TouchableOpacity
                                            onPress={() =>
                                                setDetails(buildCouponDetailsContent(coupon, applicability, conditions))
                                            }
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                            accessibilityLabel="Coupon details"
                                        >
                                            <Ionicons name="information-circle-outline" size={18} color="#6B7280" />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                                <View style={styles.ticketReasonSlot}>
                                    {isDisabled && String(applicability.reason ?? '').trim() ? (
                                        <Text
                                            style={styles.ticketReasonText}
                                            numberOfLines={2}
                                            ellipsizeMode="tail"
                                        >
                                            {String(applicability.reason).trim()}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>

                        </View>
                    );
                })}
            </ScrollView>
        );

    return (
        <>
            {list}
            <CouponDetailsModal
                visible={details != null}
                code={details?.code ?? ''}
                subtitle={details?.subtitle ?? ''}
                bullets={details?.bullets ?? []}
                onClose={() => setDetails(null)}
            />
        </>
    );
}

const styles = StyleSheet.create({
    loading: {
        marginTop: 16,
        alignSelf: 'center',
    },
    scrollContent: {
        paddingTop: 14,
        paddingBottom: 8,
        paddingRight: 8,
    },
    ticketSlot: {
        position: 'relative',
        marginRight: 12,
    },
    ticketCard: {
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 14,
        borderWidth: 1,
        borderColor: '#FAFAFA',
        backgroundColor: '#FAFAFA',
        overflow: 'hidden',
    },
    ticketCardMuted: {
        opacity: 1,
    },
    ticketTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    ticketCodeBox: {
        flex: 1,
        minWidth: 0,
        marginRight: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#CBD0D7',
        borderStyle: 'dashed',
        borderRadius: 20,
        backgroundColor: '#F5F6F8',
    },
    ticketCodeText: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        letterSpacing: 0.2,
    },
    ticketTextMuted: {
        color: '#181D27',
    },
    ticketApplyActive: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#F15E5E',
        letterSpacing: 0,
    },
    ticketApplyDisabled: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#A4A7AE',
        letterSpacing: 0,
    },
    ticketDividerWrap: {
        marginTop: 14,
        marginBottom: 14,
    },
    ticketDividerDashed: {
        borderTopWidth: 1,
        borderColor: '#D4D6DB',
        width: '100%',
    },
    ticketBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    ticketReasonSlot: {
        justifyContent: 'flex-start',
    },
    ticketDescText: {
        flex: 1,
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        marginRight: 6,
    },
    ticketReasonText: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#D92D20',
        lineHeight: 18,
        backgroundColor: '#FEE4E2',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
});
