import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    TextInput,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useAddress } from '@/context/AddressContext';
import { AddressModal } from '@/components/modals/AddressModal';
import { GiftWrappingModal } from '@/components/modals/GiftWrappingModal';
import PaymentService from '@/services/paymentService';
import { CheckoutRedeemCoins } from '@/components/nector';
import { Colors, Fonts } from '@/constants/theme';

export default function CartScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { defaultAddress } = useAddress();
    const {
        cartItems,
        updateQuantity,
        removeFromCart,
        clearCart,
        getCartTotal,
        isTryAndBuy,
        toggleTryAndBuy,
        giftWrapping,
        appliedDiscountCode,
        appliedDiscountCodes,
        discountAmount,
        applyDiscountCode,
        removeDiscountCode,
        getGiftWrappingPrice,
        getAvailableCoupons,
        loading,
    } = useCart();

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

    // Redirect back if cart is empty
    useEffect(() => {
        if (!loading && cartItems.length === 0) {
            router.back();
        }
    }, [loading, cartItems.length, router]);

    // Fetch available coupons on mount
    useEffect(() => {
        const fetchCoupons = async () => {
            setLoadingCoupons(true);
            try {
                const coupons = await getAvailableCoupons();
                setAvailableCoupons(coupons);
            } catch (error) {
                console.error('Error fetching coupons:', error);
            } finally {
                setLoadingCoupons(false);
            }
        };
        fetchCoupons();
    }, [getAvailableCoupons]);

    // Use address from AddressContext
    const selectedAddress = defaultAddress;

    // Calculate totals
    const itemTotal = getCartTotal();
    const discount = discountAmount || 0; // From applied coupon (from Shopify)
    const subtotal = itemTotal - discount;
    const deliveryFee = 0;
    const giftWrappingFee = getGiftWrappingPrice();
    const total = subtotal + deliveryFee + giftWrappingFee;

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

    const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        updateQuantity(itemId, newQuantity);
    };

    const handleRemoveItem = (itemId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        removeFromCart(itemId);
    };

    const handleApplyCoupon = async () => {
        const code = couponCode.trim().toUpperCase();
        if (!code) return;

        if (appliedDiscountCodes?.includes(code)) {
            setCouponMessage(`${code} is already applied.`);
            return;
        }

        setCouponApplying(true);
        setCouponMessage(null);
        try {
            await applyDiscountCode(code);
            setCouponMessage(`✓ ${code} applied successfully!`);
            setCouponCode('');
            // Refresh available coupons
            const coupons = await getAvailableCoupons();
            setAvailableCoupons(coupons);
        } catch (error: any) {
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
            await applyDiscountCode(code);
            setCouponMessage(`✓ ${code} applied successfully!`);
            // Refresh available coupons
            const coupons = await getAvailableCoupons();
            setAvailableCoupons(coupons);
        } catch (error: any) {
            setCouponMessage(error.message || 'Failed to apply coupon');
        } finally {
            setCouponApplying(false);
        }
    };

    const handlePlaceOrder = async () => {
        if (!selectedAddress) {
            setShowAddressModal(true);
            return;
        }

        setOrderLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
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
                })),
                totalAmount: total,
                currencyCode: 'INR',
                email: user?.email || 'guest@example.com',
                phone: user?.phone || selectedAddress.phone || '',
                name: user?.displayName || `${selectedAddress.firstName} ${selectedAddress.lastName}`,
                customerId: user?.id, // Pass the raw ID, let service handle formatting if needed
                address: {
                    name: `${selectedAddress.firstName} ${selectedAddress.lastName}`,
                    address: [selectedAddress.address1, selectedAddress.address2].filter(Boolean).join(', '),
                    city: selectedAddress.city,
                    state: selectedAddress.province,
                    pincode: selectedAddress.zip,
                    phone: selectedAddress.phone,
                },
                giftWrapping: giftWrapping ? {
                    name: giftWrapping.name,
                    price: giftWrapping.price
                } : undefined,
                couponCode: appliedDiscountCode || undefined,
            };

            // Call Payment Service
            console.log('Calling PaymentService.createOrderWithPayment...');
            const result = await PaymentService.createOrderWithPayment(
                orderData,
                paymentMethod === 'cod' ? 'cod' : 'razorpay'
            );
            console.log('PaymentService result received:', result);

            if (!result.success) {
                // Check for cancellation
                if (result.cancelled) {
                    console.log('Payment cancelled');
                    return;
                }
                throw new Error(result.error || 'Order creation failed');
            }

            // Success!
            const finalOrder = result.order;
            const orderIdForDisplay = finalOrder?.name || finalOrder?.orderNumber || finalOrder?.id || `ORD-${Date.now()}`;

            // Clear cart and navigate
            clearCart();
            router.replace({
                pathname: '/order-success',
                params: {
                    orderId: orderIdForDisplay,
                    orderGraphId: finalOrder?.id, // Pass real ID for API lookups
                    total: total.toString()
                },
            });

        } catch (error: any) {
            console.error('Order placement error:', error);
            if (error.code === 0 || error.message?.includes('cancelled')) {
                // Payment cancelled by user
                return;
            }
            Alert.alert('Order Failed', error.description || error.message || 'Something went wrong while placing your order.');
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
                    {/* Try Before You Buy Section */}
                    {tryAndBuyEligibility.hasFashionTag && (
                        <View style={styles.tryAndBuySection}>
                            <View style={styles.tryAndBuyHeader}>
                                <Text style={styles.tryAndBuyTitle}>Try Before You Buy</Text>
                                <TouchableOpacity style={styles.knowMoreButton}>
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

                    {/* Cart Items */}
                    <View style={styles.itemsSection}>
                        <View style={styles.itemsHeader}>
                            <Text style={styles.itemsHeaderText}>{cartItems.length} Items</Text>
                        </View>
                        {cartItems.map(item => renderItem(item))}
                    </View>

                    {/* Gift Wrapping */}
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
                                    <Text style={styles.billLabel}>Item Total (MRP)</Text>
                                    <Text style={styles.billValue}>{formatCurrency(itemTotal)}</Text>
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
                                    <Text style={styles.billLabel}>Subtotal</Text>
                                    <Text style={styles.billValue}>{formatCurrency(subtotal)}</Text>
                                </View>
                                {giftWrappingFee > 0 && (
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

                    {/* Payment Method - Only for normal orders */}
                    {!isTryAndBuy && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Payment Method</Text>
                            <TouchableOpacity
                                style={[
                                    styles.paymentOption,
                                    paymentMethod === 'cod' && styles.paymentOptionSelected,
                                ]}
                                onPress={() => setPaymentMethod('cod')}
                            >
                                <Ionicons
                                    name={paymentMethod === 'cod' ? 'radio-button-on' : 'radio-button-off'}
                                    size={24}
                                    color={paymentMethod === 'cod' ? Colors.primary : '#ccc'}
                                />
                                <Text style={styles.paymentOptionText}>Cash on Delivery (COD)</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.paymentOption,
                                    paymentMethod === 'razorpay' && styles.paymentOptionSelected,
                                ]}
                                onPress={() => setPaymentMethod('razorpay')}
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

                    {/* Coupon Code */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Coupon Code</Text>
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
                                            onPress={() => removeDiscountCode(code)}
                                            style={styles.couponRemove}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Ionicons name="close" size={14} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Available Coupons List - Only show when no coupon is applied */}
                        {availableCoupons.length > 0 && (!appliedDiscountCodes || appliedDiscountCodes.length === 0) && (
                            <View style={styles.availableCouponsContainer}>
                                <View style={styles.availableCouponsHeader}>
                                    <Ionicons name="pricetag" size={16} color={Colors.primary} />
                                    <Text style={styles.availableCouponsTitle}>Available Offers</Text>
                                </View>
                                {loadingCoupons ? (
                                    <View style={styles.couponsLoadingContainer}>
                                        <ActivityIndicator size="small" color={Colors.primary} />
                                        <Text style={styles.couponsLoadingText}>Loading offers...</Text>
                                    </View>
                                ) : (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.couponsList}
                                    >
                                        {availableCoupons.map((coupon) => {
                                            return (
                                                <TouchableOpacity
                                                    key={coupon.code}
                                                    style={[
                                                        styles.couponCard,
                                                        couponApplying && styles.couponCardDisabled
                                                    ]}
                                                    onPress={() => !couponApplying && handleApplyCouponFromList(coupon)}
                                                    disabled={couponApplying}
                                                    activeOpacity={0.7}
                                                >
                                                    <View style={styles.couponCardContent}>
                                                        <View style={styles.couponCodeRow}>
                                                            <Text style={styles.couponCardCode}>{coupon.code}</Text>
                                                            {coupon.value && (
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
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                )}
                            </View>
                        )}
                    </View>

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
                <View style={styles.footer}>
                    <View style={styles.footerContent}>
                        {/* Address Section */}
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

                        {/* Price and Button */}
                        <View style={styles.footerBottom}>
                            <View style={styles.footerLeft}>
                                <View style={styles.footerPriceRow}>
                                    <Text style={styles.footerTotal}>{formatCurrency(total)}</Text>
                                </View>
                                <Text style={styles.footerLabel}>Total</Text>
                            </View>
                            {selectedAddress ? (
                                <TouchableOpacity
                                    style={[
                                        styles.checkoutButton,
                                        isTryAndBuy && styles.tryAndBuyButton,
                                        orderLoading && styles.checkoutButtonDisabled,
                                    ]}
                                    onPress={handlePlaceOrder}
                                    disabled={orderLoading}
                                >
                                    {orderLoading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.checkoutButtonText}>Place Order</Text>
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
            />

            {/* Gift Wrapping Modal */}
            <GiftWrappingModal
                visible={showGiftModal}
                onClose={() => setShowGiftModal(false)}
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
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
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
