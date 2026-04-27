import {
    areAllMilestoneSlotsCompleted,
    buildMilestoneUIModel,
    milestoneCurrentStepFromConfig,
} from '@/components/home/milestoneUIFromConfig';
import { getAppVersionForApi } from '@/constants/versionConfig';
import { Fonts } from '@/constants/theme';
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
const ITEM_WIDTH = 150;
const GAP = 48;
/** Auto-advance: order summary — longer when the milestone track / Kiddo Club is shown, shorter for “order placed” only. */
const AUTO_NAVIGATE_WITH_MILESTONE_MS = 7000;
const AUTO_NAVIGATE_NO_MILESTONE_MS = 4000;

/**
 * Set when the Kiddo Club / milestone experience has been shown once on order success (carousel finish,
 * or the static all-completed state). Read on mount; when true, skip the entire milestone area next time.
 */
const ORDER_SUCCESS_CLUB_CELEBRATION_SEEN_KEY = 'kiddo_order_success_full_milestone_celebration_shown_v1';

const MILESTONES = [
    {
        id: 1,
        title: "Milestone 1",
        subtitle: "25% off 💸 on cart value",
        color: "#3AA0EB",
        titleColor: "#3AA0EB",
        subtitleColor: "#3AA0EB",
        glowColor: "#3AA0EB", // Increased alpha slightly for horizontal fade
        activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/firstAcOrder.png?v=1777210267",
        inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/firstAcOrder.png?v=1777210267",
    },
    {
        id: 2,
        title: "Milestone 2",
        subtitle: "Free Shoes",
        color: "#E0C12B",
        titleColor: "#E0C12B",
        subtitleColor: "#E0C12B",
        glowColor: "#E0C12B",
        activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/secAcOrder.png?v=1777210266",
        inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/secAcOrder.png?v=1777210266",
    },
    {
        id: 3,
        title: "Milestone 3",
        subtitle: "Free Puzzle",
        color: "#F15E5E",
        titleColor: "#F15E5E",
        subtitleColor: "#F15E5E",
        glowColor: "#F15E5E",
        activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/thirdAcOrder.png?v=1777210267",
        inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/thirdDefault.png?v=1777210267",
    },
    {
        id: 4,
        title: "Milestone 4",
        subtitle: "Mystery Gift",
        color: "#BD35D5",
        titleColor: "#BD35D5",
        subtitleColor: "#BD35D5",
        glowColor: "#BD35D5",
        activeIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/fourthAcOrder.png?v=1777210267",
        inactiveIcon: "https://cdn.shopify.com/s/files/1/0961/2787/7409/files/fourthDefault.png?v=1777210267",
    },
];

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
    }>();
    const { orderId, orderGraphId, estimatedDeliveryMinutes, destinationLat, destinationLng, total: orderTotalParam, milestoneStep: milestoneStepParam } = params;
    const orderTotalStr = Array.isArray(orderTotalParam) ? orderTotalParam[0] : orderTotalParam;

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
        const totalNum = Number.parseFloat(String(orderTotalStr ?? ''));
        const payload = {
            phone: user?.phone ?? undefined,
            customerId: user?.customerId ?? user?.id ?? undefined,
            appVersion: getAppVersionForApi(),
            deviceType: Platform.OS,
            cartSubtotal: Number.isFinite(totalNum) && totalNum > 0 ? totalNum : undefined,
        };
        void appConfigService.loadAppConfig(true, payload).catch(() => {
            // Keep rendering with cached config if refresh fails.
        });
    }, [user?.phone, user?.customerId, user?.id, orderTotalStr]);

    const { maxTargetIndex, showClubAfter, allMilestonesComplete } = useMemo(() => {
        let maxIdx = -1;
        let clubAfter = false;
        let allDone = false;

        /**
         * Primary source: pre-order completed count (no network race condition).
         * If all 4 milestones were already done before this order, skip the block
         * entirely so we do not re-show the Kiddo Club for repeat customers.
         */
        if (preOrderCompletedCount === MILESTONES.length) {
            return { maxTargetIndex: -1, showClubAfter: false, allMilestonesComplete: true };
        }

        if (preOrderCompletedCount >= 0) {
            /**
             * This order completes slot[preOrderCompletedCount].
             * The carousel sweeps from M1 all the way to the newly-unlocked milestone:
             *   maxIdx = min(preOrderCompletedCount + 1, last index)
             * When completing the very last milestone the sweep ends at M4 and the
             * Kiddo Club block replaces the carousel.
             */
            maxIdx = Math.min(preOrderCompletedCount + 1, MILESTONES.length - 1);
            clubAfter = preOrderCompletedCount === MILESTONES.length - 1;
            allDone = clubAfter;
        }

        /**
         * Secondary source: fresh config from loadAppConfig(true).
         * Always take whichever source shows MORE progress (stale data will be lower).
         * This also handles preOrderCompletedCount === -1 (no cached config).
         */
        const milestoneUI = appConfigService.getMilestoneUI();
        if (milestoneUI != null) {
            const freshAllDone = areAllMilestoneSlotsCompleted(milestoneUI);
            const configuredStep = milestoneCurrentStepFromConfig(milestoneUI, 0);
            const model = buildMilestoneUIModel(milestoneUI);
            const freshCompletedCount = (() => {
                const slots = model?.slots ?? [];
                let count = 0;
                for (const slot of slots) {
                    const v = (slot as { isCompleted?: unknown })?.isCompleted;
                    const done =
                        v === true ||
                        v === 1 ||
                        (typeof v === 'string' && v.trim().toLowerCase() === 'true');
                    if (!done) break;
                    count++;
                }
                return count;
            })();
            const freshStep = Math.min(
                MILESTONES.length - 1,
                Math.max(configuredStep, freshCompletedCount)
            );
            if (freshStep > maxIdx) maxIdx = freshStep;
            if (freshAllDone) {
                allDone = true;
                if (maxIdx === MILESTONES.length - 1) clubAfter = true;
            }
        }

        return { maxTargetIndex: maxIdx, showClubAfter: clubAfter, allMilestonesComplete: allDone };
    }, [appConfigSeq, preOrderCompletedCount]);

    const visibleMilestones = useMemo(() => {
        if (maxTargetIndex < 0) return [];
        return MILESTONES.slice(0, Math.min(MILESTONES.length, maxTargetIndex + 1));
    }, [maxTargetIndex]);

    // Even if the "already seen" flag is true, show celebration on the actual completion order.
    const shouldSkipMilestoneExperience =
        skipMilestoneExperience === true && !showClubAfter;

    useEffect(() => {
        let cancelled = false;
        AsyncStorage.getItem(ORDER_SUCCESS_CLUB_CELEBRATION_SEEN_KEY).then((v) => {
            if (!cancelled) {
                setSkipMilestoneExperience(v === 'true');
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);

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
    }, [scaleAnim, fadeAnim]);

    useEffect(() => {
        if (skipMilestoneExperience == null || shouldSkipMilestoneExperience) {
            return;
        }
        if (maxTargetIndex < 0) {
            return;
        }
        trackAnim.setValue((SCREEN_WIDTH / 2) - (ITEM_WIDTH / 2));
        setActiveIndex(0);
        setMilestoneShowAll(false);

        const runSequence = (index: number) => {
            if (index > maxTargetIndex || index >= MILESTONES.length) return;
            const targetPos = (SCREEN_WIDTH / 2) - (index * (ITEM_WIDTH + GAP)) - (ITEM_WIDTH / 2);

            Animated.timing(trackAnim, {
                toValue: targetPos,
                duration: 400,
                useNativeDriver: true,
            }).start(() => {
                setActiveIndex(index);
                setTimeout(() => {
                    if (index < maxTargetIndex) {
                        runSequence(index + 1);
                    } else if (showClubAfter) {
                        setMilestoneShowAll(true);
                        void AsyncStorage.setItem(ORDER_SUCCESS_CLUB_CELEBRATION_SEEN_KEY, 'true');
                    }
                }, 1000);
            });
        };

        const startDelay = setTimeout(() => runSequence(0), 400);
        return () => clearTimeout(startDelay);
    }, [skipMilestoneExperience, shouldSkipMilestoneExperience, allMilestonesComplete, maxTargetIndex, showClubAfter, trackAnim]);

    const currentMilestone = visibleMilestones[Math.min(activeIndex, visibleMilestones.length - 1)] ?? MILESTONES[0];
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
                                    {MILESTONES.map((m) => (
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
                                                style={[
                                                    styles.mTitle,
                                                    { color: isPassedOrFocus ? m.titleColor : '#999' },
                                                ]}
                                            >
                                                {m.title}
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
    mSub: { fontSize: 11, fontFamily: Fonts.LexendMedium },
    footerBackground: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 190, zIndex: 1 },
    footerImage: { width: '100%', height: '100%' }
});
