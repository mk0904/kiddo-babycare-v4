import { Colors, Fonts } from '@/constants/theme';
import { getAppVersionForApi } from '@/constants/versionConfig';
import { useAuth } from '@/context/AuthContext';
import { appConfigService } from '@/services/appConfigService';
import { couponService, pickSchoolNameFromCouponRaw, type CouponCode } from '@/services/couponService';
import { specialDealPromoPercentFromItem, useCartItems, useCartStore } from '@/store/cartStore';
import type { SpecialDealConfig } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

import { SchoolCouponModal } from '../modals/SchoolCouponModal';
import { SavingsCornerCouponCarousel, type SavingsCornerCouponItem } from './SavingsCornerCouponCarousel';
import { SavingsCornerPromoOfferContent } from './SavingsCornerPromoOfferContent';

/** Minimal deal modal when app config has no `speacialDealConfig` but a deal coupon is applied. */
const FALLBACK_SPECIAL_DEAL_CONFIG: SpecialDealConfig = {
    isEnabled: true,
    title: 'Special offer',
    bannerText: 'Offer unlocked!',
    footerCta: 'Add products to unlock offer',
    /** Seconds for promo countdown when using fallback config. */
    offerTime: 30,
};

export type SavingsCornerCoupon = SavingsCornerCouponItem;

export interface SavingsCornerProps {
    itemSubtotal: number;
    isAuthenticated: boolean;
    hasTicketingProducts: boolean;
    hasFashionItems: boolean;
    kiddoCashEnabled: boolean;
    /** Wallet balance from referral status API (`wallet.total_amount`). */
    walletBalance?: number | null;
    /** Amount customer pays after discounts, fees, and Kiddo Cash — used for coins earn estimate. */
    toPay: number;
    /** Amount deducted from Kiddo Cash (if any). */
    kiddoCashApplied?: number;
    formatCurrency: (amount: number) => string;
    onLoginPress: () => void;
    onKiddoCashChange: (value: boolean) => void;
    /** Bumps when remote app config reloads so free-shoe discount code (from config) re-resolves. */
    configRefreshKey?: number;
}

