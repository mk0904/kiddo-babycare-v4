import { DEFAULT_ETA_MINUTES } from '@/config/deliveryConfig';
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ICON_SIZE = 170;
const AUTO_NAVIGATE_DELAY_MS = 3000;

export default function OrderSuccessV2Screen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        orderId?: string;
        orderGraphId?: string;
        estimatedDeliveryMinutes?: string;
        destinationLat?: string;
        destinationLng?: string;
    }>();
    const { orderId, orderGraphId, estimatedDeliveryMinutes, destinationLat, destinationLng } = params;

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 6,
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    // After 3 seconds, navigate to order detail (or orders list if no id)
    useEffect(() => {
        const t = setTimeout(() => {
            const etaParam = estimatedDeliveryMinutes != null ? { estimatedDeliveryMinutes } : {};
            const destParam =
                destinationLat != null &&
                destinationLng != null &&
                String(destinationLat).trim() !== '' &&
                String(destinationLng).trim() !== ''
                    ? { destinationLat: String(destinationLat), destinationLng: String(destinationLng) }
                    : {};
            if (orderGraphId) {
                const encodedId = typeof orderGraphId === 'string' ? encodeURIComponent(orderGraphId) : orderGraphId;
                router.replace({
                    pathname: '/orders/[id]/v2',
                    params: { id: encodedId, ...etaParam, ...destParam },
                } as any);
            } else if (orderId) {
                const encodedId = typeof orderId === 'string' ? encodeURIComponent(orderId) : orderId;
                router.replace({
                    pathname: '/orders/[id]/v2',
                    params: { id: encodedId, ...etaParam, ...destParam },
                } as any);
            } else {
                router.replace('/orders');
            }
        }, AUTO_NAVIGATE_DELAY_MS);
        return () => clearTimeout(t);
    }, [orderGraphId, orderId, router, estimatedDeliveryMinutes, destinationLat, destinationLng]);

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.replace('/');
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar style="dark" />

            {/* Close button - top left */}
            <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                hitSlop={12}
                activeOpacity={0.7}
            >
                <Ionicons name="close" size={28} color="#1A1A1A" />
            </TouchableOpacity>

            {/* Center: success icon + text */}
            <View style={styles.content}>
                <Animated.View
                    style={[
                        styles.iconWrap,
                        { transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    <Image
                        source={require('@/assets/images/order-success.png')}
                        style={{ width: ICON_SIZE, height: ICON_SIZE }}
                        contentFit="contain"
                    />
                </Animated.View>
                <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
                    Order placed
                </Animated.Text>
            </View>

            {/* Footer: wavy graphic */}
            <View style={styles.footer}>
                <Image
                    source={require('@/assets/images/order-success-footer.png')}
                    style={styles.footerImage}
                    contentFit="cover"
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    closeButton: {
        position: 'absolute',
        top: 48,
        left: 16,
        zIndex: 10,
        padding: 4,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    iconWrap: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    footer: {
        width: '100%',
        alignSelf: 'center',
        minHeight: 140,
    },
    footerImage: {
        width: '100%',
        height: 190,
    },
});
