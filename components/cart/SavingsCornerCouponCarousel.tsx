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
    description?: string;
    isVisible?: boolean;
    /** If true, this coupon opens the special deal promo modal (e.g. Mother’s Day kit). */
    isDealCoupon?: boolean;
    [key: string]: unknown;
}

/** Fixed height so carousel cards line up across states. */
const TICKET_CARD_HEIGHT = 135;

function getCouponHeadline(coupon: SavingsCornerCouponItem): string {
    return coupon.title?.trim() || 'Special offer';
}

function getCouponSubline(coupon: SavingsCornerCouponItem): string {
    return coupon.description?.trim() || 'Apply this coupon on eligible items.';
}

export interface SavingsCornerCouponCarouselProps {
    /** When false, renders nothing. */
    visible: boolean;
    loading: boolean;
    coupons: { coupon: SavingsCornerCouponItem; applicability: { applicable: boolean; reason?: string }; conditions: string[] }[];
    couponApplying: boolean;
    appliedCouponCode?: string | null;
    onApplyCoupon: (coupon: SavingsCornerCouponItem) => void;
    /** Fired when the whole coupon ticket is pressed (e.g. to open deal modal). */
    onCouponPress?: (coupon: SavingsCornerCouponItem) => void;
    /** When true, hides the "Apply" / "Applied" states and makes the component read-only. */
    readOnly?: boolean;
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
    appliedCouponCode,
    onApplyCoupon,
    onCouponPress,
    readOnly,
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
                {coupons.map((item, index) => {
                    const { coupon, applicability, conditions } = item;
                    const isDisabled = !applicability.applicable;
                    const codeStr = (coupon.code || '—').toUpperCase();
                    const headline = getCouponHeadline(coupon);
                    const subline = getCouponSubline(coupon);
                    const codeLabel = `#${codeStr}`;
                    const trimmedReason = String(applicability.reason ?? '').trim();
                    const showReason = isDisabled && trimmedReason.length > 0;
                    const isApplied =
                        !!appliedCouponCode &&
                        codeStr !== '—' &&
                        codeStr === appliedCouponCode.trim().toUpperCase();
                    const isAppliedSuccess = isApplied && !showReason;

                    return (
                        <TouchableOpacity
                            key={coupon.code || `carousel-${index}`}
                            style={[styles.ticketSlot, { width: ticketWidth }]}
                            activeOpacity={coupon.isDealCoupon ? 0.8 : 1}
                            onPress={() => {
                                if (coupon.isDealCoupon) {
                                    onCouponPress?.(coupon);
                                }
                            }}
                        >
                            <View style={[styles.ticketNotch, styles.ticketNotchLeft]} />
                            <View style={[styles.ticketNotch, styles.ticketNotchRight]} />
                            <View
                                style={[
                                    styles.ticketCard,
                                    { height: TICKET_CARD_HEIGHT },
                                    (!readOnly && (couponApplying || (isDisabled && !isApplied))) && styles.ticketCardMuted,
                                ]}
                            >
                                <View style={styles.ticketTopRow}>
                                    <Text style={styles.ticketDescText} numberOfLines={1}>
                                        {headline.toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.ticketDividerWrap}>
                                    <View style={styles.ticketDividerDashed} />
                                </View>
                                <View style={styles.ticketReasonSlot}>
                                    {showReason ? (
                                        <Text style={styles.ticketReasonText} numberOfLines={2} ellipsizeMode="tail">
                                            {trimmedReason}
                                        </Text>
                                    ) : (
                                        <Text style={styles.ticketSublineText} numberOfLines={2}>
                                            {subline}
                                        </Text>
                                    )}
                                </View>
                                <View style={styles.ticketBottomRow}>
                                    <View style={styles.ticketCodeBox}>
                                        <Text
                                            style={[styles.ticketCodeText, (isDisabled || isApplied) && styles.ticketTextMuted]}
                                            numberOfLines={1}
                                        >
                                            {codeLabel}
                                        </Text>
                                    </View>
                                    {readOnly ? null : isAppliedSuccess ? (
                                        <View style={styles.appliedBadge}>
                                            <Ionicons name="checkmark" size={18} color={Colors.primary} />
                                            <Text style={styles.appliedBadgeText}>Applied</Text>
                                        </View>
                                    ) : isDisabled ? (
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
                            </View>
                        </TouchableOpacity>
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
    ticketNotch: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        top: 30,
        zIndex: 2,
    },
    ticketNotchLeft: {
        left: -12,
    },
    ticketNotchRight: {
        right: -12,
    },
    ticketCard: {
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 0,
        borderWidth: 1,
        borderColor: '#FEEFEF',
        backgroundColor: '#FEEFEF',
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
        minWidth: 96,
        marginRight: 10,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#FF7E7E',
        borderStyle: 'dashed',
        borderRadius: 16,
        backgroundColor: 'transparent',
    },
    ticketCodeText: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
    },
    ticketTextMuted: {
        color: '#181D2780',
    },
    ticketApplyActive: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#F15E5E',
    },
    ticketApplyDisabled: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#A4A7AE',
    },
    ticketDividerWrap: {
        marginTop: 10,
        marginBottom: 10,
    },
    ticketDividerDashed: {
        borderTopWidth: 1,
        borderColor: '#F3CBCD',
        width: '100%',
    },
    ticketBottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
    },
    ticketReasonSlot: {
        justifyContent: 'flex-start',
    },
    ticketDescText: {
        flex: 1,
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        
    },
    ticketSublineText: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#535862',
        lineHeight: 16,
        minHeight: 32,
    },
    ticketReasonText: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#D92D20',
        lineHeight: 16,
        minHeight: 32,
    },
    appliedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    appliedBadgeText: {
        marginLeft: 4,
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.primary,
    },
    
});
