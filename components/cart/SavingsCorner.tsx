import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { couponService, type CouponCode } from '@/services/couponService';
import { useCartItems, useCartStore } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export interface SavingsCornerCoupon {
    code?: string;
    value?: number;
    valueType?: 'percentage' | 'fixed';
    title?: string;
    [key: string]: unknown;
}

export interface SavingsCornerProps {
    itemSubtotal: number;
    isAuthenticated: boolean;
    hasTicketingProducts: boolean;
    hasFashionItems: boolean;
    kiddoCashEnabled: boolean;
    formatCurrency: (amount: number) => string;
    onLoginPress: () => void;
    onKiddoCashChange: (value: boolean) => void;
}

export function SavingsCorner({
    itemSubtotal,
    isAuthenticated,
    hasTicketingProducts,
    hasFashionItems,
    kiddoCashEnabled,
    formatCurrency,
    onLoginPress,
    onKiddoCashChange,
}: SavingsCornerProps) {
    const { user } = useAuth();
    const cartItems = useCartItems();
    const discountCodes = useCartStore(state => state.discountCodes);
    const discountAmount = useCartStore(state => state.discountAmount());
    const applyDiscountCode = useCartStore(state => state.applyDiscountCode);
    const removeDiscountCode = useCartStore(state => state.removeDiscountCode);

    const appliedDiscountCodes = useMemo(() => discountCodes.map(dc => dc.code), [discountCodes]);
    const appliedDiscountCode = appliedDiscountCodes[0] ?? null;

    const [showCouponsModal, setShowCouponsModal] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [manualCodeMessage, setManualCodeMessage] = useState<string | null>(null);
    const [availableCoupons, setAvailableCoupons] = useState<SavingsCornerCoupon[]>([]);
    const [loadingCoupons, setLoadingCoupons] = useState(false);
    const [couponApplying, setCouponApplying] = useState(false);
    const [selectedCouponForApply, setSelectedCouponForApply] = useState<SavingsCornerCoupon | null>(null);

    const applicableCoupons = useMemo(
        () => (availableCoupons ?? []).filter((c: any) => c.isVisible !== false),
        [availableCoupons]
    );

    useEffect(() => {
        if (!isAuthenticated) {
            setAvailableCoupons([]);
            return;
        }
        const fetchCoupons = async () => {
            setLoadingCoupons(true);
            try {
                const userStore = require('@/store/userStore').useUserStore.getState();
                const userId =
                    userStore.getCustomerId?.() ??
                    user?.customerId ??
                    user?.id ??
                    user?.email ??
                    user?.phone ??
                    null;
                const cartSubTotal = cartItems.reduce((sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity), 0);
                const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
                const eligibleCoupons = await couponService.getEligibleCouponsFromBackend({
                    userId,
                    cartSubTotal,
                    cartItemCount,
                    hasTicketing: hasTicketingProducts,
                    hasClothing: hasFashionItems,
                });
                const normalized: SavingsCornerCoupon[] = (eligibleCoupons ?? []).map((c: CouponCode) => ({
                    ...c,
                    value: typeof c.value === 'number' ? c.value : typeof c.value === 'string' ? parseFloat(c.value) || undefined : undefined,
                    valueType: (c.valueType === 'fixed_amount' ? 'fixed' : c.valueType) as 'percentage' | 'fixed' | undefined,
                }));
                setAvailableCoupons(normalized);
            } catch (error) {
                console.error('[SavingsCorner] Error fetching coupons:', error);
                setAvailableCoupons([]);
            } finally {
                setLoadingCoupons(false);
            }
        };
        fetchCoupons();
    }, [isAuthenticated, user?.id, user?.customerId, user?.email, user?.phone, cartItems, hasTicketingProducts, hasFashionItems]);

    const handleApplyCouponByCode = async (code: string): Promise<{ success: boolean; error?: string }> => {
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) return { success: false, error: 'Enter a coupon code' };
        if (appliedDiscountCodes?.includes(trimmed)) {
            return { success: false, error: `${trimmed} is already applied.` };
        }
        setCouponApplying(true);
        setManualCodeMessage(null);
        try {
            const result = await applyDiscountCode(trimmed, { preloadedCoupons: availableCoupons });
            if (result.success) {
                return { success: true };
            }
            return { success: false, error: result.error ?? 'Failed to apply coupon' };
        } catch (error: any) {
            return { success: false, error: error.message ?? 'Failed to apply coupon' };
        } finally {
            setCouponApplying(false);
        }
    };

    const handleApplyCouponFromList = async (coupon: SavingsCornerCoupon) => {
        const code = coupon.code?.toUpperCase();
        if (!code) return;
        if (appliedDiscountCodes?.includes(code)) {
            setManualCodeMessage(`${code} is already applied.`);
            return;
        }
        setCouponApplying(true);
        setManualCodeMessage(null);
        try {
            const result = await applyDiscountCode(code, { preloadedCoupons: availableCoupons });
            if (result.success) {
                setSelectedCouponForApply(null);
            } else {
                setManualCodeMessage(result.error ?? 'Failed to apply coupon');
            }
        } catch (error: any) {
            setManualCodeMessage(error.message ?? 'Failed to apply coupon');
        } finally {
            setCouponApplying(false);
        }
    };

    const handleRemoveCoupon = async (code: string) => {
        try {
            await removeDiscountCode(code);
            setSelectedCouponForApply(null);
        } catch (error: any) {
            setManualCodeMessage(error.message ?? 'Failed to remove coupon');
        }
    };

    const hasAppliedCoupon = (appliedDiscountCodes?.length ?? 0) > 0;

    const handleApplyManualCode = async () => {
        const code = manualCode.trim().toUpperCase();
        if (!code) return;
        setManualCodeMessage(null);
        try {
            const result = await handleApplyCouponByCode(code);
            if (result.success) {
                setManualCode('');
                setShowCouponsModal(false);
            } else {
                setManualCodeMessage(result.error ?? 'Failed to apply coupon');
            }
        } catch {
            setManualCodeMessage('Failed to apply coupon');
        }
    };

    const closeModal = () => {
        setShowCouponsModal(false);
        setManualCodeMessage(null);
    };

    const mainText = hasAppliedCoupon
        ? `Saving ${formatCurrency(discountAmount)}! ${appliedDiscountCode ?? ''} Applied`
        : selectedCouponForApply
            ? `Save ${formatCurrency(
                selectedCouponForApply.valueType === 'percentage'
                    ? Math.round((itemSubtotal * (selectedCouponForApply.value || 0)) / 100)
                    : (selectedCouponForApply.value || 0)
            )} with ${selectedCouponForApply.code}`
            : applicableCoupons.length > 0
                ? 'Select a coupon'
                : 'Add a coupon';

    return (
        <>
            <Text style={styles.title}>Savings Corner</Text>
            <View style={styles.section}>
                <View style={[styles.row, hasAppliedCoupon && styles.rowApplied]}>
                    <View style={styles.left}>
                        <View style={styles.iconBlue}>
                            <Text style={styles.iconPercent}>%</Text>
                        </View>
                        <View style={styles.textWrap}>
                            <Text
                                style={[styles.mainText, hasAppliedCoupon && styles.mainTextApplied]}
                                numberOfLines={1}
                            >
                                {mainText}
                            </Text>
                            <TouchableOpacity onPress={() => setShowCouponsModal(true)} activeOpacity={0.7}>
                                <Text style={styles.viewAll}>View all coupons</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    {hasAppliedCoupon ? (
                        <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => {
                                if (appliedDiscountCode) {
                                    handleRemoveCoupon(appliedDiscountCode);
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.removeText}>Remove</Text>
                        </TouchableOpacity>
                    ) : isAuthenticated ? (
                        <TouchableOpacity
                            style={[
                                styles.applyBtn,
                                (couponApplying || !selectedCouponForApply) && styles.applyBtnDisabled,
                            ]}
                            onPress={() => {
                                if (selectedCouponForApply) handleApplyCouponFromList(selectedCouponForApply);
                            }}
                            disabled={couponApplying || !selectedCouponForApply}
                            activeOpacity={0.8}
                        >
                            {couponApplying ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.applyText}>Apply</Text>
                            )}
                        </TouchableOpacity>
                    ) : null}
                </View>
                {/* <View style={styles.kiddoCashRow}>
                <View style={styles.kiddoCashIconWrap}>
                    <Ionicons name="cash-outline" size={20} color="#5B21B6" />
                </View>
                <View style={styles.kiddoCashTextWrap}>
                    <Text style={styles.kiddoCashTitle}>Use Kiddo Cash</Text>
                    <Text style={styles.kiddoCashSub}>₹250 available</Text>
                </View>
                <Switch
                    value={kiddoCashEnabled}
                    onValueChange={onKiddoCashChange}
                    trackColor={{ false: '#E5E7EB', true: '#5B21B6' }}
                    thumbColor={kiddoCashEnabled ? '#FFFFFF' : '#f4f3f4'}
                />
            </View>
            <View style={styles.kiddoCoinsBar}>
                <Text style={styles.kiddoCoinsBarText}>You will earn 20 Kiddo Coins with this order</Text>
            </View> */}
            </View>

            {/* Available coupons modal with manual code entry */}
            <Modal
                visible={showCouponsModal}
                animationType="slide"
                transparent
                onRequestClose={closeModal}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={closeModal}
                >
                    <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Available coupons</Text>
                            <TouchableOpacity onPress={closeModal} hitSlop={12}>
                                <Ionicons name="close" size={24} color="#1A1A1A" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                            {!isAuthenticated ? (
                                <View style={styles.loginPrompt}>
                                    <Text style={styles.loginPromptText}>Please login to view and apply coupons.</Text>
                                    <TouchableOpacity
                                        style={styles.loginButton}
                                        onPress={() => {
                                            closeModal();
                                            onLoginPress();
                                        }}
                                    >
                                        <Text style={styles.loginButtonText}>Login</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <>
                                    {/* Manual coupon code entry */}
                                    <View style={styles.manualCodeSection}>
                                        <Text style={styles.manualCodeLabel}>Have a coupon code?</Text>
                                        <View style={styles.couponInputRow}>
                                            <View style={styles.couponInputWrapper}>
                                                <Ionicons name="pricetag-outline" size={18} color="#999" style={styles.couponInputIcon} />
                                                <TextInput
                                                    style={styles.couponInput}
                                                    placeholder="Enter code"
                                                    placeholderTextColor="#999"
                                                    value={manualCode}
                                                    onChangeText={(t) => {
                                                        setManualCode(t.toUpperCase());
                                                        setManualCodeMessage(null);
                                                    }}
                                                    editable={!couponApplying}
                                                    autoCapitalize="characters"
                                                    autoCorrect={false}
                                                />
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.applyCodeBtn,
                                                    (!manualCode.trim() || couponApplying) && styles.applyCodeBtnDisabled,
                                                ]}
                                                onPress={handleApplyManualCode}
                                                disabled={!manualCode.trim() || couponApplying}
                                                activeOpacity={0.8}
                                            >
                                                {couponApplying ? (
                                                    <ActivityIndicator size="small" color="#fff" />
                                                ) : (
                                                    <Text style={styles.applyCodeBtnText}>Apply</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                        {manualCodeMessage != null && (
                                            <Text style={styles.manualCodeMessage}>{manualCodeMessage}</Text>
                                        )}
                                    </View>

                                    <View style={styles.availableDivider} />
                                    <Text style={styles.availableTitle}>Or choose from available coupons</Text>

                                    {loadingCoupons ? (
                                        <ActivityIndicator size="small" color={Colors.primary} style={styles.couponsLoading} />
                                    ) : applicableCoupons.length === 0 ? (
                                        <Text style={styles.noCouponsText}>No coupons available</Text>
                                    ) : (
                                        applicableCoupons.map((coupon) => {
                                            const conditions = coupon.code
                                                ? couponService.getCouponConditionsText({
                                                      ...coupon,
                                                      code: coupon.code,
                                                      valueType: coupon.valueType === 'fixed' ? 'fixed_amount' : coupon.valueType,
                                                  } as CouponCode)
                                                : [];
                                            const isSelected = selectedCouponForApply?.code === coupon.code;
                                            return (
                                                <TouchableOpacity
                                                    key={coupon.code}
                                                    style={[
                                                        styles.couponCard,
                                                        isSelected && styles.couponCardSelected,
                                                        couponApplying && styles.couponCardDisabled,
                                                    ]}
                                                    onPress={() => {
                                                        if (couponApplying) return;
                                                        setSelectedCouponForApply(coupon);
                                                        closeModal();
                                                    }}
                                                    disabled={couponApplying}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.couponCardContent}>
                                                        <View style={styles.couponCodeRow}>
                                                            <Text style={styles.couponCardCode}>{coupon.code}</Text>
                                                            {coupon.value != null && coupon.value !== 0 && (
                                                                <View style={styles.discountBadge}>
                                                                    <Text style={styles.discountBadgeText}>
                                                                        {coupon.valueType === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        {coupon.title && (
                                                            <Text style={styles.couponCardTitle} numberOfLines={1}>
                                                                {coupon.title}
                                                            </Text>
                                                        )}
                                                        {conditions.length > 0 && (
                                                            <View style={styles.couponConditionsContainer}>
                                                                {conditions.slice(0, 2).map((c, i) => (
                                                                    <Text key={i} style={styles.couponConditionText}>
                                                                        {c}
                                                                    </Text>
                                                                ))}
                                                            </View>
                                                        )}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    title: {
        fontSize: 16,
        color: '#717680',
        fontFamily: Fonts.Bold,
        marginBottom: 14,
        marginTop: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // marginBottom: 12,
    },
    rowApplied: {
        // borderWidth: 1,
        // borderColor: '#1E88E5',
        // borderRadius: 8,
        // padding: 12,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconBlue: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E3F2FD',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    iconPercent: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#1E88E5',
    },
    textWrap: {
        flex: 1,
    },
    mainText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#2D2D2D',
    },
    mainTextApplied: {
        color: '#1E88E5',
        fontFamily: Fonts.Bold,
    },
    viewAll: {
        fontSize: 12,
        color: '#1E88E5',
        fontFamily: Fonts.Regular,
        textDecorationLine: 'underline',
        marginTop: 2,
    },
    applyBtn: {
        // backgroundColor: '#C41E3A',
        paddingVertical: 8,
        paddingHorizontal: 20,
        minWidth: 72,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    applyBtnDisabled: {
        opacity: 0.7,
    },
    applyText: {
        fontSize: 14,
        color: '#C41E3A',
        fontFamily: Fonts.SemiBold,
    },
    removeBtn: {
        backgroundColor: '#E8ECF0',
        paddingVertical: 8,
        paddingHorizontal: 20,
        minWidth: 72,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    removeText: {
        fontSize: 14,
        color: '#1E88E5',
        fontFamily: Fonts.SemiBold,
    },
    kiddoCashRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    kiddoCashIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F5F3FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    kiddoCashTextWrap: {
        flex: 1,
    },
    kiddoCashTitle: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
    },
    kiddoCashSub: {
        fontSize: 12,
        color: '#9CA3AF',
        fontFamily: Fonts.Regular,
        marginTop: 2,
    },
    kiddoCoinsBar: {
        backgroundColor: '#EDE9FE',
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    kiddoCoinsBarText: {
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
        color: '#6D28D9',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        paddingBottom: 34,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    modalScroll: {
        maxHeight: 400,
        padding: 16,
    },
    loginPrompt: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    loginPromptText: {
        fontSize: 13,
        color: '#666',
        fontFamily: Fonts.Medium,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 12,
    },
    loginButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
        letterSpacing: 0.3,
    },
    manualCodeSection: {
        marginBottom: 16,
    },
    manualCodeLabel: {
        fontSize: 13,
        color: '#666',
        fontFamily: Fonts.Medium,
        marginBottom: 8,
    },
    couponInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    couponInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 8,
        backgroundColor: '#fafafa',
    },
    couponInputIcon: {
        marginLeft: 12,
        marginRight: 8,
    },
    couponInput: {
        flex: 1,
        height: 44,
        fontSize: 13,
        fontFamily: Fonts.Medium,
        color: '#000',
        letterSpacing: 0.5,
        paddingHorizontal: 8,
    },
    applyCodeBtn: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyCodeBtnDisabled: {
        opacity: 0.5,
    },
    applyCodeBtnText: {
        color: '#fff',
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
    },
    manualCodeMessage: {
        fontSize: 12,
        color: '#ff4444',
        fontFamily: Fonts.Regular,
        marginTop: 8,
    },
    availableDivider: {
        height: 1,
        backgroundColor: '#f0f0f0',
        marginVertical: 12,
    },
    availableTitle: {
        fontSize: 13,
        color: '#666',
        fontFamily: Fonts.Medium,
        marginBottom: 10,
    },
    couponsLoading: {
        marginVertical: 24,
    },
    noCouponsText: {
        fontSize: 13,
        color: '#999',
        fontFamily: Fonts.Regular,
        paddingVertical: 12,
    },
    couponCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    couponCardSelected: {
        borderColor: Colors.primary,
        borderWidth: 1.5,
    },
    couponCardDisabled: {
        opacity: 0.6,
    },
    couponCardContent: {
        position: 'relative',
    },
    couponCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
        gap: 6,
    },
    couponCardCode: {
        fontSize: 13,
        color: '#000',
        fontFamily: Fonts.Bold,
        letterSpacing: 0.3,
        flex: 1,
    },
    discountBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    discountBadgeText: {
        fontSize: 10,
        color: '#fff',
        fontFamily: Fonts.Bold,
    },
    couponCardTitle: {
        fontSize: 10,
        color: '#888',
        fontFamily: Fonts.Regular,
        lineHeight: 14,
        marginTop: 2,
    },
    couponConditionsContainer: {
        marginTop: 6,
        gap: 4,
    },
    couponConditionText: {
        fontSize: 9,
        color: '#666',
        fontFamily: Fonts.Regular,
        lineHeight: 12,
    },
});
