import { isDeliveryScheduleValid, ScheduleDeliveryModal } from '@/components/modals/ScheduleDeliveryModal';
import { Colors, Fonts } from '@/constants/theme';
import { useAddress } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import {
    normalizeScheduledDateForDeliveryPartner
} from '@/services/deliveryPartnerService';
import { type OrderItem } from '@/services/orderService';
import PaymentService from '@/services/paymentService';
import { configService } from '@/services/configService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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

/** Format time string for delivery partner API (e.g., "2PM - 3PM" -> "02:00 PM") */
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

const GetDemoScreen: React.FC<GetDemoProps> = ({ product }) => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const { user, isAuthenticated } = useAuth();
    const { defaultAddress, addresses, loadAddresses } = useAddress();

    // State for demo scheduling
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [demoSchedule, setDemoSchedule] = useState<DeliverySchedule | null>(null);
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [demoTimeSlots, setDemoTimeSlots] = useState<string[]>([]);

    // Load demo time slots from remote config
    useEffect(() => {
        const loadDemoTimeSlots = () => {
            try {
                const demoConfig = configService.getDemoConfig();
                const timeSlots = demoConfig?.timeSlots || ['2PM - 3PM', '3PM - 4PM', '4PM - 5PM', '5PM - 6PM'];
                console.log('[GetDemo] Time slots from remote config:', timeSlots);
                setDemoTimeSlots(timeSlots);
            } catch (error) {
                console.error('[GetDemo] Failed to load demo time slots:', error);
                setDemoTimeSlots(['2PM - 3PM', '3PM - 4PM', '4PM - 5PM', '5PM - 6PM']);
            }
        };

        loadDemoTimeSlots();

        // Also subscribe so slots update if remote config reloads
        const unsub = configService.subscribe(() => loadDemoTimeSlots());
        return unsub;
    }, []);

    // Set default address as selected when addresses load or when default address changes
    useEffect(() => {
        if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
        }
    }, [defaultAddress]);

    // Reload addresses when screen comes back into focus (e.g., after adding address)
    useFocusEffect(
        useCallback(() => {
            if (isAuthenticated) {
                loadAddresses();
            }
        }, [isAuthenticated, loadAddresses])
    );

    // Set selected address from edit order when editing
    useEffect(() => {
        const editAddress = params.editAddress as string;
        if (editAddress && addresses.length > 0) {
            try {
                const parsedAddress = JSON.parse(editAddress);
                // Try to find matching address by comparing key fields
                const matchingAddress = addresses.find((addr: any) => {
                    const addrLat = addr?.lat || addr?.latitude;
                    const addrLng = addr?.lng || addr?.longitude;
                    const parsedLat = parsedAddress?.lat;
                    const parsedLng = parsedAddress?.lng;
                    // Match by coordinates if available
                    if (addrLat && addrLng && parsedLat && parsedLng) {
                        return Math.abs(addrLat - parsedLat) < 0.0001 && Math.abs(addrLng - parsedLng) < 0.0001;
                    }
                    // Fallback to match by address line and pincode
                    return addr?.address1 === parsedAddress?.address && addr?.zip === parsedAddress?.pincode;
                });

                if (matchingAddress) {
                    setSelectedAddressId(matchingAddress.id);
                    console.log('[GetDemo] Set selected address from edit order:', matchingAddress.id);
                } else {
                    console.warn('[GetDemo] No matching address found for edit order, using default');
                }
            } catch (error) {
                console.error('[GetDemo] Failed to parse editAddress:', error);
            }
        }
    }, [params.editAddress, addresses]);

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

    // Pre-populate schedule when editing
    useEffect(() => {
        const editOrderId = params.editOrderId as string;
        const editScheduledDate = params.editScheduledDate as string;
        const editScheduledTime = params.editScheduledTime as string;

        if (editOrderId && editScheduledDate && editScheduledTime) {
            // Parse the date from delivery partner format (YYYY-MM-DD) to UI format (DD/MM/YYYY)
            let parsedDate: Date | null = null;
            try {
                parsedDate = new Date(editScheduledDate);
                if (isNaN(parsedDate.getTime())) {
                    // Try DD/MM/YYYY format as fallback
                    const parts = editScheduledDate.split('/');
                    if (parts.length === 3) {
                        parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    }
                }
            } catch (e) {
                console.warn('[GetDemo] Failed to parse scheduled date:', editScheduledDate, e);
            }

            if (parsedDate && !isNaN(parsedDate.getTime())) {
                const dd = String(parsedDate.getDate()).padStart(2, '0');
                const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
                const yyyy = parsedDate.getFullYear();
                const yy = yyyy.toString().slice(-2);
                const dateStr = `${dd}/${mm}/${yyyy}`;
                const dateFormat = `${dd}/${mm}/${yy}`;
                const dayStr = parsedDate.toLocaleDateString('en-US', { weekday: 'long' });

                // Parse time from delivery partner format (e.g., "02:00 PM") to UI slot format (e.g., "2PM - 3PM")
                let timeSlotLabel = '';
                let time = '';
                try {
                    const timeMatch = editScheduledTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                    if (timeMatch) {
                        const hour = parseInt(timeMatch[1], 10);
                        const ampm = timeMatch[3].toUpperCase();
                        const nextHour = hour + 1;
                        const nextHourFormatted = nextHour > 12 ? nextHour - 12 : nextHour;
                        timeSlotLabel = `${hour}${ampm} - ${nextHourFormatted}${ampm}`;
                        time = `${hour}${ampm}`;
                    } else {
                        // Try to match existing slot format directly
                        timeSlotLabel = demoTimeSlots.find((slot: string) =>
                            editScheduledTime.includes(slot.split(' - ')[0])
                        ) || editScheduledTime;
                        time = timeSlotLabel.split(' ')[0];
                    }
                } catch (e) {
                    console.warn('[GetDemo] Failed to parse scheduled time:', editScheduledTime, e);
                    timeSlotLabel = editScheduledTime;
                    time = editScheduledTime.split(' ')[0];
                }

                setDemoSchedule({
                    date: dateStr,
                    day: dayStr,
                    dateFormat: dateFormat,
                    time: time,
                    timeSlotLabel: timeSlotLabel,
                });

                console.log('[GetDemo] Pre-populated schedule from edit params:', {
                    date: dateStr,
                    day: dayStr,
                    time: time,
                    timeSlotLabel: timeSlotLabel,
                });
            }
        }
    }, [params.editOrderId, params.editScheduledDate, params.editScheduledTime]);

    const handleCancel = () => {
        router.back();
    };

    const handleSendRequest = async () => {
        if (!demoSchedule?.date || !demoSchedule?.time) {
            Alert.alert('Error', 'Please select a date and time for the demo');
            return;
        }

        if (!isDeliveryScheduleValid(demoSchedule)) {
            Alert.alert('Time Slot Expired', 'The selected date or time slot has passed. Please choose a new time for your demo.');
            setDemoSchedule(null);
            return;
        }

        if (!isAuthenticated) {
            Alert.alert('Login Required', 'Please login to request a demo');
            router.push('/(auth)/login');
            return;
        }

        // Check that user has a selected address (or at least a default address)
        const hasSelectedAddress = selectedAddressId && addresses?.some((addr: any) => addr.id === selectedAddressId);
        if (!hasSelectedAddress && !defaultAddress) {
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
                    // Use delivery partner order ID directly
                    const { updateDeliveryPartnerOrderScheduleById } = await import('@/services/deliveryPartnerService');

                    // Use selected address instead of default address
                    const selectedAddressObj = addresses?.find((addr: any) => addr.id === selectedAddressId) || defaultAddress;

                    const shippingAddress = {
                        lat: (selectedAddressObj as any)?.lat || (selectedAddressObj as any)?.latitude || null,
                        lng: (selectedAddressObj as any)?.lng || (selectedAddressObj as any)?.longitude || null,
                        city: (selectedAddressObj as any).city || '',
                        name: (selectedAddressObj as any)?.firstName || (selectedAddressObj as any)?.name || (user as any)?.name || 'Customer',
                        phone: (selectedAddressObj as any)?.phone || user?.phone || '',
                        state: (selectedAddressObj as any).state || '',
                        address: [
                            (selectedAddressObj as any)?.address1 || (selectedAddressObj as any)?.address || '',
                            (selectedAddressObj as any)?.address2 || ''
                        ].filter(Boolean).join(', '),
                        country: (selectedAddressObj as any)?.country || 'India',
                        pincode: (selectedAddressObj as any)?.zip || (selectedAddressObj as any)?.pincode || (selectedAddressObj as any)?.postalCode || '',
                    };

                    console.log('[GetDemo] selectedAddressId:', selectedAddressId);
                    console.log('[GetDemo] selectedAddressObj:', JSON.stringify(selectedAddressObj, null, 2));
                    console.log('[GetDemo] shippingAddress being sent:', JSON.stringify(shippingAddress, null, 2));

                    deliveryPartnerSynced = await updateDeliveryPartnerOrderScheduleById(editDeliveryPartnerOrderId, {
                        scheduledDate,
                        scheduledTime,
                        shippingAddress,
                    });
                }

                if (!deliveryPartnerSynced) {
                    console.error('[GetDemo] Delivery-partner schedule sync failed');
                    Alert.alert('Error', 'Failed to update demo schedule. Please try again.');
                    return;
                }

                // Navigate to order success screen with "demo scheduled" title
                router.replace({
                    pathname: '/order-success/v2',
                    params: {
                        orderId: editOrderId,
                        titleOverride: 'Demo Scheduled!'
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

                const formattedTimeLabel = formatTimeForDelivery(demoSchedule.timeSlotLabel || demoSchedule.time || '');

                const formattedDeliverySchedule = {
                    date: demoSchedule.date,
                    day: demoSchedule.day,
                    dateFormat: demoSchedule.dateFormat,
                    time: formattedTimeLabel,
                };

                // Use selected address instead of default address
                const selectedAddressObj = addresses?.find((addr: any) => addr.id === selectedAddressId) || defaultAddress;

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
                        name: (selectedAddressObj as any)?.firstName || (selectedAddressObj as any)?.name || (user as any)?.name || 'Customer',
                        address: [
                            (selectedAddressObj as any)?.address1 || (selectedAddressObj as any)?.address || '',
                            (selectedAddressObj as any)?.address2 || ''
                        ].filter(Boolean).join(', '),
                        city: (selectedAddressObj as any).city || '',
                        state: (selectedAddressObj as any).state || '',
                        pincode: (selectedAddressObj as any)?.zip || (selectedAddressObj as any)?.pincode || (selectedAddressObj as any)?.postalCode || '',
                        phone: (selectedAddressObj as any)?.phone || user?.phone || '',
                        addressType: 'home',
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
                            titleOverride: 'Demo Scheduled!'
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
                <Text style={styles.headerTitle}>{params.editOrderId ? 'Edit Demo' : 'Book a demo'}</Text>
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
                        <Text style={styles.productTitle}>
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
                    <Text style={styles.sectionTitle}>When?</Text>

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
                                const allSlots = demoTimeSlots;
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
                                        <View style={styles.noSlotsBox}>
                                            <Text style={styles.noSlotsText}>No slots available on this day</Text>
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
                    <Text style={styles.sectionTitle}>Where?</Text>

                    {/* Address List - Show all addresses */}
                    {addresses.length > 0 ? (
                        addresses.map((address: any) => (
                            <TouchableOpacity
                                key={address.id}
                                style={[
                                    styles.addressCard,
                                    selectedAddressId === address.id && styles.addressCardSelected,
                                ]}
                                onPress={() => setSelectedAddressId(address.id)}
                            >
                                <View style={styles.addressContent}>
                                    <Text style={styles.addressLabel}>{address.tag?.toUpperCase() || 'HOME'}</Text>
                                    <Text style={styles.addressText} numberOfLines={1}>
                                        {[
                                            address?.address1 || address?.address || '',
                                            address?.address2 || ''
                                        ].filter(Boolean).join(', ') || 'No address added'}
                                    </Text>
                                </View>
                                <View style={styles.radioButton}>
                                    <View style={[styles.radioButtonInner, selectedAddressId === address.id && styles.radioButtonInnerSelected]} />
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <View style={styles.noAddressBox}>
                            <Text style={styles.noAddressText}>No saved addresses found</Text>
                        </View>
                    )}

                    {/* Add Address */}
                    <TouchableOpacity style={styles.addAddressCard} onPress={handleAddAddress}>
                        <Text style={styles.addAddressText}>Add new address</Text>
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
                        {isSubmitting ? 'Confirming...' : (params.editOrderId ? 'Confirm Changes' : 'Confirm demo')}
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
        color: "#717680",
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
    radioButton: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#DB5656',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioButtonInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'transparent',
    },
    radioButtonInnerSelected: {
        backgroundColor: '#DB5656',
    },
    addAddressCard: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
    },
    addAddressText: {
        fontSize: 16,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.primary,
        textAlign: 'center',
    },
    noAddressBox: {
        backgroundColor: '#FAFAFA',
        padding: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: '#e0e0e0',
        minHeight: 180,
    },
    noAddressText: {
        fontSize: 14,
        fontWeight:600,
        fontFamily: Fonts.LexendRegular,
        color: Colors.textSecondary,
    },
    noSlotsBox: {
        backgroundColor: '#FAFAFA',
        padding: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderColor: '#e0e0e0',
        minHeight: 180,
    },
    noSlotsText: {
        fontSize: 14,
        fontWeight: 600,
        fontFamily: Fonts.LexendRegular,
        color: Colors.textSecondary,
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
