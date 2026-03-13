import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { couponService, type CouponCode } from '@/services/couponService';
import { useCartItems, useCartStore } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
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
            if (__DEV__) console.log('[SavingsCorner] Skipping coupon fetch: user not authenticated');
            return;
        }
        const fetchCoupons = async () => {
            setLoadingCoupons(true);
            try {
                const cartSubTotal = cartItems.reduce((sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity), 0);
                const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
                const cartCategories = [...new Set((cartItems.flatMap((item) => (item.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))))];
                const eligibleCoupons = await couponService.getEligibleCouponsFromBackend({
                    phone: user?.phone ?? null,
                    cartSubTotal,
                    cartItemCount,
                    hasTicketing: hasTicketingProducts,
                    hasClothing: hasFashionItems,
                    cartCategories: cartCategories.length > 0 ? cartCategories : undefined,
                    appVersion: Constants.expoConfig?.version ?? '',
                    deviceType: Platform.OS ?? '',
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
        ? `Save ${formatCurrency(discountAmount)} with ${appliedDiscountCode ?? ''} `
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
        <View style={styles.wrapper}>

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.title}>Savings Corner</Text>
                </View>
                <View style={[styles.row, hasAppliedCoupon && styles.rowApplied]}>
                    <View style={styles.left}>
                        <View style={styles.iconWrap}>
                            <Image source={require('@/assets/icons/coupon.png')} style={styles.iconPercentImage} resizeMode="contain" />
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
                animationType="fade"
                transparent
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={closeModal}
                    />
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalKeyboardAvoid}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                    >
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <View style={styles.modalHeaderLeft}>
                                    <View style={styles.modalHeaderIconWrap}>
                                        <Image source={require('@/assets/icons/coupon.png')} style={styles.modalHeaderIconImage} resizeMode="contain" />
                                    </View>
                                    <Text style={styles.modalTitle}>Coupons</Text>
                                </View>
                                <TouchableOpacity onPress={closeModal} hitSlop={12}>
                                    <Ionicons name="close" size={24} color="#1A1A1A" />
                                </TouchableOpacity>
                            </View>
                            {/* Fixed input section - not inside ScrollView so it does not scroll */}
                            {isAuthenticated && (
                                <View style={styles.manualCodeSection}>
                                    <Text style={styles.manualCodeLabel}>Enter coupon code</Text>
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
                                                scrollEnabled={false}
                                                multiline={false}
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
                            )}
                            <ScrollView
                                style={styles.modalScroll}
                                contentContainerStyle={styles.modalScrollContent}
                                showsVerticalScrollIndicator={true}
                                keyboardShouldPersistTaps="handled"
                                keyboardDismissMode="on-drag"
                            >
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
                                        <View style={styles.availableDivider} />
                                        <Text style={styles.availableTitle}>Or choose from available coupons</Text>

                                        {loadingCoupons ? (
                                            <ActivityIndicator size="small" color={Colors.primary} style={styles.couponsLoading} />
                                        ) : applicableCoupons.length === 0 ? (
                                            <Text style={styles.noCouponsText}>No coupons available</Text>
                                        ) : (
                                            applicableCoupons.map((coupon, index) => {
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
                                                return (
                                                    <View
                                                        key={coupon.code || `coupon-${coupon.title ?? index}`}
                                                        style={[
                                                            styles.couponCard,
                                                            couponApplying && styles.couponCardDisabled,
                                                        ]}
                                                    >
                                                        <View style={styles.couponCardIconWrap}>
                                                            <Ionicons name="pricetag" size={20} color="#fff" />
                                                        </View>
                                                        <View style={styles.couponCardMain}>
                                                            <Text style={styles.couponCardOfferTitle} numberOfLines={2}>
                                                                {offerTitle}
                                                            </Text>
                                                            {coupon.code && (
                                                                <Text style={styles.couponCardUseCode}>Use code {coupon.code}</Text>
                                                            )}
                                                            {conditions.length > 0 && (
                                                                <View style={styles.couponConditionsContainer}>
                                                                    {conditions.slice(0, 2).map((c, i) => (
                                                                        <Text key={i} style={styles.couponConditionText}>
                                                                            • {c}
                                                                        </Text>
                                                                    ))}
                                                                </View>
                                                            )}
                                                        </View>
                                                        <TouchableOpacity
                                                            style={[styles.couponCardApplyBtn, couponApplying && styles.couponCardApplyDisabled]}
                                                            onPress={() => {
                                                                if (couponApplying) return;
                                                                handleApplyCouponFromList(coupon);
                                                                closeModal();
                                                            }}
                                                            disabled={couponApplying}
                                                            activeOpacity={0.8}
                                                        >
                                                            <Text style={styles.couponCardApplyText}>Apply</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            })
                                        )}
                                    </>
                                )}
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 16,
        paddingVertical: 12,
        borderRadius: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        marginTop: 12,
    },
    titleIcon: {
        marginRight: 0,
    },
    title: {
        fontSize: Fonts.SmallFontSize,
        color: '#717680',
        fontFamily: Fonts.LexendBold,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        paddingBottom: 12,
        marginBottom: 0,
        
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
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
    iconPercentImage: {
        width: 22,
        height: 22,
    },
    textWrap: {
        flex: 1,
    },
    mainText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#181D27',
    },
    mainTextApplied: {
        color: '#181D27',
        fontFamily: Fonts.LexendBold,
        fontSize: Fonts.SmallFontSize,
    },
    viewAll: {
        fontSize: Fonts.ExtraSmallFontSize,
        color: '#6B7280',
        fontFamily: Fonts.LexendMedium,
        textDecorationLine: 'underline',
        marginTop: 2,
    },
    applyBtn: {
        // backgroundColor: '#C41E3A',
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        color: '#F15E5E',
        fontFamily: Fonts.SemiBold,
    },
    applyBtnDisabled: {
        opacity: 0.5,
    },
    applyText: {
        fontSize: Fonts.SmallFontSize,
        color: '#F15E5E',
        fontFamily: Fonts.LexendBold,
    },
    removeBtn: {
        paddingVertical: 8,
        minWidth: 72,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    removeText: {
        fontSize: 14,
        color: Colors.primary,
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
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalKeyboardAvoid: {
        width: '100%',
        maxWidth: 400,
        height: '80%',
        maxHeight: '80%',
    },
    modalContent: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingBottom: 24,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
    },
    modalHeaderIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EFF8FF',

        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    modalHeaderIconImage: {
        width: 20,
        height: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    modalScroll: {
        flex: 1,
        minHeight: 0,
        paddingHorizontal: 16,
    },
    modalScrollContent: {
        paddingTop: 16,
        paddingBottom: 24,
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
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
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
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
    },
    couponCardDisabled: {
        opacity: 0.6,
    },
    couponCardIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: '#6B7280',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    couponCardMain: {
        flex: 1,
        minWidth: 0,
    },
    couponCardOfferTitle: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
        marginBottom: 4,
    },
    couponCardUseCode: {
        fontSize: 12,
        color: '#666',
        fontFamily: Fonts.SemiBold,
        marginBottom: 6,
    },
    couponConditionsContainer: {
        gap: 2,
        marginBottom: 6,
    },
    couponConditionText: {
        fontSize: 11,
        color: '#666',
        fontFamily: Fonts.Regular,
        lineHeight: 14,
    },
    couponReadMore: {
        fontSize: 12,
        color: '#2563EB',
        fontFamily: Fonts.Regular,
        textDecorationLine: 'underline',
    },
    couponCardApplyBtn: {
        justifyContent: 'center',
        paddingVertical: 8,
        paddingLeft: 12,
    },
    couponCardApplyDisabled: {
        opacity: 0.5,
    },
    couponCardApplyText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
});
