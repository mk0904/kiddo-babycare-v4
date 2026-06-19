import { ScheduleDeliveryModal } from '@/components/modals/ScheduleDeliveryModal';
import { Colors, Fonts } from '@/constants/theme';
import { useAddress } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import {
    normalizeScheduledDateForDeliveryPartner,
    updateDeliveryPartnerOrderSchedule,
} from '@/services/deliveryPartnerService';
import { type OrderItem } from '@/services/orderService';
import PaymentService from '@/services/paymentService';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Demo time slots configuration
const DEMO_TIME_SLOTS = ['2PM - 3PM', '3PM - 4PM', '4PM - 5PM', '5PM - 6PM'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DeliverySchedule {
    date: string;
    time: string;
    day: string;
    dateFormat: string;
    timeSlotLabel?: string;
}

interface GetDemoProps {
    product?: any;
}

const GetDemoScreen: React.FC<GetDemoProps> = ({ product }) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { user, isAuthenticated } = useAuth();
    const { defaultAddress } = useAddress();

    // State for demo scheduling
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [demoSchedule, setDemoSchedule] = useState<DeliverySchedule | null>(null);
    const [selectedAddress, setSelectedAddress] = useState<string>('home');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mock product data (in real app, this would come from params or navigation)
    const mockProduct = {
        id: params.productId || 'demo-product-1',
        variantId: params.variantId || 'demo-product-1',
        title: params.productTitle || 'Loopie Lap 360° Convertible Baby Car Seat for 0-12 Y',
        price: params.productPrice || '19797',
        comparePrice: params.productComparePrice || '21999',
        discountPercentage: params.productDiscount || '10',
        image: params.productImage || 'https://cdn.shopify.com/s/files/1/0961/2787/7409/products/loopie-lap-360-convertible-baby-car-seat.jpg',
    };

    const displayProduct = product || mockProduct;

    const handleCancel = () => {
        router.back();
    };

    const handleSendRequest = async () => {
        if (!demoSchedule?.date || !demoSchedule?.time) {
            Alert.alert('Error', 'Please select a date and time for the demo');
            return;
        }

        if (!isAuthenticated) {
            Alert.alert('Login Required', 'Please login to request a demo');
            router.push('/(auth)/login');
            return;
        }

        if (!defaultAddress) {
            Alert.alert('Address Required', 'Please add a delivery address');
            handleAddAddress();
            return;
        }

        setIsSubmitting(true);

        try {
            const editOrderId = params.editOrderId as string;
            const editDeliveryPartnerOrderId = params.editDeliveryPartnerOrderId as string;
            if (editOrderId) {
                // We are editing an existing demo order using Delivery Partner API only
                const formatTimeForDelivery = (timeStr: string) => {
                    if (!timeStr) return '';
                    const time = timeStr.split(' ')[0]; // e.g. '2PM' from '2PM - 3PM'
                    const match = time.match(/(\d+)(AM|PM)/i);
                    if (!match) return timeStr.toUpperCase();
                    let hour = parseInt(match[1], 10);
                    const ampm = match[2].toUpperCase();
                    const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
                    return `${formattedHour}:00 ${ampm}`;
                };

                const scheduledDate = normalizeScheduledDateForDeliveryPartner(demoSchedule.date);
                const scheduledTime = formatTimeForDelivery(
                    demoSchedule.timeSlotLabel || demoSchedule.time || '',
                );

                console.log('[GetDemo] Editing demo order via Delivery Partner API only');
                console.log('[GetDemo] Order ID:', editOrderId);
                console.log('[GetDemo] Delivery Partner Order ID:', editDeliveryPartnerOrderId);
                console.log('[GetDemo] Scheduled Date:', scheduledDate);
                console.log('[GetDemo] Scheduled Time:', scheduledTime);

                let deliveryPartnerSynced = false;
                if (editDeliveryPartnerOrderId) {
                    // Use delivery partner order ID directly (no lookup needed)
                    const { updateDeliveryPartnerOrderScheduleById } = await import('@/services/deliveryPartnerService');
                    deliveryPartnerSynced = await updateDeliveryPartnerOrderScheduleById(editDeliveryPartnerOrderId, {
                        scheduledDate,
                        scheduledTime,
                    });
                } else {
                    // Fallback to Shopify order ID lookup (for old orders without delivery partner ID)
                    deliveryPartnerSynced = await updateDeliveryPartnerOrderSchedule(editOrderId, {
                        scheduledDate,
                        scheduledTime,
                        shippingAddress: {
                            lat: (defaultAddress as any)?.lat || (defaultAddress as any)?.latitude || null,
                            lng: (defaultAddress as any)?.lng || (defaultAddress as any)?.longitude || null,
                            city: (defaultAddress as any).city || '',
                            name: (defaultAddress as any)?.firstName || (defaultAddress as any)?.name || (user as any)?.name || 'Customer',
                            phone: (defaultAddress as any)?.phone || user?.phone || '',
                            state: (defaultAddress as any).state || '',
                            address: [
                                (defaultAddress as any)?.address1 || (defaultAddress as any)?.address || '',
                                (defaultAddress as any)?.address2 || ''
                            ].filter(Boolean).join(', '),
                            country: (defaultAddress as any)?.country || 'India',
                            pincode: (defaultAddress as any)?.zip || (defaultAddress as any)?.pincode || (defaultAddress as any)?.postalCode || '',
                        },
                    });
                }

                if (!deliveryPartnerSynced) {
                    console.error('[GetDemo] Delivery-partner schedule sync failed');
                    Alert.alert('Error', 'Failed to update demo schedule. Please try again.');
                    return;
                }

                // Update Shopify custom attributes with scheduled_date and scheduled_time for local display
                const { shopifyAdminApi } = await import('@/services/shopifyAdminApi');
                const attributesUpdated = await shopifyAdminApi.updateOrderCustomAttributes(editOrderId, [
                    { key: 'scheduled_date', value: scheduledDate },
                    { key: 'scheduled_time', value: scheduledTime },
                ], ['delivery_date', 'delivery_time']);
                console.log('[GetDemo] Shopify custom attributes updated:', attributesUpdated);

                // Navigate to order success screen with "demo scheduled" title
                router.replace({
                    pathname: '/order-success/v2',
                    params: {
                        orderId: editOrderId,
                        titleOverride: 'Demo scheduled'
                    }
                } as any);
            } else {
                // Use the variantId passed from PDP
                const variantId = displayProduct.variantId || displayProduct.id;
                const productId = displayProduct.id;

                // Extract numeric ID from variantId (backend expects just the numeric part)
                let numericVariantId = variantId;
                if (variantId.startsWith('gid://shopify/ProductVariant/')) {
                    numericVariantId = variantId.replace('gid://shopify/ProductVariant/', '');
                } else if (variantId.includes('/')) {
                    numericVariantId = variantId.split('/').pop() || variantId;
                }

                // Create order item for demo product
                const orderItem: OrderItem = {
                    id: `demo-${Date.now()}`,
                    variantId: numericVariantId,
                    productId: productId,
                    title: displayProduct.title,
                    price: 0, // Demo is free
                    quantity: 1,
                    image: displayProduct.image,
                    customAttributes: {
                        demo_request: 'true'
                    },
                };

                const formatTimeForDelivery = (timeStr: string) => {
                    if (!timeStr) return '';
                    const time = timeStr.split(' ')[0]; // e.g. '2PM' from '2PM - 3PM'
                    const match = time.match(/(\d+)(AM|PM)/i);
                    if (!match) return timeStr.toUpperCase();
                    let hour = parseInt(match[1], 10);
                    const ampm = match[2].toUpperCase();
                    const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
                    return `${formattedHour}:00 ${ampm}`;
                };

                const formattedTimeLabel = formatTimeForDelivery(demoSchedule.timeSlotLabel || demoSchedule.time || '');

                const formattedDeliverySchedule = {
                    date: demoSchedule.date,
                    day: demoSchedule.day,
                    dateFormat: demoSchedule.dateFormat,
                    time: formattedTimeLabel,
                };

                // Create order data with proper type handling
                const orderData = {
                    items: [orderItem],
                    totalAmount: 1, // Set to 1 to avoid PaymentService auto-converting to 'free' when amount is 0
                    currencyCode: 'INR',
                    email: user?.email || '',
                    phone: user?.phone || '',
                    name: (user as any)?.displayName || 'Customer',
                    customerId: user?.customerId || user?.id || undefined,
                    address: {
                        name: (defaultAddress as any)?.firstName || (defaultAddress as any)?.name || (user as any)?.name || 'Customer',
                        address: [
                            (defaultAddress as any)?.address1 || (defaultAddress as any)?.address || '',
                            (defaultAddress as any)?.address2 || ''
                        ].filter(Boolean).join(', '),
                        city: (defaultAddress as any).city || '',
                        state: (defaultAddress as any).state || '',
                        pincode: (defaultAddress as any)?.zip || (defaultAddress as any)?.pincode || (defaultAddress as any)?.postalCode || '',
                        phone: (defaultAddress as any)?.phone || user?.phone || '',
                        addressType: selectedAddress || 'home',
                    },
                    paymentMethod: 'cod' as const,
                    deliverySchedule: formattedDeliverySchedule,
                    deliveryType: 'scheduled' as const,
                    notes: `Demo Request for ${displayProduct.title} on ${demoSchedule.day}, ${demoSchedule.date} at ${formattedTimeLabel} - Demo order with 0 charge`,
                    isDemoOrder: true,
                };

                console.log('Demo order data:', JSON.stringify(orderData, null, 2));
                console.log('[GetDemo] Order-level custom attributes:', JSON.stringify(orderData.items[0].customAttributes, null, 2));
                console.log('[GetDemo] Delivery schedule:', JSON.stringify(orderData.deliverySchedule, null, 2));
                console.log('[GetDemo] isDemoOrder:', orderData.isDemoOrder);
                console.log('[GetDemo] Notes:', orderData.notes);

                // Create the order using PaymentService (COD order with 0 amount)
                const result = await PaymentService.createOrderWithPayment(orderData, 'cod');

                if (result.success) {
                    router.replace({
                        pathname: '/order-success/v2',
                        params: {
                            orderId: result.order?.name || result.order?.orderNumber || result.order?.id || `DEMO-${Date.now()}`,
                            titleOverride: 'Demo scheduled'
                        }
                    } as any);
                } else {
                    throw new Error(result.error || 'Failed to place demo request');
                }
            }
        } catch (error: any) {
            console.error('Demo request error:', error);
            Alert.alert(
                'Error',
                error.message || 'Failed to process demo request. Please try again.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddAddress = () => {
        // Navigate to address management
        router.push('/address');
    };

    const handleDateSelect = () => {
        setShowScheduleModal(true);
    };

    const handleScheduleConfirm = (schedule: DeliverySchedule) => {
        setDemoSchedule(schedule);
        setShowScheduleModal(false);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{params.editOrderId ? 'Edit Demo' : 'Book a Demo'}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Product Info Section */}
                <View style={styles.productSection}>
                    <Image
                        source={{ uri: displayProduct.image }}
                        style={styles.productImage}
                        resizeMode="cover"
                    />
                    <View style={styles.productInfo}>
                        <Text style={styles.productTitle} numberOfLines={2}>
                            {displayProduct.title}
                        </Text>
                        <View style={styles.priceRow}>
                            <Text style={styles.currentPrice}>₹{displayProduct.price}</Text>
                            <Text style={styles.discountText}>{displayProduct.discountPercentage}% off</Text>
                            <Text style={styles.originalPrice}>₹{displayProduct.comparePrice}.0</Text>
                        </View>
                    </View>
                </View>

                {/* Tell Us When Section */}

                {/* Schedule Demo Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SCHEDULE DEMO</Text>
                    <Text style={styles.subText}>The demo should take about 30 min</Text>

                    {/* Inline Date and Time Selection */}
                    <View style={styles.inlineScheduleContainer}>
                        <View style={styles.dateSelectorRow}>
                            {(() => {
                                const today = new Date();
                                return Array.from({ length: 3 }).map((_, i) => {
                                    const d = new Date(today);
                                    d.setDate(today.getDate() + i);
                                    const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
                                    const dd = String(d.getDate()).padStart(2, '0');
                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                    const yyyy = d.getFullYear();
                                    const yy = yyyy.toString().slice(-2);
                                    const dateFormat = `${dd}/${mm}/${yy}`;
                                    const dateStr = `${dd}/${mm}/${yyyy}`;
                                    const dayStr = d.toLocaleDateString('en-US', { weekday: 'long' });

                                    const isSelected = demoSchedule?.date === dateStr;

                                    return (
                                        <TouchableOpacity
                                            key={i}
                                            style={[styles.inlineDateButton, isSelected && styles.inlineDateButtonSelected]}
                                            onPress={() => {
                                                setDemoSchedule({
                                                    ...demoSchedule,
                                                    date: dateStr,
                                                    day: dayStr,
                                                    dateFormat: dateFormat,
                                                    time: demoSchedule?.time || '',
                                                });
                                            }}
                                        >
                                            <Text style={[styles.inlineDateText, isSelected && styles.inlineDateTextSelected]}>
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                });
                            })()}
                        </View>

                        <View style={styles.timeSlotContainer}>
                            {(() => {
                                const allSlots = DEMO_TIME_SLOTS;
                                const now = new Date();
                                const currentHour = now.getHours();
                                const currentMinutes = now.getMinutes();
                                
                                // Check if selected date is today
                                const isToday = demoSchedule?.date ? (() => {
                                    const today = new Date();
                                    const dd = String(today.getDate()).padStart(2, '0');
                                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                                    const yyyy = today.getFullYear();
                                    return demoSchedule.date === `${dd}/${mm}/${yyyy}`;
                                })() : true;

                                // Filter slots that have already passed (only for today)
                                const availableSlots = allSlots.filter((slot: string) => {
                                    if (!isToday) return true; // Show all slots for future dates

                                    // Extract hour from slot (e.g., "2PM" from "2PM - 3PM")
                                    const slotTimePart = slot.split(' ')[0]; // "2PM"
                                    const slotHourNum = parseInt(slotTimePart, 10); // 2
                                    const isPM = slotTimePart.toUpperCase().includes('PM');

                                    // Convert to 24-hour format
                                    let slotHour24 = slotHourNum;
                                    if (isPM && slotHourNum !== 12) {
                                        slotHour24 = slotHourNum + 12;
                                    } else if (!isPM && slotHourNum === 12) {
                                        slotHour24 = 0;
                                    }

                                    return slotHour24 > currentHour || (slotHour24 === currentHour && currentMinutes < 30);
                                });

                                // Show no slots message if no available slots for today
                                if (availableSlots.length === 0 && isToday) {
                                    return (
                                        <View style={styles.noSlotsContainer}>
                                            <Text style={styles.noSlotsText}>No slots available today</Text>
                                        </View>
                                    );
                                }

                                return availableSlots.map((slot: string, index: number) => {
                                    const isSelected = demoSchedule?.timeSlotLabel === slot;
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[styles.inlineTimeSlot, isSelected && styles.inlineTimeSlotSelected]}
                                            onPress={() => {
                                                if (!demoSchedule?.date) {
                                                    // If date isn't selected, default to today
                                                    const d = new Date();
                                                    const dd = String(d.getDate()).padStart(2, '0');
                                                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                                                    const yyyy = d.getFullYear();
                                                    setDemoSchedule({
                                                        date: `${dd}/${mm}/${yyyy}`,
                                                        day: d.toLocaleDateString('en-US', { weekday: 'long' }),
                                                        dateFormat: 'Today',
                                                        time: slot.split(' ')[0], // fallback
                                                        timeSlotLabel: slot
                                                    });
                                                } else {
                                                    setDemoSchedule({
                                                        ...demoSchedule,
                                                        time: slot.split(' ')[0],
                                                        timeSlotLabel: slot
                                                    });
                                                }
                                            }}
                                        >
                                            <Text style={[styles.inlineTimeText, isSelected && styles.inlineTimeTextSelected]}>
                                                {slot}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                });
                            })()}
                        </View>
                    </View>
                </View>

                {/* Address Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ADDRESS</Text>

                    {/* Current Address */}
                    <TouchableOpacity
                        style={[
                            styles.addressCard,
                            selectedAddress === 'home' && styles.addressCardSelected,
                        ]}
                        onPress={() => setSelectedAddress('home')}
                    >
                        <Ionicons
                            name="home-outline"
                            size={20}
                            color={selectedAddress === 'home' ? Colors.primary : Colors.textSecondary}
                        />
                        <View style={styles.addressContent}>
                            <Text style={styles.addressLabel}>HOME</Text>
                            <Text style={styles.addressText} numberOfLines={1}>
                                {defaultAddress ? [
                                    (defaultAddress as any)?.address1 || (defaultAddress as any)?.address || '',
                                    (defaultAddress as any)?.address2 || ''
                                ].filter(Boolean).join(', ') : 'No address added'}
                            </Text>
                        </View>
                        {selectedAddress === 'home' && (
                            <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                        )}
                    </TouchableOpacity>

                    {/* Add Address */}
                    <TouchableOpacity style={styles.addAddressCard} onPress={handleAddAddress}>
                        <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                        <Text style={styles.addAddressText}>Add Address</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Footer Buttons */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <View style={styles.footerDateInfo}>
                    {demoSchedule?.date ? (
                        <>
                            <Text style={styles.footerDateText}>{demoSchedule.dateFormat}</Text>
                            <Text style={styles.footerTimeText}>{demoSchedule.timeSlotLabel || demoSchedule.time}</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.footerDateText}>Select Date</Text>
                            <Text style={styles.footerTimeText}>& Time</Text>
                        </>
                    )}
                </View>
                <TouchableOpacity
                    style={[
                        styles.confirmChangesButton,
                        (!demoSchedule?.date || !demoSchedule?.time || isSubmitting) && styles.confirmChangesButtonDisabled,
                    ]}
                    onPress={handleSendRequest}
                    disabled={!demoSchedule?.date || !demoSchedule?.time || isSubmitting}
                >
                    <Text style={styles.confirmChangesButtonText}>
                        {isSubmitting ? 'Confirming...' : 'Confirm changes'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Schedule Delivery Modal */}
            <ScheduleDeliveryModal
                visible={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                onConfirm={handleScheduleConfirm}
                initialSchedule={demoSchedule}
                title="Schedule Demo"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
        marginLeft: 12,
        flex: 1,
    },
    headerSpacer: {
        width: 32,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    productSection: {
        backgroundColor: '#fff',
        margin: 16,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
    },
    productInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    productTitle: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
        marginBottom: 8,
        lineHeight: 20,
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    currentPrice: {
        fontSize: 16,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
        marginRight: 8,
    },
    discountText: {
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
        color: '#2c6975',
        marginRight: 8,
    },
    originalPrice: {
        fontSize: 12,
        fontFamily: Fonts.LexendRegular,
        color: Colors.textSecondary,
        textDecorationLine: 'line-through',
    },
    section: {
        backgroundColor: '#fff',
        margin: 16,
        marginTop: 0,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 13,
        fontFamily: Fonts.LexendRegular,
        color: Colors.textSecondary,
        lineHeight: 18,
        marginBottom: 12,
    },
    proTipBox: {
        flexDirection: 'row',
        backgroundColor: '#E3F2FD',
        padding: 12,
        borderRadius: 8,
        alignItems: 'flex-start',
    },
    proTipText: {
        fontSize: 12,
        fontFamily: Fonts.LexendRegular,
        color: '#1565C0',
        marginLeft: 8,
        flex: 1,
        lineHeight: 16,
    },
    addressCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    addressCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: '#FEEFEF',
    },
    addressContent: {
        flex: 1,
        marginLeft: 12,
    },
    addressLabel: {
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
        marginBottom: 2,
    },
    addressText: {
        fontSize: 13,
        fontFamily: Fonts.LexendRegular,
        color: Colors.textSecondary,
    },
    addAddressCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderStyle: 'dashed',
    },
    addAddressText: {
        fontSize: 13,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.primary,
        marginLeft: 8,
    },
    subText: {
        fontSize: 12,
        fontFamily: Fonts.LexendRegular,
        color: Colors.textSecondary,
        marginBottom: 12,
    },
    inlineScheduleContainer: {
        marginTop: 8,
    },
    dateSelectorRow: {
        width: '100%',
        flexDirection: 'row',
        backgroundColor: '#FAFAFA',
        borderRadius: 36,
        padding: 4,
        marginBottom: 20,
    },
    inlineDateButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inlineDateButtonSelected: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        borderColor: '#D8D8D8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    inlineDateText: {
        fontSize: 13,
        fontFamily: Fonts.LexendBold,
        color: '#717680',
    },
    inlineDateTextSelected: {
        color: '#DB5656',
        fontFamily: Fonts.LexendBold,
    },
    timeSlotContainer: {
        flexDirection: 'column',
        gap: 10,
    },
    inlineTimeSlot: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    inlineTimeSlotSelected: {
        backgroundColor: '#FEEFEF',
        borderColor: '#F15E5E',
        borderRadius: 999,
    },
    inlineTimeText: {
        fontSize: 15,
        fontFamily: Fonts.LexendMedium,
        color: '#717680',
    },
    inlineTimeTextSelected: {
        color: '#181D27',
        fontFamily: Fonts.LexendBold,
    },
    noSlotsContainer: {
        backgroundColor: '#FAFAFA',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noSlotsText: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#717680',
    },
    footer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 16,
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        alignItems: 'center',
    },
    footerDateInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    footerDateText: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#181D27',
        marginBottom: 2,
    },
    footerTimeText: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
    },
    confirmChangesButton: {
        flex: 2,
        backgroundColor: '#DB5656',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    confirmChangesButtonDisabled: {
        backgroundColor: '#D0D0D0',
        shadowOpacity: 0,
        elevation: 0,
    },
    confirmChangesButtonText: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#fff',
    },
});

export default GetDemoScreen;
