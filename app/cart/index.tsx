import FreeShoesOffer from '@/components/cart/FreeShoesOffer';
import { AddressModal } from '@/components/modals/AddressModal';
import { FreeShoesOffer as FreeShoesOfferModal } from '@/components/modals/FreeShoesOffer';
import { GiftWrappingModal } from '@/components/modals/GiftWrappingModal';
import { DeliverySchedule, ScheduleDeliveryModal } from '@/components/modals/ScheduleDeliveryModal';
import { CheckoutRedeemCoins } from '@/components/nector';
import TryAndBuyModal from '@/components/ui/TryAndBuyModal';
import { Colors, Fonts } from '@/constants/theme';
import { useAddress } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useTryAndBuy } from '@/context/TryAndBuyContext';
import { couponService } from '@/services/couponService';
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
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import HorizontalProductList from '@/components/content/HorizontalProductList';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

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
    const { defaultAddress } = useAddress();
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
    const getGiftWrappingPrice = useCartStore(state => state.getGiftWrappingPrice);
    const selectedShoe = useCartStore(state => state.selectedShoe);
    const setSelectedShoe = useCartStore(state => state.setSelectedShoe);
    const applyDiscountCode = useCartStore(state => state.applyDiscountCode);
    const removeDiscountCode = useCartStore(state => state.removeDiscountCode);
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

    // Check if cart has fashion items
    const hasFashionItems = useMemo(() => {
        return cartItems.some(item => {
            return item.tags?.some(
                (tag: string) => typeof tag === 'string' && tag.toLowerCase() === 'fashion'
            );
        });
    }, [cartItems]);

    // Computed values
    const appliedDiscountCodes = discountCodes.map(dc => dc.code);
    const appliedDiscountCode = appliedDiscountCodes[0] || null;
    // Only show loading if status is 'loading' and we don't have items yet
    // If we have items, show them even if status is 'init' (store just hydrated)
    const loading = status === 'loading' && cartItems.length === 0;

    const [showBillSummary, setShowBillSummary] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<'cod' | 'razorpay'>('razorpay');
    const [couponCode, setCouponCode] = useState('');
    const [couponApplying, setCouponApplying] = useState(false);
    const [couponMessage, setCouponMessage] = useState<string | null>(null);
    const [orderLoading, setOrderLoading] = useState(false);
    const [showAddressModal, setShowAddressModal] = useState(false);
    const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
    const [loadingCoupons, setLoadingCoupons] = useState(false);
    const [showGiftModal, setShowGiftModal] = useState(false);
    const [showShoesModal, setShowShoesModal] = useState(false);
    const [showTryAndBuyModal, setShowTryAndBuyModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [deliverySchedule, setDeliverySchedule] = useState<DeliverySchedule | null>(null);
    const [previousDiscountCodes, setPreviousDiscountCodes] = useState<string[]>([]);
    const [showAllCouponsModal, setShowAllCouponsModal] = useState(false);
    const [kiddoCashEnabled, setKiddoCashEnabled] = useState(false);
    const [selectedCouponForApply, setSelectedCouponForApply] = useState<any>(null);

    // Collection for "Complete your purchase with" - use first category or a suggestions collection if present in config
    const COMPLETE_PURCHASE_COLLECTION_ID = 'gid://shopify/Collection/508646719777';

    // Redirect back if cart is empty
    useEffect(() => {
        if (!loading && cartItems.length === 0) {
            router.back();
        }
    }, [loading, cartItems.length, router]);
    
    // Watch for discount code removals (when conditions no longer met)
    useEffect(() => {
        const currentCodes = discountCodes.map(dc => dc.code);
        const removedCodes = previousDiscountCodes.filter(code => !currentCodes.includes(code));
        
        if (removedCodes.length > 0 && previousDiscountCodes.length > 0) {
            // A discount code was automatically removed
            const removedCode = removedCodes[0];
            setCouponMessage(`${removedCode} was removed as it no longer meets the requirements.`);
            // Clear message after 5 seconds
            setTimeout(() => {
                setCouponMessage(null);
            }, 5000);
        }
        
        setPreviousDiscountCodes(currentCodes);
    }, [discountCodes.map(dc => dc.code).join(',')]);

    // Automatically switch to razorpay if COD is selected and ticketing products are added
    useEffect(() => {
        if (hasTicketingProducts && paymentMethod === 'cod') {
            setPaymentMethod('razorpay');
        }
    }, [hasTicketingProducts, paymentMethod]);

    // Fetch only visible coupons (isVisible !== false) for the list; hidden codes still work when entered manually
    useEffect(() => {
        if (!isAuthenticated) {
            setAvailableCoupons([]);
            return;
        }
        const fetchCoupons = async () => {
            setLoadingCoupons(true);
            try {
                // Use same customer id as rest of app (Shopify format); fallback to email/phone if backend accepts
                const userStore = require('@/store/userStore').useUserStore.getState();
                const userId =
                    userStore.getCustomerId?.() ??
                    user?.customerId ??
                    user?.id ??
                    user?.email ??
                    user?.phone ??
                    null;
                if (__DEV__) {
                    console.log('[CartScreen] Logged-in user ids for coupons:', {
                        customerId: user?.customerId ?? null,
                        id: user?.id ?? null,
                        getCustomerId: userStore.getCustomerId?.() ?? null,
                        resolvedUserId: userId ?? null,
                    });
                }
                const cartSubTotal = cartItems.reduce((sum, item) => sum + Number(item.price ?? 0) * Number(item.quantity), 0);
                const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
                const hasTicketing = hasTicketingProducts;
                const hasClothing = hasFashionItems;

                const eligibleCoupons = await couponService.getEligibleCouponsFromBackend({
                    userId,
                    cartSubTotal,
                    cartItemCount,
                    hasTicketing,
                    hasClothing,
                });
                setAvailableCoupons(eligibleCoupons ?? []);
            } catch (error) {
                console.error('Error fetching coupons:', error);
                setAvailableCoupons([]);
            } finally {
                setLoadingCoupons(false);
            }
        };
        fetchCoupons();
    }, [isAuthenticated, user?.id, user?.customerId, user?.email, user?.phone, cartItems, hasTicketingProducts, hasFashionItems]);

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
                if (discountType === 'percentage') {
                    // Percentage discount: value is the percentage (e.g., 10 means 10%)
                    const percentageDiscount = (itemSubtotal * discountValue) / 100;
                    calculatedDiscount += percentageDiscount;
                    if (__DEV__) {
                        console.log('[CartScreen] Applied percentage discount:', {
                            code: discountCode.code,
                            type: discountType,
                            value: discountValue,
                            itemSubtotal,
                            percentageDiscount,
                            calculatedDiscount,
                        });
                    }
                } else if (discountType === 'fixed') {
                    // Fixed amount discount: value is the fixed amount
                    calculatedDiscount += discountValue;
                    if (__DEV__) {
                        console.log('[CartScreen] Applied fixed discount:', {
                            code: discountCode.code,
                            type: discountType,
                            value: discountValue,
                            calculatedDiscount,
                        });
                    }
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
    // Don't charge gift wrapping fee for ticketing products
    const giftWrappingFee = hasTicketingProducts ? 0 : getGiftWrappingPrice();
    
    // Final total - ALWAYS calculate from our lineItems, not from Shopify's payment.total
    const total = subtotalAfterDiscount + deliveryFee + giftWrappingFee;
    const totalSavings = Math.max(0, mrp - subtotalAfterDiscount);

    // Bill details display constants (for UX only; Kiddo Cash is dummy)
    const HANDLING_FEE_ORIGINAL = 10;
    const DELIVERY_FEE_ORIGINAL = 50;
    const KIDDO_CASH_APPLIED = 250;
    const toPay = Math.max(0, total - (kiddoCashEnabled ? KIDDO_CASH_APPLIED : 0));
    const displaySavings = totalSavings + HANDLING_FEE_ORIGINAL + DELIVERY_FEE_ORIGINAL + (kiddoCashEnabled ? KIDDO_CASH_APPLIED : 0);
    
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

    // Backend returns eligible coupons; show only visible ones in the list (hidden codes still work when entered manually)
    const applicableCoupons = useMemo(
        () => (availableCoupons ?? []).filter((c) => c.isVisible !== false),
        [availableCoupons]
    );

    const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await updateQuantity(itemId, newQuantity);
    };

    const handleRemoveItem = async (itemId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await removeItem(itemId);
    };

    const handleApplyCoupon = async () => {
        const code = couponCode.trim().toUpperCase();
        console.log('[CartScreen] handleApplyCoupon called with code:', code);
        if (!code) return;

        if (appliedDiscountCodes?.includes(code)) {
            console.log('[CartScreen] Code already applied:', code);
            setCouponMessage(`${code} is already applied.`);
            return;
        }

        setCouponApplying(true);
        setCouponMessage(null);
        try {
            const result = await applyDiscountCode(code, { preloadedCoupons: availableCoupons });
            if (result.success) {
                console.log('[CartScreen] ✅ Coupon applied successfully');
                setCouponCode('');
                setCouponMessage(null); // Don't show success message
                
                // Track coupon applied
                try {
                    const { trackCouponApplied } = require('@/utils/mixpanelHelpers');
                    trackCouponApplied(code, discount);
                } catch (e) {
                    console.warn('Mixpanel tracking error:', e);
                }
            } else {
                console.log('[CartScreen] ❌ Coupon application failed:', result.error);
                setCouponMessage(result.error || 'Failed to apply coupon');
            }
        } catch (error: any) {
            console.error('[CartScreen] ❌ Error applying coupon:', error);
            setCouponMessage(error.message || 'Failed to apply coupon');
        } finally {
            setCouponApplying(false);
        }
    };

    const handleApplyCouponFromList = async (coupon: any) => {
        const code = coupon.code?.toUpperCase();
        if (!code) return;

        if (appliedDiscountCodes?.includes(code)) {
            setCouponMessage(`${code} is already applied.`);
            return;
        }

        setCouponApplying(true);
        setCouponMessage(null);
        try {
            const result = await applyDiscountCode(code, { preloadedCoupons: availableCoupons });
            if (result.success) {
                setCouponCode(''); // Clear input
                setCouponMessage(null); // Don't show success message
                setSelectedCouponForApply(null); // Clear selection after apply
            } else {
                setCouponMessage(result.error || 'Failed to apply coupon');
            }
        } catch (error: any) {
            setCouponMessage(error.message || 'Failed to apply coupon');
        } finally {
            setCouponApplying(false);
        }
    };

    const handleRemoveCoupon = async (code: string) => {
        try {
            await removeDiscountCode(code);
            setCouponMessage(null); // Don't show success message
        } catch (error: any) {
            setCouponMessage(error.message || 'Failed to remove coupon');
        }
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

            // Prepare order data
            const orderData = {
                items: cartItems.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    quantity: item.quantity,
                    price: item.price,
                    title: item.title,
                    tags: item.tags,
                    bookingDate: item.bookingDate, // For Events, Playhouses, Petting Farms - sent to Shopify
                })),
                totalAmount: toPay,
                currencyCode: 'INR',
                email: user?.email || 'guest@example.com',
                phone: user?.phone || billingAddress.phone || '',
                name: user?.displayName || `${billingAddress.firstName} ${billingAddress.lastName}`,
                customerId: user?.id, // Pass the raw ID, let service handle formatting if needed
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
                selectedShoe: selectedShoe || undefined,
                isTryAndBuy: isTryAndBuy, // Tag only: backend should create same draft (all items), use for order tagging
            };

            // Call Payment Service
            console.log('Calling PaymentService.createOrderWithPayment...');
            const isFreeOrder = toPay === 0;
            const chosenPayment = paymentMethod === 'cod' ? 'cod' : 'razorpay';
            const effectivePaymentMethod = isFreeOrder ? 'free' : chosenPayment;

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
                    const navParams = {
                        pathname: '/order-success' as const,
                        params: {
                            orderId: orderIdForDisplay,
                            orderGraphId: finalOrder?.id || '',
                            total: total.toString(),
                        },
                    };
                    
                    console.log('[Cart] Navigating with params:', navParams);
                    router.push(navParams);
                } catch (error) {
                    console.error('[Cart] Navigation error:', error);
                    // Fallback: try direct path
                    router.push('/order-success' as any);
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
                    setSelectedCouponForApply(null);
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


    // Render cart item: row1 = title + quantity buttons; row2 = prices in same column as +/-
    const renderItem = (item: any) => {
        const compareAt = item.compareAtPrice && item.compareAtPrice > item.price ? item.compareAtPrice : null;
        const discountPct = compareAt ? Math.round(((compareAt - item.price) / compareAt) * 100) : 0;

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cartItemRow}
                onPress={() => handleProductPress(item)}
                activeOpacity={0.7}
            >
                <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
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
                <Text style={styles.headerTitle}>Your Cart</Text>
                <View style={styles.headerSpacer} />
            </View>

            {cartItems.length > 0 && (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Total Savings Banner - full width, lighter green, thinner */}
                    {totalSavings > 0 && (
                        <View style={styles.savingsBanner}>
                            <Text style={styles.savingsBannerText}>Total Savings: {formatCurrency(totalSavings)}!</Text>
                        </View>
                    )}

                    {/* Delivery Information Card - same width as other cards */}
                    {!hasTicketingProducts && (
                        <View style={styles.deliveryCard}>
                            <Ionicons name="flash" size={24} color="#E6B800" style={styles.deliveryIcon} />
                            <View style={styles.deliveryCardContent}>
                                <Text style={styles.deliveryCardTitle}>Delivery in 35 min</Text>
                                <TouchableOpacity onPress={() => setShowScheduleModal(true)} activeOpacity={0.7}>
                                    <Text style={styles.deliveryCardLink}>Want it later? Schedule delivery</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Cart Items - one card with "X added items" header and all items inside */}
                    <View style={styles.itemsSection}>
                        <View style={styles.itemsHeader}>
                            <Text style={styles.itemsHeaderText}>
                                {cartItems.reduce((s, i) => s + i.quantity, 0)} added items
                            </Text>
                        </View>
                        {cartItems.map(item => renderItem(item))}
                    </View>

                    {/* Gift Wrapping - Make this a gift? Get items gift wrapped for FREE (underlined), red Select */}
                    {!hasTicketingProducts && (
                        <View style={styles.giftWrappingSection}>
                            <TouchableOpacity style={styles.giftWrappingButton} onPress={() => setShowGiftModal(true)}>
                                <View style={styles.giftWrappingLeft}>
                                    <Ionicons name="gift-outline" size={24} color={Colors.primary} />
                                    <View style={styles.giftWrappingInfo}>
                                        <Text style={styles.giftWrappingTitle}>Make this a gift?</Text>
                                        <Text style={styles.giftWrappingDescription}>Get items gift wrapped for FREE</Text>
                                    </View>
                                </View>
                                <Text style={styles.giftWrappingSelect}>Select</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Complete your purchase with - horizontal product list from collection */}
                    {!hasTicketingProducts && (
                        <View style={styles.completePurchaseSection}>
                            <Text style={styles.completePurchaseTitle}>Complete your purchase with</Text>
                            <HorizontalProductList
                                collectionIds={[COMPLETE_PURCHASE_COLLECTION_ID]}
                                config={{ limit: 8, itemsPerView: 2.5, sidePadding: 8, itemSpacing: 12 }}
                                title=""
                                onProductPress={(p) => p?.id && router.push({ pathname: '/product/[id]', params: { id: p.id } } as any)}
                                onAddToCart={(p) => {
                                    if (p?.variants?.edges?.[0]?.node) {
                                        const v = p.variants.edges[0].node;
                                        useCartStore.getState().addItem({
                                            productId: p.id,
                                            variantId: v.id,
                                            title: p.title,
                                            variantTitle: v.title,
                                            price: parseFloat(v.price?.amount || '0'),
                                            compareAtPrice: v.compareAtPrice?.amount ? parseFloat(v.compareAtPrice.amount) : undefined,
                                            currencyCode: v.price?.currencyCode || 'INR',
                                            image: p.featuredImage?.url || v.image?.url || '',
                                            quantity: 1,
                                            availableForSale: v.availableForSale !== false,
                                            tags: p.tags || [],
                                        });
                                    }
                                }}
                            />
                        </View>
                    )}

                    {/* Savings Corner - coupon row, View all coupons (modal), Kiddo Cash dummy, Kiddo Coins bar */}
                    <View style={styles.savingsCornerSection}>
                        <Text style={styles.savingsCornerTitle}>Savings Corner</Text>
                        <View style={styles.savingsCornerRow}>
                            <View style={styles.savingsCornerLeft}>
                                <View style={styles.savingsCornerIconBlue}>
                                    <Text style={styles.savingsCornerIconPercent}>%</Text>
                                </View>
                                <View style={styles.savingsCornerTextWrap}>
                                    <Text style={styles.savingsCornerMain}>
                                        {selectedCouponForApply
                                            ? `Save ${formatCurrency(selectedCouponForApply?.valueType === 'percentage'
                                                ? Math.round((itemSubtotal * (selectedCouponForApply?.value || 0)) / 100)
                                                : (selectedCouponForApply?.value || 0))} with ${selectedCouponForApply?.code}`
                                            : applicableCoupons.length > 0
                                                ? 'Select a coupon'
                                                : 'Add a coupon'}
                                    </Text>
                                    <TouchableOpacity onPress={() => setShowAllCouponsModal(true)} activeOpacity={0.7}>
                                        <Text style={styles.savingsCornerViewAll}>View all coupons</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {(!appliedDiscountCodes || appliedDiscountCodes.length === 0) && isAuthenticated && (
                                <TouchableOpacity
                                    style={[
                                        styles.savingsCornerApplyBtn,
                                        (couponApplying || !selectedCouponForApply) && styles.savingsCornerApplyBtnDisabled,
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
                                        <Text style={styles.savingsCornerApplyText}>Apply</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                        <View style={styles.kiddoCashRow}>
                            <View style={styles.kiddoCashIconWrap}>
                                <Ionicons name="cash-outline" size={20} color="#5B21B6" />
                            </View>
                            <View style={styles.kiddoCashTextWrap}>
                                <Text style={styles.kiddoCashTitle}>Use Kiddo Cash</Text>
                                <Text style={styles.kiddoCashSub}>₹250 available</Text>
                            </View>
                            <Switch
                                value={kiddoCashEnabled}
                                onValueChange={setKiddoCashEnabled}
                                trackColor={{ false: '#E5E7EB', true: '#5B21B6' }}
                                thumbColor={kiddoCashEnabled ? '#FFFFFF' : '#f4f3f4'}
                            />
                        </View>
                        <View style={styles.kiddoCoinsBar}>
                            <Text style={styles.kiddoCoinsBarText}>You will earn 20 Kiddo Coins with this order</Text>
                        </View>
                    </View>

                    {/* Coupon Code - hidden */}
                    {false && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Coupon Code</Text>
                        {/* Only show input when no coupon is applied */}
                        {(!appliedDiscountCodes || appliedDiscountCodes.length === 0) && (
                            <>
                                {!isAuthenticated ? (
                                    <View style={styles.couponLoginPrompt}>
                                        <Ionicons name="lock-closed" size={20} color={Colors.primary} />
                                        <Text style={styles.couponLoginText}>
                                            Please login or create an account to use discount coupons
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.loginButton}
                                            onPress={() => router.push('/(auth)/login')}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.loginButtonText}>Login / Sign Up</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.couponContainer}>
                                        <View style={styles.couponInputWrapper}>
                                            <Ionicons name="pricetag-outline" size={18} color="#999" style={styles.couponInputIcon} />
                                            <TextInput
                                                style={styles.couponInput}
                                                placeholder="Enter coupon code"
                                                value={couponCode}
                                                onChangeText={setCouponCode}
                                                placeholderTextColor="#999"
                                                autoCapitalize="characters"
                                            />
                                        </View>
                                        <TouchableOpacity
                                            style={[
                                                styles.applyButton,
                                                (!couponCode.trim() || couponApplying) && styles.applyButtonDisabled
                                            ]}
                                            disabled={couponApplying || !couponCode.trim()}
                                            onPress={handleApplyCoupon}
                                            activeOpacity={0.7}
                                        >
                                            {couponApplying ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <Text style={styles.applyButtonText}>Apply</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}
                        {couponMessage && (
                            <View style={styles.couponMessageContainer}>
                                <Ionicons
                                    name={couponMessage.startsWith('✓') ? 'checkmark-circle' : 'alert-circle'}
                                    size={14}
                                    color={couponMessage.startsWith('✓') ? '#4caf50' : '#ff4444'}
                                />
                                <Text
                                    style={[
                                        styles.couponMessage,
                                        couponMessage.startsWith('✓') && styles.couponMessageSuccess,
                                    ]}
                                >
                                    {couponMessage}
                                </Text>
                            </View>
                        )}
                        {/* Applied Coupons */}
                        {appliedDiscountCodes && appliedDiscountCodes.length > 0 && (
                            <View style={styles.appliedCouponsContainer}>
                                {appliedDiscountCodes.map((code, index) => (
                                    <View key={`${code}-${index}`} style={styles.couponChip}>
                                        <Ionicons name="checkmark-circle" size={14} color="#fff" />
                                        <Text style={styles.couponChipText}>{code}</Text>
                                        <TouchableOpacity
                                            onPress={() => handleRemoveCoupon(code)}
                                            style={styles.couponRemove}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="close" size={14} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Available Coupons / Offers - Show when no coupon applied and user logged in */}
                        {isAuthenticated && (!appliedDiscountCodes || appliedDiscountCodes.length === 0) && (
                            <View style={styles.availableCouponsContainer}>
                                <View style={styles.availableCouponsHeader}>
                                    <Ionicons name="pricetag" size={16} color={Colors.primary} />
                                    <Text style={styles.availableCouponsTitle}>Offers</Text>
                                </View>
                                {loadingCoupons ? (
                                    <View style={styles.couponsLoadingContainer}>
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                        <Text style={styles.couponsLoadingText}>Loading offers...</Text>
                                    </View>
                                ) : applicableCoupons.length > 0 ? (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.couponsList}
                                    >
                                        {applicableCoupons.map((coupon) => {
                                            const conditions = couponService.getCouponConditionsText(coupon);
                                            return (
                                                <TouchableOpacity
                                                    key={coupon.code}
                                                    style={[
                                                        styles.couponCard,
                                                        couponApplying && styles.couponCardDisabled,
                                                        selectedCouponForApply?.code === coupon.code && styles.couponModalCardSelected,
                                                    ]}
                                                    onPress={() => {
                                                        if (couponApplying) return;
                                                        setSelectedCouponForApply(coupon);
                                                    }}
                                                    disabled={couponApplying}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.couponCardContent}>
                                                        <View style={styles.couponCodeRow}>
                                                            <Text style={styles.couponCardCode}>{coupon.code}</Text>
                                                            {coupon.value !== null && coupon.value !== undefined && coupon.value !== 0 && (
                                                                <View style={styles.discountBadge}>
                                                                    <Text style={styles.discountBadgeText}>
                                                                        {coupon.valueType === 'percentage'
                                                                            ? `${coupon.value}%`
                                                                            : `₹${coupon.value}`}
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
                                                                {conditions.map((condition, index) => (
                                                                    <View key={index} style={styles.couponConditionTag}>
                                                                        <Ionicons name="information-circle" size={10} color="#666" />
                                                                        <Text style={styles.couponConditionText}>{condition}</Text>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        )}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                ) : (
                                    <Text style={styles.noCouponsText}>No coupons available</Text>
                                )}
                            </View>
                        )}
                    </View>
                    )}

                    {/* Bill details - wave inside card with zIndex so scalloped bottom always shows */}
                    <View style={styles.billDetailsWrapper}>
                        <View style={styles.billSummarySection} collapsable={false}>
                            <View style={styles.billSummarySectionBg} pointerEvents="none" />
                            <View style={styles.billSummaryHeader}>
                                <Text style={styles.billDetailsTitle}>Bill details</Text>
                            </View>
                            <View style={styles.billSummaryContent}>
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Item Total</Text>
                                    <View style={styles.billValueRow}>
                                        {mrp > subtotalAfterDiscount && (
                                            <Text style={styles.billValueStruck}>{formatCurrency(mrp)}</Text>
                                        )}
                                        <Text style={styles.billValue}>{formatCurrency(subtotalAfterDiscount)}</Text>
                                    </View>
                                </View>
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Handling Fee</Text>
                                    <View style={styles.billValueRow}>
                                        <Text style={styles.billValueStruck}>{formatCurrency(HANDLING_FEE_ORIGINAL)}</Text>
                                        <Text style={[styles.billValue, styles.freeText]}>FREE</Text>
                                    </View>
                                </View>
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Delivery Fee</Text>
                                    <View style={styles.billValueRow}>
                                        <Text style={styles.billValueStruck}>{formatCurrency(DELIVERY_FEE_ORIGINAL)}</Text>
                                        <Text style={[styles.billValue, styles.freeText]}>FREE</Text>
                                    </View>
                                </View>
                                {kiddoCashEnabled && (
                                    <View style={styles.billRow}>
                                        <Text style={styles.billLabel}>Kiddo Cash</Text>
                                        <Text style={[styles.billValue, styles.kiddoCashDeduction]}>
                                            -{formatCurrency(KIDDO_CASH_APPLIED)}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.billSeparator} />
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabelToPay}>To Pay</Text>
                                    <View style={styles.billValueRow}>
                                        {total !== toPay && (
                                            <Text style={styles.billValueStruck}>{formatCurrency(total)}</Text>
                                        )}
                                        <Text style={styles.billValueToPay}>{formatCurrency(toPay)}</Text>
                                    </View>
                                </View>
                                <View style={styles.billSavingsBannerWrap}>
                                    <Text style={styles.billSavingsBanner}>
                                        You saved {formatCurrency(displaySavings)}!
                                    </Text>
                                </View>
                            </View>
                            <View style={[styles.billWaveOuter, { width: Dimensions.get('window').width - 32 }]} pointerEvents="none">
                                <Svg
                                    viewBox="0 0 100 38"
                                    preserveAspectRatio="none"
                                    width={Dimensions.get('window').width - 32}
                                    height={32}
                                >
                                    <Path
                                        d="M0,0 L100,0 L100,14 L96.67,25 L93.33,14 L90,25 L86.67,14 L83.33,25 L80,14 L76.67,25 L73.33,14 L70,25 L66.67,14 L63.33,25 L60,14 L56.67,25 L53.33,14 L50,25 L46.67,14 L43.33,25 L40,14 L36.67,25 L33.33,14 L30,25 L26.67,14 L23.33,25 L20,14 L16.67,25 L13.33,14 L10,25 L6.67,14 L3.33,25 L0,14 L0,0 Z"
                                        fill="#fff"
                                    />
                                </Svg>
                            </View>
                        </View>
                    </View>

                    {/* Payment Method - show when cart has items (also selectable via footer "Pay using" modal) */}
                    {cartItems.length > 0 && total > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Payment Method</Text>
                            {/* Hide COD option for ticketing products */}
                            {!hasTicketingProducts && (
                                <TouchableOpacity
                                    style={[
                                        styles.paymentOption,
                                        paymentMethod === 'cod' && styles.paymentOptionSelected,
                                    ]}
                                    onPress={() => {
                                        setPaymentMethod('cod');
                                        // Track payment method selected
                                        try {
                                            const { trackPaymentMethodSelected } = require('@/utils/mixpanelHelpers');
                                            trackPaymentMethodSelected('cod');
                                        } catch (e) {
                                            console.warn('Mixpanel tracking error:', e);
                                        }
                                    }}
                                >
                                    <Ionicons
                                        name={paymentMethod === 'cod' ? 'radio-button-on' : 'radio-button-off'}
                                        size={24}
                                        color={paymentMethod === 'cod' ? Colors.primary : '#ccc'}
                                    />
                                    <Text style={styles.paymentOptionText}>Cash on Delivery (COD)</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[
                                    styles.paymentOption,
                                    paymentMethod === 'razorpay' && styles.paymentOptionSelected,
                                ]}
                                onPress={() => {
                                    setPaymentMethod('razorpay');
                                    // Track payment method selected
                                    try {
                                        const { trackPaymentMethodSelected } = require('@/utils/mixpanelHelpers');
                                        trackPaymentMethodSelected('razorpay');
                                    } catch (e) {
                                        console.warn('Mixpanel tracking error:', e);
                                    }
                                }}
                            >
                                <Ionicons
                                    name={paymentMethod === 'razorpay' ? 'radio-button-on' : 'radio-button-off'}
                                    size={24}
                                    color={paymentMethod === 'razorpay' ? Colors.primary : '#ccc'}
                                />
                                <View style={styles.paymentOptionContent}>
                                    <Text style={styles.paymentOptionText}>Pay Online</Text>
                                    <Text style={styles.paymentOptionSubtext}>
                                        Card, UPI, Net Banking via Razorpay
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Nector Loyalty Coins Redemption */}
                    <View style={styles.section}>
                        <CheckoutRedeemCoins
                            cartAmount={total}
                            onCouponApplied={(code) => {
                                setCouponMessage(`✓ ${code} applied from rewards!`);
                            }}
                            onCouponRemoved={() => {
                                setCouponMessage(null);
                            }}
                        />
                    </View>

                    {/* Spacer */}
                    <View style={styles.spacerEnd} />
                </ScrollView>
            )}

            {/* Footer - Only show when cart has items */}
            {cartItems.length > 0 && (
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                    <View style={styles.footerContent}>
                        {/* Address Section */}
                        {!isTicketingOnly && (
                        <TouchableOpacity
                            style={styles.footerAddress}
                            onPress={handleAddressSelection}
                        >
                            {selectedAddress ? (
                                <View style={styles.footerAddressContent}>
                                    <Ionicons name="location" size={16} color={Colors.primary} />
                                    <Text style={styles.footerAddressText} numberOfLines={1}>
                                        {selectedAddress.address1}
                                    </Text>
                                    <Ionicons name="chevron-down" size={16} color="#666" />
                                </View>
                            ) : (
                                <View style={styles.footerAddressContent}>
                                    <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                                    <Text style={styles.footerAddressText}>Add Delivery Address</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        )}

                        {/* Payment row: Pay using + method, Pay button */}
                        <View style={styles.footerBottom}>
                            <View style={styles.footerLeft}>
                                <View style={styles.footerPayUsingRow}>
                                    <Text style={styles.footerPayUsingLabel}>Pay using</Text>
                                    <Ionicons name="chevron-down" size={18} color="#666" />
                                </View>
                                <Text style={styles.footerPaymentMethod}>
                                    {paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Pay Online - Card, UPI, Net Banking'}
                                </Text>
                            </View>
                            {selectedAddress || isTicketingOnly ? (
                                <TouchableOpacity
                                    style={[
                                        styles.checkoutButton,
                                        (orderLoading || !isAuthenticated) && styles.checkoutButtonDisabled,
                                    ]}
                                    onPress={handlePlaceOrder}
                                    disabled={orderLoading || !isAuthenticated}
                                >
                                    {orderLoading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.checkoutButtonText}>
                                            {isAuthenticated ? `Pay ${formatCurrency(toPay)}` : 'Login to Order'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.addAddressButtonFooter}
                                    onPress={handleAddressSelection}
                                >
                                    <Text style={styles.addAddressButtonText}>Add Address</Text>
                                </TouchableOpacity>
                            )}
                        </View>
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

            {/* Free Shoes Selection Modal */}
            <FreeShoesOfferModal
                visible={showShoesModal}
                onClose={() => setShowShoesModal(false)}
                onSelect={(shoeId) => setSelectedShoe(shoeId || null)}
                selectedShoe={selectedShoe}
            />

            {/* Try And Buy Modal */}
            <TryAndBuyModal
                visible={showTryAndBuyModal}
                onClose={() => setShowTryAndBuyModal(false)}
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
            />

            {/* View all coupons Modal */}
            <Modal
                visible={showAllCouponsModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowAllCouponsModal(false)}
            >
                <TouchableOpacity
                    style={styles.couponsModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowAllCouponsModal(false)}
                >
                    <View style={styles.couponsModalContent} onStartShouldSetResponder={() => true}>
                        <View style={styles.couponsModalHeader}>
                            <Text style={styles.couponsModalTitle}>Available coupons</Text>
                            <TouchableOpacity onPress={() => setShowAllCouponsModal(false)} hitSlop={12}>
                                <Ionicons name="close" size={24} color="#1A1A1A" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.couponsModalScroll} showsVerticalScrollIndicator={false}>
                            {!isAuthenticated ? (
                                <View style={styles.couponLoginPrompt}>
                                    <Text style={styles.couponLoginText}>Please login to view and apply coupons.</Text>
                                    <TouchableOpacity style={styles.loginButton} onPress={() => { setShowAllCouponsModal(false); router.push('/(auth)/login'); }}>
                                        <Text style={styles.loginButtonText}>Login</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : loadingCoupons ? (
                                <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 24 }} />
                            ) : applicableCoupons.length === 0 ? (
                                <Text style={styles.noCouponsText}>No coupons available</Text>
                            ) : (
                                applicableCoupons.map((coupon) => {
                                    const conditions = couponService.getCouponConditionsText(coupon);
                                    const isSelected = selectedCouponForApply?.code === coupon.code;
                                    return (
                                        <TouchableOpacity
                                            key={coupon.code}
                                            style={[styles.couponModalCardWhite, isSelected && styles.couponModalCardSelected, couponApplying && styles.couponCardDisabled]}
                                            onPress={() => {
                                                if (couponApplying) return;
                                                setSelectedCouponForApply(coupon);
                                                setShowAllCouponsModal(false);
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
                                                {coupon.title && <Text style={styles.couponCardTitle} numberOfLines={1}>{coupon.title}</Text>}
                                                {conditions.length > 0 && (
                                                    <View style={styles.couponConditionsContainer}>
                                                        {conditions.slice(0, 2).map((c, i) => (
                                                            <Text key={i} style={styles.couponConditionText}>{c}</Text>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
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
    headerTitle: {
        flex: 1,
        fontSize: 18,
        color: '#1A1A1A',
        fontFamily: Fonts.Bold,
        textAlign: 'center',
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
    deliveryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 0,
        marginBottom: 12,
        padding: 16,
        borderRadius: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    deliveryIcon: {
        marginRight: 12,
    },
    deliveryCardContent: {
        flex: 1,
    },
    deliveryCardTitle: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#2D2D2D',
        marginBottom: 4,
    },
    deliveryCardLink: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: Colors.primary,
        textDecorationLine: 'underline',
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
    itemsHeader: {
        marginBottom: 12,
    },
    itemsHeaderText: {
        fontSize: 14,
        color: '#2D2D2D',
        fontFamily: Fonts.Regular,
    },
    cartItemRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    itemImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#F0F0F0',
        borderWidth: 1,
        borderColor: '#E5E5E5',
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
        color: '#666',
        fontFamily: Fonts.Regular,
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
        backgroundColor: '#fff',
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
    giftWrappingSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 0,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    giftWrappingButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    giftWrappingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    giftWrappingInfo: {
        marginLeft: 12,
        flex: 1,
    },
    giftWrappingTitle: {
        fontSize: 15,
        color: '#2D2D2D',
        fontFamily: Fonts.Bold,
        marginBottom: 4,
    },
    giftWrappingDescription: {
        fontSize: 12,
        color: '#888',
        fontFamily: Fonts.Regular,
        textDecorationLine: 'underline',
    },
    giftWrappingSelect: {
        fontSize: 14,
        color: Colors.primary,
        fontFamily: Fonts.SemiBold,
    },
    completePurchaseSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 8,
        paddingLeft: 8,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    completePurchaseTitle: {
        fontSize: 15,
        color: '#2D2D2D',
        fontFamily: Fonts.Bold,
        marginBottom: 12,
        textAlign: 'left',
        paddingLeft: 8,
    },
    savingsCornerSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    savingsCornerTitle: {
        fontSize: 15,
        color: '#2D2D2D',
        fontFamily: Fonts.Bold,
        marginBottom: 14,
    },
    savingsCornerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    savingsCornerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    savingsCornerIconBlue: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E3F2FD',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    savingsCornerIconPercent: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#1E88E5',
    },
    savingsCornerTextWrap: {
        flex: 1,
    },
    savingsCornerMain: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#2D2D2D',
    },
    savingsCornerViewAll: {
        fontSize: 12,
        color: '#1E88E5',
        fontFamily: Fonts.Regular,
        textDecorationLine: 'underline',
        marginTop: 2,
    },
    savingsCornerApplyBtn: {
        backgroundColor: '#C41E3A',
        paddingVertical: 8,
        paddingHorizontal: 20,
        minWidth: 72,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    savingsCornerApplyBtnDisabled: {
        opacity: 0.7,
    },
    savingsCornerApplyText: {
        fontSize: 14,
        color: '#fff',
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
    billDetailsWrapper: {
        marginBottom: 15,
        position: 'relative',
    },
    billSummarySection: {
        backgroundColor: 'transparent',
        borderRadius: 12,
        padding: 15,
        paddingBottom: 40,
        overflow: 'visible',
        position: 'relative',
    },
    billSummarySectionBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 32,
        backgroundColor: '#fff',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    billSummaryHeader: {
        marginBottom: 12,
    },
    billSummaryTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    billSummaryTitle: {
        fontSize: 16,
        color: '#000',
        marginLeft: 8,
        fontFamily: Fonts.Bold,
    },
    billDetailsTitle: {
        fontSize: 16,
        color: '#6B7280',
        fontFamily: Fonts.Bold,
    },
    billWaveOuter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 32,
        backgroundColor: 'transparent',
        zIndex: 10,
    },
    billSummaryContent: {
        paddingTop: 0,
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    billLabel: {
        fontSize: 14,
        color: '#1A1A1A',
        fontFamily: Fonts.Regular,
    },
    billValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    billValue: {
        fontSize: 14,
        color: '#2D2D2D',
        fontFamily: Fonts.SemiBold,
    },
    billValueStruck: {
        fontSize: 14,
        color: '#9CA3AF',
        fontFamily: Fonts.Regular,
        textDecorationLine: 'line-through',
    },
    kiddoCashDeduction: {
        color: '#16a34a',
    },
    billSeparator: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 12,
    },
    billLabelToPay: {
        fontSize: 14,
        color: '#2D2D2D',
        fontFamily: Fonts.SemiBold,
    },
    billValueToPay: {
        fontSize: 14,
        color: '#1A1A1A',
        fontFamily: Fonts.Bold,
    },
    billSavingsBannerWrap: {
        marginTop: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    billSavingsBanner: {
        fontSize: 14,
        color: '#16a34a',
        fontFamily: Fonts.SemiBold,
        textAlign: 'center',
    },
    discountValue: {
        color: '#16a34a',
    },
    freeText: {
        color: '#16a34a',
        fontFamily: Fonts.SemiBold,
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
    footerPayUsingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    footerPayUsingLabel: {
        fontSize: 13,
        color: '#666',
        fontFamily: Fonts.Regular,
    },
    footerPaymentMethod: {
        fontSize: 14,
        color: '#2D2D2D',
        fontFamily: Fonts.SemiBold,
    },
    footerAddress: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    footerAddressContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    footerAddressText: {
        flex: 1,
        fontSize: 12,
        color: '#000',
        fontFamily: Fonts.Regular,
    },
    footerBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerLeft: {
        flex: 1,
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
    checkoutButton: {
        backgroundColor: '#E07A5F',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 10,
        minWidth: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tryAndBuyButton: {
        backgroundColor: '#FF9800',
    },
    checkoutButtonDisabled: {
        opacity: 0.6,
    },
    checkoutButtonText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        fontFamily: Fonts.SemiBold,
    },
    addAddressButtonFooter: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 8,
    },
    addAddressButtonText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
    },
});
