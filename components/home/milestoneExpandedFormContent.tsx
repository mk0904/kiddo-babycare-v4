/**
 * Shared expanded "Kiddo rewards" list + header + progress rings (Milestone strip modal body).
 * Used by `MilestoneTracker` and `KiddoRewardsWelcomeModal`.
 */
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
    resolveMilestoneConnectorUri,
    type ResolvedMilestoneSlot,
    type ResolvedMilestoneUIModel,
} from './milestoneUIFromConfig';

const MILESTONE_SLOT_WIDTH = 48;
const VERTICAL_LINE_FRAME_WIDTH = 16;
const OPEN_ROW_GAP = 32;
/** Outer box for every step in the expanded list (matches progress ring / collapsed strip). */
export const MILESTONE_EXPANDED_LIST_OUTER = 44;
/** Inner glyph — identical for all milestones in expanded list + collapsed rail. */
export const MILESTONE_EXPANDED_LIST_IMAGE = 20;
const EXPANDED_LIST_OUTER = MILESTONE_EXPANDED_LIST_OUTER;
const EXPANDED_LIST_IMAGE = MILESTONE_EXPANDED_LIST_IMAGE;
const COLLAPSED_ICON_RING_SIZE = 44;
const COLLAPSED_ICON_RING_STROKE = 2.5;
const RING_CIRC: number = 2 * Math.PI * ((COLLAPSED_ICON_RING_SIZE - COLLAPSED_ICON_RING_STROKE) / 2);

const AnimatedProgressCircle = Animated.createAnimatedComponent(Circle);

function defaultOrderNumberLabel(index: number): string {
    const o = index + 1;
    if (o === 1) return '1ST ORDER';
    if (o === 2) return '2ND ORDER';
    if (o === 3) return '3RD ORDER';
    return '4TH ORDER';
}

function milestoneIconUri(
    slot: ResolvedMilestoneSlot,
    index: number,
    currentStepIndex: number,
    preferEntryIcon: boolean
): string {
    if (preferEntryIcon && slot.entryIconUrl) {
        return slot.entryIconUrl;
    }
    const completed = index < currentStepIndex;
    const current = index === currentStepIndex;
    if (completed || current) return slot.activeIconUrl || slot.inactiveIconUrl;
    return slot.inactiveIconUrl || slot.activeIconUrl;
}

function expandedRowDescription(
    slot: ResolvedMilestoneSlot,
    isFuture: boolean,
    isCompletedStep: boolean,
    isCurrentStep: boolean,
    cartSubtotal: number
): string | null {
    const sub = (slot.subtitle || '').trim();
    const unSub = (slot.unlockedSubtitle || '').trim();
    if (isFuture) {
        return sub || null;
    }
    if (isCompletedStep) {
        return unSub || sub || null;
    }
    if (isCurrentStep) {
        const minV = slot.minCartValue;
        const hasMin = typeof minV === 'number' && Number.isFinite(minV) && minV > 0;
        if (!hasMin) {
            return unSub || sub || null;
        }
        const remaining = minV - (Number(cartSubtotal) || 0);
        if (remaining <= 0) {
            return unSub || sub || null;
        }
        return sub || (slot.orderNumber || '').trim() || null;
    }
    return sub || null;
}

