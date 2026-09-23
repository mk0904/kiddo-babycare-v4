import CodIcon from '@/assets/icons/cod.svg';
import RazorpayIcon from '@/assets/icons/razorpay.svg';
import { BillDetails } from '@/components/cart/BillDetails';
import { CartFooterPayment } from '@/components/cart/CartFooterPayment';
import { CompletePurchaseSection } from '@/components/cart/CompletePurchaseSection';
import { DeliveryCard } from '@/components/cart/DeliveryCard';
import { FreePairShoes } from '@/components/cart/FreePairShoes';
import { FreePuzzleBlock } from '@/components/cart/FreePuzzleBlock';
import { GiftWrappingCard } from '@/components/cart/GiftWrappingCard';
import { MilestoneDiscountBlock } from '@/components/cart/MilestoneDiscountBlock';
import { MysteryGiftBlock } from '@/components/cart/MysteryGiftBlock';
import { SavingsCorner } from '@/components/cart/SavingsCorner';
import MilestoneTracker from '@/components/home/MilestoneTracker';
import { milestoneCurrentStepFromConfig } from '@/components/home/milestoneUIFromConfig';
import { AddressModal } from '@/components/modals/AddressModal';
import { GiftWrappingModal } from '@/components/modals/GiftWrappingModal';
import { isDeliveryScheduleValid, ScheduleDeliveryModal } from '@/components/modals/ScheduleDeliveryModal';
import { SchoolCouponModal } from '@/components/modals/SchoolCouponModal';
import { StockLimitModal } from '@/components/modals/StockLimitModal';
import type { TryAndBuyVariantSelectionResult } from '@/components/modals/VariantSelectionModal';
import { VariantSelectionModal } from '@/components/modals/VariantSelectionModal';
import { useDeliveryStatus } from '@/components/ui/EstimatedDeliveryTime';
import TryAndBuyModal from '@/components/ui/TryAndBuyModal';
import { getDeliveryEtaForAddressDetails } from '@/config/deliveryConfig';
import { Colors, Fonts } from '@/constants/theme';
import { getAppVersionForApi } from '@/constants/versionConfig';
import { tagToAddressType, useAddress } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useTryAndBuy } from '@/context/TryAndBuyContext';
import { analyticsService } from '@/services/analyticsService';
import { appConfigService, type AppConfigPayload } from '@/services/appConfigService';
import PaymentService from '@/services/paymentService';
import { referralService } from '@/services/referralService';
import { shopifyApi } from '@/services/shopifyApi';
import {
    specialDealPromoPercentFromItem,
    useCartId,
    useCartIsApplyingCoupon,
    useCartItemCount,
    useCartItems,
    useCartStatus,
    useCartStore,
    useCartTotal,
    useCheckoutUrl,
    useGiftWrapping,
    useIsTryAndBuy,
} from '@/store/cartStore';
import { isVariantAvailable } from '@/utils/availability';
import { getMilestoneFreeGiftKind } from '@/utils/cartMilestoneFreeGift';
import { resolveDeliveryServiceable } from '@/utils/deliveryServiceability';
import {
    calculateScheduledDiscount,
    getScheduledDiscountEligibleSubtotal,
} from '@/utils/scheduledDeliveryDiscount';
import {
    getActiveMilestoneSlotRaw,
    isMilestoneMinCartUnlocked,
    milestoneGiftBillTitleFromSlot,
    milestoneIsGiftBillDiscountLineTitle,
    milestoneTakesPrecedenceOverOtherCoupons
} from '@/utils/milestoneOrderDiscount';
import {
    sizeLabelFromVariantTitle,
    tryBuyTrialOptionValueFromVariant,
    variantIdsEqual,
} from '@/utils/tryAndBuyProduct';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function findVariantInProductById(product: any, variantId: string | undefined): any | null {
    if (!product || !variantId) return null;
    const edges = product?.variants?.edges;
    const list: any[] = edges
        ? edges.map((e: any) => e?.node).filter(Boolean)
        : Array.isArray(product?.variants)
            ? product.variants.filter(Boolean)
            : [];
    return list.find((v: any) => variantIdsEqual(v?.id, variantId)) || null;
}

/** First meaningful option value for the variant row (matches VariantSelectionModal main option). */
function primaryOptionLabelFromLine(product: any, line: any): string | null {
    const v = findVariantInProductById(product, line?.variantId);
    if (!v) return sizeLabelFromVariantTitle(line?.variantTitle) || null;
    const so = Array.isArray(v.selectedOptions) ? v.selectedOptions : [];
    const nonTitle = so.find((o: any) => o?.name && o.name !== 'Title');
    const fromOpt = nonTitle?.value != null ? String(nonTitle.value).trim() : '';
    if (fromOpt) return fromOpt;
    return sizeLabelFromVariantTitle(v.title) || null;
}

