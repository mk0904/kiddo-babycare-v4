import { BillDetails } from '@/components/cart/BillDetails';
import { CartFooterPayment } from '@/components/cart/CartFooterPayment';
import { CompletePurchaseSection } from '@/components/cart/CompletePurchaseSection';
import { DeliveryCard } from '@/components/cart/DeliveryCard';
import { FreePairShoes } from '@/components/cart/FreePairShoes';
import { GiftWrappingCard } from '@/components/cart/GiftWrappingCard';
import { SavingsCorner } from '@/components/cart/SavingsCorner';
import { AddressModal } from '@/components/modals/AddressModal';
import { GiftWrappingModal } from '@/components/modals/GiftWrappingModal';
import { DeliverySchedule, ScheduleDeliveryModal } from '@/components/modals/ScheduleDeliveryModal';
import { StockLimitModal } from '@/components/modals/StockLimitModal';
import { useDeliveryStatus } from '@/components/ui/EstimatedDeliveryTime';
import TryAndBuyModal from '@/components/ui/TryAndBuyModal';
import {
    calculateDistance,
    DARK_STORE_LOCATION,
    estimateDeliveryTime,
    geocodeAddress,
    getDeliveryTimeFromGoogleMaps,
} from '@/config/deliveryConfig';
import { Colors, Fonts } from '@/constants/theme';
import { useAddress } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useTryAndBuy } from '@/context/TryAndBuyContext';
import { appConfigService, type AppConfigPayload } from '@/services/appConfigService';
import PaymentService from '@/services/paymentService';
import {
    useCartId,
    useCartItems,
    useCartStatus,
    useCartStore,
    useCartTotal,
    useCheckoutUrl,
    useGiftWrapping,
    useIsTryAndBuy
} from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
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
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CartScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Track cart viewed on mount
    useEffect(() => {
        const trackCartView = async () => {
            try {
                const { trackCartViewed } = require('@/utils/mixpanelHelpers');
                const itemCount = cartItems.length;
                const cartValue = itemSubtotal;
                trackCartViewed(itemCount, cartValue);
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
            appVersion: Constants.expoConfig?.version ?? undefined,
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
    const { deliveryTime: estimatedDeliveryMinutes } = useDeliveryStatus(
        defaultAddress?.latitude,
        defaultAddress?.longitude,
        defaultAddress ?? undefined
    );
    // When address has no lat/lon, useDeliveryStatus returns null and we'd show default 30.
    // Match homepage: geocode then compute ETA (Google Maps + distance fallback) so cart shows same mins as homepage.
    const [etaFromGeocode, setEtaFromGeocode] = useState<number | null>(null);
    const hasCoords = defaultAddress?.latitude != null && defaultAddress?.longitude != null;
    useEffect(() => {
        if (!defaultAddress || hasCoords) {
            setEtaFromGeocode(null);
            return;
        }
        let cancelled = false;
        const run = async () => {
            const addressString = `${defaultAddress.address1 || ''} ${defaultAddress.city || ''} ${defaultAddress.state || ''} ${defaultAddress.pincode || ''}`.trim();
            if (!addressString) return;
            const coords = await geocodeAddress(addressString);
            if (cancelled || !coords) return;
            let deliveryTime = await getDeliveryTimeFromGoogleMaps(coords.latitude, coords.longitude);
            if (deliveryTime == null) {
                const distanceKm = calculateDistance(
                    DARK_STORE_LOCATION.latitude,
                    DARK_STORE_LOCATION.longitude,
                    coords.latitude,
                    coords.longitude
                );
                deliveryTime = estimateDeliveryTime(distanceKm);
            }
            if (!cancelled) setEtaFromGeocode(deliveryTime);
        };
        run();
        return () => { cancelled = true; };
    }, [defaultAddress?.id, hasCoords, defaultAddress?.address1, defaultAddress?.city, defaultAddress?.state, defaultAddress?.pincode]);

    useTryAndBuy(); // Try & Buy is tag-only; checkout always uses normal order flow below

    // Use Zustand store
    const cartItems = useCartItems();
    const cartTotal = useCartTotal();
    const isTryAndBuy = useIsTryAndBuy();
    const giftWrapping = useGiftWrapping();
    const status = useCartStatus();
    const cartId = useCartId();
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
    const discountCodes = useCartStore(state => state.discountCodes);
    const discountAmount = useCartStore(state => state.discountAmount());
    const mrp = useCartStore(state => state.mrp());
    const ensureCart = useCartStore(state => state.ensureCart);
    const getCheckoutUrl = useCartStore(state => state.getCheckoutUrl);

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
    const itemSubtotalForOffers = useMemo(
        () => cartItems.reduce((s, i) => s + Number(i.price ?? 0) * Number(i.quantity), 0),
        [cartItems]
    );
    // Refetch app config when cart screen is focused (with cart context so backend can return offer visibility)
    useFocusEffect(
        useCallback(() => {
            const payload: AppConfigPayload = {
                phone: user?.phone ?? undefined,
                customerId: (user?.customerId ?? user?.id) != null ? String(user?.customerId ?? user?.id) : undefined,
                appVersion: Constants.expoConfig?.version ?? undefined,
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
            appVersion: Constants.expoConfig?.version ?? undefined,
            deviceType: Platform.OS,
            cartSubtotal: itemSubtotalForOffers > 0 ? itemSubtotalForOffers : undefined,
            cartCategories: cartCategoryTags.length > 0 ? cartCategoryTags.join(',') : undefined,
        };
        appConfigService.loadAppConfig(true, payload).then(() => {
            if (!cancelled) setAppConfigRefresh((r) => r + 1);
        });
        return () => { cancelled = true; };
    }, [user?.phone, user?.customerId, user?.id, cartCategoryTags.join(','), itemSubtotalForOffers]);
    const freeShoesOfferConfig = useMemo(
        () => appConfigService.getCartConfig()?.freeShoesOffer,
        [appConfigRefresh]
    );
    /** Visibility is backend-only: app just reads freeShoesOffer.visible from config (no local rules). */
    const showFreeShoesByBackend = freeShoesOfferConfig?.visible !== false;

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
    const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule | null>(null);
    const [kiddoCashEnabled, setKiddoCashEnabled] = useState(false);
    const [stockLimitModal, setStockLimitModal] = useState<{ visible: boolean; maxQty: number }>({ visible: false, maxQty: 0 });

    // Redirect back if cart is empty
    useEffect(() => {
        if (!loading && cartItems.length === 0) {
            router.back();
        }
    }, [loading, cartItems.length, router]);

    // Automatically switch to razorpay if COD is selected and ticketing products are added
    useEffect(() => {
        if (hasTicketingProducts && paymentMethod === 'cod') {
            setPaymentMethod('razorpay');
        }
    }, [hasTicketingProducts, paymentMethod]);

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

    // Calculate subtotal from lineItems (like gauntlet does in payment-details)
    let itemSubtotal = 0;
    for (const item of cartItems) {
        itemSubtotal += Number(item.price ?? 0) * Number(item.quantity);
    }

    // Calculate discount ourselves from discountCodes (don't trust Shopify's discount value)
    let calculatedDiscount = 0;

    // Debug: Log discountCodes to see what we have
    if (__DEV__) {
        console.log('[CartScreen] discountCodes from store:', discountCodes);
        console.log('[CartScreen] discountCodes length:', discountCodes?.length);
    }

    // Use discount values from cart store (source: backend API only, not config)
    if (discountCodes && discountCodes.length > 0) {
        for (const discountCode of discountCodes) {
            if (__DEV__) {
                console.log('[CartScreen] Processing discount code:', discountCode);
            }

            const shouldProcess = discountCode.applicable !== false;
            const discountValue = discountCode.value;
            const discountType = discountCode.type;

            if (shouldProcess && discountValue > 0) {
                let codeDiscount = 0;
                if (discountType === 'percentage') {
                    codeDiscount = (itemSubtotal * discountValue) / 100;
                } else if (discountType === 'fixed') {
                    codeDiscount = discountValue;
                }
                if (discountCode.maxDiscountAmount != null && discountCode.maxDiscountAmount > 0) {
                    codeDiscount = Math.min(codeDiscount, discountCode.maxDiscountAmount);
                }
                calculatedDiscount += codeDiscount;
                if (__DEV__) {
                    console.log('[CartScreen] Applied discount:', {
                        code: discountCode.code,
                        type: discountType,
                        value: discountValue,
                        itemSubtotal,
                        codeDiscount,
                        maxDiscountAmount: discountCode.maxDiscountAmount,
                        calculatedDiscount,
                    });
                }
            } else {
                if (__DEV__) {
                    if (!shouldProcess) {
                        console.log('[CartScreen] Discount code not applicable:', discountCode.code);
                    } else {
                        console.warn('[CartScreen] Discount code has no value:', discountCode);
                    }
                }
            }
        }
    } else {
        if (__DEV__) {
            console.log('[CartScreen] No discount codes found in store');
        }
    }

    // Use our calculated discount instead of Shopify's
    // Cap the discount to not exceed the subtotal (for fixed discounts)
    const discount = Math.min(calculatedDiscount, itemSubtotal);

    // Debug log
    if (__DEV__) {
        console.log('[CartScreen] Final discount calculation:', {
            discountCodes,
            discountCodesLength: discountCodes?.length,
            calculatedDiscount,
            discount,
            itemSubtotal,
        });
    }

    // Subtotal after discount
    const subtotalAfterDiscount = Math.max(0, itemSubtotal - discount);

    const deliveryFee = 0;
    // Gift wrap fee: only for products still in cart; recalculates when items are removed from cart or from gift wrap
    const giftWrappingFee = hasTicketingProducts ? 0 : derivedGiftWrappingFee;
    // Platform fee for display only (ticket-only): shown struck + FREE, not added to total
    const PLATFORM_FEE_DISPLAY = 20;
    const platformFeeDisplay = isTicketingOnly ? PLATFORM_FEE_DISPLAY : 0;

    // Final total - ALWAYS calculate from our lineItems, not from Shopify's payment.total (platform fee not added)
    const total = subtotalAfterDiscount + deliveryFee + giftWrappingFee;
    const totalSavings = Math.max(0, mrp - subtotalAfterDiscount);

    // Bill details display constants (for UX only; Kiddo Cash is dummy)
    const HANDLING_FEE_ORIGINAL = 10;
    const DELIVERY_FEE_ORIGINAL = 50;
    const KIDDO_CASH_APPLIED = 250;
    const toPay = Math.max(0, total - (kiddoCashEnabled ? KIDDO_CASH_APPLIED : 0));
    const displaySavings =
      totalSavings +
      (isTicketingOnly ? PLATFORM_FEE_DISPLAY : HANDLING_FEE_ORIGINAL + DELIVERY_FEE_ORIGINAL) +
      (kiddoCashEnabled ? KIDDO_CASH_APPLIED : 0);

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
        await removeItem(itemId);
    };

    const handlePlaceOrder = async () => {
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
            return;
        }

        // For physical products, require a real delivery address (not the ticketing placeholder).
        // Users who bought ticketing first may have only the placeholder saved; prompt them to add address.
        if (!isTicketingOnly && !hasValidDeliveryAddress) {
            setShowAddressModal(true);
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
            phone: user?.phone || '9999999999'
        };

        setOrderLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Track Checkout Started
        try {
            const { trackEvent } = require('@/utils/mixpanelHelpers');
            trackEvent('Checkout Started', {
                cartValue: cartTotal,
                itemCount: cartItems.length,
                hasCoupon: discountCodes.length > 0,
                paymentMethod: paymentMethod || 'not_selected',
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
                const variantIds = cartItems.map(item => item.variantId);
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
                for (const item of cartItems) {
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
            const isFreeOrder = toPay === 0;
            const chosenPayment = paymentMethod === 'cod' ? 'cod' : 'razorpay';
            const effectivePaymentMethod = isFreeOrder ? 'free' : chosenPayment;

            // Prepare order data with full checkout details for backend/Shopify
            const orderData = {
                items: cartItems.map(item => ({
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
                })),
                totalAmount: toPay,
                currencyCode: 'INR',
                email: user?.email || 'guest@example.com',
                phone: user?.phone || billingAddress.phone || '',
                name: user?.displayName || `${billingAddress.firstName} ${billingAddress.lastName}`,
                customerId: user?.id,
                address: {
                    name: `${billingAddress.firstName} ${billingAddress.lastName}`,
                    address: [billingAddress.address1, billingAddress.address2].filter(Boolean).join(', '),
                    city: billingAddress.city,
                    state: billingAddress.province,
                    pincode: billingAddress.zip,
                    phone: billingAddress.phone,
                },
                giftWrapping: giftWrapping ? {
                    name: giftWrapping.name,
                    price: giftWrapping.price
                } : undefined,
                couponCode: appliedDiscountCode || undefined,
                discountAmount: discount > 0 ? discount : undefined,
                deliverySchedule: deliverySchedule || undefined,
                deliveryType: (deliverySchedule?.date && deliverySchedule?.time) ? ('scheduled' as const) : ('instant' as const),
                paymentMethod: effectivePaymentMethod as 'razorpay' | 'cod' | 'free' | 'try_and_buy',
                billDetails: {
                    subtotal: itemSubtotal,
                    subtotalAfterDiscount,
                    deliveryFee,
                    giftWrappingFee,
                    discount,
                    total: toPay,
                    currencyCode: 'INR',
                },
                selectedShoe: selectedShoe || undefined,
                selectedShoeSize: selectedShoeSize || undefined,
                isTryAndBuy: isTryAndBuy,
            };

            // Call Payment Service
            console.log('Calling PaymentService.createOrderWithPayment...');

            // For Pay Online, sync Shopify cart discount codes to match our store so the backend doesn't apply a stale coupon from the cart
            if (effectivePaymentMethod === 'razorpay') {
                try {
                    const cartId = await ensureCart();
                    if (cartId && cartId.startsWith('gid://shopify/Cart/')) {
                        const { shopifyApi } = await import('@/services/shopifyApi');
                        await shopifyApi.applyDiscountCodes(cartId, appliedDiscountCodes || []);
                    }
                } catch (syncErr) {
                    console.warn('[Cart] Failed to sync discount codes to Shopify before Pay Online', syncErr);
                }
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
                            couponCode: appliedDiscountCode || undefined,
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

                // Track Payment Failed
                try {
                    const { trackEvent } = require('@/utils/mixpanelHelpers');
                    trackEvent('Payment Failed', {
                        orderId: result.order?.id || 'unknown',
                        amount: cartTotal,
                        paymentMethod: paymentMethod || 'cod',
                        reason: result.error || 'Order creation failed',
                    });
                } catch (e) {
                    console.warn('Analytics tracking error:', e);
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
                const { trackEvent, trackOrderPlaced, trackFirstOrderPlaced } = require('@/utils/mixpanelHelpers');
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                const effectivePaymentMethod = isFreeOrder ? 'free' : (paymentMethod === 'cod' ? 'cod' : 'razorpay');

                const hasPlacedOrder = await AsyncStorage.getItem('has_placed_order');
                if (!hasPlacedOrder) {
                    trackFirstOrderPlaced(orderIdForDisplay, cartTotal);
                    await AsyncStorage.setItem('has_placed_order', 'true');
                }
                trackOrderPlaced(orderIdForDisplay, cartTotal, cartItems.length, effectivePaymentMethod);
                trackEvent('Payment Success', {
                    orderId: orderIdForDisplay,
                    amount: cartTotal,
                    paymentMethod: effectivePaymentMethod,
                    itemCount: cartItems.length,
                    hasCoupon: discountCodes.length > 0,
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
                            total: total.toString(),
                            ...(resolvedEta != null && { estimatedDeliveryMinutes: String(resolvedEta) }),
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
        router.push({ pathname: '/product/[id]', params: { id: item.productId } } as any);
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

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cartItemRow}
                onPress={() => handleProductPress(item)}
                activeOpacity={0.7}
            >
                <View style={styles.itemImageContainer}>
                    {showTryAndBuyBadge && (
                        <View style={styles.tryAndBuyBadgeCart}>
                            <Text style={styles.tryAndBuyBadgeCartText}>Try & Buy</Text>
                        </View>
                    )}
                    <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
                </View>
                <View style={styles.itemInfo}>
                    {/* Row 1: Title + variant on left; quantity +/- and prices (same row, vertically centered) on right */}
                    <View style={styles.itemTopRow}>
                        <View style={styles.itemTitleBlock}>
                            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                            <Text style={styles.itemVariantSubtext} numberOfLines={1}>
                                {item.variantTitle && item.variantTitle !== 'Default Title'
                                    ? `${item.variantTitle} • Pack of ${item.quantity}`
                                    : `Pack of ${item.quantity}`}
                            </Text>
                            {item.bookingDate && (
                                <View style={styles.bookingDateContainer}>
                                    <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                                    <Text style={styles.bookingDateText}>
                                        {new Date(item.bookingDate).toLocaleDateString('en-US', {
                                            weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                                        })}
                                    </Text>
                                </View>
                            )}
                        </View>
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
                                    {compareAt != null && (
                                        <Text style={styles.itemPriceStrikethrough}>{formatCurrency(compareAt)}</Text>
                                    )}
                                    <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                                </View>
                                {discountPct > 0 && (
                                    <Text style={styles.itemDiscountPct}>{discountPct}% off</Text>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
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
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
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
                                                <Ionicons name="chevron-down" size={18} color="#666" style={styles.headerAddressChevron} />
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
                <View style={styles.headerSpacer} />
            </View>

            {cartItems.length > 0 && (
                <>
                    {/* Total Savings Banner - full width, lighter green, thinner */}
                    {displaySavings > 0 && (
                        <View style={styles.savingsBanner}>
                            <Text style={styles.savingsBannerText}>Total Savings: {formatCurrency(displaySavings)}!</Text>
                        </View>
                    )}
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >

                        {/* Delivery Information Card - when at least one non-ticketing product in cart */}
                        {hasNonTicketingProducts && cartFeatures.showDeliveryCard && (
                            <DeliveryCard
                                deliverySchedule={deliverySchedule}
                                onSchedulePress={() => setShowScheduleModal(true)}
                                estimatedDeliveryMinutes={
                                    estimatedDeliveryMinutes ?? etaFromGeocode ?? (detectedLocationStatus === 'serviceable' ? detectedEta : null)
                                }
                                isUnserviceable={!defaultAddress && detectedLocationStatus === 'unserviceable'}
                            />
                        )}

                        {/* Introductory Offer - Free Pair of Shoes (same logic as FreeShoesOffer modal) */}
                        {hasNonTicketingProducts && cartFeatures.showFreePairShoes && showFreeShoesByBackend && (
                            <FreePairShoes
                                visible
                                configRefreshKey={appConfigRefresh}
                                selectedShoe={selectedShoe}
                                selectedShoeSize={selectedShoeSize}
                                onAddPress={() => {}}
                                onConfirmSize={(shoeId, size) => {
                                    setSelectedShoeSize(size);
                                    setSelectedShoe(shoeId);
                                }}
                                onRemoveOffer={() => setSelectedShoe(null)}
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
                                formatCurrency={formatCurrency}
                                onLoginPress={() => router.push('/(auth)/login')}
                                onKiddoCashChange={setKiddoCashEnabled}
                            />
                        )}

                        <BillDetails
                            mrp={mrp}
                            itemTotal={subtotalAfterDiscount}
                            isTicketingOnly={isTicketingOnly}
                            handlingFeeOriginal={HANDLING_FEE_ORIGINAL}
                            deliveryFeeOriginal={DELIVERY_FEE_ORIGINAL}
                            platformFee={platformFeeDisplay}
                            couponDiscount={discountAmount}
                            giftWrappingFee={giftWrappingFee}
                            giftWrapping={giftWrapping}
                            kiddoCashEnabled={kiddoCashEnabled}
                            kiddoCashApplied={KIDDO_CASH_APPLIED}
                            total={total}
                            toPay={toPay}
                            displaySavings={displaySavings}
                            formatCurrency={formatCurrency}
                        />

                        {/* Payment Method - show when cart has items (also selectable via footer "Pay using" modal) */}
                        {cartItems.length > 0 && total > 0 && (
                            <View style={styles.paymentMethodSection}>
                                <Text style={styles.paymentMethodSectionTitle}>Payment method</Text>
                                {/* Hide COD option for ticketing products */}
                                {!hasTicketingProducts && (
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
                                            <Image source={require('@/assets/icons/cod.png')} style={styles.paymentMethodCodIcon} contentFit="contain" />
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
                                        <Image source={require('@/assets/icons/online_pay.png')} style={styles.paymentMethodOnlineIcon} contentFit="contain" />
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
                </>
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
                            orderLoading={orderLoading}
                            isAuthenticated={isAuthenticated}
                            onPlaceOrder={handlePlaceOrder}
                            onAddAddress={handleAddressSelection}
                            payButtonLabel={checkoutConfig?.payButtonLabel}
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

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FDF6EC',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FDF6EC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FDF6EC',
    },
    backButton: {
        padding: 4,
    },
    headerSpacer: {
        width: 32,
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
        fontSize: 20,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
        flex: 1,
        minWidth: 0,
    },
    headerAddressLine: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        color: '#666',
        marginTop: 2,
    },
    savingsBanner: {
        backgroundColor: '#6BCB77',
        marginHorizontal: -16,
        marginTop: 0,
        marginBottom: 12,
        paddingVertical: 8,
        borderRadius: 0,
        alignItems: 'center',
    },
    savingsBannerText: {
        fontSize: 15,
        fontFamily: Fonts.Bold,
        color: '#fff',
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#FDF6EC',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 0,
        paddingBottom: 200,
        backgroundColor: '#FDF6EC',
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
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    itemsSectionGiftWrap: {
        paddingBottom: 0,
        overflow: 'hidden',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    itemsHeader: {
        marginBottom: 12,
    },
    itemsHeaderText: {
        fontSize: 14,
        color: '#717680',
        fontFamily: Fonts.SemiBold,
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
        flexDirection: 'row',
        marginBottom: 16,
    },
    itemImageContainer: {
        position: 'relative',
        marginRight: 12,
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
        borderWidth: 1,
        borderColor: '#E5E5E5',
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
        marginRight: 12,
    },
    quantityAndPriceRow: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
    },
    itemTitle: {
        fontSize: 14,
        color: '#1A1A1A',
        marginBottom: 2,
        fontFamily: Fonts.SemiBold,
    },
    itemVariantSubtext: {
        fontSize: 12,
        color: '#717680',
        fontFamily: Fonts.SemiBold,
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
        fontSize: 14,
        color: '#1A1A1A',
        fontFamily: Fonts.Bold,
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
        borderWidth: 1.5,
        borderColor: Colors.primary,
        borderRadius: 16,
        paddingVertical: 4,
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
        fontSize: 13,
        marginHorizontal: 6,
        minWidth: 18,
        textAlign: 'center',
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
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
        marginBottom: 15,
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
        padding: 16,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    paymentMethodSectionTitle: {
        fontSize: 16,
        marginBottom: 14,
        color: '#717680',
        fontFamily: Fonts.Bold,
    },
    paymentMethodOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
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
        fontSize: 15,
        color: '#181D27',
        fontFamily: Fonts.Bold,
    },
    paymentMethodOptionSubtext: {
        fontSize: 13,
        color: '#535862',
        marginTop: 2,
        fontFamily: Fonts.SemiBold,
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
        padding: 15,
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
        marginLeft: 8,
    },
});
