import { Fonts } from '@/constants/theme';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { configService } from '@/services/configService';
import { useCartSubtotal } from '@/store/cartStore';
import type { MilestoneUIConfig } from '@/types/appConfig';
import { getHomeMilestoneRowLayout, MILESTONE_CART_ROW_PILL_HEIGHT } from '@/utils/homeMilestoneRowLayout';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    AppState,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    CollapsedMilestoneIconProgressRing,
    MILESTONE_EXPANDED_LIST_IMAGE,
    MILESTONE_EXPANDED_LIST_OUTER,
    MilestoneExpandedFormContent,
} from './milestoneExpandedFormContent';
import {
    areAllMilestoneSlotsCompleted,
    buildMilestoneUIModel,
    milestoneCurrentStepFromConfig,
    milestoneExpandedSubtitleFromConfig,
    milestoneExpandedTitleFromConfig,
    type ResolvedMilestoneSlot,
} from './milestoneUIFromConfig';

const MILESTONE_TRACKER_DISMISSED_KEY = 'milestone_tracker_dismissed_all_done_v1';
/** Set when the “all milestones achieved” strip was left after all were complete (app backgrounded). Next launch: hide the pill. */
const MILESTONE_ALL_DONE_STRIP_SEEN_KEY = 'milestone_all_done_home_strip_seen_v1';
const ALL_DONE_RING_DEFAULTS = ['#E879F9', '#EAAA08', '#12B76A', '#F04438'] as const;
/** All done: show milestone icons only when the tracker is at least this fraction of the window width. */
const ALL_DONE_ICONS_MIN_WIDTH_FRACTION = 0.8;

/** Home: shift expanded modal card slightly **down** (less bottom padding from layout anchor). */
const HOME_MILESTONE_MODAL_NUDGE_DOWN = 55;
/**
 * Cart (`embedded`): extra **up** nudge from vertical center (negative = up). Base in `modalCenterWrap` is -36;
 * this sum is the full offset.
 */
const CART_MILESTONE_MODAL_TRANSLATE_Y = -90;

/** `dock`: above tab bar (rounded top). `embedded`: cart under savings (square top, rounded bottom into scroll). */
export type MilestoneTrackerVariant = 'dock' | 'embedded';

/** How far the sheet slides in from the collapsed strip: home = up from below; cart = down from the pill row. */
const MILESTONE_MODAL_IN_MS = 205;
const MILESTONE_MODAL_OUT_MS = 175;
const DOCK_MODAL_SLIDE_PX = 32;
const EMBEDDED_MODAL_SLIDE_PX = 26;

export interface MilestoneTrackerProps {
    /** Backend `milestoneUI` from GET /api/v1/app/config. When null/omitted, the strip is not rendered. */
    milestoneUI?: MilestoneUIConfig | null;
    /** When `milestoneUI.currentStepIndex` is unset, progress is inferred from each slot’s `isCompleted`. */
    currentStepIndex?: number;
    onExpandedChange?: (expanded: boolean) => void;
    /** `embedded` = bottom corners rounded for cart. Default `dock` = home strip with rounded top. */
    variant?: MilestoneTrackerVariant;
    /**
     * When set (Home `MilestoneCartRow` beside cart), remove extra bottom spacing and keep pill height
     * in sync with `FloatingCartCta` for one visual row.
     */
    inlineInCartRow?: boolean;
    /**
     * When the strip is not actually rendered (loading, dismissed “all done”, or no data), this is
     * `false` so the Home row can center the cart CTA instead of 70% empty + 30% cart.
     */
    onStripPresenceChange?: (visible: boolean) => void;
}

/** Collapsed rail: same 44/32 as expanded `MilestoneExpandedFormContent` list. */

function formatINR(amount: number): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            maximumFractionDigits: 0,
        }).format(Math.max(0, Math.ceil(amount)));
    } catch {
        return String(Math.max(0, Math.ceil(amount)));
    }
}

function milestoneIconUri(slot: ResolvedMilestoneSlot, index: number, currentStepIndex: number): string {
    const completed = index < currentStepIndex;
    const current = index === currentStepIndex;
    if (completed || current) return slot.activeIconUrl || slot.inactiveIconUrl;
    return slot.inactiveIconUrl || slot.activeIconUrl;
}

