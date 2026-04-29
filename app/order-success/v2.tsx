import {
    buildMilestoneUIModel
} from '@/components/home/milestoneUIFromConfig';
import { Fonts } from '@/constants/theme';
import { getAppVersionForApi } from '@/constants/versionConfig';
import { appConfigService } from '@/services/appConfigService';
import { useUserStore } from '@/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ICON_SIZE = 160;
const ITEM_WIDTH = 180;
const GAP = 48;
/** Auto-advance: order summary — longer when the milestone track / Kiddo Club is shown, shorter for “order placed” only. */
const AUTO_NAVIGATE_WITH_MILESTONE_MS = 7000;
const AUTO_NAVIGATE_NO_MILESTONE_MS = 4000;

/**
 * Set when the Kiddo Club / milestone experience has been shown once on order success (carousel finish,
 * or the static all-completed state). Read on mount; when true, skip the entire milestone area next time.
 */
const ORDER_SUCCESS_CLUB_CELEBRATION_SEEN_KEY = 'milestone_all_done_home_strip_seen_v1';
const MILESTONE_MODAL_HEIGHT = 580;
const MILESTONE_MODAL_WIDTH = SCREEN_WIDTH * 0.94;

function getDynamicMilestones() {
    const ui = appConfigService.getMilestoneUI();
    const model = buildMilestoneUIModel(ui);
    if (!model || model.slots.length === 0) {
        return [
            {
                id: 1,
                title: "1st Order Reward",
                subtitle: "25% off 💸 on cart value",
                color: "#3AA0EB",
                titleColor: "#3AA0EB",
                subtitleColor: "#3AA0EB",
                glowColor: "#3AA0EB",
                activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/1_df699638-d165-4010-af14-7e0b37e1bd31.png?v=1777355515",
                inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/1_df699638-d165-4010-af14-7e0b37e1bd31.png?v=1777355515",
            },
            {
                id: 2,
                title: "2nd Order Reward",
                subtitle: "Free Puzzle",
                color: "#E0C12B",
                titleColor: "#E0C12B",
                subtitleColor: "#E0C12B",
                glowColor: "#E0C12B",
                activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/2_74084028-3e19-48b9-8bbc-b0d638968297.png?v=1777355516",
                inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/4_1_748e4b36-8c36-4122-a10d-ae24879e331b.png?v=1777356943",
            },
            {
                id: 3,
                title: "3rd Order Reward",
                subtitle: "Free Shoes",
                color: "#F15E5E",
                titleColor: "#F15E5E",
                subtitleColor: "#F15E5E",
                glowColor: "#F15E5E",
                activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/3_85c61a4e-b141-4f10-94e6-40b242eb0e11.png?v=1777355516",
                inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/6_333b5bf4-7fb8-486a-9882-355b90efc476.png?v=1777356943",
            },
            {
                id: 4,
                title: "4th Order Reward",
                subtitle: "Mystery Gift",
                color: "#BD35D5",
                titleColor: "#BD35D5",
                subtitleColor: "#BD35D5",
                glowColor: "#BD35D5",
                activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/4_88257d92-9310-4586-a55d-0bf758d655a9.png?v=1777355515",
                inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/8_fc14050c-23b9-4187-9dd9-fec6e30b52e9.png?v=1777356943",
            },
        ];
    }

    return model.slots.map((slot, idx) => ({
        id: idx + 1,
        title: slot.orderNumber || `${idx + 1}${idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'} Order Reward`,
        subtitle: slot.subtitle,
        color: slot.titleColorActive || '#3AA0EB',
        titleColor: slot.titleColorActive || '#3AA0EB',
        subtitleColor: slot.titleColorActive || '#3AA0EB',
        glowColor: slot.titleColorActive || '#3AA0EB',
        activeIcon: slot.activeIconUrl,
        inactiveIcon: slot.inactiveIconUrl,
    }));
}

