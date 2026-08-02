import { Fonts } from '@/constants/theme';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface ProductCouponCarouselProps {
    coupons: any[];
    productPrice: number;
}

const TICKET_WIDTH = Dimensions.get('window').width * 0.85;

// A jagged circle SVG for the discount badge
const JaggedBadge = ({ size = 48, color = '#5B21B6' }) => (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
            <Path
                fill={color}
                d="M50 0L56.176 10.3703L68.3013 7.32233L71.3493 19.4477L83.4746 19.4477L83.4746 31.573L95.5999 34.621L89.4239 45L95.5999 55.379L83.4746 58.427L83.4746 70.5523L71.3493 70.5523L68.3013 82.6777L56.176 79.6297L50 90L43.824 79.6297L31.6987 82.6777L28.6507 70.5523L16.5254 70.5523L16.5254 58.427L4.40015 55.379L10.5761 45L4.40015 34.621L16.5254 31.573L16.5254 19.4477L28.6507 19.4477L31.6987 7.32233L43.824 10.3703L50 0Z"
            />
        </Svg>
        <Text style={{ color: '#FFF', fontFamily: Fonts.LexendBold, fontSize: size * 0.35 }}>%</Text>
    </View>
);

export function ProductCouponCarousel({ coupons, productPrice }: ProductCouponCarouselProps) {
    if (!coupons || coupons.length === 0) return null;

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
        >
            {coupons.map((item, index) => {
                const { coupon } = item;
                const code = coupon.code ? coupon.code.toUpperCase() : '';

                let discountAmount = 0;
                if (coupon.valueType === 'percentage' || coupon.valueType === 'percentage') {
                    discountAmount = (productPrice * (coupon.value || 0)) / 100;
                    if (coupon.maxDiscountAmount) {
                        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
                    }
                } else {
                    discountAmount = coupon.value || 0;
                }
                discountAmount = Math.round(discountAmount);
                const finalPrice = Math.max(0, productPrice - discountAmount);

                const offerText = coupon.valueType === 'percentage'
                    ? `${coupon.value}% OFF`
                    : `₹${coupon.value} OFF`;

                return (
                    <View key={code || index} style={[styles.ticketContainer, { width: TICKET_WIDTH }]}>
                        <View style={styles.leftSection}>
                            <JaggedBadge size={44} color="#6D28D9" />
                        </View>

                        <View style={styles.dividerSection}>
                            <View style={[styles.notch, styles.notchTop]} />
                            <View style={styles.dashedLine} />
                            <View style={[styles.notch, styles.notchBottom]} />
                        </View>

                        <View style={styles.rightSection}>
                            <View style={styles.topRow}>
                                <Text style={styles.getWithText} numberOfLines={1}>
                                    Get "{offerText}" with
                                </Text>
                                <View style={styles.codeBadge}>
                                    <Text style={styles.codeText} numberOfLines={1}>{code}</Text>
                                </View>
                            </View>
                            <Text style={styles.descText} numberOfLines={1}>
                                {coupon.title || `Get ${offerText}`}
                            </Text>
                            <Text style={styles.priceText} numberOfLines={1}>
                                Get it for as low as ₹{finalPrice}
                            </Text>
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
    ticketContainer: {
        flexDirection: 'row',
        backgroundColor: '#F5F3FF', // Light purple background
        borderRadius: 12,
        marginRight: 24,
        overflow: 'hidden',
    },
    leftSection: {
        paddingVertical: 16,
        paddingHorizontal: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dividerSection: {
        width: 2,
        position: 'relative',
        justifyContent: 'center',
    },
    dashedLine: {
        flex: 1,
        borderLeftWidth: 1.5,
        borderColor: '#C4B5FD',
        borderStyle: 'dashed',
        marginVertical: 10,
    },
    notch: {
        position: 'absolute',
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FFFFFF', // Assuming background of PDP is white
        left: -7,
        zIndex: 2,
    },
    notchTop: {
        top: -8,
    },
    notchBottom: {
        bottom: -8,
    },
    rightSection: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        justifyContent: 'space-between',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    getWithText: {
        fontFamily: Fonts.LexendMedium,
        fontSize: Fonts.SmallFontSize,
        color: '#4B5563',
        marginRight: 6,
    },
    codeBadge: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    codeText: {
        fontFamily: Fonts.LexendBold,
        fontSize: 10,
        color: '#111827',
    },
    descText: {
        fontFamily: Fonts.LexendRegular,
        fontSize: Fonts.SmallFontSize,
        color: '#4B5563',
        marginBottom: 4,
    },
    priceText: {
        fontFamily: Fonts.LexendBold,
        fontSize: 12,
        color: '#111827',
    },
});