export function CollapsedMilestoneIconProgressRing({
    progress01,
    accentColor,
    showColoredProgress = true,
}: {
    progress01: number;
    accentColor: string;
    /**
     * When `false`, only the neutral track ring is shown (e.g. welcome on app open).
     * @default true
     */
    showColoredProgress?: boolean;
}) {
    const size = COLLAPSED_ICON_RING_SIZE;
    const stroke = COLLAPSED_ICON_RING_STROKE;
    const r = (size - stroke) / 2;
    const c = RING_CIRC;
    const target = useMemo(() => Math.min(1, Math.max(0, progress01)), [progress01]);
    const animatedP = useSharedValue(target);
    const didMount = useRef(true);

    useEffect(() => {
        if (!showColoredProgress) {
            return;
        }
        if (didMount.current) {
            didMount.current = false;
            animatedP.value = target;
            return;
        }
        animatedP.value = withTiming(target, {
            duration: 480,
            easing: Easing.out(Easing.cubic),
        });
    }, [target, animatedP, showColoredProgress]);

    const accentAnimatedProps = useAnimatedProps(() => {
        'worklet';
        const p = Math.min(1, Math.max(0, animatedP.value));
        const dash = c * p;
        return {
            strokeDasharray: `${dash} ${c}`,
            opacity: p <= 0.002 ? 0 : 1,
        };
    });

    return (
        <Svg
            width={size}
            height={size}
            style={[StyleSheet.absoluteFill, { zIndex: 2 }]}
            pointerEvents="none"
        >
            <Circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke="rgba(0, 0, 0, 0.10)"
                strokeWidth={stroke}
                fill="none"
            />
            {showColoredProgress ? (
                <AnimatedProgressCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={accentColor}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    animatedProps={accentAnimatedProps}
                />
            ) : null}
        </Svg>
    );
}

export type MilestoneExpandedFormContentProps = {
    milestoneModel: ResolvedMilestoneUIModel;
    slots: ResolvedMilestoneSlot[];
    safeCurrent: number;
    expandedHeaderTitle: string;
    expandedHeaderSubtitle: string | null;
    collapsedIconProgress01: number;
    accentColor: string;
    cartSubtotal: number;
    onHeaderPress: () => void;
    /** In-app: chevron (dock/embedded). Welcome: X. */
    headerAction: 'chevron' | 'close';
    /** When `headerAction` is `chevron`, which icon (home vs cart). */
    chevronName?: 'chevron-up' | 'chevron-down';
    maxScrollHeight: number;
    /**
     * When `headerAction` is `close`, only the trailing icon is tappable (not the title block).
     * @default 'iconOnly'
     */
    closeControl?: 'iconOnly' | 'fullRow';
    /**
     * When `false`, step icons show the neutral track ring only (no colored progress arc; e.g. welcome on app open).
     * @default true
     */
    showMilestoneIconColoredProgress?: boolean;
    /** Prefer per-slot `entryIconUrl` when available (welcome modal). */
    preferEntryIcon?: boolean;
    /** Show the outer ring around step icons. */
    showMilestoneIconRing?: boolean;
    /** Dim future-step icons/text. */
    dimFutureSteps?: boolean;
    /** Override icon glyph size inside the fixed 44x44 icon slot. */
    iconSize?: number;
};

/**
 * Body of the white rewards card: header row + scrollable steps (same as expanded `MilestoneTracker` modal).
 */