export function MilestoneTracker({
    milestoneUI = null,
    currentStepIndex: currentStepProp = 0,
    onExpandedChange,
    variant = 'dock',
    inlineInCartRow = false,
    onStripPresenceChange,
}: MilestoneTrackerProps) {
    const [expanded, setExpanded] = useState(false);
    const [hideAfterAllDoneDismiss, setHideAfterAllDoneDismiss] = useState<boolean | null>(null);
    const onExpandedChangeRef = useRef(onExpandedChange);
    onExpandedChangeRef.current = onExpandedChange;
    const insets = useSafeAreaInsets();
    const { isVisible: isTabBarVisible } = useTabBarVisibility();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const [allDoneTrackerLayoutW, setAllDoneTrackerLayoutW] = useState(0);
    const allDoneMilestoneIconsMinW = windowWidth * ALL_DONE_ICONS_MIN_WIDTH_FRACTION;
    const showAllDoneMilestoneIcons =
        allDoneTrackerLayoutW === 0 || allDoneTrackerLayoutW >= allDoneMilestoneIconsMinW;
    /** Match Home `milestoneDock` + `index` so the sheet does not sit over the tab when it is shown. */
    const tabBarStackBottom = useMemo(() => {
        const tabBarHeight = configService.getTabBarConfig()?.styles?.height ?? 60;
        return Math.max(insets.bottom, 0) + tabBarHeight;
    }, [insets.bottom]);
    /** Use subtotal (line items) for milestone thresholds — matches merchandising “min cart” rules better than order total. */
    const cartSubtotal = useCartSubtotal();

    const milestoneModel = useMemo(
        () => buildMilestoneUIModel(milestoneUI ?? undefined),
        [milestoneUI],
    );
    const slots = milestoneModel?.slots ?? [];
    const allMilestonesComplete = useMemo(
        () => areAllMilestoneSlotsCompleted(milestoneUI ?? null),
        [milestoneUI]
    );
    const dismissAllMilestonesComplete = useCallback(() => {
        setHideAfterAllDoneDismiss(true);
        void AsyncStorage.setItem(MILESTONE_TRACKER_DISMISSED_KEY, 'true').catch(() => {});
    }, []);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const [dismissed, seenAllDoneInPriorSession] = await Promise.all([
                    AsyncStorage.getItem(MILESTONE_TRACKER_DISMISSED_KEY),
                    AsyncStorage.getItem(MILESTONE_ALL_DONE_STRIP_SEEN_KEY),
                ]);
                if (cancelled) return;
                setHideAfterAllDoneDismiss(
                    dismissed === 'true' || seenAllDoneInPriorSession === 'true'
                );
            } catch {
                if (!cancelled) {
                    setHideAfterAllDoneDismiss(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    /** After all milestones are done, the first time the user leaves the app (or locks), don’t show the all-done pill on the next open. */
    useEffect(() => {
        const onAppState = (state: string) => {
            if (state !== 'background') {
                return;
            }
            if (hideAfterAllDoneDismiss !== false) {
                return;
            }
            if (!allMilestonesComplete) {
                return;
            }
            void AsyncStorage.setItem(MILESTONE_ALL_DONE_STRIP_SEEN_KEY, 'true');
        };
        const sub = AppState.addEventListener('change', onAppState);
        return () => sub.remove();
    }, [hideAfterAllDoneDismiss, allMilestonesComplete]);

    useLayoutEffect(() => {
        if (allMilestonesComplete) {
            setExpanded(false);
        }
    }, [allMilestonesComplete]);
    const expandedHeaderTitle = useMemo(
        () => milestoneExpandedTitleFromConfig(milestoneUI ?? undefined),
        [milestoneUI]
    );
    const expandedHeaderSubtitle = useMemo(
        () => milestoneExpandedSubtitleFromConfig(milestoneUI ?? undefined),
        [milestoneUI]
    );
    const safeCurrent = useMemo(() => {
        const fromCfg = milestoneCurrentStepFromConfig(milestoneUI ?? undefined, currentStepProp);
        const n = slots.length;
        return Math.min(Math.max(0, fromCfg), Math.max(0, n - 1));
    }, [milestoneUI, currentStepProp, slots.length]);

    const collapsedTitle = slots[safeCurrent]?.title ?? slots[0]?.title ?? '';
    const collapsedActiveSlot = slots[safeCurrent] ?? slots[0] ?? null;
    const accentColor =
        collapsedActiveSlot?.color ||
        collapsedActiveSlot?.titleColorActive ||
        '#FF5CC8';
    const collapsedActiveIconUri = collapsedActiveSlot
        ? milestoneIconUri(collapsedActiveSlot, safeCurrent, safeCurrent)
        : '';
    const collapsedCopy = useMemo(() => {
        if (!collapsedActiveSlot) {
            return {
                title: collapsedTitle,
                subtitle: '',
            };
        }
        const target = collapsedActiveSlot.minCartValue;
        const validTarget = typeof target === 'number' && Number.isFinite(target) ? target : null;
        if (validTarget == null || validTarget <= 0) {
            return {
                title: collapsedActiveSlot.unlockedTitle || collapsedActiveSlot.title || collapsedTitle,
                subtitle: collapsedActiveSlot.unlockedSubtitle || collapsedActiveSlot.subtitle || '',
            };
        }

        const remaining = validTarget - (Number(cartSubtotal) || 0);
        if (remaining <= 0) {
            return {
                title: collapsedActiveSlot.unlockedTitle || collapsedActiveSlot.title || collapsedTitle,
                subtitle: collapsedActiveSlot.unlockedSubtitle || collapsedActiveSlot.subtitle || '',
            };
        }

        return {
            title: `Spend \u20B9${formatINR(remaining)} for ${collapsedActiveSlot.title || collapsedTitle}`,
            subtitle: collapsedActiveSlot.subtitle || collapsedActiveSlot.orderNumber || '',
        };
    }, [collapsedActiveSlot, collapsedTitle, cartSubtotal]);

    const collapsedIconProgress01 = useMemo(() => {
        if (!collapsedActiveSlot) return 0;
        const minV = collapsedActiveSlot.minCartValue;
        if (typeof minV !== 'number' || !Number.isFinite(minV) || minV <= 0) return 1;
        const ct = Number(cartSubtotal) || 0;
        return Math.min(1, Math.max(0, ct / minV));
    }, [collapsedActiveSlot, cartSubtotal]);

    const slideFromStripPx = useMemo(
        () => (variant === 'embedded' ? -EMBEDDED_MODAL_SLIDE_PX : DOCK_MODAL_SLIDE_PX),
        [variant]
    );
    const translateY = useSharedValue(
        variant === 'embedded' ? -EMBEDDED_MODAL_SLIDE_PX : DOCK_MODAL_SLIDE_PX
    );
    const backdropOp = useSharedValue(0);

    const finishClose = useCallback(() => {
        setExpanded(false);
    }, []);

    const toggle = useCallback(() => {
        if (expanded) {
            translateY.value = withTiming(
                slideFromStripPx,
                { duration: MILESTONE_MODAL_OUT_MS, easing: Easing.bezier(0.4, 0, 1, 0.95) },
                (finished) => {
                    if (finished) {
                        runOnJS(finishClose)();
                    }
                }
            );
            backdropOp.value = withTiming(0, {
                duration: 135,
                easing: Easing.bezier(0.4, 0, 1, 0.95),
            });
        } else {
            setExpanded(true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values not deps
    }, [expanded, finishClose, slideFromStripPx]);

    useLayoutEffect(() => {
        if (!expanded) {
            return;
        }
        translateY.value = slideFromStripPx;
        backdropOp.value = 0;
        translateY.value = withTiming(0, {
            duration: MILESTONE_MODAL_IN_MS,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        backdropOp.value = withTiming(1, {
            duration: 160,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values not deps
    }, [expanded, slideFromStripPx]);

    const backdropAnimStyle = useAnimatedStyle(() => ({
        opacity: backdropOp.value,
    }));

    const cardAnimStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const hasMilestones = Boolean(milestoneModel && slots.length > 0);
    const stripPaints = hasMilestones && hideAfterAllDoneDismiss === false;
    useLayoutEffect(() => {
        onStripPresenceChange?.(stripPaints);
    }, [onStripPresenceChange, stripPaints]);
    useLayoutEffect(() => {
        return () => {
            onStripPresenceChange?.(false);
        };
    }, [onStripPresenceChange]);
    useLayoutEffect(() => {
        if (!hasMilestones) {
            onExpandedChangeRef.current?.(false);
            return;
        }
        onExpandedChangeRef.current?.(expanded);
    }, [expanded, hasMilestones]);

    if (hideAfterAllDoneDismiss === null) {
        return null;
    }
    if (hideAfterAllDoneDismiss) {
        return null;
    }
    if (!milestoneModel || slots.length === 0) {
        return null;
    }
    if (allMilestonesComplete) {
        return (
            <View
                style={styles.milestoneRoot}
                onLayout={(e) => {
                    setAllDoneTrackerLayoutW(e.nativeEvent.layout.width);
                }}
            >
                <View
                    style={[
                        styles.collapsedSurface,
                        variant === 'embedded' && styles.surfaceEmbeddedCollapsed,
                        inlineInCartRow && styles.collapsedSurfaceInCartRow,
                    ]}
                    accessibilityRole="summary"
                >
                    <View style={styles.embeddedCollapsedRow}>
                        <View
                            style={[
                                styles.collapsedPillPressable,
                                inlineInCartRow && styles.collapsedPillPressableInCartRow,
                            ]}
                        >
                            <BlurView
                                intensity={100}
                                tint="light"
                                style={[
                                    styles.pillBlurContainer,
                                    { borderColor: '#D5D7DA' },
                                    inlineInCartRow && styles.pillBlurContainerInCartRow,
                                ]}
                            >
                                <View style={styles.collapsedPillContent} pointerEvents="box-none">
                                    <View style={styles.allDoneTextCol}>
                                        <Text style={styles.allDoneKicker}>All milestones achieved</Text>
                                        <Text style={styles.collapsedTitleEmbedded}>Congratulations!</Text>
                                    </View>
                                    {showAllDoneMilestoneIcons ? (
                                        <View style={styles.allDoneIconsRow}>
                                            {slots.map((slot, i) => {
                                                const slotColor = slot.color && String(slot.color).trim();
                                                const ring =
                                                    slotColor ||
                                                    ALL_DONE_RING_DEFAULTS[i % ALL_DONE_RING_DEFAULTS.length];
                                                const uri = slot.activeIconUrl || slot.inactiveIconUrl;
                                                return (
                                                    <View key={`all-done-m-${i}`} style={styles.allDoneIconCell}>
                                                        <View
                                                            style={[styles.allDoneIconRing, { borderColor: ring }]}
                                                        >
                                                            {!!uri && (
                                                                <Image
                                                                    source={{ uri }}
                                                                    style={styles.allDoneIconImage}
                                                                    contentFit="contain"
                                                                />
                                                            )}
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ) : null}
                                    <Pressable
                                        onPress={dismissAllMilestonesComplete}
                                        style={({ pressed }) => [styles.allDoneClose, pressed && { opacity: 0.72 }]}
                                        hitSlop={12}
                                        accessibilityLabel="Dismiss; milestone tracker will stay hidden"
                                    >
                                        <Ionicons name="close" size={22} color="#7B7F86" />
                                    </Pressable>
                                </View>
                            </BlurView>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    /** Home strip: up / modal header down. Cart (`embedded`): reversed so the affordance matches placement. */
    const collapsedChevron: 'chevron-up' | 'chevron-down' =
        variant === 'embedded' ? 'chevron-down' : 'chevron-up';
    const expandedHeaderChevron: 'chevron-up' | 'chevron-down' =
        variant === 'embedded' ? 'chevron-up' : 'chevron-down';

    const surfaceCollapsed =
        variant === 'embedded'
            ? [styles.collapsedSurface, styles.surfaceEmbeddedCollapsed]
            : styles.collapsedSurface;

    const isDock = variant === 'dock';
    const homeMilestoneLayout = isDock ? getHomeMilestoneRowLayout(windowWidth) : null;
    const cardMaxWidth = isDock && homeMilestoneLayout
        ? Math.min(homeMilestoneLayout.innerWidth, 420)
        : Math.min(windowWidth - 40, 420);
    /** Home: `MILESTONE_CART_ROW_PILL_HEIGHT` (64) — bottom of modal sits level with the strip in `MilestoneCartRow` / `getHomeMilestoneRowLayout`. */
    const homeStripBottomOffset =
        (isTabBarVisible ? tabBarStackBottom : Math.max(insets.bottom, 0) + 4) + MILESTONE_CART_ROW_PILL_HEIGHT;
    const homeModalBottomPad = Math.max(0, homeStripBottomOffset - HOME_MILESTONE_MODAL_NUDGE_DOWN);
    const modalScrollMaxHeight = isDock
        ? Math.max(200, windowHeight - insets.top - 20 - homeModalBottomPad)
        : Math.max(200, windowHeight * 0.86 - insets.top - insets.bottom);

    const collapsedContainerStyle = Array.isArray(surfaceCollapsed)
        ? [...surfaceCollapsed, inlineInCartRow && styles.collapsedSurfaceInCartRow]
        : [surfaceCollapsed, inlineInCartRow && styles.collapsedSurfaceInCartRow];

    const hasCollapsedSubtitle = Boolean((collapsedCopy.subtitle || '').trim());

    return (
        <View style={styles.milestoneRoot}>
            <View style={collapsedContainerStyle} accessibilityRole="summary">
                <View style={styles.embeddedCollapsedRow}>
                    <TouchableOpacity
                        style={[
                            styles.collapsedPillPressable,
                            inlineInCartRow && styles.collapsedPillPressableInCartRow,
                        ]}
                        onPress={toggle}
                        activeOpacity={0.92}
                        accessibilityLabel="Expand milestone rewards"
                    >
                        <BlurView
                            intensity={100}
                            tint="light"
                            style={[
                                styles.pillBlurContainer,
                                { borderColor: accentColor },
                                inlineInCartRow && styles.pillBlurContainerInCartRow,
                            ]}
                        >
                            <View style={styles.collapsedPillContent} pointerEvents="box-none">
                                {collapsedActiveIconUri ? (
                                    <View
                                        style={[
                                            styles.collapsedActiveIconWrap,
                                            styles.collapsedActiveIconWrapEmbedded,
                                            { flexShrink: 0 },
                                        ]}
                                    >
                                        <Image
                                            source={{ uri: collapsedActiveIconUri }}
                                            style={styles.collapsedMilestoneIconImage}
                                            contentFit="contain"
                                        />
                                        <CollapsedMilestoneIconProgressRing
                                            progress01={collapsedIconProgress01}
                                            accentColor={accentColor}
                                        />
                                    </View>
                                ) : null}
                                <View style={styles.collapsedCopyWrap}>
                                    <Text
                                        numberOfLines={hasCollapsedSubtitle ? 1 : 2}
                                        ellipsizeMode="tail"
                                        style={[styles.collapsedTitle, styles.collapsedTitleEmbedded]}
                                    >
                                        {collapsedCopy.title}
                                    </Text>
                                    {hasCollapsedSubtitle ? (
                                        <Text
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                            style={styles.collapsedSubtitleEmbedded}
                                        >
                                            {collapsedCopy.subtitle}
                                        </Text>
                                    ) : null}
                                </View>
                                <View style={styles.collapsedChevronWrap} pointerEvents="none">
                                    <Ionicons name={collapsedChevron} size={22} color="#7B7F86" />
                                </View>
                            </View>
                        </BlurView>
                    </TouchableOpacity>
                </View>
            </View>

            <Modal
                visible={expanded}
                transparent
                animationType="none"
                onRequestClose={toggle}
                statusBarTranslucent
            >
                <View style={styles.modalRoot}>
                    <Animated.View
                        style={[
                            isDock && isTabBarVisible
                                ? {
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: tabBarStackBottom,
                                  }
                                : StyleSheet.absoluteFill,
                            styles.modalBackdropScrim,
                            backdropAnimStyle,
                        ]}
                        pointerEvents="box-none"
                    />
                    <Pressable
                        style={[
                            isDock && isTabBarVisible
                                ? {
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      right: 0,
                                      bottom: tabBarStackBottom,
                                  }
                                : StyleSheet.absoluteFill,
                        ]}
                        onPress={toggle}
                        accessibilityLabel="Close milestone rewards"
                    />
                    <View
                        style={[
                            isDock ? styles.modalHomeMilestoneRowWrap : styles.modalCenterWrap,
                            {
                                paddingTop: Math.max(insets.top, 16),
                                paddingBottom: isDock
                                    ? homeModalBottomPad
                                    : Math.max(insets.bottom, 16),
                            },
                        ]}
                        pointerEvents="box-none"
                    >
                        <Animated.View
                            style={[
                                styles.modalContainerExpanded,
                                { width: '100%', maxWidth: cardMaxWidth },
                                cardAnimStyle,
                            ]}
                            accessibilityRole="summary"
                        >
                            <MilestoneExpandedFormContent
                                milestoneModel={milestoneModel}
                                slots={slots}
                                safeCurrent={safeCurrent}
                                expandedHeaderTitle={expandedHeaderTitle}
                                expandedHeaderSubtitle={expandedHeaderSubtitle}
                                collapsedIconProgress01={collapsedIconProgress01}
                                accentColor={accentColor}
                                cartSubtotal={Number(cartSubtotal) || 0}
                                onHeaderPress={toggle}
                                headerAction="chevron"
                                chevronName={expandedHeaderChevron}
                                maxScrollHeight={modalScrollMaxHeight}
                            />
                        </Animated.View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    milestoneRoot: {
        width: '100%',
    },
    modalRoot: {
        flex: 1,
    },
    modalBackdropScrim: {
        backgroundColor: 'rgba(15, 15, 20, 0.5)',
    },
    /**
     * Home: bottom-align so the card base lines up with the 64pt milestone+home row
     * (`MILESTONE_CART_ROW_PILL_HEIGHT` in `getHomeMilestoneRowLayout`); `paddingHorizontal: 12` = `sideInset`.
     */
    modalHomeMilestoneRowWrap: {
        flex: 1,
        width: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    /** Cart (`embedded`): centered. */
    modalCenterWrap: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        transform: [{ translateY: CART_MILESTONE_MODAL_TRANSLATE_Y }],
    },
    /** Light expanded panel (Kiddo rewards). */
    modalContainerExpanded: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        overflow: 'hidden',
    },
    collapsedSurface: {
        backgroundColor: 'transparent',
        paddingHorizontal: 8,
        paddingTop: 0,
        paddingBottom: 0,
        zIndex: 50,
    },
    /** Home row beside cart: use full column width, no side padding. */
    collapsedSurfaceInCartRow: {
        paddingHorizontal: 0,
        marginBottom: 8,
    },
    /** Cart: flush under savings (square top); rounded bottom into cream scroll area. */
    surfaceEmbeddedCollapsed: {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
    },
    collapsedPillPressable: {
        width: '100%',
        minHeight: 52,
        zIndex: 1,
        marginBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    collapsedPillPressableInCartRow: {
        marginBottom: 0,
        minHeight: MILESTONE_CART_ROW_PILL_HEIGHT,
    },
    pillBlurContainer: {
        width: '100%',
        height: 64,
        borderRadius: 24,
        overflow: 'hidden',
        borderStyle: 'solid',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.7)',
    },
    pillBlurContainerInCartRow: {
        height: MILESTONE_CART_ROW_PILL_HEIGHT,
    },
    collapsedPillContent: {
        flex: 1,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 8,
    },
    collapsedChevronWrap: {
        flexShrink: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    embeddedCollapsedRow: {
        width: '100%',
    },
    collapsedTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#000000',
    },
    collapsedCopyWrap: {
        flex: 1,
        minWidth: 0,
    },
    collapsedActiveIconWrap: {
        width: MILESTONE_EXPANDED_LIST_OUTER,
        height: MILESTONE_EXPANDED_LIST_OUTER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    collapsedActiveIconWrapEmbedded: {
        width: MILESTONE_EXPANDED_LIST_OUTER,
        height: MILESTONE_EXPANDED_LIST_OUTER,
        borderRadius: 24,
        position: 'relative',
        backgroundColor: '#FFFFFF',
    },
    /** Same inner size as expanded Kiddo rewards list (`MILESTONE_EXPANDED_LIST_IMAGE`). */
    collapsedMilestoneIconImage: {
        width: MILESTONE_EXPANDED_LIST_IMAGE,
        height: MILESTONE_EXPANDED_LIST_IMAGE,
        zIndex: 1,
    },
    collapsedTitleEmbedded: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#111111',
        lineHeight: 20,
    },
    /** Muted line under title when `unlockedSubtitle` / earned copy is set (light pill). */
    collapsedSubtitleEmbedded: {
        marginTop: 2,
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#6B6B6B',
        lineHeight: 16,
    },
    allDoneTextCol: {
        flex: 1,
        minWidth: 0,
    },
    /** Muted line — matches `collapsedSubtitleEmbedded` (light pill) */
    allDoneKicker: {
        fontSize: 12,
        fontFamily: Fonts.LexendBold,
        color: '#6B6B6B',
        marginBottom: 2,
    },
    allDoneIconsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
    },
    allDoneIconCell: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    allDoneIconRing: {
        width: 36,
        height: 36,
        borderRadius: 20,
        borderWidth: 2.5,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    allDoneIconImage: {
        width: 20,
        height: 20,
    },
    allDoneClose: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default MilestoneTracker;