export default function CartScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const cartItemCount = useCartItemCount();

    // Use Zustand store
    const dealProducts = useCartStore(state => state.dealProducts);
    const discountBreakdown = useCartStore(state => state.discountBreakdownSnapshot);
    const cartItems = useCartItems();
    const cartTotal = useCartTotal();
    const isTryAndBuy = useIsTryAndBuy();

    // Track cart viewed on mount
    useEffect(() => {
        const trackCartView = async () => {
            try {
                const { trackCartViewed } = require('@/utils/mixpanelHelpers');
                const itemCount = cartItems.length;
                const cartValue = itemSubtotal;
                trackCartViewed(itemCount, cartValue);

                // Firebase Ecommerce Tracking
                analyticsService.logViewCart({
                    items: cartItems.map(item => ({
                        item_id: item.productId,
                        item_name: item.title,
                        item_category: item.tags?.[0],
                        price: item.price,
                        quantity: item.quantity,
                    })),
                    value: cartValue,
                    currency: 'INR',
                });
            } catch (e) {
                console.warn('Mixpanel tracking error:', e);
            }
        };
        if (cartItems.length > 0) {
            trackCartView();
        }
    }, []); // Only track once on mount
    const { user, isAuthenticated } = useAuth();
    const { defaultAddress, detectedLocationStatus, detectedEta } = useAddress();
    const [appConfigRefresh, setAppConfigRefresh] = useState(0);
    // Load app config from backend with Postman-style params (phone, customerId, appVersion, deviceType) for cart/checkout
    useEffect(() => {
        let cancelled = false;
        const payload: AppConfigPayload = {
            phone: user?.phone ?? undefined,
            customerId: (user?.customerId ?? user?.id) != null ? String(user?.customerId ?? user?.id) : undefined,
            appVersion: getAppVersionForApi(),
            deviceType: Platform.OS,
        };
        appConfigService.loadAppConfig(true, payload).then(() => {
            if (!cancelled) setAppConfigRefresh((r) => r + 1);
        });
        return () => {
            cancelled = true;
        };
    }, [user?.phone, user?.customerId, user?.id]);
    const cartFeatures = useMemo(
        () => appConfigService.getCartFeatures(),
        [appConfigRefresh]
    );
    const checkoutConfig = useMemo(
        () => appConfigService.getCheckoutConfig(),
        [appConfigRefresh]
    );
    const milestoneUI = useMemo(() => appConfigService.getMilestoneUI(), [appConfigRefresh]);
    const isCodAvailable = useMemo(() => appConfigService.isCodAvailable(), [appConfigRefresh]);
    const milestoneFreeKind = useMemo(
        () => getMilestoneFreeGiftKind(milestoneUI ?? null),
        [milestoneUI]
    );
    const activeMilestoneSlot = useMemo(
        () => getActiveMilestoneSlotRaw(milestoneUI ?? null),
        [milestoneUI]
    );
    const milestoneGiftBillTitle = useMemo(
        () => milestoneGiftBillTitleFromSlot(activeMilestoneSlot),
        [activeMilestoneSlot]
    );
    const [cartMilestoneExpanded, setCartMilestoneExpanded] = useState(false);
    const giftWrapping = useGiftWrapping();
    const etaRequestItems = useMemo(() => cartItems.map(item => ({
        quantity: item.quantity,
        l1: item.tags?.[0]
    })), [cartItems]);

    const {
        deliveryTime: estimatedDeliveryMinutes,
        isServiceable: coordsServiceable,
        loading: coordsEtaLoading,
    } = useDeliveryStatus(
        defaultAddress?.latitude,
        defaultAddress?.longitude,
        defaultAddress ?? undefined,
        { hasGiftWrap: !!giftWrapping, items: etaRequestItems }
    );
    // When address has no lat/lon, useDeliveryStatus returns null and we'd show default 30.
    // Match homepage: geocode then compute ETA (Google Maps + distance fallback) so cart shows same mins as homepage.
    const [etaFromGeocode, setEtaFromGeocode] = useState<number | null>(null);
    const [etaFromGeocodeServiceable, setEtaFromGeocodeServiceable] = useState(true);
    const [geocodeEtaLoading, setGeocodeEtaLoading] = useState(false);
    const hasCoords = defaultAddress?.latitude != null && defaultAddress?.longitude != null;
    useEffect(() => {
        if (!defaultAddress || hasCoords) {
            setEtaFromGeocode(null);
            setEtaFromGeocodeServiceable(true);
            setGeocodeEtaLoading(false);
            return;
        }
        let cancelled = false;
        const run = async () => {
            const addressString = `${defaultAddress.address1 || ''} ${defaultAddress.city || ''} ${defaultAddress.state || ''} ${defaultAddress.pincode || ''}`.trim();
            setGeocodeEtaLoading(true);
            if (!addressString) {
                if (!cancelled) {
                    setEtaFromGeocode(null);
                    setEtaFromGeocodeServiceable(true);
                    setGeocodeEtaLoading(false);
                }
                return;
            }
            try {
                const data = await getDeliveryEtaForAddressDetails(addressString, { hasGiftWrap: !!giftWrapping, items: etaRequestItems });
                if (cancelled) return;
                setEtaFromGeocode(data?.etaMinutes ?? null);
                const threshold = appConfigService.getServicableDistanceKm();
                setEtaFromGeocodeServiceable(resolveDeliveryServiceable(data, threshold));
            } finally {
                if (!cancelled) setGeocodeEtaLoading(false);
            }
        };
        run();
        return () => {
            cancelled = true;
        };
    }, [defaultAddress?.id, hasCoords, defaultAddress?.address1, defaultAddress?.city, defaultAddress?.state, defaultAddress?.pincode, giftWrapping, appConfigRefresh, JSON.stringify(etaRequestItems)]);

    const savedAddressOutsideDeliveryZone =
        !!defaultAddress &&
        (hasCoords
            ? !coordsServiceable && !coordsEtaLoading
            : !etaFromGeocodeServiceable && !geocodeEtaLoading);

    useTryAndBuy(); // Try & Buy is tag-only; checkout always uses normal order flow below
    const status = useCartStatus();
    const cartId = useCartId();
    const isApplyingCoupon = useCartIsApplyingCoupon();
    const checkoutUrl = useCheckoutUrl();

    // Store actions
    const updateQuantity = useCartStore(state => state.updateQuantity);
    const removeItem = useCartStore(state => state.removeItem);
    const clearCart = useCartStore(state => state.clearCart);
    const toggleTryAndBuy = useCartStore(state => state.toggleTryAndBuy);
    const setGiftWrapping = useCartStore(state => state.setGiftWrapping);
    const selectedShoe = useCartStore(state => state.selectedShoe);
    const selectedShoeSize = useCartStore(state => state.selectedShoeSize);
    const setSelectedShoe = useCartStore(state => state.setSelectedShoe);
    const setSelectedShoeSize = useCartStore(state => state.setSelectedShoeSize);
    const selectedPuzzleId = useCartStore(state => state.selectedPuzzleId);
    const selectedPuzzleAge = useCartStore(state => state.selectedPuzzleAge);
    const setSelectedPuzzle = useCartStore(state => state.setSelectedPuzzle);
    const applyDiscountCode = useCartStore(state => state.applyDiscountCode);
    const removeDiscountCode = useCartStore(state => state.removeDiscountCode);
    const discountCodes = useCartStore(state => state.discountCodes);
    const discountAmount = useCartStore(state => state.discountAmount());
    const mrp = useCartStore(state => state.mrp());
    const ensureCart = useCartStore(state => state.ensureCart);
    const getCheckoutUrl = useCartStore(state => state.getCheckoutUrl);
    const updateCartItem = useCartStore(state => state.updateCartItem);
    const shippingFee = useCartStore(state => state.shippingFee);
    const deliverySchedule = useCartStore(state => state.deliverySchedule);
    const setDeliverySchedule = useCartStore(state => state.setDeliverySchedule);

    // Collection IDs that are ticketing products
    const TICKETING_COLLECTION_IDS = [
        'gid://shopify/Collection/509771120929', // Events
        'gid://shopify/Collection/509726458145', // Playhouses
        'gid://shopify/Collection/509771153697', // Petting Farms
    ];

    // Check if cart has any ticketing products
    const hasTicketingProducts = useMemo(() => {
        return cartItems.some(item => {
            // Check if item has booking date (indicates ticketing product)
            if (item.bookingDate) return true;

            // Check tags
            const hasTicketingTag = item.tags?.some((tag: any) => {
                const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
                return tagLower.includes('event') ||
                    tagLower.includes('playhouse') ||
                    tagLower.includes('petting') ||
                    tagLower.includes('farm') ||
                    tagLower.includes('ticket') ||
                    tagLower.includes('pass');
            });

            return hasTicketingTag;
        });
    }, [cartItems]);

    // Split cart items: gift-wrapped vs regular (for separate display)
    const giftWrapProductIds = useMemo(() => giftWrapping?.productIds ?? [], [giftWrapping?.productIds]);
    const itemsNotGiftWrapped = useMemo(
        () => cartItems.filter(item => !giftWrapProductIds.includes(item.id)),
        [cartItems, giftWrapProductIds]
    );
    const itemsGiftWrapped = useMemo(
        () => cartItems.filter(item => giftWrapProductIds.includes(item.id)),
        [cartItems, giftWrapProductIds]
    );
    const totalCartItems = useMemo(
        () => cartItems.reduce((s, i) => s + i.quantity, 0),
        [cartItems]
    );

    // Gift wrap fee: only charge for products still in cart (so removing a product or deselecting from gift wrap updates the fee)
    const validGiftWrapIds = useMemo(
        () => (giftWrapping?.productIds ?? []).filter(id => cartItems.some(item => item.id === id)),
        [giftWrapping?.productIds, cartItems]
    );
    const giftWrapPerItemPrice = useMemo(() => {
        const ids = giftWrapping?.productIds ?? [];
        if (ids.length === 0 || !giftWrapping?.price) return 30;
        return giftWrapping.price / ids.length;
    }, [giftWrapping?.productIds, giftWrapping?.price]);
    const derivedGiftWrappingFee = useMemo(
        () => validGiftWrapIds.length * giftWrapPerItemPrice,
        [validGiftWrapIds.length, giftWrapPerItemPrice]
    );

    // Sync gift wrap state when cart items change (e.g. user removed a product) so stored productIds and price stay correct
    const validGiftWrapIdsKey = useMemo(() => validGiftWrapIds.join(','), [validGiftWrapIds]);
    useEffect(() => {
        if (!giftWrapping || hasTicketingProducts) return;
        const storedIds = giftWrapping.productIds ?? [];
        if (validGiftWrapIds.length === 0) {
            setGiftWrapping(null);
            return;
        }
        if (validGiftWrapIds.length !== storedIds.length || validGiftWrapIds.some((id, i) => id !== storedIds[i])) {
            setGiftWrapping({
                name: giftWrapping.name,
                description: giftWrapping.description,
                price: validGiftWrapIds.length * giftWrapPerItemPrice,
                productIds: validGiftWrapIds,
            });
        }
    }, [validGiftWrapIdsKey, giftWrapping, giftWrapPerItemPrice, hasTicketingProducts, setGiftWrapping]);

    // Check if cart has only ticketing products
    const isTicketingOnly = useMemo(() => {
        return cartItems.length > 0 && cartItems.every(item => {
            // Check if item has booking date (indicates ticketing product)
            if (item.bookingDate) return true;

            // Check tags
            const hasTicketingTag = item.tags?.some((tag: any) => {
                const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
                return tagLower.includes('event') ||
                    tagLower.includes('playhouse') ||
                    tagLower.includes('petting') ||
                    tagLower.includes('farm') ||
                    tagLower.includes('ticket') ||
                    tagLower.includes('pass');
            });

            return hasTicketingTag;
        });
    }, [cartItems]);

    // Show delivery card when at least one non-ticketing product exists in cart
    const hasNonTicketingProducts = useMemo(() => {
        return cartItems.some(item => {
            if (item.bookingDate) return false;
            const hasTicketingTag = item.tags?.some((tag: any) => {
                const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
                return tagLower.includes('event') ||
                    tagLower.includes('playhouse') ||
                    tagLower.includes('petting') ||
                    tagLower.includes('farm') ||
                    tagLower.includes('ticket') ||
                    tagLower.includes('pass');
            });
            return !hasTicketingTag;
        });
    }, [cartItems]);

    // Check if cart has fashion items
    const hasFashionItems = useMemo(() => {
        return cartItems.some(item => {
            return item.tags?.some(
                (tag: string) => typeof tag === 'string' && tag.toLowerCase() === 'fashion'
            );
        });
    }, [cartItems]);

    // Unique category/tag strings from cart (lowercase) for backend-driven offer visibility
    const cartCategoryTags = useMemo(
        () => [
            ...new Set(
                cartItems.flatMap((item) =>
                    (item.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean)
                )
            ),
        ],
        [cartItems]
    );
    if (__DEV__) {
        console.log('[CartScreen] computed cartCategoryTags:', cartCategoryTags);
    }
    const itemSubtotalForOffers = useMemo(
        () => cartItems.reduce((s, i) => s + Number(i.price ?? 0) * Number(i.quantity), 0),
        [cartItems]
    );
    /** Min-cart for the *active* milestone (same gate as the strip on cart). */
    const milestoneMinCartUnlocked = useMemo(() => {
        if (activeMilestoneSlot == null) return true;
        return isMilestoneMinCartUnlocked(activeMilestoneSlot, itemSubtotalForOffers);
    }, [activeMilestoneSlot, itemSubtotalForOffers]);

    // Per-milestone unlock checks to ensure rewards are always interactable if their specific threshold is met
    const milestoneSecondUnlocked = useMemo(() => {
        const slot = milestoneUI?.milestoneSecond;
        if (!slot) return false;
        return isMilestoneMinCartUnlocked(slot, itemSubtotalForOffers);
    }, [milestoneUI?.milestoneSecond, itemSubtotalForOffers]);

    const milestoneThirdUnlocked = useMemo(() => {
        const slot = milestoneUI?.milestoneThird;
        if (!slot) return false;
        return isMilestoneMinCartUnlocked(slot, itemSubtotalForOffers);
    }, [milestoneUI?.milestoneThird, itemSubtotalForOffers]);

    const milestoneFourthUnlocked = useMemo(() => {
        const slot = milestoneUI?.milestoneFourth;
        if (!slot) return false;
        return isMilestoneMinCartUnlocked(slot, itemSubtotalForOffers);
    }, [milestoneUI?.milestoneFourth, itemSubtotalForOffers]);
    const milestoneIsGiftBillDiscountTitle = useMemo(
        () =>
            milestoneIsGiftBillDiscountLineTitle(
                activeMilestoneSlot,
                itemSubtotalForOffers,
                milestoneFreeKind
            ),
        [activeMilestoneSlot, itemSubtotalForOffers, milestoneFreeKind]
    );
    /** 0 = 1st … 3 = 4th (`milestoneFourth`). Mystery gift auto-apply only uses step 3. */
    const currentMilestoneStep = useMemo(
        () => milestoneCurrentStepFromConfig(milestoneUI ?? null, 0),
        [milestoneUI]
    );
    // Refetch app config when cart screen is focused (with cart context so backend can return offer visibility)
    useFocusEffect(
        useCallback(() => {
            const payload: AppConfigPayload = {
                phone: user?.phone ?? undefined,
                customerId: (user?.customerId ?? user?.id) != null ? String(user?.customerId ?? user?.id) : undefined,
                appVersion: getAppVersionForApi(),
                deviceType: Platform.OS,
                cartSubtotal: itemSubtotalForOffers > 0 ? itemSubtotalForOffers : undefined,
                cartCategories: cartCategoryTags.length > 0 ? cartCategoryTags.join(',') : undefined,
            };
            appConfigService.loadAppConfig(true, payload).then(() => setAppConfigRefresh((r) => r + 1));
        }, [user?.phone, user?.customerId, user?.id, cartCategoryTags, itemSubtotalForOffers])
    );
    // Refetch app config when cart changes so backend can return updated offer visibility
    useEffect(() => {
        let cancelled = false;
        const payload: AppConfigPayload = {
            phone: user?.phone ?? undefined,
            customerId: (user?.customerId ?? user?.id) != null ? String(user?.customerId ?? user?.id) : undefined,
            appVersion: getAppVersionForApi(),
            deviceType: Platform.OS,
            cartSubtotal: itemSubtotalForOffers > 0 ? itemSubtotalForOffers : undefined,
            cartCategories: cartCategoryTags.length > 0 ? cartCategoryTags.join(',') : undefined,
        };
        appConfigService.loadAppConfig(true, payload).then(() => {
            if (!cancelled) setAppConfigRefresh((r) => r + 1);
        });
        return () => { cancelled = true; };
    }, [user?.phone, user?.customerId, user?.id, cartCategoryTags.join(','), itemSubtotalForOffers]);

    const fetchWalletBalance = useCallback(() => {
        if (!isAuthenticated || !user?.phone) {
            setWalletBalance(null);
            return;
        }
        referralService
            .getReferralStatus(user.phone)
            .then((status) => setWalletBalance(status.wallet?.total_amount ?? 0))
            .catch((err) => {
                if (__DEV__) console.warn('[Cart] Failed to load wallet balance:', err);
            });
    }, [isAuthenticated, user?.phone]);

    useFocusEffect(
        useCallback(() => {
            fetchWalletBalance();
            const currentSchedule = useCartStore.getState().deliverySchedule;
            if (currentSchedule?.date && currentSchedule?.time && !isDeliveryScheduleValid(currentSchedule)) {
                setDeliverySchedule(null);
            }
        }, [fetchWalletBalance, setDeliverySchedule]),
    );

    const freeShoesOfferConfig = useMemo(
        () => appConfigService.getCartConfig()?.freeShoesOffer,
        [appConfigRefresh]
    );
    const freeShoesPickerConfig = useMemo(
        () => appConfigService.getCartConfig()?.freeShoesPicker,
        [appConfigRefresh]
    );
    const freePuzzleOfferConfig = useMemo(
        () => appConfigService.getCartConfig()?.freePuzzleOffer,
        [appConfigRefresh]
    );
    const freePuzzlePickerConfig = useMemo(
        () => appConfigService.getCartConfig()?.freePuzzlePicker,
        [appConfigRefresh]
    );
    const mysteryGiftOfferConfig = useMemo(
        () => appConfigService.getMysteryGiftOfferConfig(),
        [appConfigRefresh]
    );
    const scheduledOfferConfig = useMemo(() => {
        const cfg = appConfigService.getScheduledDeliveryOfferConfig();
        if (__DEV__) {
            console.log('[CartScreen] Backend scheduledDeliveryOffer in cart:', cfg);
        }
        return cfg;
    }, [appConfigRefresh]);
    /** Visibility is backend-only: app just reads freeShoesOffer.visible from config (no local rules). */
    const showFreeShoesByBackend = freeShoesOfferConfig?.visible !== false;
    const showPuzzleByBackend = freePuzzleOfferConfig?.visible !== false;
    const showShoesMilestoneUIF =
        cartFeatures.showFreePairShoes &&
        milestoneFreeKind === 'shoes' &&
        showFreeShoesByBackend &&
        freeShoesOfferConfig?.enabled !== false;
    const showPuzzleMilestoneUIF =
        cartFeatures.showFreePairShoes &&
        milestoneFreeKind === 'puzzle' &&
        showPuzzleByBackend &&
        freePuzzleOfferConfig?.enabled !== false;
    const showDiscountMilestoneUIF =
        cartFeatures.showFreePairShoes &&
        milestoneFreeKind === 'discount';
    const showMysteryMilestoneUIF =
        cartFeatures.showFreePairShoes &&
        milestoneFreeKind === 'mystery';
    const freeShoesGiftCodeUc = useMemo(
        () => appConfigService.getFreeShoesGiftDiscountCodeUppercase(),
        [appConfigRefresh]
    );
    const freeShoesGiftCodeDisplay = useMemo(
        () => appConfigService.getFreeShoesGiftDiscountCode(),
        [appConfigRefresh]
    );
    const freePuzzleGiftCodeUc = useMemo(
        () => appConfigService.getFreePuzzleGiftDiscountCodeUppercase(),
        [appConfigRefresh]
    );
    const freePuzzleGiftCodeDisplay = useMemo(
        () => appConfigService.getFreePuzzleGiftDiscountCode(),
        [appConfigRefresh]
    );
    const freeMysteryGiftCodeUc = useMemo(
        () => appConfigService.getMysteryGiftDiscountCodeUppercase(),
        [appConfigRefresh]
    );
    const freeMysteryGiftCodeDisplay = useMemo(
        () => appConfigService.getMysteryGiftDiscountCode(),
        [appConfigRefresh]
    );
    const milestoneDiscountCodeUc = useMemo(
        () => 'FIRSTMILESTONE',
        []
    );
    const milestoneShouldOverrideStackedCoupons = useMemo(
        () =>
            milestoneTakesPrecedenceOverOtherCoupons(
                itemSubtotalForOffers,
                activeMilestoneSlot,
                milestoneFreeKind
            ),
        [itemSubtotalForOffers, activeMilestoneSlot, milestoneFreeKind]
    );

    // Computed values
    const appliedDiscountCodes = discountCodes.map(dc => dc.code);
    const appliedDiscountCode = appliedDiscountCodes[0] || null;
    // Only show loading if status is 'loading' and we don't have items yet
    // If we have items, show them even if status is 'init' (store just hydrated)
    const loading = status === 'loading' && cartItems.length === 0;

    const [showBillSummary, setShowBillSummary] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay'>('razorpay');
    const [orderLoading, setOrderLoading] = useState(false);
    const [couponMessage, setCouponMessage] = useState<string | null>(null); // Used by CheckoutRedeemCoins for reward coupon feedback
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [showGiftModal, setShowGiftModal] = useState(false);
    const [showTryAndBuyModal, setShowTryAndBuyModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showSchoolModal, setShowSchoolModal] = useState(false);
    const [kiddoCashEnabled, setKiddoCashEnabled] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [stockLimitModal, setStockLimitModal] = useState<{ visible: boolean; maxQty: number }>({ visible: false, maxQty: 0 });
    const [hasPlacedOrder, setHasPlacedOrder] = useState(false);
    const [tryBuyEditLine, setTryBuyEditLine] = useState<any>(null);
    const [tryBuyEditProduct, setTryBuyEditProduct] = useState<any>(null);

    const closeTryBuyEdit = useCallback(() => {
        setTryBuyEditLine(null);
        setTryBuyEditProduct(null);
    }, []);

    const openTryBuyEdit = useCallback(
        async (line: any) => {
            const pid = line?.productId;
            if (!pid) {
                Alert.alert('Edit', 'Missing product information.');
                return;
            }
            setTryBuyEditLine(line);
            setTryBuyEditProduct(null);
            try {
                const product = await shopifyApi.getProductById(pid);
                if (!product) {
                    Alert.alert('Edit', 'Could not load product.');
                    setTryBuyEditLine(null);
                    return;
                }
                const v = findVariantInProductById(product, line.variantId);
                if (!v) {
                    Alert.alert('Edit', 'Could not find this item variant.');
                    setTryBuyEditLine(null);
                    return;
                }
                setTryBuyEditProduct(product);
            } catch {
                Alert.alert('Edit', 'Could not load product.');
                setTryBuyEditLine(null);
            }
        },
        [],
    );

    const handleTryBuyEditConfirm = useCallback(
        async (result: TryAndBuyVariantSelectionResult) => {
            if (!tryBuyEditLine?.id) return;
            const k = result.keepVariant;
            const price = parseFloat(k?.price?.amount || '0');
            const compareAtRaw = k?.compareAtPrice?.amount ? parseFloat(k.compareAtPrice.amount) : NaN;
            const compareAtPrice = Number.isFinite(compareAtRaw) ? compareAtRaw : undefined;
            const imageUrl =
                k?.image?.url ||
                k?.product?.images?.edges?.[0]?.node?.url ||
                k?.product?.images?.[0]?.url ||
                k?.product?.featuredImage?.url ||
                tryBuyEditProduct?.images?.[0]?.url ||
                tryBuyEditProduct?.featuredImage?.url ||
                tryBuyEditProduct?.images?.edges?.[0]?.node?.url ||
                tryBuyEditLine.image ||
                '';

            const qtyAvail = k?.quantityAvailable != null ? Number(k.quantityAvailable) : undefined;

            const patch: {
                variantId: string;
                variantTitle?: string;
                price: number;
                compareAtPrice?: number;
                image?: string;
                availableForSale: boolean;
                quantityAvailable?: number;
                customAttributes?: Record<string, string>;
            } = {
                variantId: String(k?.id || ''),
                variantTitle: k?.title,
                price,
                compareAtPrice,
                availableForSale: isVariantAvailable(k) !== false,
                ...(Number.isFinite(qtyAvail) ? { quantityAvailable: qtyAvail } : {}),
                ...(imageUrl ? { image: imageUrl } : {}),
            };

            if (result.tryVariant) {
                patch.customAttributes = {
                    try_buy_trial_variant_id: String(result.tryVariant.id || ''),
                    try_buy_trial_variant_title: String(result.tryVariant.title || ''),
                    try_buy_trial_option_value: tryBuyTrialOptionValueFromVariant(result.tryVariant),
                };
            } else {
                patch.customAttributes = {};
            }

            await updateCartItem(tryBuyEditLine.id, patch);
        },
        [tryBuyEditLine, tryBuyEditProduct, updateCartItem],
    );

    const handleTryBuyRemoveTrial = useCallback(() => {
        if (!tryBuyEditLine?.id) return;
        void updateCartItem(tryBuyEditLine.id, { customAttributes: {} });
    }, [tryBuyEditLine, updateCartItem]);

    // Redirect back if cart is empty
    useEffect(() => {
        if (!loading && cartItems.length === 0) {
            router.back();
        }
    }, [loading, cartItems.length, router]);

    // Automatically switch to razorpay if COD is selected and ticketing products are added or COD is unavailable

    // Automatically switch to razorpay if COD is selected and ticketing products are added
    useEffect(() => {
        if ((hasTicketingProducts || !isCodAvailable) && paymentMethod === 'cod') {
            setPaymentMethod('razorpay');
        }
    }, [hasTicketingProducts, isCodAvailable, paymentMethod]);

    // When the free-shoes gift code (e.g. "Free Shoes") is applied, auto-select first free shoe (milestone 3 / shoes rail only)
    useEffect(() => {
        if (milestoneFreeKind !== 'shoes' || !freeShoesGiftCodeUc) return;
        const hasFreeShoesGift = discountCodes.some((dc) => dc.code.toUpperCase() === freeShoesGiftCodeUc);
        if (!hasFreeShoesGift || selectedShoe || !freeShoesOfferConfig?.shoes?.length) return;
        const configuredShoes = freeShoesPickerConfig?.enabled && freeShoesPickerConfig.shoes?.length
            ? freeShoesPickerConfig.shoes
            : freeShoesOfferConfig.shoes;
        const configuredSizes = freeShoesPickerConfig?.enabled && freeShoesPickerConfig.sizes?.length
            ? freeShoesPickerConfig.sizes
            : freeShoesOfferConfig.sizes?.map((s) => ({ ...s, shoeIds: configuredShoes.map((shoe) => shoe.id) }));
        const firstAvailableSize = configuredSizes?.find((s) => s.isAvailable) ?? configuredSizes?.[0];
        const firstSize = firstAvailableSize?.size;
        const allowedIds = firstAvailableSize?.shoeIds?.length ? firstAvailableSize.shoeIds : configuredShoes.map((shoe) => shoe.id);
        const firstShoe = configuredShoes.find((shoe) => allowedIds.includes(shoe.id)) ?? configuredShoes[0];
        if (!firstShoe) return;
        setSelectedShoe(firstShoe.id);
        if (firstSize) setSelectedShoeSize(firstSize);
    }, [milestoneFreeKind, discountCodes, selectedShoe, freeShoesOfferConfig?.shoes, freeShoesOfferConfig?.sizes, freeShoesPickerConfig, setSelectedShoe, setSelectedShoeSize, freeShoesGiftCodeUc]);

    // KIDPUZZLE + first puzzle/age (milestone 2)
    useEffect(() => {
        if (milestoneFreeKind !== 'puzzle') return;
        const hasPuzzle = discountCodes.some((dc) => dc.code.toUpperCase() === freePuzzleGiftCodeUc);
        if (!hasPuzzle || selectedPuzzleId || !freePuzzleOfferConfig?.items?.length) return;
        const items =
            freePuzzlePickerConfig?.enabled && freePuzzlePickerConfig.items?.length
                ? freePuzzlePickerConfig.items
                : freePuzzleOfferConfig.items;
        const ages = freePuzzlePickerConfig?.ages?.length
            ? freePuzzlePickerConfig.ages
            : [];
        const firstAge = (ages.find((a) => a.isAvailable) ?? ages[0])?.age ?? '2-3 Years';
        if (!items[0]) return;
        setSelectedPuzzle(items[0]!.id, firstAge);
    }, [
        milestoneFreeKind,
        discountCodes,
        selectedPuzzleId,
        freePuzzleOfferConfig?.items,
        freePuzzlePickerConfig,
        setSelectedPuzzle,
        freePuzzleGiftCodeUc,
    ]);

    // Milestone auto-application of mystery gift is now disabled (decoupled).
    // The user must apply the coupon or select the gift manually.

    /* Clear the other rail’s selection + free-gift coupon when active milestone no longer matches. */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only `milestoneFreeKind` is intentional
    useEffect(() => {
        if (milestoneFreeKind !== 'shoes') {
            if (selectedShoe) {
                setSelectedShoe(null);
                setSelectedShoeSize(null);
            }
            if (discountCodes.some((dc) => dc.code.toUpperCase() === freeShoesGiftCodeUc)) {
                void removeDiscountCode(freeShoesGiftCodeUc);
            }
        }
        if (milestoneFreeKind !== 'puzzle') {
            if (selectedPuzzleId) setSelectedPuzzle(null, null);
            if (discountCodes.some((dc) => dc.code.toUpperCase() === freePuzzleGiftCodeUc)) {
                void removeDiscountCode(freePuzzleGiftCodeUc);
            }
        }
        if (milestoneFreeKind !== 'mystery') {
            if (discountCodes.some((dc) => dc.code.toUpperCase() === freeMysteryGiftCodeUc)) {
                void removeDiscountCode(freeMysteryGiftCodeUc);
            }
        }
    }, [milestoneFreeKind, freeShoesGiftCodeUc, freePuzzleGiftCodeUc, freeMysteryGiftCodeUc]);

    /**
     * Gift-bill milestone (1st/4th with `freeKind === 'none'`) — clear mystery code when the slot is no longer
     * unlocked for bill display.
     *
     * When the active step is the mystery rail (`freeKind === 'mystery'`), `milestoneIsGiftBillDiscountTitle` is
     * always null by definition (see `milestoneIsGiftBillDiscountLineTitle`), so we must NOT strip the coupon here;
     * otherwise Add would apply and this effect would immediately remove it.
     */
    useEffect(() => {
        if (milestoneFreeKind === 'mystery') return;
        if (milestoneIsGiftBillDiscountTitle == null) {
            if (discountCodes.some((dc) => dc.code.toUpperCase() === freeMysteryGiftCodeUc)) {
                void removeDiscountCode(freeMysteryGiftCodeUc);
            }
        }
    }, [
        milestoneFreeKind,
        milestoneIsGiftBillDiscountTitle,
        freeMysteryGiftCodeUc,
        discountCodes,
        removeDiscountCode,
    ]);

    // Milestone coupon override is now disabled (decoupled).
    // Milestones and normal coupons can coexist or overwrite each other based on standard Shopify rules.

    // Coupon fetching is handled inside SavingsCorner.

    // Use address from AddressContext
    const selectedAddress = defaultAddress;

    // Detect ticketing placeholder address (from prior ticketing-only orders).
    // Shopify may store this as the customer's default; it's not valid for physical delivery.
    const isTicketingPlaceholderAddress = (addr: { address1?: string; address2?: string } | null): boolean => {
        if (!addr) return false;
        const a1 = (addr.address1 || '').toLowerCase();
        const a2 = (addr.address2 || '').toLowerCase();
        return a1.includes('digital delivery') || a2.includes('online event');
    };

    // For physical orders, we need a real delivery address (not the ticketing placeholder)
    const hasValidDeliveryAddress = selectedAddress && !isTicketingPlaceholderAddress(selectedAddress);

    // Calculate totals - Exactly like gauntlet's payment-details component
    const payment = useCartStore(state => state.payment);

    const { itemSubtotal, itemMrpTotal } = useMemo(() => {
        let sub = 0;
        let mrp = 0;
        for (const item of cartItems) {
            const price = Number(item.price ?? 0);
            const qty = Number(item.quantity ?? 1);
            sub += price * qty;
            // Use compareAtPrice if available, otherwise fallback to price
            const compareAt = Number(item.compareAtPrice ?? item.price ?? 0);
            mrp += compareAt * qty;
        }
        return { itemSubtotal: sub, itemMrpTotal: mrp };
    }, [cartItems]);

    // Total savings from line-item deal promos (isDealCoupon: true)
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

    // Use the pre-calculated breakdown from the store snapshot (re-calculated async in store)
    // Removed local useMemo of computeDiscountBreakdown as it is now async

    if (__DEV__) {
        console.log('[CartScreen] discountCodes from store:', discountCodes);
        console.log('[CartScreen] excludedCategories:', discountCodes.map(dc => dc.excludedCategories));
        console.log('[CartScreen] discountCodes length:', discountCodes?.length);
    }

    const {
        calculatedDiscount,
        otherCouponDiscountAmount,
        milestoneConfigDiscountAmount,
        milestoneConfigDiscountLabel,
        milestoneAppliedCode,
        milestoneAppliedDescription,
    } = useMemo(() => {
        let otherCouponDiscountAmount = 0;
        let milestoneConfigDiscountAmount = 0;
        let milestoneConfigDiscountLabel = '';
        let milestoneAppliedCode = '';
        let milestoneAppliedDescription = '';
        for (const row of discountBreakdown.perCode) {
            if (row.codeDiscount <= 0) continue;
            const codeUc = row.code.toUpperCase();
            const isFreeShoesGiftCode =
                Boolean(freeShoesGiftCodeUc) && codeUc === freeShoesGiftCodeUc;
            const isKidPuzzle = codeUc === freePuzzleGiftCodeUc;
            const isMysteryGift = codeUc === freeMysteryGiftCodeUc;
            const isMilestoneCoupon = row.isMilestone;
            if (
                (isMilestoneCoupon || isFreeShoesGiftCode || isKidPuzzle || isMysteryGift) &&
                !isFreeShoesGiftCode &&
                !isKidPuzzle &&
                !isMysteryGift
            ) {
                milestoneConfigDiscountAmount += row.codeDiscount;
                if (!milestoneConfigDiscountLabel) {
                    const stepIndex = milestoneCurrentStepFromConfig(milestoneUI ?? null, 0);
                    const ordinals = ['First', 'Second', 'Third', 'Fourth'];
                    milestoneConfigDiscountLabel =
                        stepIndex >= 0 && stepIndex < ordinals.length
                            ? `${ordinals[stepIndex]} Reward`
                            : 'Milestone Reward';
                    milestoneAppliedCode = row.code;
                    const dc = discountCodes.find(
                        (d) => d.code.toUpperCase() === codeUc,
                    );
                    milestoneAppliedDescription = dc?.couponDescription || '';
                }
            } else if (!isFreeShoesGiftCode && !isKidPuzzle && !isMysteryGift) {
                otherCouponDiscountAmount += row.codeDiscount;
            }
        }
        return {
            calculatedDiscount: discountBreakdown.total,
            otherCouponDiscountAmount,
            milestoneConfigDiscountAmount,
            milestoneConfigDiscountLabel,
            milestoneAppliedCode,
            milestoneAppliedDescription,
        };
    }, [
        discountBreakdown,
        discountCodes,
        freeShoesGiftCodeUc,
        freePuzzleGiftCodeUc,
        freeMysteryGiftCodeUc,
        milestoneUI,
    ]);

    const hasFreeShoesGiftApplied =
        Boolean(freeShoesGiftCodeUc) &&
        discountCodes.some(
            (dc) => dc.code.toUpperCase() === freeShoesGiftCodeUc && dc.applicable !== false
        );
    const freeShoesGiftOriginalPrice = discountCodes.find(
        (dc) => freeShoesGiftCodeUc && dc.code.toUpperCase() === freeShoesGiftCodeUc
    )?.originalPrice;
    const hasKidPuzzleApplied = discountCodes.some(
        (dc) => dc.code.toUpperCase() === freePuzzleGiftCodeUc && dc.applicable !== false
    );
    const kidPuzzleOriginalPrice = discountCodes.find((dc) => dc.code.toUpperCase() === freePuzzleGiftCodeUc)
        ?.originalPrice;
    const freeShoesBillFromCoupon = useMemo(() => {
        const dc = discountCodes.find(
            (d) => d.code.toUpperCase() === freeShoesGiftCodeUc && d.applicable !== false
        );
        return { title: dc?.couponTitle, description: dc?.couponDescription };
    }, [discountCodes, freeShoesGiftCodeUc]);
    const freePuzzleBillFromCoupon = useMemo(() => {
        const dc = discountCodes.find(
            (d) => d.code.toUpperCase() === freePuzzleGiftCodeUc && d.applicable !== false
        );
        return { title: dc?.couponTitle, description: dc?.couponDescription };
    }, [discountCodes, freePuzzleGiftCodeUc]);
    const mysteryBillFromCoupon = useMemo(() => {
        const dc = discountCodes.find(
            (d) => d.code.toUpperCase() === freeMysteryGiftCodeUc && d.applicable !== false
        );
        return { title: dc?.couponTitle, description: dc?.couponDescription };
    }, [discountCodes, freeMysteryGiftCodeUc]);
    const hasMysteryGiftApplied = discountCodes.some(
        (dc) => dc.code.toUpperCase() === freeMysteryGiftCodeUc && dc.applicable !== false
    );
    const mysteryGiftOriginalPrice = discountCodes.find((dc) => dc.code.toUpperCase() === freeMysteryGiftCodeUc)
        ?.originalPrice;

    const discount = Math.min(Number(discountAmount) || 0, itemSubtotal);

    // Scheduled delivery extra discount for eligible sub-categories (e.g. diapers & formula)
    const isDeliveryScheduled = Boolean(
        deliverySchedule?.date && deliverySchedule?.time && isDeliveryScheduleValid(deliverySchedule)
    );
    const scheduledEligibleSubtotal = useMemo(
        () => getScheduledDiscountEligibleSubtotal(cartItems, scheduledOfferConfig?.categories),
        [cartItems, scheduledOfferConfig?.categories]
    );
    const hasScheduledEligibleItems = scheduledEligibleSubtotal > 0;
    const scheduledDeliveryDiscount = useMemo(
        () =>
            calculateScheduledDiscount(
                scheduledEligibleSubtotal,
                isDeliveryScheduled,
                scheduledOfferConfig?.discountPercent ?? 0,
                scheduledOfferConfig?.enabled ?? false
            ),
        [
            scheduledEligibleSubtotal,
            isDeliveryScheduled,
            scheduledOfferConfig?.discountPercent,
            scheduledOfferConfig?.enabled,
        ]
    );

    const appliedSaveAmount = useMemo(() => {
        let total = discount + scheduledDeliveryDiscount;
        if (hasFreeShoesGiftApplied && freeShoesGiftOriginalPrice != null) total += freeShoesGiftOriginalPrice;
        if (hasKidPuzzleApplied && kidPuzzleOriginalPrice != null) total += (kidPuzzleOriginalPrice || 0);
        if (hasMysteryGiftApplied && mysteryGiftOriginalPrice != null) total += (mysteryGiftOriginalPrice || 0);
        return total;
    }, [discount, scheduledDeliveryDiscount, hasFreeShoesGiftApplied, freeShoesGiftOriginalPrice, hasKidPuzzleApplied, kidPuzzleOriginalPrice, hasMysteryGiftApplied, mysteryGiftOriginalPrice]);

    const milestoneCouponCodeCopy = useMemo(() => {
        if (milestoneConfigDiscountAmount > 0) {
            return milestoneDiscountCodeUc || 'FIRSTMILESTONE';
        }
        if (hasFreeShoesGiftApplied) {
            return freeShoesGiftCodeUc || 'THIRDMILESTONE';
        }
        if (hasKidPuzzleApplied) {
            return freePuzzleGiftCodeUc || 'SECONDMILESTONE';
        }
        if (hasMysteryGiftApplied) {
            return freeMysteryGiftCodeUc || 'FOURTHMILESTONE';
        }
        return undefined;
    }, [
        milestoneConfigDiscountAmount,
        milestoneDiscountCodeUc,
        hasFreeShoesGiftApplied,
        freeShoesGiftCodeUc,
        hasKidPuzzleApplied,
        freePuzzleGiftCodeUc,
        hasMysteryGiftApplied,
        freeMysteryGiftCodeUc,
    ]);
    const checkoutCouponCode = appliedDiscountCode || milestoneCouponCodeCopy;

    // Bill / Savings Corner: same number as store discountAmount() and payment.discount writers
    // Debug log
    if (__DEV__) {
        console.log('[CartScreen] Final discount calculation:', {
            discountCodes,
            discountCodesLength: discountCodes?.length,
            calculatedDiscount,
            discount,
            scheduledDeliveryDiscount,
            itemSubtotal,
        });
    }

    // Subtotal after discount (including scheduled delivery discount)
    const subtotalAfterDiscount = Math.max(0, itemSubtotal - discount - scheduledDeliveryDiscount);

    const deliveryFee = shippingFee();
    // Gift wrap fee: only when there are valid gift-wrapped items in cart (so removing the product zeros the fee).
    const giftWrappingFee = isTicketingOnly
        ? 0
        : (derivedGiftWrappingFee > 0
            ? derivedGiftWrappingFee
            : (giftWrapping != null && Number(giftWrapping?.price) > 0 && validGiftWrapIds.length > 0 ? Number(giftWrapping.price) : 0));
    // Platform fee for display only (ticket-only): shown struck + FREE, not added to total
    const PLATFORM_FEE_DISPLAY = 20;
    const platformFeeDisplay = isTicketingOnly ? PLATFORM_FEE_DISPLAY : 0;

    // Final total - ALWAYS calculate from our lineItems, not from Shopify's payment.total (platform fee not added)
    const total = subtotalAfterDiscount + deliveryFee + giftWrappingFee;
    const totalSavings = Math.max(0, itemMrpTotal - subtotalAfterDiscount);

    const handleKiddoCashChange = useCallback((enabled: boolean) => {
        setKiddoCashEnabled(enabled);
        if (enabled) {
            const appliedAmount = Math.min(walletBalance ?? 0, total);
            try {
                const { trackWalletApplied } = require('@/utils/mixpanelHelpers');
                trackWalletApplied(appliedAmount);
            } catch (e) {
                console.warn('Wallet applied tracking error:', e);
            }
        }
    }, [walletBalance, total]);

    // Bill details display constants
    const HANDLING_FEE_ORIGINAL = 10;
    const DELIVERY_FEE_ORIGINAL = 50;
    const kiddoCashApplied = kiddoCashEnabled
        ? Math.min(walletBalance ?? 0, total)
        : 0;
    const toPay = Math.max(0, total - kiddoCashApplied);
    const displaySavings =
        totalSavings +
        (isTicketingOnly ? PLATFORM_FEE_DISPLAY : HANDLING_FEE_ORIGINAL + DELIVERY_FEE_ORIGINAL) +
        kiddoCashApplied;

    // Debug log to verify calculation
    if (__DEV__) {
        console.log('[CartScreen] Total calculation:', {
            itemSubtotal,
            discount,
            subtotalAfterDiscount,
            giftWrappingFee,
            deliveryFee,
            total,
            shopifyTotal: payment?.total,
        });
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: cartItems[0]?.currencyCode || 'INR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Check Try & Buy eligibility
    const tryAndBuyEligibility = useMemo(() => {
        const hasFashionTag = cartItems.some(item => {
            const tags = item.tags || [];
            return tags.some(tag =>
                typeof tag === 'string' && tag.toLowerCase() === 'fashion'
            );
        });
        return { isEligible: hasFashionTag, hasFashionTag };
    }, [cartItems]);

    const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const item = cartItems.find((li) => li.id === itemId);
        const maxQty = item?.quantityAvailable;
        if (typeof maxQty === 'number' && newQuantity > maxQty) {
            setStockLimitModal({ visible: true, maxQty });
            newQuantity = maxQty;
        }
        await updateQuantity(itemId, newQuantity);
    };

    const handleRemoveItem = async (itemId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const itemToRemove = cartItems.find(i => i.id === itemId);
        await removeItem(itemId);

        // Firebase Ecommerce Tracking
        if (itemToRemove) {
            analyticsService.logRemoveFromCart({
                items: [{
                    item_id: itemToRemove.productId,
                    item_name: itemToRemove.title,
                    item_category: itemToRemove.tags?.[0],
                    price: itemToRemove.price,
                    quantity: itemToRemove.quantity,
                }],
                value: itemToRemove.price * itemToRemove.quantity,
                currency: itemToRemove.currencyCode || 'INR',
            });
        }
    };

    const handlePlaceOrder = async () => {
        if (status === 'loading' || orderLoading) return;
        setOrderLoading(true);
        setHasPlacedOrder(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // GET LATEST STORE STATE TO AVOID STALE CLOSURES
        const { useCartStore } = await import('@/store/cartStore');
        const latestStore = useCartStore.getState();
        const latestCartItems = latestStore.lineItems;
        const latestDiscountCodes = latestStore.discountCodes;
        const latestItemSubtotal = latestStore.subtotal();
        const latestDiscount = latestStore.discountAmount();
        const latestDeliveryFee = latestStore.shippingFee();
        const latestGiftWrappingFee = latestStore.getGiftWrappingPrice();
        const latestSchedule = latestStore.deliverySchedule;
        const latestIsScheduled = Boolean(
            latestSchedule?.date && latestSchedule?.time && isDeliveryScheduleValid(latestSchedule)
        );
        const latestScheduledEligibleSubtotal = getScheduledDiscountEligibleSubtotal(
            latestCartItems,
            scheduledOfferConfig?.categories
        );
        const latestScheduledDiscount = calculateScheduledDiscount(
            latestScheduledEligibleSubtotal,
            latestIsScheduled,
            scheduledOfferConfig?.discountPercent ?? 0,
            scheduledOfferConfig?.enabled ?? false
        );
        const latestSubtotalAfterDiscount = Math.max(0, latestItemSubtotal - latestDiscount - latestScheduledDiscount);
        const latestTotal = latestSubtotalAfterDiscount + latestDeliveryFee + latestGiftWrappingFee;

        let balanceForKiddo = walletBalance ?? 0;
        if (kiddoCashEnabled && user?.phone) {
            try {
                const status = await referralService.getReferralStatus(user.phone);
                balanceForKiddo = status.wallet?.total_amount ?? 0;
                setWalletBalance(balanceForKiddo);
            } catch (err) {
                if (__DEV__) console.warn('[Cart] Failed to refresh wallet before checkout:', err);
            }
        }
        const latestKiddoCashApplied = kiddoCashEnabled
            ? Math.min(balanceForKiddo, latestTotal)
            : 0;
        const latestToPay = Math.max(0, latestTotal - latestKiddoCashApplied);

        // Re-calculate derived values using latest state
        const latestAppliedDiscountCode = latestDiscountCodes.filter((dc) => dc.applicable !== false).map((dc) => dc.code)[0] || null;

        // Re-calculate milestone coupon using latest state
        const hasFreeShoesAppliedLatest = Boolean(freeShoesGiftCodeUc) && latestDiscountCodes.some(dc => dc.code.toUpperCase() === freeShoesGiftCodeUc && dc.applicable !== false);
        const hasKidPuzzleAppliedLatest = latestDiscountCodes.some(dc => dc.code.toUpperCase() === freePuzzleGiftCodeUc && dc.applicable !== false);
        const hasMysteryGiftAppliedLatest = latestDiscountCodes.some(dc => dc.code.toUpperCase() === freeMysteryGiftCodeUc && dc.applicable !== false);

        let latestMilestoneConfigDiscountAmount = 0;
        const latestDiscountBreakdown = latestStore.discountBreakdownSnapshot;
        for (const row of latestDiscountBreakdown.perCode) {
            if (row.codeDiscount <= 0) continue;
            const isMilestoneCoupon = row.isMilestone;
            const codeUc = row.code.toUpperCase();
            const isFreeShoes = Boolean(freeShoesGiftCodeUc) && codeUc === freeShoesGiftCodeUc;
            const isKidPuzzle = codeUc === freePuzzleGiftCodeUc;
            const isMysteryGift = codeUc === freeMysteryGiftCodeUc;
            if (isMilestoneCoupon && !isFreeShoes && !isKidPuzzle && !isMysteryGift) {
                latestMilestoneConfigDiscountAmount += row.codeDiscount;
            }
        }

        let latestMilestoneCouponCode: string | undefined;
        if (latestMilestoneConfigDiscountAmount > 0) {
            latestMilestoneCouponCode = milestoneDiscountCodeUc || 'FIRSTMILESTONE';
        } else if (hasFreeShoesAppliedLatest) {
            latestMilestoneCouponCode = freeShoesGiftCodeUc || 'THIRDMILESTONE';
        } else if (hasKidPuzzleAppliedLatest) {
            latestMilestoneCouponCode = freePuzzleGiftCodeUc || 'SECONDMILESTONE';
        } else if (hasMysteryGiftAppliedLatest) {
            latestMilestoneCouponCode = freeMysteryGiftCodeUc || 'FOURTHMILESTONE';
        }

        const latestCheckoutCouponCode = latestAppliedDiscountCode || latestMilestoneCouponCode;

        // Track Checkout Started event
        try {
            const { trackCheckoutStarted } = require('@/utils/mixpanelHelpers');
            trackCheckoutStarted(latestTotal, latestCartItems.length, latestCartItems.map(item => item.productId).filter(Boolean));

            // Firebase Ecommerce Tracking
            analyticsService.logBeginCheckout({
                items: latestCartItems.map(item => ({
                    item_id: item.productId,
                    item_name: item.title,
                    item_category: item.tags?.[0],
                    price: item.price,
                    quantity: item.quantity,
                })),
                value: latestTotal,
                currency: 'INR',
                coupon: latestCheckoutCouponCode,
            });
        } catch (e) {
            console.warn('Checkout started tracking error:', e);
        }

        // Snapshot pre-order milestone step now (before any async ops that could update config).
        const milestoneStepSnapshot = currentMilestoneStep;
        // Check if user is logged in
        if (!isAuthenticated) {
            Alert.alert(
                'Login Required',
                'Please login or create an account to place an order.',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {
                        text: 'Login / Sign Up',
                        onPress: () => router.push('/(auth)/login'),
                    },
                ]
            );
            setOrderLoading(false);
            return;
        }

        // Re-calculate ticketing status using latest state
        const latestIsTicketingOnly = latestCartItems.length > 0 && latestCartItems.every(item => item.bookingDate || item.tags?.some(tag => {
            const t = typeof tag === 'string' ? tag.toLowerCase() : '';
            return t.includes('event') || t.includes('playhouse') || t.includes('petting') || t.includes('farm');
        }));

        // For physical products, require a real delivery address (not the ticketing placeholder).
        // Users who bought ticketing first may have only the placeholder saved; prompt them to add address.
        if (!latestIsTicketingOnly && !hasValidDeliveryAddress) {
            setShowAddressModal(true);
            setOrderLoading(false);
            return;
        }

        // Validate delivery schedule if set
        const currentDeliverySchedule = latestStore.deliverySchedule;
        if (currentDeliverySchedule?.date && currentDeliverySchedule?.time) {
            if (!isDeliveryScheduleValid(currentDeliverySchedule)) {
                setDeliverySchedule(null);
                setOrderLoading(false);
                Alert.alert(
                    'Delivery Slot Expired',
                    'Your previously selected delivery time slot has passed. Please choose a new delivery slot or proceed with instant delivery.',
                    [
                        {
                            text: 'Update Slot',
                            onPress: () => setShowScheduleModal(true),
                        },
                        {
                            text: 'Deliver Now',
                            style: 'cancel',
                        },
                    ]
                );
                return;
            }
        }

        const { schoolCouponData } = latestStore;

        // Validate School Coupon requirements
        const activeSchoolCoupon = latestDiscountCodes.find(dc => dc.isSchoolCoupon && dc.applicable !== false);
        if (activeSchoolCoupon) {
            if (!schoolCouponData || !schoolCouponData.childName || !schoolCouponData.parentName || !schoolCouponData.dob || !schoolCouponData.gender) {
                setShowSchoolModal(true);
                setOrderLoading(false);
                return;
            }
        }

        const latestHasNonTicketingProducts = latestCartItems.some(item => !item.bookingDate && !item.tags?.some(tag => {
            const t = typeof tag === 'string' ? tag.toLowerCase() : '';
            return t.includes('event') || t.includes('playhouse') || t.includes('petting') || t.includes('farm');
        }));

        if (!latestIsTicketingOnly && latestHasNonTicketingProducts && savedAddressOutsideDeliveryZone) {
            Alert.alert(
                'Area unserviceable',
                'Delivery is not available at this address. Please choose a location closer to our store.',
                [{ text: 'OK' }]
            );
            setOrderLoading(false);
            return;
        }

        // For ticketing-only orders, use a default/placeholder address if none selected
        // This ensures the order creation doesn't fail due to missing address structure
        // Use a valid Indian address structure to pass Shopify validation
        const billingAddress = selectedAddress || {
            firstName: user?.displayName?.split(' ')[0] || 'Guest',
            lastName: user?.displayName?.split(' ').slice(1).join(' ') || 'User',
            address1: 'Digital Delivery',
            address2: 'Online Event',
            city: 'New Delhi',
            province: 'Delhi',
            zip: '110001',
            country: 'India',
            phone: user?.phone || '9999999999',
            latitude: 0,
            longitude: 0
        };

        try {
            // Firebase Ecommerce Tracking
            analyticsService.logAddPaymentInfo({
                payment_type: paymentMethod,
                value: latestToPay,
                currency: 'INR',
                items: latestCartItems.map(item => ({
                    item_id: item.productId,
                    item_name: item.title,
                    item_category: item.tags?.[0],
                    price: item.price,
                    quantity: item.quantity,
                })),
            });

            // Firebase Ecommerce Tracking - Shipping Info
            analyticsService.logAddShippingInfo({
                shipping_tier: 'Standard',
                value: latestToPay,
                currency: 'INR',
                items: latestCartItems.map(item => ({
                    item_id: item.productId,
                    item_name: item.title,
                    item_category: item.tags?.[0],
                    price: item.price,
                    quantity: item.quantity,
                })),
                coupon: latestCheckoutCouponCode,
            });
        } catch (e) {
            console.warn('Analytics tracking error:', e);
        }

        try {
            // Checkout always uses normal order flow. Try & Buy is a tag only (sent as isTryAndBuy to backend).
            // Normal order flow
            // Validate product availability before placing order
            try {
                const { shopifyApi } = await import('@/services/shopifyApi');
                const variantIds = latestCartItems.map(item => item.variantId);
                const variants = await shopifyApi.getVariantsByIds(variantIds);

                // Create a map of variant ID to variant data for easier lookup
                const variantMap = new Map();
                variants.forEach((variant: any) => {
                    if (variant && variant.id) {
                        variantMap.set(variant.id, variant);
                    }
                });

                // Check if any products are unavailable
                const unavailableItems: Array<{ title: string; id: string; productId?: string }> = [];
                const itemsToFix: Array<{ item: any; realVariant: any }> = [];

                // First pass: identify items with wrong variant IDs and collect fixes
                for (const item of latestCartItems) {
                    let variant = variantMap.get(item.variantId);

                    // If variant not found, it might be a search result with wrong variant ID
                    // Try to fetch the product and get the real variant ID
                    if (!variant && item.productId) {
                        try {
                            const { shopifyApi } = await import('@/services/shopifyApi');
                            const fullProduct = await shopifyApi.getProductById(item.productId);

                            if (fullProduct && fullProduct.variants?.edges && fullProduct.variants.edges.length > 0) {
                                // Find matching variant by title or use first available
                                const matchingVariant = fullProduct.variants.edges.find((e: any) => {
                                    const v = e.node;
                                    // Try to match by title if available
                                    if (item.variantTitle && v.title === item.variantTitle) {
                                        return true;
                                    }
                                    // Otherwise use first available variant
                                    if (v.availableForSale !== false) {
                                        if (v.quantityAvailable !== undefined && v.quantityAvailable !== null) {
                                            return v.quantityAvailable > 0;
                                        }
                                        return true;
                                    }
                                    return false;
                                })?.node || fullProduct.variants.edges[0]?.node;

                                if (matchingVariant) {
                                    itemsToFix.push({ item, realVariant: matchingVariant });
                                    // Update variant map with the correct variant for validation
                                    variantMap.set(matchingVariant.id, matchingVariant);
                                    variant = matchingVariant;
                                    console.log('[Cart] Will fix variant ID for search result product:', item.title);
                                }
                            }
                        } catch (error) {
                            console.error('[Cart] Error fixing variant ID for product:', item.productId, error);
                        }
                    }

                    // Check multiple conditions for unavailability:
                    // 1. Variant not found in Shopify (after trying to fix)
                    // 2. availableForSale is false
                    // 3. quantityAvailable is 0 or less than requested quantity
                    const isUnavailable = !variant ||
                        variant.availableForSale === false ||
                        (variant.quantityAvailable !== null && variant.quantityAvailable !== undefined && variant.quantityAvailable < item.quantity) ||
                        (variant.quantityAvailable === 0);

                    if (isUnavailable) {
                        unavailableItems.push({
                            title: item.title || `Product ${item.variantId}`,
                            id: item.id,
                            productId: item.productId
                        });
                    }
                }

                // Second pass: Apply fixes if any
                if (itemsToFix.length > 0) {
                    const { useCartStore } = await import('@/store/cartStore');
                    const cartStore = useCartStore.getState();

                    for (const { item, realVariant } of itemsToFix) {
                        try {
                            // Remove old item and add with correct variant ID
                            await cartStore.removeItem(item.id);
                            await cartStore.addItem({
                                productId: item.productId,
                                variantId: realVariant.id,
                                title: item.title,
                                variantTitle: realVariant.title,
                                price: parseFloat(realVariant.price?.amount || '0'),
                                compareAtPrice: realVariant.compareAtPrice?.amount
                                    ? parseFloat(realVariant.compareAtPrice.amount)
                                    : undefined,
                                currencyCode: realVariant.price?.currencyCode || 'INR',
                                image: item.image,
                                quantity: item.quantity,
                                availableForSale: realVariant.availableForSale !== false,
                                tags: item.tags || [],
                            });
                            console.log('[Cart] Fixed variant ID for:', item.title);
                        } catch (error) {
                            console.error('[Cart] Error applying variant fix:', error);
                            // Add to unavailable if fix fails
                            unavailableItems.push({
                                title: item.title || `Product ${item.variantId}`,
                                id: item.id,
                                productId: item.productId
                            });
                        }
                    }

                    // If we fixed items, refresh cart items and retry validation
                    if (itemsToFix.length > 0 && unavailableItems.length === 0) {
                        // Get updated cart items
                        const updatedCartItems = useCartStore.getState().lineItems;
                        // Re-validate with updated items
                        const updatedVariantIds = updatedCartItems.map(item => item.variantId);
                        const updatedVariants = await shopifyApi.getVariantsByIds(updatedVariantIds);
                        const updatedVariantMap = new Map();
                        updatedVariants.forEach((v: any) => {
                            if (v && v.id) updatedVariantMap.set(v.id, v);
                        });

                        // Check updated items
                        for (const item of updatedCartItems) {
                            const variant = updatedVariantMap.get(item.variantId);
                            const isUnavailable = !variant ||
                                variant.availableForSale === false ||
                                (variant.quantityAvailable !== null && variant.quantityAvailable !== undefined && variant.quantityAvailable < item.quantity) ||
                                (variant.quantityAvailable === 0);

                            if (isUnavailable) {
                                unavailableItems.push({
                                    title: item.title || `Product ${item.variantId}`,
                                    id: item.id,
                                    productId: item.productId
                                });
                            }
                        }
                    }
                }

                if (unavailableItems.length > 0) {
                    const itemNames = unavailableItems.map(item => item.title).join(', ');
                    Alert.alert(
                        'Product Unavailable',
                        `The following item(s) are no longer available: ${itemNames}. Please remove them from your cart and try again.`,
                        [
                            { text: 'OK' },
                            {
                                text: 'Remove All',
                                style: 'destructive',
                                onPress: async () => {
                                    const { useCartStore } = await import('@/store/cartStore');
                                    const cartStore = useCartStore.getState();
                                    unavailableItems.forEach(item => {
                                        cartStore.removeItem(item.id);
                                    });
                                }
                            }
                        ]
                    );
                    setOrderLoading(false);
                    return;
                }
            } catch (validationError: any) {
                console.error('[Cart] Error validating product availability:', validationError);
                // Continue with order placement if validation fails (don't block user)
                // Shopify will catch it anyway, but this gives better UX
            }

            // Effective payment method for backend (so Shopify order has correct method)
            const isFreeOrder = latestToPay === 0;
            const chosenPayment = paymentMethod === 'cod' ? 'cod' : 'razorpay';
            const effectivePaymentMethod = isFreeOrder ? 'free' : chosenPayment;

            // Prepare order data with full checkout details for backend/Shopify
            const orderData = {
                items: latestCartItems.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    price: item.price,
                    title: item.title,
                    variantTitle: item.variantTitle,
                    image: item.image,
                    compareAtPrice: item.compareAtPrice,
                    tags: item.tags,
                    bookingDate: item.bookingDate,
                    ...(item.customAttributes && Object.keys(item.customAttributes).length > 0
                        ? { customAttributes: item.customAttributes }
                        : {}),
                })),
                totalAmount: latestToPay,
                currencyCode: 'INR',
                email: user?.email || 'guest@example.com',
                phone: user?.phone || billingAddress.phone || '',
                name: user?.displayName || `${billingAddress.firstName} ${billingAddress.lastName}`,
                customerId: user?.id,
                address: (() => {
                    const base = {
                        name: `${billingAddress.firstName} ${billingAddress.lastName}`,
                        address: [billingAddress.address1, billingAddress.address2].filter(Boolean).join(', '),
                        city: billingAddress.city,
                        state: billingAddress.province,
                        pincode: billingAddress.zip,
                        phone: billingAddress.phone,
                        latitude: billingAddress.latitude,
                        longitude: billingAddress.longitude,
                    };
                    const addressType = selectedAddress?.tag != null ? tagToAddressType(selectedAddress.tag) : undefined;
                    return addressType ? { ...base, addressType } : base;
                })(),
                giftWrapping: giftWrapping ? {
                    name: giftWrapping.name,
                    price: giftWrapping.price
                } : undefined,
                couponCode: latestCheckoutCouponCode || undefined,
                discountAmount: latestDiscount > 0 ? latestDiscount : undefined,
                scheduledDeliveryDiscount: latestScheduledDiscount > 0 ? latestScheduledDiscount : undefined,
                deliverySchedule: (latestSchedule?.date && latestSchedule?.time && isDeliveryScheduleValid(latestSchedule)) ? latestSchedule : undefined,
                deliveryType: (latestSchedule?.date && latestSchedule?.time && isDeliveryScheduleValid(latestSchedule)) ? ('scheduled' as const) : ('instant' as const),
                paymentMethod: effectivePaymentMethod as 'razorpay' | 'cod' | 'free' | 'try_and_buy',
                billDetails: {
                    subtotal: latestItemSubtotal,
                    subtotalAfterDiscount: latestSubtotalAfterDiscount,
                    deliveryFee: latestDeliveryFee,
                    giftWrappingFee: latestGiftWrappingFee,
                    discount: latestDiscount,
                    ...(latestScheduledDiscount > 0 ? { scheduledDiscount: latestScheduledDiscount } : {}),
                    ...(latestKiddoCashApplied > 0 ? { kiddoCashUsed: latestKiddoCashApplied } : {}),
                    total: latestToPay,
                    currencyCode: 'INR',
                },
                ...(latestKiddoCashApplied > 0 ? { kiddoCashUsed: latestKiddoCashApplied } : {}),
                selectedShoe: selectedShoe || undefined,
                selectedShoeSize: selectedShoeSize || undefined,
                selectedPuzzleId: selectedPuzzleId || undefined,
                selectedPuzzleAge: latestStore.selectedPuzzleAge || undefined,
                isTryAndBuy: isTryAndBuy,
                schoolCouponData: activeSchoolCoupon ? latestStore.schoolCouponData : null,
                searchId: (() => {
                    try {
                        const { selfSearchApi } = require('@/services/selfSearchApi');
                        return selfSearchApi.getCurrentSearchId();
                    } catch {
                        return undefined;
                    }
                })(),
                sessionId: (() => {
                    try {
                        const { selfSearchApi } = require('@/services/selfSearchApi');
                        return selfSearchApi.getCurrentSessionId();
                    } catch {
                        return undefined;
                    }
                })(),
            };

            // Call Payment Service
            console.log('Calling PaymentService.createOrderWithPayment...');

            // Sync Shopify cart discount codes to match our store so the backend doesn't apply a stale coupon from the cart
            try {
                const cartId = await latestStore.ensureCart();
                if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                    const { shopifyApi } = await import('@/services/shopifyApi');
                    const shopifyCodes = (latestDiscountCodes || []).filter(dc => dc.applicable !== false && (dc as any).isDealCoupon !== true).map(dc => dc.code);
                    await shopifyApi.applyDiscountCodes(cartId, shopifyCodes);
                }
            } catch (syncErr) {
                console.warn('[Cart] Failed to sync discount codes to Shopify before order completion', syncErr);
            }

            const result = await PaymentService.createOrderWithPayment(
                orderData,
                effectivePaymentMethod
            );
            console.log('PaymentService result received:', result);

            if (!result.success) {
                // Check for cancellation
                if (result.cancelled) {
                    console.log('Payment cancelled');
                    return;
                }

                if (result.orderCreationFailed && result.payment?.paymentId) {
                    console.error('[Cart] 🚨 CRITICAL: Payment successful but order creation failed', {
                        paymentId: result.payment.paymentId,
                        error: result.error,
                    });

                    // Try to create a local order record as fallback for recovery
                    try {
                        const { orderService } = await import('@/services/orderService');

                        // Calculate order values for local record
                        const itemSubtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                        const calculatedDiscount = discount || 0;
                        const calculatedDeliveryFee = 0; // Delivery fee is typically 0 based on code
                        const calculatedSubtotal = itemSubtotal;

                        // Create local order record with payment info for manual recovery
                        const userIdForOrder = user?.id || user?.customerId || user?.email || user?.phone || null;
                        const localOrder = await orderService.createOrder({
                            items: cartItems.map(item => ({
                                id: item.id,
                                variantId: item.variantId,
                                productId: item.productId,
                                title: item.title,
                                variantTitle: item.variantTitle,
                                price: item.price,
                                quantity: item.quantity,
                                image: item.image,
                            })),
                            shippingAddress: selectedAddress
                                ? {
                                    name: selectedAddress.name,
                                    address: [selectedAddress.address1, selectedAddress.address2].filter(Boolean).join(', '),
                                    city: selectedAddress.city,
                                    state: selectedAddress.province || selectedAddress.state,
                                    pincode: selectedAddress.zip || selectedAddress.pincode,
                                    phone: selectedAddress.phone,
                                }
                                : {
                                    name: `${billingAddress.firstName} ${billingAddress.lastName}`,
                                    address: [billingAddress.address1, billingAddress.address2].filter(Boolean).join(', '),
                                    city: billingAddress.city,
                                    state: billingAddress.province,
                                    pincode: billingAddress.zip,
                                    phone: billingAddress.phone,
                                },
                            paymentMethod: paymentMethod || 'razorpay',
                            paymentStatus: 'paid',
                            paymentId: result.payment?.paymentId,
                            deliveryFee: calculatedDeliveryFee,
                            discount: calculatedDiscount,
                            couponCode: checkoutCouponCode || undefined,
                            note: `⚠️ RECOVERY ORDER: Payment successful but Shopify order creation failed. Payment ID: ${result.payment?.paymentId || 'unknown'}. Error: ${result.error}`,
                            userId: userIdForOrder ?? undefined,
                        });

                        console.log('[Cart] Created local recovery order:', localOrder.id);

                        // Show alert with share payment ID option
                        Alert.alert(
                            'Payment Successful - Order Issue',
                            `Your payment was processed successfully (Payment ID: ${result.payment.paymentId}), but we encountered an issue creating your order. We've saved your order details locally. Please contact support with your payment ID and we will resolve this immediately.`,
                            [
                                {
                                    text: 'Share Payment ID',
                                    onPress: async () => {
                                        try {
                                            const paymentId = result.payment?.paymentId || '';
                                            if (paymentId) {
                                                await Share.share({
                                                    message: `Payment ID for support: ${paymentId}`,
                                                    title: 'Payment ID',
                                                });
                                            }
                                        } catch (e) {
                                            console.error('Failed to share payment ID:', e);
                                        }
                                    },
                                },
                                {
                                    text: 'Contact Support',
                                    onPress: () => {
                                        // You can navigate to support or open support URL
                                        console.log('User needs to contact support with payment ID:', result.payment?.paymentId);
                                        // TODO: Navigate to support screen or open support URL
                                    },
                                },
                                { text: 'OK' },
                            ]
                        );
                    } catch (recoveryError) {
                        console.error('[Cart] Failed to create local recovery order:', recoveryError);

                        // Fallback: Show alert without local order creation
                        const paymentId = result.payment?.paymentId || 'unknown';
                        Alert.alert(
                            'Payment Successful - Order Issue',
                            `Your payment was processed successfully (Payment ID: ${paymentId}), but we encountered an issue creating your order. Please contact support with your payment ID and we will resolve this immediately.`,
                            [
                                {
                                    text: 'Share Payment ID',
                                    onPress: async () => {
                                        try {
                                            const pid = result.payment?.paymentId || '';
                                            if (pid) {
                                                await Share.share({
                                                    message: `Payment ID for support: ${pid}`,
                                                    title: 'Payment ID',
                                                });
                                            }
                                        } catch (e) {
                                            console.error('Failed to share payment ID:', e);
                                        }
                                    },
                                },
                                { text: 'OK' },
                            ]
                        );
                    }

                    setOrderLoading(false);
                    return;
                }

                // Track Payment Failed only for Razorpay
                if (effectivePaymentMethod === 'razorpay') {
                    try {
                        const { trackEvent } = require('@/utils/mixpanelHelpers');
                        trackEvent('Payment Failed', {
                            orderId: result.order?.id || 'unknown',
                            amount: cartTotal,
                            paymentMethod: effectivePaymentMethod,
                            reason: result.error || 'Order creation failed',
                        });
                    } catch (e) {
                        console.warn('Analytics tracking error:', e);
                    }
                }

                throw new Error(result.error || 'Order creation failed');
            }

            // Validate order was actually created
            if (!result.order || !result.order.id) {
                console.error('[Cart] ⚠️ Order creation returned invalid order:', result);
                throw new Error('Order creation failed: Invalid order response from server');
            }

            // Success!
            const finalOrder = result.order;
            const orderIdForDisplay = finalOrder?.name || finalOrder?.orderNumber || finalOrder?.id || `ORD-${Date.now()}`;

            console.log('[Cart] Order placed successfully:', {
                orderId: orderIdForDisplay,
                orderGraphId: finalOrder?.id,
                total: total.toString(),
            });

            // Track Payment Success and Order Placed
            try {
                const { trackEvent, trackOrderPlaced, trackFirstOrderPlaced, trackSecondOrderPlaced, trackThirdOrderPlaced } = require('@/utils/mixpanelHelpers');
                const { extractNumericId } = require('@/utils/shopifyIds');
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const effectivePaymentMethod = isFreeOrder ? 'free' : (paymentMethod === 'cod' ? 'cod' : 'razorpay');

                const orderCountRaw = await AsyncStorage.getItem('user_order_count');
                const orderCount = (parseInt(orderCountRaw || '0', 10) || 0) + 1;
                await AsyncStorage.setItem('user_order_count', orderCount.toString());

                if (orderCount === 1) {
                    trackFirstOrderPlaced(orderIdForDisplay, cartTotal);
                    await AsyncStorage.setItem('has_placed_order', 'true');
                } else if (orderCount === 2) {
                    trackSecondOrderPlaced(orderIdForDisplay, cartTotal);
                } else if (orderCount === 3) {
                    trackThirdOrderPlaced(orderIdForDisplay, cartTotal);
                }

                const cartProductIds = cartItems.map(item => item.productId).filter(Boolean);
                const cartVariantIds = cartItems.map(item => item.variantId).filter(Boolean);

                // Fetch product metafields for L1, L2, L3 collections and empty metafields
                let productMetafields: Array<{
                    productId: string, 
                    l1Collection?: string, 
                    l2Collection?: string, 
                    l3Collection?: string, 
                    emptyMetafield1?: string, 
                    emptyMetafield2?: string, 
                    emptyMetafield3?: string,
                    brandCollection?: string,
                    brandMargin?: string,
                    brandPositioningCollection?: string,
                    bucketCollection?: string,
                    colorCollection?: string,
                    fabricCollection?: string,
                    genderCollection?: string,
                    newDiscountBucket?: string,
                    occasionCollection?: string,
                    patternCollection?: string,
                    productCategory?: string,
                    productSpecs?: string,
                    productSubCategory?: string,
                    productSubSubCategory?: string,
                    seasonalityCollection?: string,
                    shalf?: string,
                    sizechart?: string,
                    skuId?: string,
                    sleeveCollection?: string,
                    globalDescriptionTag?: string,
                    globalTitleTag?: string,
                    mmGoogleShoppingGender?: string,
                    mmGoogleShoppingGoogleProductCategory?: string,
                    productTitle?: string,
                    variantTitle?: string,
                    sku?: string,
                    quantity?: number,
                    mrp?: number,
                    sellingPrice?: number,
                    costPrice?: number,
                    discountAmount?: number,
                    lineItemTotal?: number
                }> = [];
                try {
                    const { shopifyApi } = await import('@/services/shopifyApi');
                    const metafieldPromises = cartItems.map(async (item) => {
                        try {
                            const product = await shopifyApi.getProductById(item.productId);
                            if (product?.metafields) {
                                console.log('[Cart] Product metafields for order:', product.metafields);
                                const validMetafields = product.metafields.filter((m: any) => m != null);
                                const l1Collection = validMetafields.find((m: any) => m.key === 'l1_collection')?.value;
                                const l2Collection = validMetafields.find((m: any) => m.key === 'l2_collection')?.value;
                                const l3Collection = validMetafields.find((m: any) => m.key === 'l3_collection')?.value;
                                const emptyMetafield1 = validMetafields.find((m: any) => m.key === 'empty_metafield_1')?.value;
                                const emptyMetafield2 = validMetafields.find((m: any) => m.key === 'empty_metafield_2')?.value;
                                const emptyMetafield3 = validMetafields.find((m: any) => m.key === 'empty_metafield_3')?.value;
                                
                                const brandCollection = validMetafields.find((m: any) => m.key === 'brand_collection')?.value;
                                const brandMargin = validMetafields.find((m: any) => m.key === 'brand_margin')?.value;
                                const brandPositioningCollection = validMetafields.find((m: any) => m.key === 'brand_positioning_collection')?.value;
                                const bucketCollection = validMetafields.find((m: any) => m.key === 'bucket_collection')?.value;
                                const colorCollection = validMetafields.find((m: any) => m.key === 'color_collection')?.value;
                                const fabricCollection = validMetafields.find((m: any) => m.key === 'fabric_collection')?.value;
                                const genderCollection = validMetafields.find((m: any) => m.key === 'gender_collection')?.value;
                                const newDiscountBucket = validMetafields.find((m: any) => m.key === 'new_discount_bucket')?.value;
                                const occasionCollection = validMetafields.find((m: any) => m.key === 'occasion_collection')?.value;
                                const patternCollection = validMetafields.find((m: any) => m.key === 'pattern_collection')?.value;
                                const productCategory = validMetafields.find((m: any) => m.key === 'product_category')?.value;
                                const productSpecs = validMetafields.find((m: any) => m.key === 'product_specs')?.value;
                                const productSubCategory = validMetafields.find((m: any) => m.key === 'product_sub_category')?.value;
                                const productSubSubCategory = validMetafields.find((m: any) => m.key === 'product_sub_sub_category')?.value;
                                const seasonalityCollection = validMetafields.find((m: any) => m.key === 'seasonality_collection')?.value;
                                const shalf = validMetafields.find((m: any) => m.key === 'shalf')?.value;
                                const sizechart = validMetafields.find((m: any) => m.key === 'sizechart')?.value;
                                const skuId = validMetafields.find((m: any) => m.key === 'sku_id')?.value;
                                const sleeveCollection = validMetafields.find((m: any) => m.key === 'sleeve_collection')?.value;
                                
                                const globalDescriptionTag = validMetafields.find((m: any) => m.namespace === 'global' && m.key === 'description_tag')?.value;
                                const globalTitleTag = validMetafields.find((m: any) => m.namespace === 'global' && m.key === 'title_tag')?.value;
                                const mmGoogleShoppingGender = validMetafields.find((m: any) => m.namespace === 'mm-google-shopping' && m.key === 'gender')?.value;
                                const mmGoogleShoppingGoogleProductCategory = validMetafields.find((m: any) => m.namespace === 'mm-google-shopping' && m.key === 'google_product_category')?.value;

                                const sellingPrice = item.price;
                                const mrp = item.compareAtPrice !== undefined ? item.compareAtPrice : sellingPrice;
                                const discountAmount = (mrp !== undefined && sellingPrice !== undefined) ? (mrp - sellingPrice) : undefined;
                                const lineItemTotal = sellingPrice !== undefined ? sellingPrice * item.quantity : undefined;

                                console.log('[Cart] L1 Collection:', l1Collection, 'L2 Collection:', l2Collection, 'L3 Collection:', l3Collection);
                                return {
                                    productId: item.productId,
                                    l1Collection,
                                    l2Collection,
                                    l3Collection,
                                    emptyMetafield1,
                                    emptyMetafield2,
                                    emptyMetafield3,
                                    brandCollection,
                                    brandMargin,
                                    brandPositioningCollection,
                                    bucketCollection,
                                    colorCollection,
                                    fabricCollection,
                                    genderCollection,
                                    newDiscountBucket,
                                    occasionCollection,
                                    patternCollection,
                                    productCategory,
                                    productSpecs,
                                    productSubCategory,
                                    productSubSubCategory,
                                    seasonalityCollection,
                                    shalf,
                                    sizechart,
                                    skuId,
                                    sleeveCollection,
                                    globalDescriptionTag,
                                    globalTitleTag,
                                    mmGoogleShoppingGender,
                                    mmGoogleShoppingGoogleProductCategory,
                                    productTitle: item.title,
                                    variantTitle: item.variantTitle,
                                    quantity: item.quantity,
                                    mrp,
                                    sellingPrice,
                                    discountAmount,
                                    lineItemTotal
                                };
                            }
                        } catch (error) {
                            console.warn('[Cart] Failed to fetch metafields for product:', item.productId, error);
                        }
                        return { productId: item.productId };
                    });
                    productMetafields = (await Promise.all(metafieldPromises)).filter(m => m);
                    console.log('[Cart] All product metafields for order:', productMetafields);
                } catch (error) {
                    console.warn('[Cart] Failed to fetch product metafields for order:', error);
                }

                trackOrderPlaced(orderIdForDisplay, cartTotal, cartItems.length, effectivePaymentMethod, cartProductIds, cartVariantIds, productMetafields);
                trackEvent('Payment Success', {
                    orderId: orderIdForDisplay,
                    amount: cartTotal,
                    paymentMethod: effectivePaymentMethod,
                    itemCount: cartItems.length,
                    hasCoupon: discountCodes.length > 0,
                    content_ids: cartProductIds.map(id => extractNumericId(id)),
                    content_type: 'product',
                    value: cartTotal,
                    currency: 'INR',
                });
            } catch (e) {
                console.warn('Analytics tracking error:', e);
            }

            // Optional: verify order visible in Shopify. Storefront API often returns null for Order
            // when using only the storefront token (no customer access token), so empty result is expected.
            if (finalOrder?.id) {
                try {
                    const { shopifyApi } = await import('@/services/shopifyApi');
                    let orderIdToVerify = finalOrder.id;
                    if (typeof orderIdToVerify === 'number' || (typeof orderIdToVerify === 'string' && !orderIdToVerify.startsWith('gid://'))) {
                        orderIdToVerify = `gid://shopify/Order/${orderIdToVerify}`;
                    }
                    const verificationPromise = shopifyApi.getOrderById(orderIdToVerify);
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Verification timeout')), 5000)
                    );
                    const verifiedOrder = await Promise.race([verificationPromise, timeoutPromise]) as any;
                    if (verifiedOrder?.id) {
                        console.log('[Cart] ✅ Order verified in Shopify:', {
                            orderId: verifiedOrder.id,
                            orderNumber: verifiedOrder.orderNumber,
                        });
                    }
                    // If empty: expected when Storefront API is called without customer token; order was still created by backend.
                } catch (_verifyError) {
                    // Verification is best-effort; do not fail or warn—backend already confirmed creation.
                }
            }

            // Firebase Ecommerce Tracking - Purchase
            try {
                analyticsService.logPurchase({
                    transaction_id: orderIdForDisplay,
                    value: cartTotal,
                    currency: 'INR',
                    items: cartItems.map(item => ({
                        item_id: item.productId,
                        item_name: item.title,
                        item_category: item.tags?.[0],
                        price: item.price,
                        quantity: item.quantity,
                    })),
                    coupon: appliedDiscountCode || undefined,
                });
            } catch (e) {
                console.warn('[Cart] logPurchase failed:', e);
            }

            // Increment coupon usage for applied discount codes
            if (appliedDiscountCode) {
                try {
                    const { couponService } = await import('@/services/couponService');
                    const userId = user?.id || user?.customerId || user?.email || user?.phone || null;
                    if (userId) {
                        await couponService.incrementCouponUsage(appliedDiscountCode, userId);
                        console.log('[Cart] Incremented coupon usage for:', appliedDiscountCode);
                    }
                } catch (error) {
                    console.error('[Cart] Error incrementing coupon usage:', error);
                    // Don't fail the order if usage tracking fails
                }
            }

            // Clear cart first
            clearCart();

            // Navigate to order success screen
            // Use a small delay to ensure state updates complete
            requestAnimationFrame(() => {
                try {
                    const resolvedEta = estimatedDeliveryMinutes ?? etaFromGeocode ?? (detectedLocationStatus === 'serviceable' ? detectedEta : null);
                    const navParams = {
                        pathname: '/order-success/v2' as const,
                        params: {
                            orderId: orderIdForDisplay,
                            orderGraphId: finalOrder?.id || '',
                            total: latestToPay.toString(),
                            subtotal: latestItemSubtotal.toString(),
                            milestoneStep: String(milestoneStepSnapshot),
                            appliedCouponCode: appliedDiscountCode || '',
                            ...(latestKiddoCashApplied > 0 && {
                                kiddoCashUsed: String(latestKiddoCashApplied),
                                couponDiscountAmount: String(latestDiscount),
                                checkoutTotal: String(latestToPay),
                            }),
                            ...(resolvedEta != null && { estimatedDeliveryMinutes: String(resolvedEta) }),
                            ...(selectedAddress &&
                                typeof selectedAddress.latitude === 'number' &&
                                typeof selectedAddress.longitude === 'number' &&
                                Number.isFinite(selectedAddress.latitude) &&
                                Number.isFinite(selectedAddress.longitude) && {
                                destinationLat: String(selectedAddress.latitude),
                                destinationLng: String(selectedAddress.longitude),
                            }),
                        },
                    };

                    console.log('[Cart] Navigating with params:', navParams);
                    router.push(navParams);
                } catch (error) {
                    console.error('[Cart] Navigation error:', error);
                    // Fallback: try direct path
                    router.push('/order-success/v2' as any);
                }
            });

        } catch (error: any) {
            console.error('Order placement error:', error);
            if (error.code === 0 || error.message?.includes('cancelled')) {
                // Payment cancelled by user
                return;
            }

            // Parse Shopify errors for better user experience
            let errorMessage = error.description || error.message || 'Something went wrong while placing your order.';

            // Check if error is about product availability
            if (errorMessage.includes('no longer available') || errorMessage.includes('is no longer available')) {
                // Extract product ID from error message
                const productIdMatch = errorMessage.match(/ID\s+(\d+)/);
                if (productIdMatch) {
                    const unavailableProductId = productIdMatch[1];
                    // Find the product in cart
                    const unavailableItem = cartItems.find(item =>
                        item.variantId.includes(unavailableProductId) ||
                        item.productId.includes(unavailableProductId)
                    );

                    if (unavailableItem) {
                        errorMessage = `${unavailableItem.title || 'One or more items'} is no longer available. Please remove it from your cart and try again.`;

                        // Offer to remove the item
                        Alert.alert(
                            'Product Unavailable',
                            errorMessage,
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Remove Item',
                                    onPress: async () => {
                                        const cartStore = await import('@/store/cartStore');
                                        await cartStore.useCartStore.getState().removeItem(unavailableItem.id);
                                    }
                                }
                            ]
                        );
                        setOrderLoading(false);
                        return;
                    }
                }
            }

            // If order failed due to invalid/already-used coupon, remove it from cart so user can retry
            const isCouponError = /already been used|coupon|invalid coupon|expired coupon/i.test(errorMessage);
            if (isCouponError && appliedDiscountCodes?.length) {
                try {
                    const { useCartStore: getCartStore } = await import('@/store/cartStore');
                    appliedDiscountCodes.forEach((code: string) => getCartStore.getState().removeDiscountCode(code));
                } catch (e) {
                    console.warn('Failed to remove invalid coupon from cart', e);
                }
            }

            Alert.alert('Order Failed', errorMessage);
        } finally {
            setOrderLoading(false);
        }
    };

    const handleProductPress = (item: any) => {
        router.push({ pathname: '/products/[id]', params: { id: item.productId } } as any);
    };

    const handleAddressSelection = () => {
        setShowAddressModal(true);
    };


    // Try & Buy badge: show when item has fashion or try-and-buy style tag
    const hasTryAndBuyTag = (it: { tags?: string[] | string }) => {
        const raw = it.tags;
        const tags = Array.isArray(raw) ? raw : (typeof raw === 'string' ? raw.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
        return tags.some((tag: string) => {
            const t = String(tag).trim().toLowerCase();
            if (t === 'fashion') return true;
            if (['try and buy', 'try & buy', 'try-and-buy', 'tryandbuy'].includes(t)) return true;
            if (t.includes('try') && t.includes('buy')) return true;
            return false;
        });
    };

    // Render cart item: row1 = title + quantity buttons; row2 = prices in same column as +/-
    const renderItem = (item: any) => {
        const compareAt = item.compareAtPrice && item.compareAtPrice > item.price ? item.compareAtPrice : null;
        const discountPct = compareAt ? Math.round(((compareAt - item.price) / compareAt) * 100) : 0;
        const showTryAndBuyBadge = hasTryAndBuyTag(item);
        const trialVariantId = item.customAttributes?.try_buy_trial_variant_id;
        const showTryBuyDetail = !!trialVariantId;
        /** Show sizes + Edit for any Try & Buy line, including before a try size is chosen */
        const showTryBuyUi = showTryAndBuyBadge || showTryBuyDetail;
        const primarySize = sizeLabelFromVariantTitle(item.variantTitle);
        const trialSize =
            item.customAttributes?.try_buy_trial_option_value ||
            sizeLabelFromVariantTitle(item.customAttributes?.try_buy_trial_variant_title);
        const showTbBadge = showTryAndBuyBadge || showTryBuyDetail;
        const unitTotal = item.price * (item.quantity || 1);
        const compareLineTotal = compareAt != null ? compareAt * (item.quantity || 1) : null;

        return (
            <View key={item.id} style={styles.cartItemRow}>
                <View style={styles.cartItemRowInner}>
                    <View style={styles.cartItemBlock}>
                        <TouchableOpacity
                            style={styles.itemImageAndTitleBlock}
                            onPress={() => handleProductPress(item)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.itemImageContainer}>
                                {showTbBadge && (
                                    <View style={styles.tryAndBuyBadgeCart}>
                                        <Text style={styles.tryAndBuyBadgeCartText}>Try & Buy</Text>
                                    </View>
                                )}
                                {item.image ? (
                                    <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
                                ) : (
                                    <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                                        <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                                    </View>
                                )}
                            </View>
                            <View style={styles.itemTitleBlock}>
                                <Text style={styles.itemTitle} numberOfLines={2}>
                                    {item.title}
                                </Text>
                                {showTryBuyUi ? (
                                    <View style={styles.tryBuyDetailBlock}>
                                        {primarySize ? (
                                            <Text style={styles.itemSizeLine}>Size: {primarySize}</Text>
                                        ) : null}
                                        {trialSize ? (
                                            <Text style={styles.itemTryBuySizeLine} ellipsizeMode="tail">
                                                Try & Buy Size: {trialSize}
                                            </Text>
                                        ) : null}
                                        <TouchableOpacity
                                            onPress={() => openTryBuyEdit(item)}
                                            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                                        >
                                            <Text style={styles.itemEditTryBuy}>Edit</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <Text style={styles.itemVariantSubtext} numberOfLines={1}>
                                        {item.variantTitle && item.variantTitle !== 'Default Title'
                                            ? `${item.variantTitle} • Pack of ${item.quantity}`
                                            : `Pack of ${item.quantity}`}
                                    </Text>
                                )}
                                {item.bookingDate && (
                                    <View style={styles.bookingDateContainer}>
                                        <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                                        <Text style={styles.bookingDateText}>
                                            {new Date(item.bookingDate).toLocaleDateString('en-US', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                        <View style={styles.quantityAndPriceRow}>
                            <View style={styles.quantityContainer}>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                >
                                    <Ionicons name="remove" size={16} color={Colors.primary} />
                                </TouchableOpacity>
                                <Text style={styles.quantityText}>{item.quantity}</Text>
                                <TouchableOpacity
                                    style={styles.quantityButton}
                                    onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                >
                                    <Ionicons name="add" size={16} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.itemPriceBlock}>
                                <View style={styles.itemPriceInline}>
                                    {compareLineTotal != null && (
                                        <Text style={styles.itemPriceStrikethrough}>
                                            {formatCurrency(compareLineTotal)}
                                        </Text>
                                    )}
                                    <Text style={styles.itemPrice}>
                                        {formatCurrency(showTryBuyUi ? unitTotal : item.price * item.quantity)}
                                    </Text>
                                </View>
                                {discountPct > 0 && (
                                    <Text style={styles.itemDiscountPct}>{discountPct}% off</Text>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar style="dark" />

            {/* Header - light beige to match page */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={20} color="#717680" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    {isTicketingOnly ? (
                        <Text style={styles.headerTitle}>Cart</Text>
                    ) : (
                        <TouchableOpacity
                            style={styles.headerAddressRow}
                            onPress={handleAddressSelection}
                            activeOpacity={0.7}
                        >
                            {selectedAddress ? (
                                <View style={styles.headerAddressContent}>
                                    <View style={styles.headerAddressTextBlock}>
                                        <View style={styles.headerAddressTagRow}>
                                            <Text style={styles.headerAddressTag} numberOfLines={1}>
                                                {selectedAddress.tag ? selectedAddress.tag.charAt(0).toUpperCase() + selectedAddress.tag.slice(1) : 'Address'}
                                                <Ionicons name="chevron-down" size={18} color="#717680" style={styles.headerAddressChevron} />
                                            </Text>
                                        </View>
                                        <Text style={styles.headerAddressLine} numberOfLines={1}>
                                            {selectedAddress.address1}
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View style={styles.headerAddressContent}>
                                    <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                                    <Text style={styles.headerAddressLine}>Add Delivery Address</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
                {/* <View style={styles.headerSpacer}>
                    {status === 'loading' && <ActivityIndicator color={Colors.primary} size="small" />}
                </View> */}
            </View>

            {cartItems.length > 0 && (
                <View style={styles.cartBodyColumn}>
                    {/* Total Savings Banner - full width, lighter green, thinner */}
                    {displaySavings > 0 && (
                        <View style={styles.savingsBanner}>
                            <Text style={styles.savingsBannerText}>Total Savings: {formatCurrency(displaySavings)}!</Text>
                        </View>
                    )}

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={[
                            styles.scrollContent,
                            // cartMilestoneExpanded ? { paddingBottom: 220 } : null,
                        ]}
                        showsVerticalScrollIndicator={false}
                    >

                        <View style={styles.cartMilestoneSlot}>
                            <MilestoneTracker
                                variant="embedded"
                                milestoneUI={milestoneUI}
                                onExpandedChange={setCartMilestoneExpanded}
                            />
                        </View>

                        {/* Free puzzle (milestone 2) or free shoes (milestone 3) — backend visibility + app milestone gate */}
                        {hasNonTicketingProducts && showPuzzleMilestoneUIF && (
                            <FreePuzzleBlock
                                visible
                                configRefreshKey={appConfigRefresh}
                                milestoneMinCartUnlocked={milestoneMinCartUnlocked}
                                selectedPuzzleId={selectedPuzzleId}
                                selectedPuzzleAge={selectedPuzzleAge}
                                onAddPress={() => { }}
                                onConfirmAgeItem={async (itemId, age) => {
                                    setSelectedPuzzle(itemId, age);
                                    if (hasKidPuzzleApplied) {
                                        return;
                                    }
                                    const rawOrig = (freePuzzleOfferConfig as { originalPrice?: number })?.originalPrice;
                                    const orig = typeof rawOrig === 'number' ? rawOrig : undefined;
                                    const result = await applyDiscountCode(freePuzzleGiftCodeUc, { originalPrice: orig });
                                    if (
                                        !result.success &&
                                        result.error &&
                                        !result.error.toLowerCase().includes('already applied')
                                    ) {
                                        Alert.alert('Coupon', result.error);
                                    }
                                }}
                                onRemoveOffer={async () => {
                                    setSelectedPuzzle(null, null);
                                    await removeDiscountCode(freePuzzleGiftCodeUc);
                                }}
                                appliedCouponOriginalPrice={kidPuzzleOriginalPrice}
                            />
                        )}
                        {hasNonTicketingProducts && showShoesMilestoneUIF && (
                            <FreePairShoes
                                visible
                                configRefreshKey={appConfigRefresh}
                                milestoneMinCartUnlocked={milestoneMinCartUnlocked}
                                selectedShoe={selectedShoe}
                                selectedShoeSize={selectedShoeSize}
                                onAddPress={() => { }}
                                onConfirmSize={async (shoeId, size) => {
                                    setSelectedShoeSize(size);
                                    setSelectedShoe(shoeId);
                                    if (hasFreeShoesGiftApplied) {
                                        return;
                                    }
                                    const rawOrig = (freeShoesOfferConfig as { originalPrice?: number })?.originalPrice
                                        ?? (freeShoesOfferConfig as { original_price?: number })?.original_price;
                                    const orig = typeof rawOrig === 'number' ? rawOrig : typeof rawOrig === 'string' ? parseFloat(rawOrig) : undefined;
                                    const originalPrice = orig != null && Number.isFinite(orig) && orig >= 0 ? orig : undefined;
                                    const result = await applyDiscountCode(freeShoesGiftCodeUc, { originalPrice });
                                    if (
                                        !result.success &&
                                        result.error &&
                                        !result.error.toLowerCase().includes('already applied')
                                    ) {
                                        Alert.alert('Coupon', result.error);
                                    }
                                }}
                                onRemoveOffer={async () => {
                                    setSelectedShoe(null);
                                    await removeDiscountCode(freeShoesGiftCodeUc);
                                }}
                                appliedCouponOriginalPrice={freeShoesGiftOriginalPrice}
                            />
                        )}

                        {hasNonTicketingProducts && showDiscountMilestoneUIF && (
                            <MilestoneDiscountBlock
                                visible
                                code={milestoneDiscountCodeUc}
                                title={activeMilestoneSlot?.header || '25% OFF'}
                                description={activeMilestoneSlot?.body || 'Get 25% off on your first order'}
                                firstMilestoneIcon={milestoneUI?.firstMilestoneIcon}
                                milestoneMinCartUnlocked={milestoneMinCartUnlocked}
                                isApplied={discountCodes.some(dc => dc.code.toUpperCase() === milestoneDiscountCodeUc)}
                                onAddPress={async () => {
                                    const rawOrig = (activeMilestoneSlot as any)?.originalPrice ?? (activeMilestoneSlot as any)?.original_price;
                                    const orig = typeof rawOrig === 'number' ? rawOrig : typeof rawOrig === 'string' ? parseFloat(rawOrig) : undefined;
                                    const originalPrice = orig != null && Number.isFinite(orig) && orig >= 0 ? orig : undefined;

                                    const result = await applyDiscountCode(milestoneDiscountCodeUc, { originalPrice });
                                    if (!result.success && result.error && !result.error.toLowerCase().includes('already applied')) {
                                        Alert.alert('Coupon', result.error);
                                    }
                                }}
                                onRemoveOffer={async () => {
                                    await removeDiscountCode(milestoneDiscountCodeUc);
                                }}
                                accentColor={activeMilestoneSlot?.activeColor}
                                backgroundColor={activeMilestoneSlot?.inactiveColor}
                            />
                        )}

                        {hasNonTicketingProducts && showMysteryMilestoneUIF && (
                            <MysteryGiftBlock
                                visible={showMysteryMilestoneUIF && !!freeMysteryGiftCodeUc}
                                code={freeMysteryGiftCodeUc}
                                title={milestoneUI?.milestoneFourth?.header || milestoneUI?.milestoneFourth?.title || 'Mystery Gift'}
                                description={milestoneUI?.milestoneFourth?.body || milestoneUI?.milestoneFourth?.description || 'You unlocked a mystery gift!'}
                                fourthMilestoneIcon={milestoneUI?.fourthMilestoneIcon}
                                milestoneMinCartUnlocked={milestoneMinCartUnlocked}
                                isApplied={discountCodes.some(dc => dc.code.toUpperCase() === freeMysteryGiftCodeUc)}
                                onAddPress={async () => {
                                    const rawOrig = (milestoneUI?.milestoneFourth as any)?.originalPrice ?? (milestoneUI?.milestoneFourth as any)?.original_price;
                                    const orig = typeof rawOrig === 'number' ? rawOrig : typeof rawOrig === 'string' ? parseFloat(rawOrig) : undefined;
                                    const originalPrice = orig != null && Number.isFinite(orig) && orig >= 0 ? orig : undefined;

                                    const result = await applyDiscountCode(freeMysteryGiftCodeUc, { originalPrice });
                                    if (!result.success && result.error && !result.error.toLowerCase().includes('already applied')) {
                                        Alert.alert('Coupon Error', result.error);
                                    }
                                }}
                                onRemoveOffer={() => removeDiscountCode(freeMysteryGiftCodeUc)}
                                accentColor={milestoneUI?.milestoneFourth?.activeColor || milestoneUI?.milestoneFourth?.color}
                                backgroundColor={milestoneUI?.milestoneFourth?.color ? `${milestoneUI.milestoneFourth.color}15` : undefined}
                            />
                        )}


                        {/* Delivery Information Card - when at least one non-ticketing product in cart */}
                        {hasNonTicketingProducts && cartFeatures.showDeliveryCard && (
                            <DeliveryCard
                                deliverySchedule={deliverySchedule}
                                onSchedulePress={() => setShowScheduleModal(true)}
                                estimatedDeliveryMinutes={
                                    estimatedDeliveryMinutes ?? etaFromGeocode ?? (detectedLocationStatus === 'serviceable' ? detectedEta : null)
                                }
                                isUnserviceable={
                                    (!defaultAddress && detectedLocationStatus === 'unserviceable') ||
                                    savedAddressOutsideDeliveryZone
                                }
                                showScheduleOfferBanner={Boolean(scheduledOfferConfig?.enabled && hasScheduledEligibleItems)}
                                offerTitle={scheduledOfferConfig?.title}
                                offerSubtitlePrefix={scheduledOfferConfig?.subtitlePrefix}
                                offerHighlightText={scheduledOfferConfig?.highlightText}
                            />
                        )}

                        {/* Cart Items - gift-wrapped first, then regular; "X added items" shown once with total */}
                        {itemsGiftWrapped.length > 0 && (
                            <View style={[styles.itemsSection, styles.itemsSectionGiftWrap]}>
                                <View style={styles.itemsHeader}>
                                    <Text style={styles.itemsHeaderText}>
                                        {totalCartItems} added items
                                    </Text>
                                </View>
                                {itemsGiftWrapped.map(item => renderItem(item))}
                                <View style={styles.giftWrapRibbonContainer}>
                                    <Image
                                        source={require('@/assets/images/ribbon.png')}
                                        style={styles.giftWrapRibbon}
                                        contentFit="cover"
                                    />
                                </View>
                            </View>
                        )}
                        {itemsNotGiftWrapped.length > 0 && (
                            <View style={styles.itemsSection}>
                                {itemsGiftWrapped.length === 0 && (
                                    <View style={styles.itemsHeader}>
                                        <Text style={styles.itemsHeaderText}>
                                            {totalCartItems} added items
                                        </Text>
                                    </View>
                                )}
                                {itemsNotGiftWrapped.map(item => renderItem(item))}
                            </View>
                        )}

                        {/* Gift Wrapping - when at least one non-ticketing product in cart */}
                        {hasNonTicketingProducts && cartFeatures.showGiftWrap && (
                            <GiftWrappingCard
                                giftWrapping={giftWrapping}
                                onSelectPress={() => setShowGiftModal(true)}
                                onRemovePress={() => setGiftWrapping(null)}
                            />
                        )}

                        {/* Complete your purchase with - horizontal product list from collection */}
                        {!hasTicketingProducts && cartFeatures.showCompletePurchaseSection && <CompletePurchaseSection />}

                        {cartFeatures.showSavingsCorner && (
                            <SavingsCorner
                                itemSubtotal={itemSubtotal}
                                isAuthenticated={isAuthenticated}
                                hasTicketingProducts={hasTicketingProducts}
                                hasFashionItems={hasFashionItems}
                                kiddoCashEnabled={kiddoCashEnabled}
                                walletBalance={walletBalance}
                                toPay={toPay}
                                kiddoCashApplied={kiddoCashApplied}
                                formatCurrency={formatCurrency}
                                onLoginPress={() => router.push('/(auth)/login')}
                                onKiddoCashChange={handleKiddoCashChange}
                                configRefreshKey={appConfigRefresh}
                            />
                        )}

                        <BillDetails
                            mrp={itemMrpTotal}
                            itemTotal={itemSubtotal}
                            isTicketingOnly={isTicketingOnly}
                            handlingFeeOriginal={HANDLING_FEE_ORIGINAL}
                            deliveryFeeOriginal={DELIVERY_FEE_ORIGINAL}
                            deliveryFee={deliveryFee}
                            platformFee={platformFeeDisplay}
                            couponDiscount={discount}
                            hasFreeShoesGift={hasFreeShoesGiftApplied}
                            freeShoesGiftOriginalPrice={freeShoesGiftOriginalPrice}
                            freeShoesCouponCode={freeShoesGiftCodeDisplay}
                            freeShoesTitle={freeShoesBillFromCoupon.title}
                            freeShoesDescription={freeShoesBillFromCoupon.description}
                            hasKidPuzzle={hasKidPuzzleApplied}
                            kidPuzzleOriginalPrice={kidPuzzleOriginalPrice}
                            freePuzzleCouponCode={freePuzzleGiftCodeDisplay}
                            freePuzzleTitle={freePuzzleBillFromCoupon.title}
                            freePuzzleDescription={freePuzzleBillFromCoupon.description}
                            hasMysteryGift={hasMysteryGiftApplied}
                            mysteryGiftOriginalPrice={mysteryGiftOriginalPrice}
                            mysteryGiftCouponCode={freeMysteryGiftCodeDisplay}
                            mysteryGiftTitle={mysteryBillFromCoupon.title}
                            mysteryGiftDescription={mysteryBillFromCoupon.description}
                            milestoneMysteryGiftLabel={undefined}
                            milestoneFreeShoesLabel={undefined}
                            milestoneFreePuzzleLabel={undefined}
                            milestoneConfigDiscount={milestoneConfigDiscountAmount}
                            milestoneConfigDiscountLabel={milestoneConfigDiscountLabel || undefined}
                            milestoneConfigDiscountDescription={discountCodes.find(dc => dc.code.toUpperCase() === milestoneDiscountCodeUc)?.couponDescription}
                            milestoneIsGiftBillDiscountTitle={undefined}
                            otherCouponDiscount={otherCouponDiscountAmount}
                            scheduledDeliveryDiscount={scheduledDeliveryDiscount}
                            scheduledDeliveryDiscountLabel={scheduledOfferConfig?.billLabel}
                            giftWrappingFee={giftWrappingFee}
                            giftWrapping={giftWrapping}
                            kiddoCashEnabled={kiddoCashEnabled}
                            kiddoCashApplied={kiddoCashApplied}
                            total={total}
                            toPay={toPay}
                            displaySavings={displaySavings}
                            formatCurrency={formatCurrency}
                        />

                        {/* Payment Method - show when cart has items (also selectable via footer "Pay using" modal) */}
                        {cartItems.length > 0 && total > 0 && (
                            <View style={styles.paymentMethodSection}>
                                <Text style={styles.paymentMethodSectionTitle}>Payment method</Text>
                                {/* Hide COD option for ticketing products and when COD is not available */}
                                {!hasTicketingProducts && isCodAvailable && (
                                    <TouchableOpacity
                                        style={styles.paymentMethodOption}
                                        onPress={() => {
                                            setPaymentMethod('cod');
                                            try {
                                                const { trackPaymentMethodSelected } = require('@/utils/mixpanelHelpers');
                                                trackPaymentMethodSelected('cod');
                                            } catch (e) {
                                                console.warn('Mixpanel tracking error:', e);
                                            }
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.paymentMethodIconWrap}>
                                            <CodIcon width={22} height={22} style={styles.paymentMethodCodIcon} />
                                        </View>
                                        <View style={styles.paymentMethodTextBlock}>
                                            <Text style={styles.paymentMethodOptionTitle}>Pay on delivery</Text>
                                            <Text style={styles.paymentMethodOptionSubtext}>Pay by cash or UPI on delivery</Text>
                                        </View>
                                        <View style={[styles.paymentMethodRadio, paymentMethod !== 'cod' && styles.paymentMethodRadioEmpty]}>
                                            {paymentMethod === 'cod' && <View style={styles.paymentMethodRadioInner} />}
                                        </View>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.paymentMethodOption}
                                    onPress={() => {
                                        setPaymentMethod('razorpay');
                                        try {
                                            const { trackPaymentMethodSelected } = require('@/utils/mixpanelHelpers');
                                            trackPaymentMethodSelected('razorpay');
                                        } catch (e) {
                                            console.warn('Mixpanel tracking error:', e);
                                        }
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.paymentMethodIconWrap, styles.paymentMethodIconWrapOnline]}>
                                        <RazorpayIcon width={33} height={33} style={styles.paymentMethodOnlineIcon} />
                                    </View>
                                    <View style={styles.paymentMethodTextBlock}>
                                        <Text style={styles.paymentMethodOptionTitle}>Pay online</Text>
                                        <Text style={styles.paymentMethodOptionSubtext}>Pay by card/ UPI/ Netbanking</Text>
                                    </View>
                                    <View style={[styles.paymentMethodRadio, paymentMethod !== 'razorpay' && styles.paymentMethodRadioEmpty]}>
                                        {paymentMethod === 'razorpay' && <View style={styles.paymentMethodRadioInner} />}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Nector Loyalty Coins Redemption */}
                        {/* <View style={styles.section}>
                            <CheckoutRedeemCoins
                                cartAmount={total}
                                onCouponApplied={(code) => {
                                    setCouponMessage(`✓ ${code} applied from rewards!`);
                                }}
                                onCouponRemoved={() => {
                                    setCouponMessage(null);
                                }}
                            />
                        </View> */}

                        {/* Spacer */}
                        <View style={styles.spacerEnd} />
                    </ScrollView>
                </View>
            )}

            {/* Footer - Only show when cart has items */}
            {cartItems.length > 0 && (
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={styles.footerContent}>
                        <CartFooterPayment
                            showPayButton={!!(selectedAddress || isTicketingOnly)}
                            paymentMethod={paymentMethod}
                            toPay={toPay}
                            formatCurrency={formatCurrency}
                            orderLoading={orderLoading || isApplyingCoupon}
                            isAuthenticated={isAuthenticated}
                            onPlaceOrder={handlePlaceOrder}
                            onAddAddress={handleAddressSelection}
                            onLoginPress={() => router.push('/(auth)/login')}
                            payButtonLabel={checkoutConfig?.payButtonLabel}
                            minOrderValueNotMet={itemSubtotal < appConfigService.getMinOrderValue()}
                            minOrderValue={appConfigService.getMinOrderValue()}
                            cartSubtotal={itemSubtotal}
                            hotWheelConfig={appConfigService.getHotWheelConfig()}
                        />
                    </View>
                </View>
            )}

            {/* Address Modal */}
            <AddressModal
                visible={showAddressModal}
                onClose={() => setShowAddressModal(false)}
                fromHome={false}
                returnToCart
            />

            {/* Gift Wrapping Modal */}
            <GiftWrappingModal
                visible={showGiftModal}
                onClose={() => setShowGiftModal(false)}
            />

            {/* Try And Buy Modal */}
            <TryAndBuyModal
                visible={showTryAndBuyModal}
                onClose={() => setShowTryAndBuyModal(false)}
            />

            <VariantSelectionModal
                visible={!!tryBuyEditProduct && !!tryBuyEditLine}
                product={tryBuyEditProduct}
                layout="sheet"
                mode="edit"
                initialPrimaryOptionValue={
                    tryBuyEditLine && tryBuyEditProduct
                        ? primaryOptionLabelFromLine(tryBuyEditProduct, tryBuyEditLine)
                        : null
                }
                initialTryOptionValue={
                    tryBuyEditLine?.customAttributes?.try_buy_trial_option_value ||
                    sizeLabelFromVariantTitle(tryBuyEditLine?.customAttributes?.try_buy_trial_variant_title) ||
                    null
                }
                onClose={closeTryBuyEdit}
                onAddToCart={handleTryBuyEditConfirm}
                onRemoveTryBuy={handleTryBuyRemoveTrial}
            />

            {/* Stock limit (quantity) modal */}
            <StockLimitModal
                visible={stockLimitModal.visible}
                maxQuantity={stockLimitModal.maxQty}
                onClose={() => setStockLimitModal((s) => ({ ...s, visible: false }))}
            />

            {/* Schedule Delivery Modal */}
            <ScheduleDeliveryModal
                visible={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                onConfirm={(schedule) => {
                    if (!schedule.date || !schedule.time) setDeliverySchedule(null);
                    else setDeliverySchedule(schedule);
                }}
                initialSchedule={deliverySchedule}
                title={checkoutConfig?.scheduleModalTitle}
            />
            <SchoolCouponModal
                visible={showSchoolModal}
                onClose={() => setShowSchoolModal(false)}
            />

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F5F5F5',
    },
    backButton: {
        padding: 4,
        marginRight: 8,
    },
    headerSpacer: {
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        justifyContent: 'center',
        minWidth: 0,
    },
    headerTitle: {
        fontSize: 18,
        color: '#1A1A1A',
        fontFamily: Fonts.Bold,
        textAlign: 'center',
    },
    headerAddressRow: {
        marginTop: 4,
    },
    headerAddressContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minWidth: 0,
    },
    headerAddressTextBlock: {
        flex: 1,
        minWidth: 0,
        marginLeft: 8,
    },
    headerAddressTagRow: {
        flexDirection: 'row',

        gap: 4,
    },
    headerAddressTag: {
        fontSize: 24,
        fontFamily: Fonts.FredokaSemiBold,
        fontWeight: 600,
        color: '#000000',
        flex: 1,
        minWidth: 0,
        gap: 4,
        lineHeight: 32,
    },
    headerAddressLine: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#535862',
        marginTop: 2,
    },
    savingsBanner: {
        backgroundColor: '#cef4da',
        marginTop: 0,

        paddingVertical: 8,
        borderRadius: 0,
        alignItems: 'center',
    },
    savingsBannerText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#118a45',
    },
    cartBodyColumn: {
        flex: 1,
        minHeight: 0,
    },
    cartMilestoneSlot: {
        position: 'relative',
        width: '100%',
        alignSelf: 'stretch',
        overflow: 'hidden',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        marginBottom: 12,
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 100,
        backgroundColor: '#F5F5F5',
    },
    tryAndBuySection: {
        backgroundColor: Colors.backgroundSecondary || '#F5F9FA',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
    },
    tryAndBuyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    tryAndBuyTitle: {
        fontSize: 16,
        color: '#000',
        fontFamily: Fonts.Bold,
    },
    knowMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    knowMoreText: {
        fontSize: 12,
        color: Colors.primary,
        marginRight: 4,
        fontFamily: Fonts.Regular,
    },
    tryAndBuyCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: Colors.primary,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: Colors.primary,
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#000',
        fontFamily: Fonts.Regular,
    },
    itemsSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        overflow: 'hidden',
    },
    itemsSectionGiftWrap: {
        paddingBottom: 0,
        marginBottom: 24,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
    },
    itemsHeader: {
        marginBottom: 12,
    },
    itemsHeaderText: {
        fontSize: Fonts.SmallFontSize,
        color: '#717680',
        fontFamily: Fonts.LexendBold,
    },
    giftWrapRibbonContainer: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    giftWrapRibbon: {
        width: '100%',
        height: 36,
    },
    cartItemRow: {
        marginBottom: 24,
        width: '100%',
    },
    cartItemRowInner: {
        width: '100%',
        overflow: 'hidden',
    },
    cartItemBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'nowrap',
        width: '100%',
    },
    itemImageAndTitleBlock: {
        flexDirection: 'row',
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-start',
        marginRight: 12,
        maxWidth: '100%',
    },
    itemImageContainer: {
        position: 'relative',
        marginRight: 12,
    },
    itemImage: {
        width: 72,
        height: 72,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
        borderWidth: 1,
        borderColor: '#E5E5E5',
    },
    itemImagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    tryAndBuyBadgeCart: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: '#FEF7C3',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderTopLeftRadius: 8,
        borderBottomRightRadius: 8,
        zIndex: 1,
    },
    tryAndBuyBadgeCartText: {
        color: '#EAAA08',
        fontSize: 10,
        fontFamily: Fonts.Bold,
    },
    itemInfo: {
        flex: 1,
        marginLeft: 12,
    },
    itemTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemTitleBlock: {
        flex: 1,
        minWidth: 0,
        marginRight: 12,
    },
    quantityAndPriceRow: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        maxWidth: 120,
    },
    itemTitle: {
        fontSize: Fonts.SmallFontSize,
        lineHeight: 20,
        color: '#181D27',
        marginBottom: 2,
        fontFamily: Fonts.LexendBold,
    },
    itemVariantSubtext: {
        fontSize: Fonts.ExtraSmallFontSize,
        color: '#717680',
        fontFamily: Fonts.LexendMedium,
        marginTop: 6,
    },
    tryBuyDetailBlock: {
        marginTop: 6,
        gap: 4,
    },
    itemSizeLine: {
        fontSize: Fonts.ExtraSmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.LexendSemiBold,
    },
    itemTryBuySizeLine: {
        fontSize: 11,
        color: '#717680',
        fontFamily: Fonts.LexendMedium,
    },
    itemEditTryBuy: {
        fontSize: Fonts.ExtraSmallFontSize,
        color: Colors.variantSelection,
        fontFamily: Fonts.LexendSemiBold,
        textDecorationLine: 'underline',
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    itemPriceBlock: {
        alignItems: 'center',
    },
    itemPriceInline: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemPriceStrikethrough: {
        fontSize: 12,
        color: '#999',
        fontFamily: Fonts.Regular,
        textDecorationLine: 'line-through',
    },
    itemPrice: {
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.LexendBold,
    },
    itemDiscountPct: {
        fontSize: 11,
        color: '#28A745',
        fontFamily: Fonts.SemiBold,
        marginTop: 2,
    },
    bookingDateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        backgroundColor: '#FFF5F5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    bookingDateText: {
        fontSize: 11,
        fontFamily: Fonts.Medium,
        color: Colors.primary,
        marginLeft: 4,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    spacer: {
        flex: 1,
    },
    spacerEnd: {
        height: 20,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F15E5E',
        borderRadius: 12,
        paddingVertical: 2,
        paddingHorizontal: 2,
        backgroundColor: '#FEEFEF',
    },
    quantityButton: {
        paddingVertical: 4,
        paddingHorizontal: 6,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 24,
    },
    quantityText: {
        fontSize: Fonts.SmallFontSize,
        marginHorizontal: 6,
        minWidth: 18,
        textAlign: 'center',
        fontFamily: Fonts.LexendBold,
        color: '#181D27',
    },
    couponsModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    couponsModalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        paddingBottom: 34,
    },
    couponsModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    couponsModalTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    couponsModalScroll: {
        maxHeight: 400,
        padding: 16,
    },
    couponModalCard: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    couponModalCardWhite: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    couponModalCardSelected: {
        borderColor: Colors.primary,
        borderWidth: 1.5,
    },
    giftWrappingRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    giftWrappingPrice: {
        fontSize: 16,
        color: Colors.primary,
        fontFamily: Fonts.Bold,
        marginRight: 8,
    },
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 28,
    },
    sectionTitle: {
        fontSize: 16,
        marginBottom: 10,
        color: '#000',
        fontFamily: Fonts.SemiBold,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: '#f8f8f8',
    },
    paymentOptionSelected: {
        backgroundColor: `${Colors.primary}10`,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    paymentOptionContent: {
        marginLeft: 8,
    },
    paymentOptionText: {
        fontSize: 14,
        color: '#000',
        marginLeft: 8,
        fontFamily: Fonts.SemiBold,
    },
    paymentOptionSubtext: {
        fontSize: 12,
        color: '#666',
        marginLeft: 8,
        marginTop: 2,
        fontFamily: Fonts.Regular,
    },
    paymentMethodSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 8,
        paddingTop: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    paymentMethodSectionTitle: {
        fontSize: Fonts.SmallFontSize,
        marginBottom: 14,
        color: '#717680',
        fontFamily: Fonts.LexendBold,
        marginLeft: 6,
    },
    paymentMethodOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
    },
    paymentMethodIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 10,

        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    paymentMethodCodIcon: {
        width: 22,
        height: 22,
    },
    paymentMethodIconWrapOnline: {
        width: 44,
        height: 44,

    },
    paymentMethodOnlineIcon: {
        width: 44,
        height: 44,
    },
    paymentMethodTextBlock: {
        flex: 1,
    },
    paymentMethodOptionTitle: {
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.LexendBold,
    },
    paymentMethodOptionSubtext: {
        fontSize: Fonts.ExtraSmallFontSize,
        color: '#535862',
        marginTop: 2,
        fontFamily: Fonts.LexendMedium,
    },
    paymentMethodRadio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentMethodRadioEmpty: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: '#d1d5db',
    },
    paymentMethodRadioInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#fff',
    },
    couponContainer: {
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
    },
    applyButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        minWidth: 80,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    applyButtonDisabled: {
        opacity: 0.5,
    },
    applyButtonText: {
        color: '#fff',
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
        letterSpacing: 0.3,
    },
    couponMessageContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    couponMessage: {
        fontSize: 12,
        color: '#ff4444',
        fontFamily: Fonts.Regular,
        flex: 1,
    },
    couponMessageSuccess: {
        color: '#4caf50',
    },
    appliedCouponsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
        gap: 6,
    },
    couponChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 6,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    couponChipText: {
        color: '#fff',
        fontSize: 11,
        fontFamily: Fonts.SemiBold,
        letterSpacing: 0.3,
    },
    couponRemove: {
        padding: 2,
        marginLeft: 2,
    },
    availableCouponsContainer: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    availableCouponsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 6,
    },
    availableCouponsTitle: {
        fontSize: 13,
        color: '#666',
        fontFamily: Fonts.Medium,
        letterSpacing: 0.2,
    },
    couponsLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 8,
    },
    couponsLoadingText: {
        fontSize: 11,
        color: '#999',
        fontFamily: Fonts.Regular,
    },
    noCouponsText: {
        fontSize: 13,
        color: '#999',
        fontFamily: Fonts.Regular,
        paddingVertical: 12,
    },
    couponLoginPrompt: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e9ecef',
    },
    couponLoginText: {
        fontSize: 13,
        color: '#666',
        fontFamily: Fonts.Medium,
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 12,
    },
    couponNotAvailablePrompt: {
        backgroundColor: '#FFF3E0',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFE0B2',
    },
    couponNotAvailableText: {
        fontSize: 13,
        color: '#E65100',
        fontFamily: Fonts.Medium,
        marginLeft: 8,
        flex: 1,
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
    couponsList: {
        paddingRight: 4,
        gap: 8,
    },
    couponCard: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
        minWidth: 120,
        borderWidth: 1,
        borderColor: '#e8e8e8',
        marginRight: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        position: 'relative',
    },
    couponCardApplied: {
        backgroundColor: '#f8f9ff',
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
    couponConditionTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 2,
    },
    couponConditionText: {
        fontSize: 9,
        color: '#666',
        fontFamily: Fonts.Regular,
        lineHeight: 12,
    },
    appliedBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: Colors.primary,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FAF9F7',
        borderTopWidth: 1,
        borderTopColor: '#e8e6e3',
    },
    footerContent: {
        padding: 0,
    },
    footerPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    footerTotal: {
        fontSize: 20,
        color: '#000',
        marginRight: 8,
        fontFamily: Fonts.Bold,
    },
    footerLabel: {
        fontSize: 12,
        color: '#666',
        fontFamily: Fonts.Regular,
    },
    tryAndBuyButton: {
        backgroundColor: '#FF9800',
    },
    headerAddressChevron: {
        marginLeft: 16,
    },
});
