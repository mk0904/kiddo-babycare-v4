import { Fonts } from '@/constants/theme';
import { appConfigService } from '@/services/appConfigService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ICON_SIZE = 160;
const ITEM_WIDTH = 150;
const GAP = 48;
const AUTO_NAVIGATE_DELAY_MS = 7000;

const MILESTONES = [
    {
        id: 1,
        title: "Milestone 1",
        subtitle: "Min. Cart Value",
        color: "#FF0099",
        titleColor: "#FF37B9",
        subtitleColor: "#FF37B980",
        glowColor: "#FF37B925", // Increased alpha slightly for horizontal fade
        activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/firstCompletedIcon.png?v=1776527697",
        inactiveIcon: "https://img.icons8.com/fluency-systems-regular/96/shopping-cart.png",
    },
    {
        id: 2,
        title: "Milestone 2",
        subtitle: "Free Shoes",
        color: "#F8DB60",
        titleColor: "#E0C12B",
        subtitleColor: "#E0C12BB2",
        glowColor: "#F8DB6030",
        activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/secondCompletedIcon.png?v=1776527697",
        inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/secondInActiveIcon.png?v=1776446446",
    },
    {
        id: 3,
        title: "Milestone 3",
        subtitle: "Free Puzzle",
        color: "#72CC7E",
        titleColor: "#4DC012",
        subtitleColor: "#4DC012B2",
        glowColor: "#72CC7E30",
        activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/thirdCompletedIcon.png?v=1776527697",
        inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/thirdInActiveIcon.png?v=1776446446",
    },
    {
        id: 4,
        title: "Milestone 4",
        subtitle: "Mystery Gift",
        color: "#ED6666",
        titleColor: "#FF2728",
        subtitleColor: "#FF272880",
        glowColor: "#ED666625",
        activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/fourthCompletedIcon.png?v=1776527697",
        inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/fourthInActiveIcon.png?v=1776446446",
    },
];

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
    const trackAnim = useRef(new Animated.Value((SCREEN_WIDTH / 2) - (ITEM_WIDTH / 2))).current;

    const [activeIndex, setActiveIndex] = useState(0);
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

        const runSequence = (index: number) => {
            if (index >= MILESTONES.length) return;
            const targetPos = (SCREEN_WIDTH / 2) - (index * (ITEM_WIDTH + GAP)) - (ITEM_WIDTH / 2);

            Animated.timing(trackAnim, {
                toValue: targetPos,
                duration: 800,
                useNativeDriver: true,
            }).start(() => {
                setActiveIndex(index);
                setTimeout(() => {
                    if (index + 1 < MILESTONES.length) runSequence(index + 1);
                }, 1000);
            });
        };

        setTimeout(() => runSequence(0), 800);

    }, []);

    const currentMilestone = MILESTONES[activeIndex];

    // Warm the event-order hero cache while this screen is visible so order summary paints faster.
    useEffect(() => {
        const d = appConfigService.getOrderDetailConfig();
        const ext = d as { eventOrderUrl?: string; eventOrderurl?: string } | null;
        const u = (ext?.eventOrderUrl ?? ext?.eventOrderurl)?.trim();
        if (u) void Image.prefetch(u);
    }, []);

    // After a short beat, navigate to order summary (or orders list if no id)
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
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="dark" />

            <TouchableOpacity style={styles.closeButton} onPress={() => router.replace('/')}>
                <Ionicons name="close" size={28} color="#1A1A1A" />
            </TouchableOpacity>

            <View style={styles.topSection}>
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <Image source={require('@/assets/images/order-success.png')} style={styles.heroIcon} contentFit="contain" />
                </Animated.View>
                <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>Order placed</Animated.Text>
            </View>


            <View style={styles.bottomSection}>

                <View style={styles.glowWrapper}>
                    <LinearGradient
                        colors={[
                            '#FFFFFF',
                            'rgba(255, 255, 255, 0)',
                            currentMilestone.glowColor,
                            'rgba(255, 255, 255, 0)',
                            '#FFFFFF'
                        ]}
                        start={{ x: 1, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        // 0.15 and 0.85 act as the 'walls' where the color must be gone
                        // 0.5 is your focused center peak
                        locations={[0, 0.05, 0.5, 0.95, 0.5]}
                        style={[styles.topGlowConatiner]}
                    />
                </View>
                <View style={styles.fullWidthGlowContainer}>

                    <LinearGradient
                        // We use pure white at the edges to blend into the container background
                        // We use a transparent version of white between the edges and center to smooth the fade
                        colors={[
                            '#FFFFFF',
                            'rgba(255, 255, 255, 0)',
                            currentMilestone.glowColor,
                            'rgba(255, 255, 255, 0)',
                            '#FFFFFF'
                        ]}
                        start={{ x: 1, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        // 0.15 and 0.85 act as the 'walls' where the color must be gone
                        // 0.5 is your focused center peak
                        locations={[0, 0.05, 0.5, 0.95, 0.5]}
                        style={styles.fullWidthGlow}
                    />

                </View>
                <View style={styles.carouselContainer}>
                    <Animated.View
                        style={[
                            styles.track,
                            { transform: [{ translateX: trackAnim }] }
                        ]}
                    >
                        {MILESTONES.map((m, index) => {
                            const isFocus = index === activeIndex;
                            const isPassedOrFocus = index <= activeIndex;

                            return (
                                <View key={m.id} style={styles.item}>
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            isFocus && styles.activeScale,
                                            { backgroundColor: '#FFFFFF40' }
                                        ]}
                                    >
                                        <Image
                                            source={{
                                                uri: isPassedOrFocus ? m.activeIcon : m.inactiveIcon
                                            }}
                                            style={styles.mIcon}
                                            contentFit="contain"
                                        />
                                    </View>

                                    <Text
                                        style={[
                                            styles.mTitle,
                                            { color: isPassedOrFocus ? m.titleColor : '#999' }
                                        ]}
                                    >
                                        {m.title}
                                    </Text>

                                    <Text
                                        style={[
                                            styles.mSub,
                                            { color: isPassedOrFocus ? m.subtitleColor : '#BBB' }
                                        ]}
                                    >
                                        {m.subtitle}
                                    </Text>
                                </View>
                            );
                        })}
                    </Animated.View>
                </View>
            </View>

            <View style={styles.footerBackground}>
                <Image source={require('@/assets/images/order-success-footer.png')} style={styles.footerImage} contentFit="cover" />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    closeButton: { position: 'absolute', top: 48, left: 16, zIndex: 10, padding: 4 },
    topSection: { flex: 1.2, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
    bottomSection: { flex: 1, width: '100%', justifyContent: 'center' },



    fullWidthGlowContainer: {
        position: 'absolute',
        top: -80,
        left: -SCREEN_WIDTH * 0.8,
        right: -SCREEN_WIDTH * 0.8,
        height: 550,
        zIndex: 1,
        borderTopLeftRadius: SCREEN_WIDTH * 2, // Shallow curve
        borderTopRightRadius: SCREEN_WIDTH * 2,
        overflow: 'hidden',
        borderTopWidth: 0,
        backgroundColor: '#FFFFFF', // Base color is white
    },

    // SHALLOW CURVE & HORIZONTAL GLOW
    glowWrapper: {
        marginHorizontal: 0,   // 👈 controls width (increase = narrower)
    },

    fullWidthGlow: {
        width: '100%',
        height: '100%',
        paddingTop: 50,
    },

    topGlowConatiner: {
        position: 'absolute',
        top: -120,
        left: 0,
        right: 0,
        height: 120,
        zIndex: 1,
        borderTopLeftRadius: SCREEN_WIDTH * 32, // Shallow curve
        borderTopRightRadius: SCREEN_WIDTH * 32,
        overflow: 'hidden',
        borderTopWidth: 0,
        marginHorizontal: 20,
    },

    title: { fontSize: 24, fontFamily: Fonts.LexendBold, color: '#1A1A1A', marginTop: 15 },
    heroIcon: { width: ICON_SIZE, height: ICON_SIZE },

    carouselContainer: { height: 300, zIndex: 5, marginBottom: 40 },
    track: { flexDirection: 'row', alignItems: 'flex-end', gap: GAP },
    item: { width: ITEM_WIDTH, alignItems: 'center', position: 'relative' },


    iconContainer: {
        width: 56,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        zIndex: 6,
        borderRadius: 35,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        backgroundColor: '#FFFFFF1A', // Light semi-transparent white for inside shadow feel
    },
    activeScale: { transform: [{ scale: 1.25 }] },
    mIcon: { width: 36, height: 36 },
    mTitle: { fontSize: 14, fontFamily: Fonts.LexendBold },
    mSub: { fontSize: 11, fontFamily: Fonts.LexendMedium },
    footerBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 190, zIndex: 1 },
    footerImage: { width: '100%', height: '100%' }
});
