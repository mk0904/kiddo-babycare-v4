import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { configService } from '@/services/configService';
import { useCartSubtotal } from '@/store/cartStore';
import type { MilestoneUIConfig } from '@/types/appConfig';
import { getHomeMilestoneRowLayout } from '@/utils/homeMilestoneRowLayout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MilestoneExpandedFormContent } from './milestoneExpandedFormContent';
import {
    buildMilestoneUIModel,
    milestoneCurrentStepFromConfig,
    milestoneExpandedSubtitleFromConfig,
    milestoneExpandedTitleFromConfig,
} from './milestoneUIFromConfig';

const WELCOME_SHOW_DELAY_MS = 0;
const WELCOME_MODAL_IN_MS = 0;
const WELCOME_MODAL_OUT_MS = 0;
/** Card snaps up from below (aligned with quick bottom-anchored motion on Home). */
const WELCOME_SLIDE_PX = 0;

const KIDDO_REWARDS_WELCOME_DISMISSED_KEY = 'kiddo_rewards_welcome_modal_dismissed';

export type KiddoRewardsWelcomeModalProps = {
    milestoneUI: MilestoneUIConfig | null | undefined;
    open?: boolean;
    isHomeTabFocused: boolean;
    /** Fires when the popup is shown or hidden; Home can hide the milestone+ cart row (uses `getHomeMilestoneRowLayout`) while the popup is open. */
    onVisibilityChange?: (visible: boolean) => void;
};

/**
 * Home-only **popup** over the main feed: same Kiddo rewards list as the expanded strip, in a dimmed
 * `Modal` (separate from `MilestoneTracker`). Shown after the Home tab is focused when milestone
 * app-config exists. Dismiss via the X (or Android back): persisted in AsyncStorage so it auto-opens
 * only once. Full rewards detail afterward is via the milestone strip chevron (`MilestoneTracker`).
 */
