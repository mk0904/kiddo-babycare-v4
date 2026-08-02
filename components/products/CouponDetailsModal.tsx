import BaseModal from '@/components/ui/BaseModal';
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface CouponDetailsModalProps {
    visible: boolean;
    onClose: () => void;
    selectedCoupon: any;
    productPrice: number;
}

const CurvedUnderline = () => (
    <Svg width="100%" height="6" viewBox="0 0 50 6" preserveAspectRatio="none" style={{ position: 'absolute', bottom: -4, left: 0 }}>
        <Path d="M 2 4 Q 25 1 48 4" fill="none" stroke="#FF5722" strokeWidth="2" strokeLinecap="round" />
    </Svg>
);

const MegaDealBadge = () => (
    <View style={styles.megaDealContainer}>
        <Text style={styles.megaDealTextTop}>MEGA</Text>
        <Text style={styles.megaDealTextBottom}>DEAL</Text>
    </View>
);

export function CouponDetailsModal({ visible, onClose, selectedCoupon, productPrice }: CouponDetailsModalProps) {
    const [detailsExpanded, setDetailsExpanded] = useState(false);

    if (!selectedCoupon) return null;

    const { coupon, conditions } = selectedCoupon;
    const code = coupon?.code ? coupon.code.toUpperCase() : '';

    let discountAmount = 0;
    if (coupon?.valueType === 'percentage') {
        discountAmount = (productPrice * (coupon.value || 0)) / 100;
        if (coupon.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
        }
    } else {
        discountAmount = coupon?.value || 0;
    }
    discountAmount = Math.round(discountAmount);
    const finalPrice = Math.max(0, productPrice - discountAmount);

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            type="bottomSheet"
            closeButtonPosition="above"
            allowBackdropClose={true}
        >
            <View style={styles.container}>
                <View style={styles.headerGlow} />

                <View style={styles.badgeWrapper}>
                    <MegaDealBadge />
                </View>

                <View style={styles.priceSection}>
                    <Text style={styles.getAtText}>Get at </Text>
                    <View style={styles.priceWrapper}>
                        <Text style={styles.priceText}>₹{finalPrice}</Text>
                        <CurvedUnderline />
                    </View>
                    <View style={styles.greenBadge}>
                        <Text style={styles.greenBadgeText}>Extra ₹{discountAmount} Off</Text>
                    </View>
                </View>

                <Text style={styles.subtitle}>Combine coupons & offers to get maximum discount</Text>

                <View style={styles.couponCard}>
                    <View style={styles.couponCardHeader}>
                        <View style={styles.bankIconPlaceholder}>
                            <Ionicons name="card" size={14} color="#374151" />
                        </View>
                        <Text style={styles.couponTitle}>{coupon?.title || code}</Text>
                        <Text style={styles.discountText}>₹{discountAmount} off</Text>
                    </View>

                    <Text style={styles.couponDesc}>
                        {coupon?.description || `Get ₹${discountAmount} off on your order.`}
                    </Text>

                    <TouchableOpacity
                        style={styles.detailsToggle}
                        onPress={() => setDetailsExpanded(!detailsExpanded)}
                    >
                        <Text style={styles.detailsToggleText}>Details</Text>
                        <Ionicons
                            name={detailsExpanded ? "chevron-up" : "chevron-down"}
                            size={16}
                            color="#F43F5E"
                        />
                    </TouchableOpacity>

                    {detailsExpanded && conditions && conditions.length > 0 && (
                        <View style={styles.conditionsList}>
                            {conditions.map((cond: string, idx: number) => (
                                <Text key={idx} style={styles.conditionItem}>• {cond}</Text>
                            ))}
                        </View>
                    )}
                </View>



                <Text style={styles.footerText}>Final price may change based on the items in your bag.</Text>
            </View>
        </BaseModal>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 40,
        paddingHorizontal: 20,
        paddingBottom: 24,
        backgroundColor: '#FFFFFF',
        position: 'relative',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    headerGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: '#FFFBEB', // Light yellow glow behind badge
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        opacity: 0.5,
    },
    badgeWrapper: {
        position: 'absolute',
        top: -30,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    megaDealContainer: {
        backgroundColor: '#E11D48',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 4,
        transform: [{ rotate: '-4deg' }],
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        alignItems: 'center',
    },
    megaDealTextTop: {
        color: '#FFFFFF',
        fontFamily: Fonts.LexendBold,
        fontSize: 16,
        lineHeight: 18,
    },
    megaDealTextBottom: {
        color: '#FFFFFF',
        fontFamily: Fonts.LexendBold,
        fontSize: 18,
        lineHeight: 20,
    },
    priceSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    getAtText: {
        fontSize: 20,
        fontFamily: Fonts.LexendMedium,
        color: '#111827',
    },
    priceWrapper: {
        position: 'relative',
        marginHorizontal: 4,
    },
    priceText: {
        fontSize: 22,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
    },
    greenBadge: {
        backgroundColor: '#34D399',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginLeft: 8,
    },
    greenBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 13,
        fontFamily: Fonts.LexendRegular,
        color: '#4B5563',
        marginBottom: 20,
    },
    couponCard: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
    },
    couponCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    bankIconPlaceholder: {
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    couponTitle: {
        flex: 1,
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#111827',
    },
    discountText: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#10B981',
    },
    couponDesc: {
        fontSize: 13,
        fontFamily: Fonts.LexendRegular,
        color: '#4B5563',
        lineHeight: 18,
        marginBottom: 12,
    },
    detailsToggle: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailsToggleText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#F43F5E',
        marginRight: 4,
    },
    conditionsList: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    conditionItem: {
        fontSize: 12,
        fontFamily: Fonts.LexendRegular,
        color: '#6B7280',
        marginBottom: 4,
    },
    moreOffersCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ECFDF5', // Light green background
        borderRadius: 8,
        padding: 12,
        marginBottom: 20,
    },
    moreOffersLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    moreOffersText: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#111827',
        marginLeft: 8,
    },
    viewAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    viewAllText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#F43F5E',
        marginRight: 2,
    },
    footerLine: {
        height: 1,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#D1D5DB',
        marginHorizontal: 20,
        marginBottom: 16,
        borderRadius: 1,
    },
    footerText: {
        textAlign: 'center',
        fontSize: 12,
        fontFamily: Fonts.LexendRegular,
        color: '#6B7280',
    },
});