function glowColorFaded(glowColor: string, alpha = 0.22): string {
    const s = (glowColor || '').replace('#', '').trim();
    if (s.length !== 6) return 'rgba(0, 0, 0, 0.12)';
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    if (![r, g, b].every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
        return 'rgba(0, 0, 0, 0.12)';
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function OrderSuccessV2Screen() {
    const router = useRouter();
    const user = useUserStore((state) => state.user);
    const params = useLocalSearchParams<{
        orderId?: string;
        orderGraphId?: string;
        estimatedDeliveryMinutes?: string;
        destinationLat?: string;
        destinationLng?: string;
        /** Order total from checkout — compared to active milestone `minCartValue`. */
        total?: string;
        /** Pre-order milestone step snapshot from cart (0-3). Used to compute animation target. */
        milestoneStep?: string;
        /** Cart subtotal (pre-discount) — compared to active milestone `minCartValue`. */
        subtotal?: string;
        /** The discount code applied to this order (if any). */
        appliedCouponCode?: string;
    }>();
    const {
        orderId,
        orderGraphId,
        estimatedDeliveryMinutes,
        destinationLat,
        destinationLng,
        total: orderTotalParam,
        milestoneStep: milestoneStepParam,
        subtotal: subtotalParam,
        appliedCouponCode
    } = params;
    const orderTotalStr = Array.isArray(orderTotalParam) ? orderTotalParam[0] : orderTotalParam;
    const subtotalStr = Array.isArray(subtotalParam) ? subtotalParam[0] : subtotalParam;

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const trackAnim = useRef(new Animated.Value((SCREEN_WIDTH / 2) - (ITEM_WIDTH / 2))).current;

    const [activeIndex, setActiveIndex] = useState(0);
    const [milestoneShowAll, setMilestoneShowAll] = useState(false);
    /** `null` until AsyncStorage is read; `true` = club already shown once → no milestone block. */
    const [skipMilestoneExperience, setSkipMilestoneExperience] = useState<boolean | null>(null);
    /** Bumps when `appConfigService` finishes a load so milestone caps recompute. */
    const [appConfigSeq, setAppConfigSeq] = useState(0);

    useEffect(() => appConfigService.subscribe(() => setAppConfigSeq((n) => n + 1)), []);

    /**
     * Number of consecutive completed milestones from the CACHED config at mount time (before the
     * forced refresh fires). This is the pre-order state, immune to backend timing races.
     *
     *   0  = no milestones done yet; this order completes M1, animate up to M2 (index 1)
     *   1  = M1 done; this order completes M2, animate up to M3 (index 2)
     *   2  = M1+M2 done; this order completes M3, animate up to M4 (index 3)
     *   3  = M1-M3 done; this order completes M4, animate all + show Kiddo Club
     *   4  = all already done before this order (repeat customer), no new milestone block
     *  -1  = config not in cache yet, fall through to fresh-config path
     *
     * useState lazy initializer runs exactly once on first render, before any effects.
     */
    const [preOrderCompletedCount] = useState<number>(() => {
        // Prefer the snapshot passed from cart — it is captured before any async ops.
        const fromParam = Number.parseInt(String(milestoneStepParam ?? ''), 10);
        if (Number.isFinite(fromParam) && fromParam >= 0) return fromParam;
        // Fallback: read from cached config (works when navigating to this screen by other means).
        const ui = appConfigService.getMilestoneUI();
        if (ui == null) return -1;
        const keys = ['milestoneFirst', 'milestoneSecond', 'milestoneThird', 'milestoneFourth'] as const;
        let count = 0;
        for (const key of keys) {
            const v = (ui[key] as { isCompleted?: unknown } | undefined)?.isCompleted;
            const done =
                v === true ||
                v === 1 ||
                (typeof v === 'string' && v.trim().toLowerCase() === 'true');
            if (!done) break;
            count++;
        }
        return count;
    });

    // Force fresh app-config on order-success so milestone completion reflects the just-placed order.
    useEffect(() => {
        const payload = {
            phone: user?.phone ?? undefined,
            customerId: user?.customerId ?? user?.id ?? undefined,
            appVersion: getAppVersionForApi(),
            deviceType: Platform.OS,
            appliedCoupon: appliedCouponCode || undefined,
        };
        void appConfigService.loadAppConfig(true, payload).catch(() => {
        });
    }, [user?.phone, user?.customerId, user?.id, appliedCouponCode]);

    const lastSequenceId = useRef(0);
    const milestones = useMemo(() => getDynamicMilestones(), [appConfigSeq]);
    const currentStepRef = useRef(preOrderCompletedCount >= 0 ? preOrderCompletedCount : 0);
    const milestoneState = useMemo(() => {
        let maxIdx = -1;
        let clubAfter = false;
        const totalMilestones = milestones.length;

        if (skipMilestoneExperience === true) {
            return { maxTargetIndex: -1, showClubAfter: false, allMilestonesComplete: true };
        }

        // 1. Determine progression from applied coupon
        const normalizedCoupon = (appliedCouponCode || '').trim().toUpperCase();
        const milestoneCoupons = ['FIRSTMILESTONE', 'SECONDMILESTONE', 'THIRDMILESTONE', 'FOURTHMILESTONE'];
        const completedByCouponIdx = milestoneCoupons.indexOf(normalizedCoupon);

        // 2. Determine progression from backend flags (refreshed config)
        const milestoneUI = appConfigService.getMilestoneUI();
        const freshCompletedCount = (() => {
            if (!milestoneUI) return preOrderCompletedCount;
            let count = 0;
            const keys = ['milestoneFirst', 'milestoneSecond', 'milestoneThird', 'milestoneFourth'] as const;
            for (const key of keys) {
                const slot = milestoneUI[key];
                if (slot?.isCompleted) count++;
                else break;
            }
            return count;
        })();

        // Use the furthest progression detected
        const targetCompletedCount = Math.max(
            preOrderCompletedCount,
            freshCompletedCount,
            completedByCouponIdx !== -1 ? completedByCouponIdx + 1 : 0
        );

        if (targetCompletedCount >= totalMilestones) {
            maxIdx = totalMilestones - 1;
            clubAfter = true;
        } else {
            maxIdx = targetCompletedCount;
            clubAfter = false;
        }

        // Terminal state: if everything was already done before this order
        if (preOrderCompletedCount >= totalMilestones) {
            return { maxTargetIndex: 3, showClubAfter: true, allMilestonesComplete: true };
        }

        return { maxTargetIndex: maxIdx, showClubAfter: clubAfter, allMilestonesComplete: clubAfter };
    }, [milestones, preOrderCompletedCount, appliedCouponCode, appConfigSeq, skipMilestoneExperience]);

    const { maxTargetIndex, showClubAfter, allMilestonesComplete } = milestoneState;

    const visibleMilestones = useMemo(() => {
        if (maxTargetIndex < 0) return [];
        return milestones.slice(0, Math.min(milestones.length, maxTargetIndex + 1));
    }, [maxTargetIndex, milestones]);

    const shouldSkipMilestoneExperience =
        skipMilestoneExperience === true && !showClubAfter;

    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(ORDER_SUCCESS_CLUB_CELEBRATION_SEEN_KEY).then((v) => {
            if (!cancelled) setSkipMilestoneExperience(v === 'true');
        });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.parallel([
            Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start();
    }, [scaleAnim, fadeAnim]);

    useEffect(() => {
        if (skipMilestoneExperience == null || shouldSkipMilestoneExperience || maxTargetIndex < 0) {
            return;
        }

        const seqId = ++lastSequenceId.current;

        const runSequence = (index: number) => {
            if (seqId !== lastSequenceId.current) return;
            if (index > maxTargetIndex || index >= milestones.length) return;

            const targetPos = (SCREEN_WIDTH / 2) - (index * (ITEM_WIDTH + GAP)) - (ITEM_WIDTH / 2);
            currentStepRef.current = index;

            if (__DEV__) console.log(`[OrderSuccess] Animating to index ${index}, pos ${targetPos}`);

            Animated.timing(trackAnim, {
                toValue: targetPos,
                duration: 400,
                useNativeDriver: true,
            }).start(() => {
                if (seqId !== lastSequenceId.current) return;
                setActiveIndex(index);
                setTimeout(() => {
                    if (seqId !== lastSequenceId.current) return;
                    if (index < maxTargetIndex) {
                        runSequence(index + 1);
                    } else if (showClubAfter) {
                        setMilestoneShowAll(true);
                        void AsyncStorage.setItem(ORDER_SUCCESS_CLUB_CELEBRATION_SEEN_KEY, 'true');
                    }
                }, 1000);
            });
        };

        // Always start the animation from the very first milestone (index 0)
        const startIdx = 0;
        const initialPos = (SCREEN_WIDTH / 2) - (startIdx * (ITEM_WIDTH + GAP)) - (ITEM_WIDTH / 2);
        trackAnim.setValue(initialPos);
        setActiveIndex(startIdx);
        currentStepRef.current = startIdx;

        const startDelay = setTimeout(() => runSequence(startIdx), 400);
        return () => {
            clearTimeout(startDelay);
            lastSequenceId.current++;
        };
    }, [skipMilestoneExperience, shouldSkipMilestoneExperience, allMilestonesComplete, maxTargetIndex, showClubAfter, trackAnim, milestones, preOrderCompletedCount]);

    const currentMilestone = visibleMilestones[Math.min(activeIndex, visibleMilestones.length - 1)] ?? milestones[0];
    /**
     * Require `milestoneUI` in app config (`maxTargetIndex >= 0`).
     * If all milestones are complete, keep showing this section only while the completion-order
     * sequence is running (`showClubAfter`) or once it lands on the club finale (`milestoneShowAll`).
     */
    const showMilestoneBlock =
        skipMilestoneExperience != null &&
        !shouldSkipMilestoneExperience &&
        maxTargetIndex >= 0 &&
        (!allMilestonesComplete || showClubAfter || milestoneShowAll);

    const autoNavigateDelayMs = useMemo(() => {
        if (skipMilestoneExperience == null) {
            // Until we know the celebration flag, assume the long window so the carousel is not cut off.
            return AUTO_NAVIGATE_WITH_MILESTONE_MS;
        }
        return showMilestoneBlock ? AUTO_NAVIGATE_WITH_MILESTONE_MS : AUTO_NAVIGATE_NO_MILESTONE_MS;
    }, [skipMilestoneExperience, showMilestoneBlock]);

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
        }, autoNavigateDelayMs);
        return () => clearTimeout(t);
    }, [
        orderGraphId,
        orderId,
        router,
        estimatedDeliveryMinutes,
        destinationLat,
        destinationLng,
        autoNavigateDelayMs,
    ]);

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


            {showMilestoneBlock ? (
                <View style={styles.bottomSection}>
                    <View style={styles.fullWidthGlowContainer}>
                        <LinearGradient
                            colors={[
                                '#FFFFFF',
                                'rgba(255, 255, 255, 0)',
                                glowColorFaded(currentMilestone.glowColor),
                                'rgba(255, 255, 255, 0)',
                                '#FFFFFF',
                            ]}
                            start={{ x: 1, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            locations={[0, 0.05, 0.5, 0.95, 0.5]}
                            style={styles.fullWidthGlow}
                        />
                    </View>
                    <View style={styles.carouselContainer}>
                        {milestoneShowAll ? (
                            <View style={styles.clubMilestoneBlock}>
                                <Text style={styles.clubKicker}>Congratulations!</Text>
                                <Text style={styles.clubTitle}>
                                    {'Welcome to the\nKiddo Club!'}
                                </Text>
                                <View style={styles.milestoneAllRow}>
                                    {milestones.map((m) => (
                                        <View key={m.id} style={styles.milestoneAllItem}>
                                            <Image
                                                source={{ uri: m.activeIcon }}
                                                style={styles.mIconAll}
                                                contentFit="contain"
                                            />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : (
                            <Animated.View
                                style={[
                                    styles.track,
                                    { transform: [{ translateX: trackAnim }] },
                                ]}
                            >
                                {visibleMilestones.map((m, index) => {
                                    const isPassedOrFocus = index <= activeIndex;
                                    return (
                                        <View key={m.id} style={styles.item}>
                                            <Image
                                                source={{
                                                    uri: isPassedOrFocus ? m.activeIcon : m.inactiveIcon,
                                                }}
                                                style={styles.mIcon}
                                                contentFit="contain"
                                            />
                                            <Text
                                                numberOfLines={2}
                                                style={[
                                                    styles.mTitle,
                                                    {
                                                        color: isPassedOrFocus ? m.titleColor : '#999',
                                                        textAlign: 'center'
                                                    },
                                                ]}
                                            >
                                                {m.title}
                                                {index === visibleMilestones.length - 1 ? (
                                                    <Text style={{ fontSize: 16 }}>{'\n'}Unlocked</Text>
                                                ) : null}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.mSub,
                                                    { color: isPassedOrFocus ? m.subtitleColor : '#BBB' },
                                                ]}
                                            >
                                                {m.subtitle}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </Animated.View>
                        )}
                    </View>
                </View>
            ) : (
                <View style={styles.bottomSectionSpacer} />
            )}

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
    /** When the full club celebration already ran once — keeps layout without milestone UI. */
    bottomSectionSpacer: { flex: 1, width: '100%' },



    fullWidthGlowContainer: {
        position: 'absolute',
        top: -80,
        left: -SCREEN_WIDTH * 0.7,
        right: -SCREEN_WIDTH * 0.7,
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

    carouselContainer: {
        minHeight: 300,
        zIndex: 5,
        marginBottom: 40,
        width: '100%',
        overflow: 'hidden',
    },
    track: { flexDirection: 'row', alignItems: 'flex-end', gap: GAP },
    item: { width: ITEM_WIDTH, alignItems: 'center', position: 'relative' },
    /** After the carousel run finishes: static row of all active milestone art + club copy. */
    clubMilestoneBlock: {
        width: '100%',
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clubKicker: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#00000066',
        marginBottom: 8,
        textAlign: 'center',
    },
    clubTitle: {
        fontSize: 24,
        lineHeight: 32,
        fontFamily: Fonts.LexendBold,
        color: '#F15E5E',
        textAlign: 'center',
        marginBottom: 20,
    },
    milestoneAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 340,
        paddingHorizontal: 4,
    },
    milestoneAllItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
    },
    mIconAll: { width: 56, height: 56 },
    mIcon: { width: 56, height: 56, marginBottom: 8 },
    mTitle: { fontSize: 14, fontFamily: Fonts.LexendBold },
    mSub: { fontSize: 11, fontFamily: Fonts.LexendMedium, textAlign: 'center' },
    footerBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 190, zIndex: 1 },
    footerImage: { width: '100%', height: '100%' }
});