export function KiddoRewardsWelcomeModal({
    milestoneUI,
    open = true,
    isHomeTabFocused: isHomeFocused,
    onVisibilityChange,
}: KiddoRewardsWelcomeModalProps) {
    const homeLandedAtMsRef = useRef<number | null>(null);
    /** Session re-arm on foreground; ignored if the user has permanently dismissed (`AsyncStorage`). */
    const mayAutoShowRef = useRef(true);
    const persistDismissedRef = useRef(false);
    const [persistDismissed, setPersistDismissed] = useState<boolean | null>(null);
    const [scheduleTick, setScheduleTick] = useState(0);
    const insets = useSafeAreaInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const { isVisible: isTabBarVisible } = useTabBarVisibility();
    const cartSubtotal = useCartSubtotal();
    const [visible, setVisible] = useState(false);
    const [showConfetti, setShowConfetti] = useState(true);

    const milestoneModel = useMemo(
        () => buildMilestoneUIModel(milestoneUI ?? undefined),
        [milestoneUI]
    );
    const slots = milestoneModel?.slots ?? [];
    const expandedHeaderTitle = useMemo(
        () => milestoneExpandedTitleFromConfig(milestoneUI ?? undefined),
        [milestoneUI]
    );
    const expandedHeaderSubtitle = useMemo(
        () => milestoneExpandedSubtitleFromConfig(milestoneUI ?? undefined),
        [milestoneUI]
    );
    const safeCurrent = useMemo(() => {
        const fromCfg = milestoneCurrentStepFromConfig(milestoneUI ?? undefined, 0);
        const n = slots.length;
        return Math.min(Math.max(0, fromCfg), Math.max(0, n - 1));
    }, [milestoneUI, slots.length]);

    const activeSlot = slots[safeCurrent] ?? slots[0] ?? null;
    const accentColor = activeSlot?.color || activeSlot?.titleColorActive || '#FF5CC8';
    const collapsedIconProgress01 = useMemo(() => {
        if (!activeSlot) return 0;
        const minV = activeSlot.minCartValue;
        if (typeof minV !== 'number' || !Number.isFinite(minV) || minV <= 0) return 1;
        const ct = Number(cartSubtotal) || 0;
        return Math.min(1, Math.max(0, ct / minV));
    }, [activeSlot, cartSubtotal]);

    const tabBarStackBottom = useMemo(() => {
        const tabBarHeight = configService.getTabBarConfig()?.styles?.height ?? 60;
        return Math.max(insets.bottom, 0) + tabBarHeight;
    }, [insets.bottom]);

    const homeMilestoneLayout = getHomeMilestoneRowLayout(windowWidth);
    const cardMaxWidth = Math.min(homeMilestoneLayout.innerWidth, 420);
    const modalScrollMaxHeight = useMemo(
        () =>
            Math.max(
                200,
                Math.min(windowHeight * 0.7, windowHeight - insets.top - insets.bottom - 32)
            ),
        [windowHeight, insets.top, insets.bottom]
    );

    const translateY = useSharedValue(WELCOME_SLIDE_PX);
    const backdropOp = useSharedValue(0);

    const finishHideModal = useCallback(() => {
        setVisible(false);
    }, []);

    const dismiss = useCallback(() => {
        mayAutoShowRef.current = false;
        persistDismissedRef.current = true;
        setPersistDismissed(true);
        void AsyncStorage.setItem(KIDDO_REWARDS_WELCOME_DISMISSED_KEY, 'true').catch(() => { });
        translateY.value = withTiming(
            WELCOME_SLIDE_PX,
            { duration: WELCOME_MODAL_OUT_MS, easing: Easing.bezier(0.4, 0, 1, 0.95) },
            (finished) => {
                if (finished) {
                    runOnJS(finishHideModal)();
                }
            }
        );
        backdropOp.value = withTiming(0, {
            duration: 130,
            easing: Easing.bezier(0.4, 0, 1, 0.95),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values not deps
    }, [finishHideModal]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const v = await AsyncStorage.getItem(KIDDO_REWARDS_WELCOME_DISMISSED_KEY);
                if (cancelled) return;
                const dismissed = v === 'true';
                persistDismissedRef.current = dismissed;
                setPersistDismissed(dismissed);
                if (dismissed) {
                    mayAutoShowRef.current = false;
                }
            } catch {
                if (!cancelled) {
                    setPersistDismissed(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useLayoutEffect(() => {
        if (!visible) {
            return;
        }
        setShowConfetti(true);
        const timer = setTimeout(() => setShowConfetti(false), 2000);

        translateY.value = WELCOME_SLIDE_PX;
        backdropOp.value = 0;
        translateY.value = withTiming(0, {
            duration: WELCOME_MODAL_IN_MS,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        backdropOp.value = withTiming(1, {
            duration: 160,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values not deps
    }, [visible]);

    const backdropAnimStyle = useAnimatedStyle(() => ({
        opacity: backdropOp.value,
    }));

    const cardAnimStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    useEffect(() => {
        const onAppState = (state: AppStateStatus) => {
            if (state !== 'active') {
                return;
            }
            setVisible(false);
            if (persistDismissedRef.current) {
                return;
            }
            mayAutoShowRef.current = true;
            homeLandedAtMsRef.current = Date.now();
            setScheduleTick((t) => t + 1);
        };
        const sub = AppState.addEventListener('change', onAppState);
        return () => sub.remove();
    }, []);

    useLayoutEffect(() => {
        if (!isHomeFocused || !open) {
            return;
        }
        homeLandedAtMsRef.current = Date.now();
        setScheduleTick((t) => t + 1);
    }, [isHomeFocused, open]);

    useEffect(() => {
        if (visible) {
            return;
        }
        if (!open || !isHomeFocused) {
            return;
        }
        if (persistDismissed !== false) {
            return;
        }
        if (!milestoneModel || slots.length === 0) {
            return;
        }
        if (homeLandedAtMsRef.current == null) {
            return;
        }
        if (!mayAutoShowRef.current) {
            return;
        }

        let cancelled = false;
        const elapsed = Date.now() - homeLandedAtMsRef.current;
        const waitMs = Math.max(0, WELCOME_SHOW_DELAY_MS - elapsed);
        const timer = setTimeout(() => {
            if (cancelled) return;
            if (!mayAutoShowRef.current) return;
            if (!milestoneModel || slots.length === 0) return;
            setVisible(true);
        }, waitMs);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [open, isHomeFocused, visible, milestoneModel, slots.length, scheduleTick, persistDismissed]);

    useEffect(() => {
        onVisibilityChange?.(visible);
    }, [visible, onVisibilityChange]);

    if (!milestoneModel || slots.length === 0) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={dismiss}
            statusBarTranslucent
            hardwareAccelerated
            presentationStyle="overFullScreen"
        >
            <View
                style={[
                    styles.modalRoot,
                    { paddingTop: insets.top, paddingBottom: isTabBarVisible ? tabBarStackBottom : insets.bottom },
                ]}
                pointerEvents="box-none"
            >
                {/* Backdrop: dims Home; not pressable (dismiss with X or header / Android back). */}
                <Animated.View
                    style={[
                        isTabBarVisible
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
                />
                <View style={styles.popupCenter} pointerEvents="box-none">
                    <Animated.View
                        style={[
                            styles.popupCard,
                            { maxWidth: cardMaxWidth, width: '100%' },
                            cardAnimStyle,
                        ]}
                        accessibilityViewIsModal
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
                            onHeaderPress={dismiss}
                            headerAction="close"
                            closeControl="iconOnly"
                            maxScrollHeight={modalScrollMaxHeight}
                            showMilestoneIconColoredProgress={false}
                            preferEntryIcon
                            showMilestoneIconRing={false}
                            dimFutureSteps={false}
                            iconSize={32}
                        />
                    </Animated.View>
                </View>
                {showConfetti && milestoneModel?.animationUrl ? (
                    <Image
                        source={{ uri: milestoneModel.animationUrl }}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '70%',
                            zIndex: 100,
                        }}
                        contentFit="cover"
                        pointerEvents="none"
                    />
                ) : null}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
    },
    modalBackdropScrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 15, 20, 0.4)',
    },
    /** Centers the Kiddo rewards “popup” card on the Home screen, like a dialog. */
    popupCenter: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    popupCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        overflow: 'hidden',
    },
});
