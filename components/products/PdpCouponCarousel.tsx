import React from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import Svg, { Path } from 'react-native-svg';

export interface PdpCouponCarouselProps {
    coupons: any[];
    productPrice: number;
    onApply?: (coupon: any) => void;
    onDetails?: (item: any) => void;
}

const TICKET_WIDTH = Dimensions.get('window').width * 0.9;

const CurvedUnderline = () => (
    <Svg width="100%" height="6" viewBox="0 0 50 6" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -4, left: 0 }}>
        <Path d="M 2 4 Q 25 1 48 4" fill="none" stroke="#FF5722" strokeWidth="2" strokeLinecap="round" />
    </Svg>
);

const KiddoSpecialBadge = () => (
    <View style={styles.badgeContainer}>
        <View style={styles.kiddoBubble}>
            <Text style={styles.kiddoText}>Kiddo</Text>
        </View>
        <View style={styles.specialBubble}>
            <Text style={styles.specialText}>SPECIAL</Text>
        </View>
    </View>
);

export function PdpCouponCarousel({ coupons, productPrice, onApply, onDetails }: PdpCouponCarouselProps) {
    if (!coupons || coupons.length === 0) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
        >
            {coupons.map((item, index) => {
                const { coupon, applicable } = item;
                const code = coupon.code ? coupon.code.toUpperCase() : '';
                
                let discountAmount = 0;
                if (coupon.valueType === 'percentage') {
                    discountAmount = (productPrice * (coupon.value || 0)) / 100;
                    if (coupon.maxDiscountAmount) {
                        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
                    }
                } else {
                    discountAmount = coupon.value || 0;
                }
                discountAmount = Math.round(discountAmount);
                const finalPrice = Math.max(0, productPrice - discountAmount);

                return (
                    <View key={code || index} style={[styles.card, { width: TICKET_WIDTH }]}>
                        <View style={styles.topSection}>
                            <View style={styles.topLeft}>
                                <KiddoSpecialBadge />
                                <Text style={styles.getAtText}>Get at </Text>
                                <View>
                                    <Text style={styles.priceText}>₹{finalPrice}</Text>
                                    <CurvedUnderline />
                                </View>
                            </View>
                            <View style={styles.greenBadge}>
                                <Text style={styles.greenBadgeText}>Extra ₹{discountAmount} Off</Text>
                            </View>
                        </View>
                        <View style={styles.bottomSection}>
                            <Text style={styles.withCouponText}>
                                With Coupon : <Text style={styles.codeText}>{code}</Text>
                            </Text>
                            <TouchableOpacity onPress={() => onDetails ? onDetails(item) : (onApply && onApply(coupon))}>
                                <Text style={styles.detailsText}>Details {'>'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            })}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingRight: 16,
        paddingLeft: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginRight: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    topSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#F8F9FA',
    },
    topLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    badgeContainer: {
        marginRight: 8,
        alignItems: 'center',
        justifyContent: 'center',
        width: 48,
        height: 36,
    },
    kiddoBubble: {
        backgroundColor: '#FF8A80',
        borderRadius: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        zIndex: 2,
        transform: [{ rotate: '-5deg' }, { translateY: 4 }],
    },
    kiddoText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: Fonts.LexendBold,
    },
    specialBubble: {
        backgroundColor: '#B388FF',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
        transform: [{ rotate: '3deg' }],
        zIndex: 1,
    },
    specialText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontFamily: Fonts.LexendBold,
    },
    getAtText: {
        fontSize: 16,
        fontFamily: Fonts.LexendRegular,
        color: '#111827',
    },
    priceText: {
        fontSize: 18,
        fontFamily: Fonts.LexendMedium,
        color: '#111827',
    },
    greenBadge: {
        backgroundColor: '#34D399',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    greenBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
    },
    bottomSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
    },
    withCouponText: {
        fontSize: 13,
        fontFamily: Fonts.LexendRegular,
        color: '#374151',
    },
    codeText: {
        fontFamily: Fonts.LexendMedium,
        color: '#111827',
    },
    detailsText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#F43F5E',
    },
});