export function MilestoneExpandedFormContent({
    milestoneModel,
    slots,
    safeCurrent,
    expandedHeaderTitle,
    expandedHeaderSubtitle,
    collapsedIconProgress01,
    accentColor,
    cartSubtotal,
    onHeaderPress,
    headerAction,
    chevronName = 'chevron-up',
    maxScrollHeight,
    closeControl = 'iconOnly',
    showMilestoneIconColoredProgress = true,
    preferEntryIcon = false,
    showMilestoneIconRing = true,
    dimFutureSteps = true,
    iconSize = EXPANDED_LIST_IMAGE,
}: MilestoneExpandedFormContentProps) {
    const n = slots.length;
    const connector = useCallback(
        (stepIndex: number, axis: 'horizontal' | 'vertical') =>
            resolveMilestoneConnectorUri(milestoneModel, stepIndex, axis, safeCurrent),
        [milestoneModel, safeCurrent]
    );

    const rows = useMemo(
        () =>
            slots.map((slot, index) => {
                const isLast = index === n - 1;
                const lineUri = connector(index, 'horizontal');
                const iconUri = milestoneIconUri(slot, index, safeCurrent, preferEntryIcon);
                const isFuture = index > safeCurrent;
                const isCompletedStep = index < safeCurrent;
                const isCurrentStep = index === safeCurrent;
                const slotRingColor = slot.color || slot.titleColorActive || accentColor;
                const showRingAroundIcon = Boolean(showMilestoneIconRing && iconUri);
                const ringProgress01 = isFuture ? 0 : (isCurrentStep ? collapsedIconProgress01 : 1);
                const ringColor = isCurrentStep ? accentColor : slotRingColor;
                const orderLabel = (slot.orderNumber || '').trim() || defaultOrderNumberLabel(index);
                const activeTitleColor = slot.titleColorActive ? { color: slot.titleColorActive } : null;
                const activeSubtitleColor = slot.subtitleColor ? { color: slot.subtitleColor } : null;
                const descriptionText = expandedRowDescription(
                    slot,
                    isFuture,
                    isCompletedStep,
                    isCurrentStep,
                    Number(cartSubtotal) || 0
                );

                return (
                    <View key={`k-${index}`} style={[styles.milestoneRow, isLast && styles.milestoneRowLast]}>
                        <View style={styles.milestoneLeft}>
                            <View
                                style={[
                                    styles.iconClip,
                                    isFuture && dimFutureSteps && styles.expandedIconClipFuture,
                                ]}
                            >
                                {iconUri ? (
                                    <View style={styles.expandedActiveIconWithRing}>
                                        <View style={[styles.iconShadowWrapper, { shadowColor: ringColor }]}>
                                            <Image
                                                source={{ uri: iconUri }}
                                                style={[styles.iconFill, { width: iconSize, height: iconSize }]}
                                                contentFit="contain"
                                            />
                                        </View>
                                        {showRingAroundIcon ? (
                                            <CollapsedMilestoneIconProgressRing
                                                progress01={ringProgress01}
                                                accentColor={ringColor}
                                                showColoredProgress={showMilestoneIconColoredProgress}
                                            />
                                        ) : null}
                                    </View>
                                ) : null}
                            </View>
                            {!isLast && lineUri ? (
                                <Image
                                    source={{ uri: lineUri }}
                                    style={[styles.connectingLineImage, { height: OPEN_ROW_GAP - 8 }]}
                                    contentFit="contain"
                                    allowDownscaling={false}
                                />
                            ) : null}
                        </View>
                        <View style={styles.milestoneContent}>
                            {orderLabel ? (
                                <Text
                                    style={[
                                        styles.expandedOrderLabel,
                                        isFuture && dimFutureSteps && styles.expandedOrderLabelFuture,
                                    ]}
                                    numberOfLines={1}
                                >
                                    {orderLabel}
                                </Text>
                            ) : null}
                            <Text
                                style={[
                                    styles.expandedRewardTitle,
                                    isFuture && dimFutureSteps && styles.expandedRewardTitleFuture,
                                    !isFuture && activeTitleColor,
                                ]}
                                numberOfLines={2}
                            >
                                {slot.title}
                            </Text>
                            {descriptionText ? (
                                <Text
                                    style={[
                                        styles.expandedDescription,
                                        isFuture && dimFutureSteps && styles.expandedDescriptionFuture,
                                        !isFuture && activeSubtitleColor,
                                    ]}
                                >
                                    {descriptionText}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                );
            }),
        [
            slots,
            n,
            connector,
            safeCurrent,
            accentColor,
            collapsedIconProgress01,
            cartSubtotal,
            showMilestoneIconColoredProgress,
            preferEntryIcon,
            showMilestoneIconRing,
            dimFutureSteps,
            iconSize,
        ]
    );

    return (
        <ScrollView
            style={{ maxHeight: maxScrollHeight }}
            showsVerticalScrollIndicator
            bounces
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
        >
            {headerAction === 'close' && closeControl === 'iconOnly' ? (
                <View style={styles.expandedHeader}>
                    <View style={styles.expandedHeaderTextBlock}>
                        {expandedHeaderSubtitle ? (
                            <Text style={styles.expandedPanelSubtitle}>{expandedHeaderSubtitle}</Text>
                        ) : null}
                        {expandedHeaderTitle ? (
                            <Text style={styles.expandedPanelTitle}>{expandedHeaderTitle}</Text>
                        ) : null}
                    </View>
                    <TouchableOpacity
                        style={styles.modalHeaderChevronWrap}
                        onPress={onHeaderPress}
                        activeOpacity={0.7}
                        accessibilityLabel="Close Kiddo rewards"
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Ionicons name="close" size={24} color="#717680" />
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity
                    style={styles.expandedHeader}
                    onPress={onHeaderPress}
                    activeOpacity={0.9}
                    accessibilityLabel={headerAction === 'close' ? 'Close Kiddo rewards' : 'Collapse milestone rewards'}
                >
                    <View style={styles.expandedHeaderTextBlock}>
                        {expandedHeaderSubtitle ? (
                            <Text style={styles.expandedPanelSubtitle}>{expandedHeaderSubtitle}</Text>
                        ) : null}
                        {expandedHeaderTitle ? <Text style={styles.expandedPanelTitle}>{expandedHeaderTitle}</Text> : null}
                    </View>
                    <View style={styles.modalHeaderChevronWrap} pointerEvents="none">
                        {headerAction === 'close' ? (
                            <Ionicons name="close" size={24} color="#717680" />
                        ) : (
                            <Ionicons name={chevronName} size={22} color="#717680" />
                        )}
                    </View>
                </TouchableOpacity>
            )}
            {rows}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    modalScrollContent: {
        flexGrow: 0,
    },
    expandedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 20,
    },
    expandedHeaderTextBlock: {
        flex: 1,
        marginRight: 8,
    },
    expandedPanelSubtitle: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#0000004D',
    },
    expandedPanelTitle: {
        fontSize: Fonts.LargeFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#000000',
    },
    modalHeaderChevronWrap: {
        minWidth: 28,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 2,
    },
    expandedOrderLabel: {
        fontSize: 10,
        fontFamily: Fonts.LexendBold,
        color: '#00000066',
        letterSpacing: 0.4,
        marginBottom: 4,
    },
    expandedOrderLabelFuture: {
        color: '#9CA3AF',
    },
    expandedRewardTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#000000',
    },
    expandedRewardTitleFuture: {
        color: '#6B6B6B',
    },
    expandedDescription: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#00000066',
        marginTop: 4,
    },
    expandedDescriptionFuture: {
        color: '#0000004D',
    },
    expandedIconClipFuture: {
        opacity: 0.6,
    },
    milestoneRow: {
        flexDirection: 'row',
        paddingBottom: OPEN_ROW_GAP,
        alignItems: 'flex-start',
    },
    milestoneRowLast: {
        paddingBottom: 0,
    },
    milestoneLeft: {
        width: MILESTONE_SLOT_WIDTH,
        marginRight: 12,
        marginLeft: 8,
        alignItems: 'center',
        position: 'relative',
        zIndex: 1,
    },
    iconClip: {
        width: EXPANDED_LIST_OUTER,
        height: EXPANDED_LIST_OUTER,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        zIndex: 20,
        elevation: 8,
    },
    iconFill: {
        width: EXPANDED_LIST_IMAGE,
        height: EXPANDED_LIST_IMAGE,
        opacity: 1,
        zIndex: 1,
    },
    iconShadowWrapper: {
        width: EXPANDED_LIST_IMAGE,
        height: EXPANDED_LIST_IMAGE,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: EXPANDED_LIST_IMAGE / 2,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 15,
    },
    expandedActiveIconWithRing: {
        width: EXPANDED_LIST_OUTER,
        height: EXPANDED_LIST_OUTER,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    connectingLineImage: {
        width: VERTICAL_LINE_FRAME_WIDTH,
        position: 'absolute',
        top: EXPANDED_LIST_OUTER + 4,
        left: (MILESTONE_SLOT_WIDTH - VERTICAL_LINE_FRAME_WIDTH) / 2,
        zIndex: 2,
        elevation: 0,
    },
    milestoneContent: {
        flex: 1,
    },
});