export const SavingsCorner = React.memo(function SavingsCorner({
    itemSubtotal,
    isAuthenticated,
    hasTicketingProducts,
    hasFashionItems,
    kiddoCashEnabled,
    walletBalance = null,
    toPay,
    kiddoCashApplied = 0,
    formatCurrency,
    onLoginPress,
    onKiddoCashChange,
    configRefreshKey = 0,
}: SavingsCornerProps) {
    const { user } = useAuth();
    const cartItems = useCartItems();
    const discountCodes = useCartStore(state => state.discountCodes);
    const discountAmount = useCartStore(state => state.discountAmount());
    const applyDiscountCode = useCartStore(state => state.applyDiscountCode);
    const removeDiscountCode = useCartStore(state => state.removeDiscountCode);

    const appliedDiscountCodes = useMemo(() => discountCodes.map(dc => dc.code), [discountCodes]);
    /**
     * Header / Remove / carousel must match bill logic: Shopify can leave stale rows in `discountCodes`.
     * Prefer applicable codes; tie-break by newest appliedAt, then later index (replacement often appended last).
     */
    const appliedDiscountCode = useMemo(() => {
        const indexed = discountCodes.map((dc, i) => ({ dc, i }));
        const active = indexed.filter(({ dc }) => dc.applicable !== false);
        const pool = active.length > 0 ? active : indexed;
        if (pool.length === 0) return null;
        const best = pool.reduce((a, b) => {
            const atA = a.dc.appliedAt ?? 0;
            const atB = b.dc.appliedAt ?? 0;
            if (atB !== atA) return atB > atA ? b : a;
            return b.i > a.i ? b : a;
        });
        return best.dc.code;
    }, [discountCodes]);

    const [showCouponsModal, setShowCouponsModal] = useState(false);
    /** Promo upsell (Mother’s Day style) first; user can switch to the classic coupon list. */
    const [couponModalMode, setCouponModalMode] = useState<'promo' | 'list'>('promo');
    const [manualCode, setManualCode] = useState('');
    const [manualCodeMessage, setManualCodeMessage] = useState<string | null>(null);
    const [availableCoupons, setAvailableCoupons] = useState<SavingsCornerCoupon[]>([]);
    const [loadingCoupons, setLoadingCoupons] = useState(false);
    /** Which UI surface started the current apply/remove — avoids carousel applies spinning the inline pill. */
    const [applyUiSource, setApplyUiSource] = useState<null | 'inline' | 'carousel' | 'modal' | 'remove'>(null);
    const couponBusy = applyUiSource !== null;
    const [couponUsages, setCouponUsages] = useState<Record<string, number>>({});
    const [lastApplyError, setLastApplyError] = useState<string | null>(null);
    const [showSchoolModal, setShowSchoolModal] = useState(false);

    /**
     * Opening PDP from the promo grid must dismiss the sheet *before* navigation so React Navigation’s
     * frozen cart snapshot does not keep `showCouponsModal === true` (back from PDP would reopen the promo).
     */
    const dismissPromoAfterProductNavRef = useRef(false);

    useFocusEffect(
        useCallback(() => {
            if (!dismissPromoAfterProductNavRef.current) return;
            setShowCouponsModal(false);
            dismissPromoAfterProductNavRef.current = false;
        }, []),
    );

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
        const mapped = displayCoupons.map((c) => {
            const applicable = c.code
                ? couponService.getCouponApplicabilityForDisplay(
                    { ...c, code: c.code, valueType: c.valueType === 'fixed' ? 'fixed_amount' : c.valueType } as CouponCode,
                    {
                        hasTicketingProducts,
                        hasFashionItems,
                        cartSubtotal,
                        cartItemCount,
                        userOrderCount,
                        couponUsageCount: couponUsages[c.code?.toUpperCase() ?? ''] ?? 0,
                        categorySubtotals,
                        lineItems: cartItems,
                    }
                ).applicable
                : true;
            return { coupon: c, applicable };
        });

        return mapped
            .sort((a, b) => (a.applicable ? 0 : 1) - (b.applicable ? 0 : 1))
            .map((item) => item.coupon);
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
        if (!isAuthenticated) {
            setShowCouponsModal(false);
            setCouponModalMode('promo');
            setManualCode('');
            setManualCodeMessage(null);
            setLastApplyError(null);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated || displayCoupons.length === 0) {
            setCouponUsages({});
            return;
        }
        const codes = displayCoupons.map((c) => c.code).filter(Boolean) as string[];
        const userId = user?.id ?? user?.customerId ?? user?.phone ?? null;
        couponService.getCouponUsagesForUser(codes, userId).then(setCouponUsages);
    }, [isAuthenticated, user?.id, user?.customerId, user?.phone, displayCoupons]);

    /** Debounced: cart updates during apply/sync were re-fetching coupons repeatedly and flashing carousel loaders. */
    useEffect(() => {
        if (!isAuthenticated) {
            setAvailableCoupons([]);
            setLoadingCoupons(false);
            if (__DEV__) console.log('[SavingsCorner] Skipping coupon fetch: user not authenticated');
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            void (async () => {
                setLoadingCoupons(true);
                try {
                    const cartSubTotal = cartItems.reduce((sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity), 0);
                    const cartItemCountLocal = cartItems.reduce((sum, item) => sum + item.quantity, 0);
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
                        cartItemCount: cartItemCountLocal,
                        hasTicketing: hasTicketingProducts,
                        hasClothing: hasFashionItems,
                        cartCategories: cartCategories.length > 0 ? cartCategories : undefined,
                        categorySubtotals: Object.keys(categorySubtotalsForFetch).length > 0 ? categorySubtotalsForFetch : undefined,
                        appVersion: getAppVersionForApi(),
                        deviceType: Platform.OS ?? '',
                    });
                    if (cancelled) return;
                    const normalized: SavingsCornerCoupon[] = (visibleCoupons ?? []).map((c: CouponCode) => ({
                        ...c,
                        value: typeof c.value === 'number' ? c.value : typeof c.value === 'string' ? parseFloat(c.value) || undefined : undefined,
                        valueType: (c.valueType === 'fixed_amount' ? 'fixed' : c.valueType) as 'percentage' | 'fixed' | undefined,
                    }));
                    setAvailableCoupons(normalized);
                } catch (error) {
                    console.error('[SavingsCorner] Error fetching coupons:', error);
                    if (!cancelled) setAvailableCoupons([]);
                } finally {
                    if (!cancelled) setLoadingCoupons(false);
                }
            })();
        }, 380);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [isAuthenticated, user?.id, user?.customerId, user?.email, user?.phone, cartItems, hasTicketingProducts, hasFashionItems]);

    const handleApplyCouponByCode = async (
        code: string,
        options?: { surfaceCardError?: boolean },
    ): Promise<{ success: boolean; error?: string; openedDealPromo?: boolean }> => {
        const surfaceCardError = options?.surfaceCardError !== false;
        const trimmed = code.trim().toUpperCase();
        if (!trimmed) return { success: false, error: 'Enter a coupon code' };
        if (discountCodes.some(dc => dc.code.toUpperCase() === trimmed && dc.applicable !== false)) {
            return { success: false, error: `${trimmed} is already applied.` };
        }
        setApplyUiSource('inline');
        setManualCodeMessage(null);
        setLastApplyError(null);
        try {
            const result = await applyDiscountCode(trimmed, { preloadedCoupons: availableCoupons });
            if (result.success) {
                const applied = useCartStore.getState().discountCodes.find(dc => dc.code.toUpperCase() === trimmed);
                if (applied?.isSchoolCoupon) {
                    setShowSchoolModal(true);
                    return { success: true };
                }
                // Optional upsell: browse deal collection / add products — user can dismiss without adding (see promo sheet CTA).
                if (applied?.isDealCoupon) {
                    openDealPromoModal();
                    return { success: true, openedDealPromo: true };
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
            setApplyUiSource(null);
        }
    };

    const handleApplyCouponFromList = async (
        coupon: SavingsCornerCoupon,
        surface: 'carousel' | 'modal',
    ) => {
        const code = coupon.code?.toUpperCase();
        if (!code) return;
        if (discountCodes.some(dc => dc.code.toUpperCase() === code && dc.applicable !== false)) {
            setManualCodeMessage(`${code} is already applied.`);
            return;
        }
        setApplyUiSource(surface);
        setManualCodeMessage(null);
        setLastApplyError(null);
        try {
            const result = await applyDiscountCode(code, { preloadedCoupons: availableCoupons });
            if (!result.success) {
                const err = result.error ?? 'Failed to apply coupon';
                setManualCodeMessage(err);
                setLastApplyError(err);
            } else {
                if (coupon.isSchoolCoupon) {
                    setShowSchoolModal(true);
                } else if (coupon.isDealCoupon) {
                    openDealPromoModal();
                }
            }
        } catch (error: any) {
            const err = error.message ?? 'Failed to apply coupon';
            setManualCodeMessage(err);
            setLastApplyError(err);
        } finally {
            setApplyUiSource(null);
        }
    };

    const handleRemoveCoupon = async (code: string) => {
        setApplyUiSource('remove');
        try {
            await removeDiscountCode(code);
            setShowCouponsModal(false);
            setCouponModalMode('promo');
            setManualCode('');
            setManualCodeMessage(null);
            setLastApplyError(null);
        } catch (error: any) {
            setManualCodeMessage(error.message ?? 'Failed to remove coupon');
        } finally {
            setApplyUiSource(null);
        }
    };

    /** Open deal modal if coupon has `isDealCoupon`. */
    const handleCouponPress = (coupon: SavingsCornerCoupon) => {
        if (coupon.isDealCoupon) {
            openDealPromoModal();
        }
    };

    const hasAppliedCoupon = (appliedDiscountCodes?.length ?? 0) > 0;

    /** When coupon is removed (UI or cart/sync clearing store), reset modal + input state so errors/text don’t linger. */
    const hadAppliedCouponRef = useRef(hasAppliedCoupon);
    useEffect(() => {
        if (hadAppliedCouponRef.current && !hasAppliedCoupon) {
            setShowCouponsModal(false);
            setCouponModalMode('promo');
            setManualCode('');
            setManualCodeMessage(null);
            setLastApplyError(null);
        }
        hadAppliedCouponRef.current = hasAppliedCoupon;
    }, [hasAppliedCoupon]);

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
                if (closeModalOnSuccess && !result.openedDealPromo) setShowCouponsModal(false);
            } else {
                setManualCodeMessage(result.error ?? 'Failed to apply coupon');
            }
        } catch {
            setManualCodeMessage('Failed to apply coupon');
        }
    };

    const closeModal = () => {
        setShowCouponsModal(false);
        setCouponModalMode('promo');
        setManualCode('');
        setManualCodeMessage(null);
        setLastApplyError(null);
    };

    const specialDealConfig = useMemo(() => appConfigService.getSpecialDealConfig(), [configRefreshKey]);
    const specialDealPromoEnabled = specialDealConfig?.isEnabled === true;

    const hasDealCouponApplied = useMemo(
        () => discountCodes.some((dc) => dc.isDealCoupon === true),
        [discountCodes]
    );

    /** “Get 50% off products” only when the coupon shown in the header is a deal coupon (not any other row). */
    const showDealPromoUpsellCta = useMemo(() => {
        const code = appliedDiscountCode;
        if (!code) return false;
        const dc = discountCodes.find((x) => x.code.toUpperCase() === code.toUpperCase());
        return dc?.isDealCoupon === true && dc?.applicable !== false;
    }, [discountCodes, appliedDiscountCode]);

    /** From coupons API on the applied deal coupon (supports merged payloads + nested keys). */
    const dealCouponSchoolName = useMemo(() => {
        const code = appliedDiscountCode;
        if (!code) return '';
        const dc = discountCodes.find((x) => x.code.toUpperCase() === code.toUpperCase());
        return pickSchoolNameFromCouponRaw(dc) ?? '';
    }, [discountCodes, appliedDiscountCode]);

    const resolvedDealConfig: SpecialDealConfig | null = useMemo(() => {
        if (specialDealConfig) return specialDealConfig;
        if (hasDealCouponApplied) return FALLBACK_SPECIAL_DEAL_CONFIG;
        return null;
    }, [specialDealConfig, hasDealCouponApplied]);

    /** Promo sheet: deal coupon and/or enabled special-deal config from app. */
    const showPromoOfferSheet =
        couponModalMode === 'promo' &&
        isAuthenticated &&
        resolvedDealConfig != null &&
        (hasDealCouponApplied || specialDealPromoEnabled);

    const openApplyCouponsModal = () => {
        setCouponModalMode(isAuthenticated && specialDealPromoEnabled ? 'promo' : 'list');
        setShowCouponsModal(true);
    };

    /** View All → classic coupon list / manual entry (not the promo upsell). */
    const openCouponsListModal = () => {
        setCouponModalMode('list');
        setShowCouponsModal(true);
    };

    /** Opens {@link SavingsCornerPromoOfferContent} (same as deal-coupon auto-open). */
    const openDealPromoModal = () => {
        setCouponModalMode('promo');
        setShowCouponsModal(true);
    };


    const freeShoesGiftCodeUc = useMemo(
        () => appConfigService.getFreeShoesGiftDiscountCodeUppercase(),
        [configRefreshKey]
    );
    const freePuzzleGiftCodeUc = useMemo(
        () => appConfigService.getFreePuzzleGiftDiscountCodeUppercase(),
        [configRefreshKey]
    );
    const mysteryGiftCodeUc = useMemo(
        () => appConfigService.getMysteryGiftDiscountCodeUppercase(),
        [configRefreshKey]
    );
    const appliedCouponUc = (appliedDiscountCode ?? '').toUpperCase();
    const isFreeShoesGiftApplied =
        Boolean(freeShoesGiftCodeUc) && appliedCouponUc === freeShoesGiftCodeUc;
    const isFreePuzzleGiftApplied =
        Boolean(freePuzzleGiftCodeUc) && appliedCouponUc === freePuzzleGiftCodeUc;
    const isMysteryGiftApplied =
        Boolean(mysteryGiftCodeUc) && appliedCouponUc === mysteryGiftCodeUc;
    const isGiftCouponApplied =
        isFreeShoesGiftApplied || isFreePuzzleGiftApplied || isMysteryGiftApplied;
    const appliedGiftSubtitle = useMemo(() => {
        if (isFreeShoesGiftApplied) return 'You will get Free Shoe on this order';
        if (isFreePuzzleGiftApplied) return 'You will get Free Puzzle on this order';
        if (isMysteryGiftApplied) return 'You will get Mystery Gift on this order';
        return null;
    }, [isFreeShoesGiftApplied, isFreePuzzleGiftApplied, isMysteryGiftApplied]);
    const freeShoesGiftDisplayPrice = useMemo(() => {
        if (!isFreeShoesGiftApplied) return undefined;
        const fromCode = discountCodes.find((dc) => dc.code.toUpperCase() === freeShoesGiftCodeUc)?.originalPrice;
        if (fromCode != null && Number.isFinite(fromCode)) return fromCode;
        const config = appConfigService.getCartConfig()?.freeShoesOffer ?? appConfigService.getFreeShoesOfferConfig();
        const raw = (config as any)?.originalPrice ?? (config as any)?.original_price;
        const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
        return Number.isFinite(num) && num >= 0 ? num : undefined;
    }, [isFreeShoesGiftApplied, discountCodes, freeShoesGiftCodeUc]);
    const dealSavingsAmount = useMemo(() => {
        return cartItems.reduce((sum, item) => {
            const p = specialDealPromoPercentFromItem(item);
            if (p != null && p > 0 && p < 100) {
                // Calculate original selling price from discounted price and percentage
                const originalPrice = Math.round(item.price / (1 - p / 100));
                return sum + (originalPrice - item.price) * item.quantity;
            }
            return sum;
        }, 0);
    }, [cartItems]);

    const appliedSaveAmount = useMemo(() => {
        if (isFreeShoesGiftApplied && freeShoesGiftDisplayPrice != null) return freeShoesGiftDisplayPrice;
        // The store's discountAmount already includes base value + deal savings, capped at maxDiscountAmount.
        return Math.round(discountAmount);
    }, [isFreeShoesGiftApplied, freeShoesGiftDisplayPrice, discountAmount]);

    const appliedHeadline = hasAppliedCoupon
        ? `Save ${formatCurrency(appliedSaveAmount)} with ${appliedDiscountCode ?? ''}`
        : '';

    const canSubmitInlineCode = isAuthenticated && !!manualCode.trim() && applyUiSource === null;

    const cartKiddoCashEnabled = useMemo(
        () => appConfigService.getCartConfig()?.kiddoCashEnabled === true,
        [configRefreshKey],
    );

    const kiddoCoinsEarned = useMemo(() => Math.round(Math.max(0, toPay + kiddoCashApplied) * 0.01), [toPay, kiddoCashApplied]);

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
                                <TouchableOpacity
                                    style={styles.applyCouponHeaderLeft}
                                    onPress={() => {
                                        if (hasDealCouponApplied) openDealPromoModal();
                                    }}
                                    disabled={!hasDealCouponApplied}
                                    activeOpacity={hasDealCouponApplied ? 0.7 : 1}
                                >
                                    <Image
                                        source={require('@/assets/icons/coupon.png')}
                                        style={styles.applyCouponHeaderIcon}
                                        resizeMode="contain"
                                    />
                                    <View style={styles.applyCouponHeaderTextCol}>
                                        <Text style={styles.applyCouponSectionTitle} numberOfLines={1}>
                                            {(appliedDiscountCode ?? 'APPLIED').toUpperCase()}
                                        </Text>
                                        {!appliedGiftSubtitle && appliedSaveAmount > 0 ? (
                                            <Text style={styles.applyCouponAppliedSub} numberOfLines={2}>
                                                You saved {formatCurrency(appliedSaveAmount)} on this order
                                            </Text>
                                        ) : null}
                                        {appliedGiftSubtitle ? (
                                            <Text style={styles.applyCouponAppliedSub} numberOfLines={2}>
                                                {appliedGiftSubtitle}
                                            </Text>
                                        ) : null}
                                        {lastApplyError ? (
                                            <Text style={styles.cardErrorText} numberOfLines={2}>
                                                {lastApplyError}
                                            </Text>
                                        ) : null}
                                    </View>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.applyCouponAppliedTag}
                                    onPress={() => {
                                        if (appliedDiscountCode) {
                                            handleRemoveCoupon(appliedDiscountCode);
                                        }
                                    }}
                                >
                                    <Text style={[styles.applyCouponAppliedTagText, { color: '#EF4444' }]}>Remove</Text>
                                </TouchableOpacity>
                            </View>

                            {showDealPromoUpsellCta ? (
                                <TouchableOpacity
                                    style={styles.dealPromoCta}
                                    onPress={openDealPromoModal}
                                    activeOpacity={0.85}
                                    disabled={!isAuthenticated}
                                >
                                    <Text style={styles.dealPromoEmoji}>🥳</Text>
                                    <View style={styles.dealPromoTextContainer}>
                                        <Text style={styles.dealPromoCtaText}>
                                            Go to{' '}
                                            <Text>exclusive 50% off store</Text>
                                            {' '}for{' '}
                                            {dealCouponSchoolName ? (
                                                <>
                                                    <Text style={styles.dealPromoCtaTextBold}>{dealCouponSchoolName}</Text>
                                                    {' '}
                                                </>
                                            ) : null}
                                            parents
                                        </Text>
                                        <Text style={styles.dealPromoSubtext}>valid on this order only</Text>
                                    </View>
                                    <View>
                                        <Ionicons name="arrow-forward" size={20} color={Colors.primary} />
                                    </View>
                                </TouchableOpacity>
                            ) : null}

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
                                    editable={!couponBusy}
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
                                    {applyUiSource === 'inline' ? (
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
                                <TouchableOpacity
                                    style={styles.applyCouponHeaderLeft}
                                    activeOpacity={0.7}
                                    disabled={couponBusy}
                                >
                                    <Image
                                        source={require('@/assets/icons/coupon.png')}
                                        style={styles.applyCouponHeaderIcon}
                                        resizeMode="contain"
                                    />
                                    <Text style={styles.applyCouponSectionTitle}>Apply Coupon</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={openCouponsListModal}
                                    activeOpacity={0.7}
                                    disabled={couponBusy}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={[styles.applyCouponViewAll, couponBusy && styles.viewAllDisabled]}>
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
                                        editable={!couponBusy}
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
                                        {applyUiSource === 'inline' ? (
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
                        couponApplying={applyUiSource === 'carousel'}
                        hasTicketingProducts={hasTicketingProducts}
                        hasFashionItems={hasFashionItems}
                        cartSubtotal={cartSubtotal}
                        cartItemCount={cartItemCount}
                        userOrderCount={userOrderCount}
                        couponUsages={couponUsages}
                        categorySubtotals={categorySubtotals}
                        lineItems={cartItems}
                        appliedCouponCode={appliedDiscountCode}
                        onApplyCoupon={(c) => void handleApplyCouponFromList(c, 'carousel')}
                        onCouponPress={handleCouponPress}
                    />
                </View>


            </View>

            {cartKiddoCashEnabled && (
                <View style={styles.kiddoCashContainer}>
                    <View style={styles.kiddoCashRow}>
                        <View style={styles.kiddoCashIconWrap}>
                            <Ionicons name="cash" size={20} color="#5B21B6" />
                        </View>
                        <View style={styles.kiddoCashTextWrap}>
                            <Text style={styles.kiddoCashTitle}>Use Kiddo Cash</Text>
                            <Text style={styles.kiddoCashSub}>
                                {walletBalance != null
                                    ? `${formatCurrency(walletBalance)} available`
                                    : '—'}
                            </Text>
                        </View>
                        <View style={styles.kiddoCashSwitchWrap}>
                            <Switch
                                value={kiddoCashEnabled}
                                onValueChange={onKiddoCashChange}
                                trackColor={{ false: '#575a5eff', true: '#5B21B6' }}
                                thumbColor={kiddoCashEnabled ? '#FFFFFF' : '#FFFFFF'}
                                style={styles.kiddoCashSwitch}
                            />
                        </View>
                    </View>
                    <View style={styles.kiddoCoinsBar}>
                        <Text style={styles.kiddoCoinsBarText}>
                            You will earn {kiddoCoinsEarned} Kiddo Coin{kiddoCoinsEarned === 1 ? '' : 's'} with this order
                        </Text>
                    </View>
                </View>
            )}



            {/* Available coupons modal with manual code entry */}
            <Modal
                visible={showCouponsModal}
                animationType={showPromoOfferSheet ? 'slide' : 'fade'}
                transparent
                onRequestClose={closeModal}
            >
                <View style={[styles.modalOverlay, showPromoOfferSheet && styles.modalOverlayDrawer]}>
                    <TouchableOpacity
                        style={StyleSheet.absoluteFill}
                        activeOpacity={1}
                        onPress={closeModal}
                    />
                    {showPromoOfferSheet ? (
                        <View style={styles.promoDrawerShell} pointerEvents="box-none">
                            <SavingsCornerPromoOfferContent
                                presentation="bottomSheet"
                                dealConfig={resolvedDealConfig}
                                formatCurrency={formatCurrency}
                                onClose={closeModal}
                                onSkip={closeModal}
                                onSeeAllCoupons={() => setCouponModalMode('list')}
                                onProductNavigationFromPromo={() => {
                                    dismissPromoAfterProductNavRef.current = true;
                                }}
                            />
                        </View>
                    ) : (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={styles.modalKeyboardAvoid}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                        >
                            <View style={styles.modalContent}>
                                <View style={styles.modalHeader}>
                                    <View style={styles.modalHeaderLeft}>
                                        {isAuthenticated && (hasDealCouponApplied || specialDealPromoEnabled) ? (
                                            <TouchableOpacity
                                                onPress={() => setCouponModalMode('promo')}
                                                hitSlop={12}
                                                style={styles.modalBackHit}
                                            >
                                                <Ionicons name="chevron-back" size={22} color={Colors.primary} />
                                            </TouchableOpacity>
                                        ) : null}
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
                                                    editable={!couponBusy}
                                                    autoCapitalize="characters"
                                                    autoCorrect={false}
                                                    scrollEnabled={false}
                                                    multiline={false}
                                                />
                                            </View>
                                            <TouchableOpacity
                                                style={[
                                                    styles.applyCodeBtn,
                                                    (!manualCode.trim() || couponBusy) && styles.applyCodeBtnDisabled,
                                                ]}
                                                onPress={() => void handleApplyManualCode(true)}
                                                disabled={!manualCode.trim() || couponBusy}
                                                activeOpacity={0.8}
                                            >
                                                {applyUiSource === 'inline' ? (
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
                                                        <TouchableOpacity
                                                            key={coupon.code || `coupon-${coupon.title ?? index}`}
                                                            style={[
                                                                styles.couponCard,
                                                                (couponBusy || isDisabled) && styles.couponCardDisabled,
                                                            ]}
                                                            onPress={() => handleCouponPress(coupon)}
                                                            activeOpacity={coupon.isDealCoupon ? 0.7 : 1}
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
                                                                        style={[styles.couponCardApplyBtn, couponBusy && styles.couponCardApplyDisabled]}
                                                                        onPress={() => {
                                                                            if (couponBusy) return;
                                                                            void (async () => {
                                                                                await handleApplyCouponFromList(coupon, 'modal');
                                                                                closeModal();
                                                                            })();
                                                                        }}
                                                                        disabled={couponBusy}
                                                                        activeOpacity={0.8}
                                                                    >
                                                                        {applyUiSource === 'modal' ? (
                                                                            <ActivityIndicator size="small" color={Colors.primary} />
                                                                        ) : (
                                                                            <Text style={styles.couponCardApplyText}>Apply</Text>
                                                                        )}
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
                                                        </TouchableOpacity>
                                                    );
                                                })
                                            )}
                                        </>
                                    )}
                                </ScrollView>
                            </View>
                        </KeyboardAvoidingView>
                    )}
                </View>
            </Modal>
        </View>
    );
});

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
        fontSize: Fonts.ExtraSmallFontSize,
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
    dealPromoCta: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFBEB',
        borderWidth: 1,
        borderColor: '#FDA4AF',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
        marginHorizontal: 0,
    },
    dealPromoEmoji: {
        fontSize: 32,
    },
    dealPromoTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    dealPromoCtaText: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#F43F5E',
    },
    dealPromoCtaTextBold: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#F43F5E',
    },
    dealPromoSubtext: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
        marginTop: 2,
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
        padding: 12,
        justifyContent: 'space-between',
    },
    kiddoCashIconWrap: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    kiddoCashTextWrap: {
        flex: 1,
    },
    kiddoCashTitle: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
    },
    kiddoCashSub: {
        fontSize: 12,
        color: '#535862',
        fontFamily: Fonts.LexendMedium,
        marginTop: 2,
    },
    kiddoCashSwitchWrap: {

        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    kiddoCashSwitch: {
        transform: [{ scaleX: 0.8 }, { scaleY: 0.85 }],
    },
    kiddoCoinsBar: {
        backgroundColor: '#EDE9FE',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    kiddoCoinsBarText: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        color: '#7A5AF8',
    },
    // Modal — promo upsell as bottom sheet (slide-up)
    modalOverlayDrawer: {
        justifyContent: 'flex-end',
        alignItems: 'stretch',
        paddingBottom: 0,
    },
    promoDrawerShell: {
        width: '100%',
        maxHeight: '92%',
    },
    modalBackHit: {
        marginRight: 4,
        justifyContent: 'center',
    },
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
    kiddoCashContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginTop: 16,
    },
});
