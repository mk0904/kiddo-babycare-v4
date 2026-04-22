import { Colors, Fonts } from '@/constants/theme';
import { getAppVersionForApi } from '@/constants/versionConfig';
import { useAuth } from '@/context/AuthContext';
import { appConfigService } from '@/services/appConfigService';
import { couponService, type CouponCode } from '@/services/couponService';
import { useCartItems, useCartStore } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
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

import { SavingsCornerCouponCarousel, type SavingsCornerCouponItem } from './SavingsCornerCouponCarousel';
import { SchoolCouponModal } from '../modals/SchoolCouponModal';

export type SavingsCornerCoupon = SavingsCornerCouponItem;

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
    const [couponUsages, setCouponUsages] = useState<Record<string, number>>({});
    const [lastApplyError, setLastApplyError] = useState<string | null>(null);
    const [showSchoolModal, setShowSchoolModal] = useState(false);

    const cartSubtotal = useMemo(
        () => cartItems.reduce((sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity), 0),
        [cartItems]
    );
    const cartItemCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems]);
    const categorySubtotals = useMemo(() => {
        const out: Record<string, number> = {};
        for (const item of cartItems) {
            const amount = Number(item.price ?? 0) * Number(item.quantity ?? 1);
            const tags = (item.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
            for (const tag of tags) out[tag] = (out[tag] ?? 0) + amount;
        }
        return out;
    }, [cartItems]);
    const userOrderCount = (user as { numberOfOrders?: number })?.numberOfOrders ?? 0;

    // Show only coupons with isVisible true (eligible and ineligible among those, each with applicability reason)
    const displayCoupons = useMemo(
        () => (availableCoupons ?? []).filter((c: any) => c.isVisible === true),
        [availableCoupons]
    );

    // Sort: eligible (applicable) first, then non-eligible
    const sortedDisplayCoupons = useMemo(() => {
        return [...displayCoupons].sort((a, b) => {
            const appA = a.code
                ? couponService.getCouponApplicabilityForDisplay(
                    { ...a, code: a.code, valueType: a.valueType === 'fixed' ? 'fixed_amount' : a.valueType } as CouponCode,
                    {
                        hasTicketingProducts: hasTicketingProducts,
                        hasFashionItems: hasFashionItems,
                        cartSubtotal,
                        cartItemCount,
                        userOrderCount,
                        couponUsageCount: couponUsages[a.code?.toUpperCase() ?? ''] ?? 0,
                        categorySubtotals,
                        lineItems: cartItems,
                    }
                ).applicable
                : true;
            const appB = b.code
                ? couponService.getCouponApplicabilityForDisplay(
                    { ...b, code: b.code, valueType: b.valueType === 'fixed' ? 'fixed_amount' : b.valueType } as CouponCode,
                    {
                        hasTicketingProducts: hasTicketingProducts,
                        hasFashionItems: hasFashionItems,
                        cartSubtotal,
                        cartItemCount,
                        userOrderCount,
                        couponUsageCount: couponUsages[b.code?.toUpperCase() ?? ''] ?? 0,
                        categorySubtotals,
                        lineItems: cartItems,
                    }
                ).applicable
                : true;
            return (appA ? 0 : 1) - (appB ? 0 : 1);
        });
    }, [
        displayCoupons,
        hasTicketingProducts,
        hasFashionItems,
        cartSubtotal,
        cartItemCount,
        userOrderCount,
        couponUsages,
        categorySubtotals,
        cartItems,
    ]);

    useEffect(() => {
        if (!isAuthenticated || displayCoupons.length === 0) {
            setCouponUsages({});
            return;
        }
        const codes = displayCoupons.map((c) => c.code).filter(Boolean) as string[];
        const userId = user?.id ?? user?.customerId ?? user?.phone ?? null;
        couponService.getCouponUsagesForUser(codes, userId).then(setCouponUsages);
    }, [isAuthenticated, user?.id, user?.customerId, user?.phone, displayCoupons]);

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
                const categorySubtotalsForFetch: Record<string, number> = {};
                for (const item of cartItems) {
                    const amount = Number(item.price ?? 0) * Number(item.quantity ?? 1);
                    const tags = (item.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean);
                    for (const tag of tags) categorySubtotalsForFetch[tag] = (categorySubtotalsForFetch[tag] ?? 0) + amount;
                }
                const visibleCoupons = await couponService.getVisibleCouponsFromBackend({
                    phone: user?.phone ?? null,
                    cartSubTotal,
                    cartItemCount,
                    hasTicketing: hasTicketingProducts,
                    hasClothing: hasFashionItems,
                    cartCategories: cartCategories.length > 0 ? cartCategories : undefined,
                    categorySubtotals: Object.keys(categorySubtotalsForFetch).length > 0 ? categorySubtotalsForFetch : undefined,
                    appVersion: getAppVersionForApi(),
                    deviceType: Platform.OS ?? '',
                });
                const normalized: SavingsCornerCoupon[] = (visibleCoupons ?? []).map((c: CouponCode) => ({
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

    const handleApplyCouponByCode = async (
        code: string,
        options?: { surfaceCardError?: boolean },
    ): Promise<{ success: boolean; error?: string }> => {
        const surfaceCardError = options?.surfaceCardError !== false;
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) return { success: false, error: 'Enter a coupon code' };
        if (appliedDiscountCodes?.includes(trimmed)) {
            return { success: false, error: `${trimmed} is already applied.` };
        }
        setCouponApplying(true);
        setManualCodeMessage(null);
        setLastApplyError(null);
        try {
            const result = await applyDiscountCode(trimmed, { preloadedCoupons: availableCoupons });
            if (result.success) {
                // Check if the applied coupon is a school coupon
                const applied = useCartStore.getState().discountCodes.find(dc => dc.code.toUpperCase() === trimmed);
                if (applied?.isSchoolCoupon) {
                    setShowSchoolModal(true);
                }
                return { success: true };
            }
            const err = result.error ?? 'Failed to apply coupon';
            if (surfaceCardError) setLastApplyError(err);
            return { success: false, error: err };
        } catch (error: any) {
            const err = error.message ?? 'Failed to apply coupon';
            if (surfaceCardError) setLastApplyError(err);
            return { success: false, error: err };
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
        setLastApplyError(null);
        try {
            const result = await applyDiscountCode(code, { preloadedCoupons: availableCoupons });
            if (!result.success) {
                const err = result.error ?? 'Failed to apply coupon';
                setManualCodeMessage(err);
                setLastApplyError(err);
            } else {
                // Check if the applied coupon is a school coupon
                if (coupon.isSchoolCoupon) {
                    setShowSchoolModal(true);
                }
            }
        } catch (error: any) {
            const err = error.message ?? 'Failed to apply coupon';
            setManualCodeMessage(err);
            setLastApplyError(err);
        } finally {
            setCouponApplying(false);
        }
    };

    const handleRemoveCoupon = async (code: string) => {
        try {
            await removeDiscountCode(code);
        } catch (error: any) {
            setManualCodeMessage(error.message ?? 'Failed to remove coupon');
        }
    };

    const hasAppliedCoupon = (appliedDiscountCodes?.length ?? 0) > 0;

    const handleApplyManualCode = async (closeModalOnSuccess = true) => {
        const code = manualCode.trim().toUpperCase();
        if (!code) return;
        setManualCodeMessage(null);
        try {
            const result = await handleApplyCouponByCode(code, {
                surfaceCardError: closeModalOnSuccess,
            });
            if (result.success) {
                setManualCode('');
                if (closeModalOnSuccess) setShowCouponsModal(false);
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
        setLastApplyError(null);
    };

    const isHeyKiddoApplied = (appliedDiscountCode ?? '').toUpperCase() === 'HEYKIDDO';
    const heyKiddoOriginalPrice = useMemo(() => {
        if (!isHeyKiddoApplied) return undefined;
        const fromCode = discountCodes.find((dc) => dc.code.toUpperCase() === 'HEYKIDDO')?.originalPrice;
        if (fromCode != null && Number.isFinite(fromCode)) return fromCode;
        const config = appConfigService.getCartConfig()?.freeShoesOffer ?? appConfigService.getFreeShoesOfferConfig();
        const raw = (config as any)?.originalPrice ?? (config as any)?.original_price;
        const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
        return Number.isFinite(num) && num >= 0 ? num : undefined;
    }, [isHeyKiddoApplied, discountCodes]);
    const appliedSaveAmount = isHeyKiddoApplied && heyKiddoOriginalPrice != null ? heyKiddoOriginalPrice : discountAmount;
    const appliedHeadline = hasAppliedCoupon
        ? `Save ${formatCurrency(appliedSaveAmount)} with ${appliedDiscountCode ?? ''}`
        : '';

    const canSubmitInlineCode = isAuthenticated && !!manualCode.trim() && !couponApplying;

    return (
        <View style={styles.wrapper}>
            <SchoolCouponModal 
                visible={showSchoolModal} 
                onClose={() => setShowSchoolModal(false)} 
            />

            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.title}>Savings Corner</Text>
                </View>

                {/* Apply Coupon — layout aligned with design: header row + pill input */}
                <View style={styles.applyCouponBlock}>
                    {hasAppliedCoupon ? (
                        <>
                            <View style={styles.applyCouponHeaderRow}>
                                <View style={styles.applyCouponHeaderLeft}>
                                    <Image
                                        source={require('@/assets/icons/coupon.png')}
                                        style={styles.applyCouponHeaderIcon}
                                        resizeMode="contain"
                                    />
                                    <View style={styles.applyCouponHeaderTextCol}>
                                        <Text style={styles.applyCouponSectionTitle} numberOfLines={1}>
                                            {(appliedDiscountCode ?? 'APPLIED').toUpperCase()}
                                        </Text>
                                        <Text style={styles.applyCouponAppliedSub} numberOfLines={2}>
                                            You saved {formatCurrency(appliedSaveAmount)} on this order
                                        </Text>
                                        {lastApplyError ? (
                                            <Text style={styles.cardErrorText} numberOfLines={2}>
                                                {lastApplyError}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                                <View style={styles.applyCouponAppliedTag}>
                                    <Ionicons name="checkmark" size={18} color={Colors.primary} />
                                    <Text style={styles.applyCouponAppliedTagText}>Applied</Text>
                                </View>
                            </View>

                            <View style={styles.applyCouponPill}>
                                <TextInput
                                    style={styles.applyCouponPillInput}
                                    placeholder="Enter Coupon Code"
                                    placeholderTextColor="#9CA3AF"
                                    value={manualCode}
                                    onChangeText={(t) => {
                                        setManualCode(t.toUpperCase());
                                        setManualCodeMessage(null);
                                        setLastApplyError(null);
                                    }}
                                    editable={!couponApplying}
                                    autoCapitalize="characters"
                                    autoCorrect={false}
                                    scrollEnabled={false}
                                    multiline={false}
                                    returnKeyType="done"
                                    onSubmitEditing={() => void handleApplyManualCode(false)}
                                />
                                <TouchableOpacity
                                    onPress={() => void handleApplyManualCode(false)}
                                    disabled={!canSubmitInlineCode}
                                    activeOpacity={0.6}
                                    style={styles.applyCouponPillApplyHit}
                                    hitSlop={{ top: 12, bottom: 12, left: 8, right: 4 }}
                                >
                                    {couponApplying ? (
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                    ) : (
                                        <Text
                                            style={[
                                                styles.applyCouponPillApplyText,
                                                canSubmitInlineCode && styles.applyCouponPillApplyTextActive,
                                            ]}
                                        >
                                            APPLY
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {manualCodeMessage != null ? (
                                <Text style={styles.manualCodeMessage}>{manualCodeMessage}</Text>
                            ) : null}
                        </>
                    ) : (
                        <>
                            <View style={styles.applyCouponHeaderRow}>
                                <View style={styles.applyCouponHeaderLeft}>
                                    <Image
                                        source={require('@/assets/icons/coupon.png')}
                                        style={styles.applyCouponHeaderIcon}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.applyCouponSectionTitle}>Apply Coupon</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setShowCouponsModal(true)}
                                    activeOpacity={0.7}
                                    disabled={couponApplying}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={[styles.applyCouponViewAll, couponApplying && styles.viewAllDisabled]}>
                                        View All
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {lastApplyError ? (
                                <Text style={[styles.cardErrorText, styles.applyCouponErrorAbovePill]} numberOfLines={2}>
                                    {lastApplyError}
                                </Text>
                            ) : null}

                            {isAuthenticated ? (
                                <View style={styles.applyCouponPill}>
                                    <TextInput
                                        style={styles.applyCouponPillInput}
                                        placeholder="Enter Coupon Code"
                                        placeholderTextColor="#9CA3AF"
                                        value={manualCode}
                                        onChangeText={(t) => {
                                            setManualCode(t.toUpperCase());
                                            setManualCodeMessage(null);
                                            setLastApplyError(null);
                                        }}
                                        editable={!couponApplying}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        scrollEnabled={false}
                                        multiline={false}
                                        returnKeyType="done"
                                        onSubmitEditing={() => void handleApplyManualCode(false)}
                                    />
                                    <TouchableOpacity
                                        onPress={() => void handleApplyManualCode(false)}
                                        disabled={!canSubmitInlineCode}
                                        activeOpacity={0.6}
                                        style={styles.applyCouponPillApplyHit}
                                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 4 }}
                                    >
                                        {couponApplying ? (
                                            <ActivityIndicator size="small" color={Colors.primary} />
                                        ) : (
                                            <Text
                                                style={[
                                                    styles.applyCouponPillApplyText,
                                                    canSubmitInlineCode && styles.applyCouponPillApplyTextActive,
                                                ]}
                                            >
                                                APPLY
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.applyCouponPill}
                                    onPress={onLoginPress}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.applyCouponPillPlaceholder}>Enter Coupon Code</Text>
                                    <Text style={styles.applyCouponPillApplyText}>APPLY</Text>
                                </TouchableOpacity>
                            )}

                            {manualCodeMessage != null ? (
                                <Text style={styles.manualCodeMessage}>{manualCodeMessage}</Text>
                            ) : null}

                        </>
                    )}

                    <SavingsCornerCouponCarousel
                        visible={isAuthenticated}
                        loading={loadingCoupons}
                        coupons={sortedDisplayCoupons}
                        couponApplying={couponApplying}
                        hasTicketingProducts={hasTicketingProducts}
                        hasFashionItems={hasFashionItems}
                        cartSubtotal={cartSubtotal}
                        cartItemCount={cartItemCount}
                        userOrderCount={userOrderCount}
                        couponUsages={couponUsages}
                        categorySubtotals={categorySubtotals}
                        lineItems={cartItems}
                        appliedCouponCode={appliedDiscountCode}
                        onApplyCoupon={(c) => void handleApplyCouponFromList(c)}
                    />
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
                                            onPress={() => void handleApplyManualCode(true)}
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
                                        ) : displayCoupons.length === 0 ? (
                                            <Text style={styles.noCouponsText}>No coupons available</Text>
                                        ) : (
                                            sortedDisplayCoupons.map((coupon, index) => {
                                                const applicability = coupon.code
                                                    ? couponService.getCouponApplicabilityForDisplay(
                                                        { ...coupon, code: coupon.code, valueType: coupon.valueType === 'fixed' ? 'fixed_amount' : coupon.valueType } as CouponCode,
                                                        {
                                                            hasTicketingProducts: hasTicketingProducts,
                                                            hasFashionItems: hasFashionItems,
                                                            cartSubtotal,
                                                            cartItemCount,
                                                            userOrderCount,
                                                            couponUsageCount: couponUsages[coupon.code?.toUpperCase() ?? ''] ?? 0,
                                                            categorySubtotals,
                                                            lineItems: cartItems,
                                                        }
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
                                                return (
                                                    <View
                                                        key={coupon.code || `coupon-${coupon.title ?? index}`}
                                                        style={[
                                                            styles.couponCard,
                                                            (couponApplying || isDisabled) && styles.couponCardDisabled,
                                                        ]}
                                                    >
                                                        <View style={styles.couponCardRow}>
                                                            <View style={[styles.couponCardIconWrap, isDisabled && styles.couponCardIconWrapDisabled]}>
                                                                {/* <Ionicons name="pricetag" size={20} color="#fff" /> */}
                                                                <Image source={require('@/assets/images/coupon-icon.jpeg')} style={styles.couponCardIconPercentImage} resizeMode="contain" />
                                                            </View>
                                                            <View style={styles.couponCardMain}>
                                                                <Text style={[styles.couponCardOfferTitle, isDisabled && styles.couponCardTextDisabled]} numberOfLines={2}>
                                                                    {offerTitle}
                                                                </Text>
                                                                {coupon.code && (
                                                                    <Text style={[styles.couponCardUseCode, isDisabled && styles.couponCardTextDisabled]}>Use code {coupon.code}</Text>
                                                                )}
                                                            </View>
                                                            {isDisabled ? (
                                                                <View style={styles.couponCardApplyBtnDisabled}>
                                                                    <Text style={styles.couponCardApplyTextDisabled}>Apply</Text>
                                                                </View>
                                                            ) : (
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
                                                            )}
                                                        </View>
                                                        {(conditions.length > 0 || (isDisabled && applicability.reason)) && (
                                                            <View style={styles.couponCardFooter}>
                                                                {conditions.length > 0 && (
                                                                    <View style={styles.couponConditionsContainer}>
                                                                        {conditions.slice(0, 2).map((c, i) => (
                                                                            <Text key={i} style={[styles.couponConditionText, isDisabled && styles.couponCardTextDisabled]}>
                                                                                • {c}
                                                                            </Text>
                                                                        ))}
                                                                    </View>
                                                                )}
                                                                {isDisabled && applicability.reason && (
                                                                    <Text style={styles.couponCardReasonText}>{applicability.reason}</Text>
                                                                )}
                                                            </View>
                                                        )}
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
        paddingBottom: 20,
        marginBottom: 0,

    },
    applyCouponBlock: {
        marginTop: 0,
    },
    applyCouponHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    applyCouponHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        minWidth: 0,
        marginRight: 8,
    },
    applyCouponHeaderIcon: {
        width: 20,
        height: 20,
        marginRight: 10,
    },
    applyCouponHeaderTextCol: {
        flex: 1,
        minWidth: 0,
    },
    applyCouponSectionTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
    },
    applyCouponAppliedSub: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#535862',
        marginTop: 2,
    },
    applyCouponRemoveText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.primary,
    },
    applyCouponAppliedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 4,
    },
    applyCouponAppliedTagText: {
        marginLeft: 4,
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.primary,
    },
    applyCouponViewAll: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.primary,
        marginRight: 12,
    },
    applyCouponErrorAbovePill: {
        marginBottom: 8,
        marginTop: -6,
    },
    applyCouponPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        paddingLeft: 18,
        paddingRight: 6,
        minHeight: 40,
    },
    applyCouponPillInput: {
        flex: 1,
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        paddingVertical: 14,
        paddingRight: 8,
    },
    applyCouponPillApplyHit: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        justifyContent: 'center',
    },
    applyCouponPillApplyText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#9CA3AF',
        letterSpacing: 0.5,
    },
    applyCouponPillApplyTextActive: {
        color: Colors.primary,
    },
    applyCouponPillPlaceholder: {
        flex: 1,
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#9CA3AF',
        paddingVertical: 14,
    },
    couponCardIconPercentImage: {
        width: 40,
        height: 40,
        borderRadius: 12,
    },
    cardErrorText: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#DC2626',
        marginTop: 4,
    },
    viewAllDisabled: {
        opacity: 0.5,
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
        paddingBottom: 24,
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
        fontSize: Fonts.SmallFontSize,
        color: '#717680',
        fontFamily: Fonts.LexendMedium,
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
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
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
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendBold,
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
        fontSize: Fonts.SmallFontSize,
        color: '#717680',
        fontFamily: Fonts.LexendMedium,
        marginBottom: 10,
    },
    couponsLoading: {
        marginVertical: 24,
    },
    noCouponsText: {
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.Regular,
        paddingVertical: 12,
    },
    couponCard: {
        flexDirection: 'column',
        backgroundColor: '#FAFAFA',
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
    },
    couponCardRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    couponCardFooter: {
        marginTop: 8,
        marginLeft: 4,
        paddingLeft: 0,
    },
    couponCardDisabled: {
        opacity: 0.6,
    },
    couponCardIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    couponCardIconWrapDisabled: {
        backgroundColor: '#9CA3AF',
    },
    couponCardTextDisabled: {
        color: '#9CA3AF',
    },
    couponCardReasonText: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#F15E5E',
        marginTop: 4,
    },
    couponCardMain: {
        flex: 1,
        minWidth: 0,
    },
    couponCardOfferTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#181D27',
        marginBottom: 4,
    },
    couponCardUseCode: {
        fontSize: Fonts.ExtraSmallFontSize,
        color: '#535862',
        fontFamily: Fonts.LexendMedium,
        marginBottom: 6,
    },
    couponConditionsContainer: {
        gap: 2,
        marginBottom: 6,
    },
    couponConditionText: {
        fontSize: Fonts.ExtraSmallFontSize,
        color: '#535862',
        fontFamily: Fonts.LexendRegular,
        lineHeight: 14,
        marginBottom: 2,
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
    couponCardApplyBtnDisabled: {
        justifyContent: 'center',
        paddingVertical: 8,
        paddingLeft: 12,
        opacity: 0.5,
    },
    couponCardApplyDisabled: {
        opacity: 0.5,
    },
    couponCardApplyText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    couponCardApplyTextDisabled: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#9CA3AF',
    },
});
