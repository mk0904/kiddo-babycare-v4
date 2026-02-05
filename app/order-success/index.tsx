import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OrderSuccessScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { orderId, orderGraphId, total } = params;

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        // Haptic celebration
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Animate checkmark
        Animated.sequence([
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 5,
                useNativeDriver: true,
            }),
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, []);

    const handleContinueShopping = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.replace('/');
    };

    const handleViewOrders = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/orders');
    };

    const handleViewOrderDetails = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Navigate to order details if ID is available
        if (orderGraphId) {
            // Ensure the order ID is properly encoded for URL navigation
            // Shopify order IDs might include query parameters like ?key=...
            const encodedId = typeof orderGraphId === 'string' ? encodeURIComponent(orderGraphId) : orderGraphId;
            console.log('[OrderSuccess] Navigating to order details with ID:', orderGraphId);
            router.push({ pathname: '/orders/[id]', params: { id: encodedId } } as any);
        } else if (orderId) {
            // Fallback: try to navigate with orderId if orderGraphId is not available
            const encodedId = typeof orderId === 'string' ? encodeURIComponent(orderId) : orderId;
            console.log('[OrderSuccess] Navigating to order details with fallback orderId:', orderId);
            router.push({ pathname: '/orders/[id]', params: { id: encodedId } } as any);
        } else {
            router.push('/orders');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            <View style={styles.content}>
                {/* Success Icon */}
                <Animated.View
                    style={[
                        styles.iconContainer,
                        { transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    <View style={styles.iconCircle}>
                        <Ionicons name="checkmark" size={60} color="#FFFFFF" />
                    </View>
                </Animated.View>

                {/* Success Message */}
                <Animated.View
                    style={[
                        styles.messageContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <Text style={styles.title}>Order Placed!</Text>
                    <Text style={styles.subtitle}>
                        Your order has been placed successfully
                    </Text>

                    {/* Order Details Card */}
                    <View style={styles.orderCard}>
                        <View style={styles.orderRow}>
                            <Text style={styles.orderLabel}>Order ID</Text>
                            <Text style={styles.orderValue}>{orderId || 'ORD123456'}</Text>
                        </View>
                        {total && (
                            <View style={styles.orderRow}>
                                <Text style={styles.orderLabel}>Total Amount</Text>
                                <Text style={styles.orderValue}>
                                    {new Intl.NumberFormat('en-IN', {
                                        style: 'currency',
                                        currency: 'INR',
                                        minimumFractionDigits: 0,
                                    }).format(Number(total))}
                                </Text>
                            </View>
                        )}
                        <View style={[styles.orderRow, styles.lastOrderRow]}>
                            <Text style={styles.orderLabel}>Estimated Delivery</Text>
                            <Text style={styles.orderValue}>30 mins</Text>
                        </View>
                    </View>

                    <Text style={styles.infoText}>
                        You will receive an order confirmation email with tracking details shortly.
                    </Text>
                </Animated.View>

                {/* Action Buttons */}
                <Animated.View
                    style={[
                        styles.actions,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    {orderGraphId && (
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={handleViewOrderDetails}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.primaryButtonText}>View Order Details</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={orderGraphId ? styles.secondaryButton : styles.primaryButton}
                        onPress={handleContinueShopping}
                        activeOpacity={0.8}
                    >
                        <Text style={orderGraphId ? styles.secondaryButtonText : styles.primaryButtonText}>
                            Continue Shopping
                        </Text>
                    </TouchableOpacity>

                    {orderGraphId && (
                        <TouchableOpacity
                            style={styles.tertiaryButton}
                            onPress={handleViewOrders}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.tertiaryButtonText}>View All Orders</Text>
                        </TouchableOpacity>
                    )}
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconContainer: {
        marginBottom: 32,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    messageContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        fontFamily: Fonts.Regular,
        color: '#666',
        marginBottom: 28,
    },
    orderCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 32,
    },
    orderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    lastOrderRow: {
        marginBottom: 0,
    },
    orderLabel: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#666',
    },
    orderValue: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
    },
    infoText: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#999',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 48,
    },
    actions: {
        position: 'absolute',
        bottom: 40,
        left: 32,
        right: 32,
        paddingTop: 16,
    },
    primaryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#FFFFFF',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
    },
    tertiaryButton: {
        backgroundColor: 'transparent',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    tertiaryButtonText: {
        fontSize: 15,
        fontFamily: Fonts.Medium,
        color: Colors.primary,
    },
});
