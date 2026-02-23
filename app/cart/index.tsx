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
import PaymentService, { type PaymentResult } from '@/services/paymentService';
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
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
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
    const { defaultAddress } = useAddress();
    const { addItem: addTryAndBuyItem, createOrder: createTryAndBuyOrder, clearCart: clearTryAndBuyCart } = useTryAndBuy();
    
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
        const fetchCoupons = async () => {
            setLoadingCoupons(true);
            try {
                const userId = user?.id || user?.customerId || user?.email || user?.phone || null;
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
    }, [user?.id, user?.customerId, user?.email, user?.phone]);

    // Use address from AddressContext
    const selectedAddress = defaultAddress;

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
    // Shopify's payment.total may be based on different subtotal (cart sync issue)
    // So we always use our calculated total to ensure accuracy
    const total = subtotalAfterDiscount + deliveryFee + giftWrappingFee;
    
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

    // Backend returns only eligible coupons - use directly
    const applicableCoupons = useMemo(() => availableCoupons, [availableCoupons]);

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
            console.log('[CartScreen] Calling applyDiscountCode...');
            const result = await applyDiscountCode(code);
            console.log('[CartScreen] applyDiscountCode result:', result);
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
            const result = await applyDiscountCode(code);
            if (result.success) {
                setCouponCode(''); // Clear input
                setCouponMessage(null); // Don't show success message
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

        // Only require address if cart contains non-ticketing products
        if (!isTicketingOnly && !selectedAddress) {
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
            // If Try & Buy is enabled, handle it separately
            if (isTryAndBuy) {
                // Add eligible items to try and buy cart
                // Eligible items are those that are returnable (not diapers, formula, food, etc.)
                const NON_RETURNABLE_TAGS = [
                    'diaper',
                    'diapers',
                    'formula',
                    'food',
                    'feeding',
                    'non-returnable',
                    'event',
                    'ticket',
                    'pass',
                    'playhouse',
                    'petting',
                    'farm',
                ];

                const isProductReturnable = (tags?: string[]): boolean => {
                    if (!tags || tags.length === 0) return true;
                    const lowerTags = tags.map((t) => String(t).toLowerCase());
                    return !NON_RETURNABLE_TAGS.some((nonRet) =>
                        lowerTags.some((tag) => tag.includes(nonRet))
                    );
                };

                const eligibleItems = cartItems.filter(item => {
                    const isReturnable = isProductReturnable(item.tags);
                    console.log('[Cart] Checking item for Try & Buy:', {
                        title: item.title,
                        tags: item.tags,
                        isReturnable,
                    });
                    return isReturnable;
                });

                console.log('[Cart] Try & Buy eligible items:', {
                    totalCartItems: cartItems.length,
                    eligibleItems: eligibleItems.length,
                    eligibleTitles: eligibleItems.map(i => i.title),
                });

                if (eligibleItems.length === 0) {
                    // Automatically disable Try & Buy and continue with regular order
                    // This prevents the error when user has only non-returnable items
                    console.log('[Cart] No returnable items found, disabling Try & Buy and continuing as regular order');
                    toggleTryAndBuy();
                    // Fall through to regular order flow below (don't return, let it continue)
                } else {
                    // Has eligible items, proceed with Try & Buy flow
                    // Prepare Try & Buy items directly (avoid state sync issues)
                    // We'll pass items directly to createOrder instead of relying on state
                    const tryAndBuyItems = eligibleItems.map(item => ({
                        id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                        productId: item.productId,
                        variantId: item.variantId,
                        title: item.title,
                        variantTitle: item.variantTitle || 'Default Title',
                        price: item.price,
                        currencyCode: item.currencyCode,
                        image: item.image,
                        quantity: item.quantity,
                        tags: item.tags,
                    }));

                    // Also update the Try & Buy cart state (for UI consistency)
                    clearTryAndBuyCart();
                    for (const item of tryAndBuyItems) {
                        await addTryAndBuyItem({
                            productId: item.productId,
                            variantId: item.variantId,
                            title: item.title,
                            variantTitle: item.variantTitle,
                            price: item.price,
                            currencyCode: item.currencyCode,
                            image: item.image,
                            quantity: item.quantity,
                            tags: item.tags,
                        });
                    }

                    // Handle payment based on selected payment method
                    let paymentId: string | undefined = undefined;
                    let paymentResult: PaymentResult | undefined;
                    if (paymentMethod === 'razorpay') {
                        // For Razorpay, process payment first
                        paymentResult = await PaymentService.initiateRazorpayPayment(
                            total,
                            'INR',
                            {
                                email: user?.email || 'guest@example.com',
                                phone: user?.phone || billingAddress.phone || '',
                                name: user?.displayName || `${billingAddress.firstName} ${billingAddress.lastName}`,
                                customerId: user?.id,
                                items: eligibleItems.map(item => ({
                                    id: item.id,
                                    productId: item.productId,
                                    variantId: item.variantId,
                                    quantity: item.quantity,
                                    price: item.price,
                                    title: item.title,
                                    tags: item.tags,
                                })),
                            }
                        );

                        if (!paymentResult.success) {
                            if (paymentResult.cancelled) {
                                console.log('Payment cancelled');
                                setOrderLoading(false);
                                return;
                            }
                            throw new Error(paymentResult.error || 'Payment failed');
                        }

                        paymentId = paymentResult.paymentId;
                    }

                    // Create try and buy order with selected payment method and payment ID
                    // Pass items directly to avoid state sync issues; for Razorpay pass orderId + signature for backend verification
                    let tryAndBuyOrder;
                    try {
                        tryAndBuyOrder = await createTryAndBuyOrder(
                            {
                                name: `${billingAddress.firstName} ${billingAddress.lastName}`,
                                address: [billingAddress.address1, billingAddress.address2].filter(Boolean).join(', '),
                                city: billingAddress.city,
                                state: billingAddress.province,
                                pincode: billingAddress.zip,
                                phone: billingAddress.phone,
                            },
                            user?.id,
                            paymentMethod,
                            paymentId,
                            tryAndBuyItems, // Pass items directly to avoid state sync issues
                            deliverySchedule || undefined,
                            selectedShoe || undefined,
                            appliedDiscountCode || undefined,
                            discount > 0 ? discount : undefined,
                            paymentResult?.orderId,
                            paymentResult?.signature
                        );

                        if (!tryAndBuyOrder) {
                            throw new Error('Failed to create Try & Buy order');
                        }
                    } catch (orderError: any) {
                        console.error('[Cart] Try & Buy order creation error:', orderError);
                        console.error('[Cart] Error details:', {
                            message: orderError.message,
                            stack: orderError.stack,
                            originalError: orderError.originalError,
                            response: orderError.response?.data,
                        });
                        
                        // Extract user-friendly error message
                        let errorMessage = orderError.message || 'Failed to create Try & Buy order. Please try again.';
                        
                        // Check for Shopify user errors
                        if (orderError.userErrors && orderError.userErrors.length > 0) {
                            errorMessage = orderError.userErrors[0].message || errorMessage;
                        }
                        
                        // Check response data for errors
                        if (orderError.response?.data?.errors) {
                            errorMessage = orderError.response.data.errors[0]?.message || errorMessage;
                        }
                        
                        if (orderError.response?.data?.data?.draftOrderCreate?.userErrors) {
                            const userError = orderError.response.data.data.draftOrderCreate.userErrors[0];
                            errorMessage = userError.message || errorMessage;
                        }
                        
                        // Re-throw with user-friendly message
                        throw new Error(errorMessage);
                    }

                    // Increment coupon usage for applied discount codes (if any)
                    if (appliedDiscountCode) {
                        try {
                            const { couponService } = await import('@/services/couponService');
                            const userId = user?.id || user?.customerId || user?.email || user?.phone || null;
                            if (userId) {
                                await couponService.incrementCouponUsage(appliedDiscountCode, userId);
                                console.log('[Cart] Incremented coupon usage for Try & Buy:', appliedDiscountCode);
                            }
                        } catch (error) {
                            console.error('[Cart] Error incrementing coupon usage:', error);
                            // Don't fail the order if usage tracking fails
                        }
                    }

                    // Clear regular cart
                    clearCart();

                    // Navigate to order success
                    requestAnimationFrame(() => {
                        router.push({
                            pathname: '/order-success' as const,
                            params: {
                                orderId: tryAndBuyOrder.id,
                                orderGraphId: tryAndBuyOrder.shopifyDraftOrderId || '',
                                total: total.toString(),
                            },
                        });
                    });

                    setOrderLoading(false);
                    return;
                }
            }

            // Normal order flow (not try and buy)
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
                totalAmount: total,
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
            };

            // Call Payment Service
            console.log('Calling PaymentService.createOrderWithPayment...');
            // Check if total is 0 or payment method is free
            const isFreeOrder = total === 0;
            const effectivePaymentMethod = isFreeOrder ? 'free' : (paymentMethod === 'cod' ? 'cod' : 'razorpay');

                            const result = await PaymentService.createOrderWithPayment(
                orderData,
                isFreeOrder ? 'free' : (paymentMethod === 'cod' ? 'cod' : 'razorpay')
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


    // Render cart item
    const renderItem = (item: any) => {
        const hasFashionTag = item.tags?.some(
            (tag: string) => typeof tag === 'string' && tag.toLowerCase() === 'fashion'
        );

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cartItem}
                onPress={() => handleProductPress(item)}
                activeOpacity={0.7}
            >
                {/* T&B Badge */}
                {hasFashionTag && (
                    <View style={styles.tbBadge}>
                        <Text style={styles.tbBadgeText}>T&B</Text>
                    </View>
                )}

                <Image
                    source={{ uri: item.image }}
                    style={styles.itemImage}
                    contentFit="cover"
                />
                <View style={styles.itemInfo}>
                    <View style={styles.titleRow}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.itemTitle} numberOfLines={2}>
                                {item.title}
                            </Text>
                            {item.variantTitle && item.variantTitle !== 'Default Title' && (
                                <View style={styles.variantPillStatic}>
                                    <Text style={styles.variantTextStatic} numberOfLines={1}>
                                        {item.variantTitle}
                                    </Text>
                                </View>
                            )}
                            {item.bookingDate && (
                                <View style={styles.bookingDateContainer}>
                                    <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                                    <Text style={styles.bookingDateText}>
                                        {new Date(item.bookingDate).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.quantityContainer}>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            >
                                <Ionicons name="remove" size={18} color="#000" />
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{item.quantity}</Text>
                            <TouchableOpacity
                                style={styles.quantityButton}
                                onPress={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            >
                                <Ionicons name="add" size={18} color="#000" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View style={styles.priceRow}>
                        <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                    </View>
                    <View style={styles.itemBottomRow}>
                        <View style={styles.spacer} />
                        <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleRemoveItem(item.id)}
                        >
                            <Ionicons name="trash-outline" size={18} color="#ff4444" />
                        </TouchableOpacity>
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

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Cart</Text>
            </View>

            {cartItems.length > 0 && (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Cart Items */}
                    <View style={styles.itemsSection}>
                        <View style={styles.itemsHeader}>
                            <Text style={styles.itemsHeaderText}>{cartItems.length} Items</Text>
                        </View>
                        {cartItems.map(item => renderItem(item))}
                    </View>

                    {/* Free Shoes Offer - Show when cart has fashion items OR HEYKIDDO coupon is available */}
                    {(hasFashionItems || applicableCoupons.some(c => c.code?.toUpperCase() === 'HEYKIDDO')) && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setShowShoesModal(true)}
                        >
                            <FreeShoesOffer
                                visible={true}
                                heykiddoCoupon={applicableCoupons.find(c => c.code?.toUpperCase() === 'HEYKIDDO') || undefined}
                            />
                        </TouchableOpacity>
                    )}

                    {/* Try Before You Buy Section */}
                    {tryAndBuyEligibility.hasFashionTag && (
                        <View style={styles.tryAndBuySection}>
                            <View style={styles.tryAndBuyHeader}>
                                <Text style={styles.tryAndBuyTitle}>Try Before You Buy</Text>
                                <TouchableOpacity 
                                    style={styles.knowMoreButton}
                                    onPress={() => setShowTryAndBuyModal(true)}
                                >
                                    <Text style={styles.knowMoreText}>Know more</Text>
                                    <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity
                                style={styles.tryAndBuyCheckbox}
                                onPress={toggleTryAndBuy}
                            >
                                <View style={[styles.checkbox, isTryAndBuy && styles.checkboxChecked]}>
                                    {isTryAndBuy && <Ionicons name="checkmark" size={16} color="#fff" />}
                                </View>
                                <Text style={styles.checkboxLabel}>
                                    I'd like to Try & Buy the eligible items
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Gift Wrapping - Hide for ticketing products */}
                    {!hasTicketingProducts && (
                        <View style={styles.giftWrappingSection}>
                            <TouchableOpacity
                                style={styles.giftWrappingButton}
                                onPress={() => setShowGiftModal(true)}
                            >
                                <View style={styles.giftWrappingLeft}>
                                    <Ionicons name="gift-outline" size={20} color={Colors.primary} />
                                    <View style={styles.giftWrappingInfo}>
                                        <Text style={styles.giftWrappingTitle}>
                                            {giftWrapping ? giftWrapping.name : 'Add Gift Wrapping'}
                                        </Text>
                                        {giftWrapping && (
                                            <Text style={styles.giftWrappingDescription}>
                                                {giftWrapping.description}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.giftWrappingRight}>
                                    {giftWrapping ? (
                                        <Text style={styles.giftWrappingPrice}>
                                            ₹{giftWrapping.price}
                                        </Text>
                                    ) : (
                                        <Ionicons name="chevron-forward" size={20} color="#666" />
                                    )}
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    

                    {/* Schedule Delivery - Hide for ticketing products */}
                    {!hasTicketingProducts && (
                        <View style={styles.giftWrappingSection}>
                            <TouchableOpacity
                                style={styles.giftWrappingButton}
                                onPress={() => setShowScheduleModal(true)}
                            >
                                <View style={styles.giftWrappingLeft}>
                                    <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                                    <View style={styles.giftWrappingInfo}>
                                        <Text style={styles.giftWrappingTitle}>
                                            {deliverySchedule ? 'Schedule Delivery' : 'Schedule Delivery'}
                                        </Text>
                                        {deliverySchedule && deliverySchedule.date && deliverySchedule.time && (
                                            <Text style={styles.giftWrappingDescription}>
                                                {deliverySchedule.date} at {deliverySchedule.time}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.giftWrappingRight}>
                                    {deliverySchedule ? (
                                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                                    ) : (
                                        <Ionicons name="chevron-forward" size={20} color="#666" />
                                    )}
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Coupon Code */}
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
                                                    ]}
                                                    onPress={() => !couponApplying && handleApplyCouponFromList(coupon)}
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

                    {/* Bill Summary */}
                    <View style={styles.billSummarySection}>
                        <TouchableOpacity
                            style={styles.billSummaryHeader}
                            onPress={() => setShowBillSummary(!showBillSummary)}
                        >
                            <View style={styles.billSummaryTitleRow}>
                                <Ionicons name="receipt-outline" size={20} color="#000" />
                                <Text style={styles.billSummaryTitle}>Bill Summary</Text>
                            </View>
                            <Ionicons
                                name={showBillSummary ? 'chevron-up' : 'chevron-down'}
                                size={20}
                                color="#666"
                            />
                        </TouchableOpacity>

                        {showBillSummary && (
                            <View style={styles.billSummaryContent}>
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Subtotal</Text>
                                    <Text style={styles.billValue}>{formatCurrency(itemSubtotal)}</Text>
                                </View>
                                {discount > 0 && (
                                    <View style={styles.billRow}>
                                        <Text style={styles.billLabel}>Total Discount</Text>
                                        <Text style={[styles.billValue, styles.discountValue]}>
                                            -{formatCurrency(discount)}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Subtotal After Discount</Text>
                                    <Text style={styles.billValue}>{formatCurrency(subtotalAfterDiscount)}</Text>
                                </View>
                                {!hasTicketingProducts && giftWrappingFee > 0 && (
                                    <View style={styles.billRow}>
                                        <Text style={styles.billLabel}>Gift Wrapping</Text>
                                        <Text style={styles.billValue}>
                                            {formatCurrency(giftWrappingFee)}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.billRow}>
                                    <Text style={styles.billLabel}>Delivery Fee</Text>
                                    <Text style={[styles.billValue, styles.freeText]}>FREE</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Payment Method - Always show when cart has items and total > 0 */}
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

                        {/* Price and Button */}
                        <View style={styles.footerBottom}>
                            <View style={styles.footerLeft}>
                                <View style={styles.footerPriceRow}>
                                    <Text style={styles.footerTotal}>{formatCurrency(total)}</Text>
                                </View>
                                <Text style={styles.footerLabel}>Total</Text>
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
                                            {isAuthenticated ? 'Place Order' : 'Login to Order'}
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
                    // If schedule is empty (removed), set to null
                    if (!schedule.date || !schedule.time) {
                        setDeliverySchedule(null);
                    } else {
                        setDeliverySchedule(schedule);
                    }
                }}
                initialSchedule={deliverySchedule}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        marginRight: 10,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        color: '#000',
        fontFamily: Fonts.SemiBold,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 15,
        paddingBottom: 200,
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
        padding: 15,
        marginBottom: 15,
    },
    itemsHeader: {
        marginBottom: 15,
    },
    itemsHeaderText: {
        fontSize: 14,
        color: '#666',
        fontFamily: Fonts.Regular,
    },
    cartItem: {
        flexDirection: 'row',
        marginBottom: 20,
        position: 'relative',
    },
    tbBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: Colors.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 1,
    },
    tbBadgeText: {
        fontSize: 10,
        color: '#fff',
        fontFamily: Fonts.Bold,
    },
    itemImage: {
        width: 90,
        height: 90,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#f5f5f5',
    },
    itemInfo: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    titleContainer: {
        flex: 1,
        marginRight: 12,
    },
    itemTitle: {
        fontSize: 14,
        color: '#000',
        marginBottom: 4,
        fontFamily: Fonts.SemiBold,
    },
    variantPillStatic: {
        marginTop: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: '#f2f2f2',
        alignSelf: 'flex-start',
    },
    variantTextStatic: {
        fontSize: 12,
        color: '#777',
        fontFamily: Fonts.Medium || Fonts.Regular,
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
    itemPrice: {
        fontSize: 16,
        color: '#000',
        marginRight: 8,
        fontFamily: Fonts.Bold,
    },
    itemBottomRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginTop: 4,
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
        borderColor: Colors.primary,
        borderRadius: 6,
        paddingHorizontal: 2,
    },
    quantityButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 28,
    },
    quantityText: {
        fontSize: 14,
        marginHorizontal: 6,
        minWidth: 18,
        textAlign: 'center',
        fontFamily: Fonts.SemiBold,
    },
    removeButton: {
        padding: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    giftWrappingSection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
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
        fontSize: 14,
        color: '#000',
        fontFamily: Fonts.SemiBold,
        marginBottom: 2,
    },
    giftWrappingDescription: {
        fontSize: 12,
        color: '#666',
        fontFamily: Fonts.Regular,
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
    billSummarySection: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 15,
        marginBottom: 15,
    },
    billSummaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
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
    billSummaryContent: {
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    billRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    billLabel: {
        fontSize: 14,
        color: '#666',
        fontFamily: Fonts.Regular,
    },
    billValue: {
        fontSize: 14,
        color: '#000',
        fontFamily: Fonts.SemiBold,
    },
    discountValue: {
        color: '#4caf50',
    },
    freeText: {
        color: '#4caf50',
        fontFamily: Fonts.Bold,
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
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    footerContent: {
        padding: 15,
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
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 8,
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
