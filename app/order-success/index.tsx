import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '@/constants/theme';

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
        // Navigate to orders details if ID is available, else home
        if (orderGraphId) {
            // Encode ID just in case, though usually fine in Expo Router paths if standard chracters
            // If it's a GID, it might contain slashes which is bad for path params
            // However, Expo Router can handle it if we push as object params usually, or encodeURIComponent
            // Let's try direct push first
            router.replace({ pathname: '/orders/[id]', params: { id: orderGraphId } } as any);
        } else {
            router.replace('/');
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
                        <View style={styles.orderRow}>
                            <Text style={styles.orderLabel}>Estimated Delivery</Text>
                            <Text style={styles.orderValue}>3-5 Business Days</Text>
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
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={handleContinueShopping}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.primaryButtonText}>Continue Shopping</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={handleViewOrders}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.secondaryButtonText}>View My Orders</Text>
                    </TouchableOpacity>
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
        marginBottom: 24,
    },
    orderCard: {
        width: '100%',
        backgroundColor: '#F8F8F8',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
    },
    orderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
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
    },
    actions: {
        position: 'absolute',
        bottom: 40,
        left: 32,
        right: 32,
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
});
