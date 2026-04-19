import { Fonts } from '@/constants/theme';
import type { MilestoneUIConfig } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    buildMilestoneSlotsFromConfig,
    milestoneCurrentStepFromConfig,
    milestoneExpandedTitleFromConfig,
    type ResolvedMilestoneSlot,
} from './milestoneUIFromConfig';

/** `dock`: above tab bar (rounded top). `embedded`: cart under savings (square top, rounded bottom into scroll). */
export type MilestoneTrackerVariant = 'dock' | 'embedded';

export interface MilestoneTrackerProps {
    /** Backend `milestoneUI` from GET /api/v1/app/config. When null, defaults are used. */
    milestoneUI?: MilestoneUIConfig | null;
    /** When `milestoneUI.currentStepIndex` is unset, progress is inferred from each slot’s `isCompleted`. */
    currentStepIndex?: number;
    onExpandedChange?: (expanded: boolean) => void;
    /** `embedded` = bottom corners rounded for cart. Default `dock` = home strip with rounded top. */
    variant?: MilestoneTrackerVariant;
}

/** Expanded: `milestoneLeft` column width. Collapsed: row height for 32×32 nodes + glow. */
const MILESTONE_SLOT_WIDTH = 32;
const LINE_WIDTH = 2;
const OPEN_ROW_GAP = 32;
const COLLAPSED_NODE_IMAGE = 20;
const COLLAPSED_ROW_MARGIN_TOP = 2;
const COLLAPSED_TRACK_BOTTOM_PAD = 10;
/** Horizontal gap between each icon edge and the line inside the flex bridge. */
const COLLAPSED_SEGMENT_H_GAP = 8;
/** 2px line vertically centered on the 32px icon row (bridge and slot share the same height). */
const COLLAPSED_LINE_TOP_IN_BRIDGE = COLLAPSED_NODE_IMAGE / 2 - 1;
const COLLAPSED_TRACK_HEIGHT =
    COLLAPSED_ROW_MARGIN_TOP + COLLAPSED_NODE_IMAGE + COLLAPSED_TRACK_BOTTOM_PAD;
/** Reference HTML `.tracker`: horizontal padding on the row. */
const COLLAPSED_TRACKER_PADDING_H = 10;

type MilestoneConnectorAxis = 'horizontal' | 'vertical';

/**
 * Connector between step `stepIndex` and `stepIndex + 1` (same rules for collapsed vs expanded).
 * - `stepIndex < current` → completed asset
 * - `stepIndex === current` → active asset
 * - else → pending asset
 */
function milestoneConnectorUri(
    slots: ResolvedMilestoneSlot[],
    stepIndex: number,
    currentStepIndex: number,
    total: number,
    axis: MilestoneConnectorAxis
): string | null {
    if (stepIndex >= total - 1) return null;
    const s = slots[stepIndex];
    if (!s) return null;
    if (stepIndex < currentStepIndex) {
        return axis === 'horizontal' ? s.completedHorLine || null : s.completedVerLine || null;
    }
    if (stepIndex === currentStepIndex) {
        return axis === 'horizontal' ? s.horActiveLine || null : s.verActiveLine || null;
    }
    return axis === 'horizontal' ? s.pendingHorLine || null : s.pendingVerLine || null;
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
}: MilestoneTrackerProps) {
    const [expanded, setExpanded] = useState(false);

    const slots = useMemo(() => buildMilestoneSlotsFromConfig(milestoneUI ?? undefined), [milestoneUI]);
    const expandedHeaderTitle = useMemo(
        () => milestoneExpandedTitleFromConfig(milestoneUI ?? undefined),
        [milestoneUI]
    );
    const safeCurrent = useMemo(() => {
        const fromCfg = milestoneCurrentStepFromConfig(milestoneUI ?? undefined, currentStepProp);
        const n = slots.length;
        return Math.min(Math.max(0, fromCfg), Math.max(0, n - 1));
    }, [milestoneUI, currentStepProp, slots.length]);

    const collapsedTitle = slots[safeCurrent]?.title ?? slots[0]?.title ?? '';

    const toggle = useCallback(() => {
        setExpanded((e) => {
            const next = !e;
            onExpandedChange?.(next);
            return next;
        });
    }, [onExpandedChange]);

    const n = slots.length;

    const surfaceExpanded =
        variant === 'embedded'
            ? [styles.modalContainer, styles.surfaceEmbeddedExpanded]
            : styles.modalContainer;
    const surfaceCollapsed =
        variant === 'embedded' ? [styles.card, styles.surfaceEmbeddedCollapsed] : styles.card;

    if (expanded) {
        return (
            <View style={surfaceExpanded} accessibilityRole="summary">
                <TouchableOpacity
                    style={[styles.modalHeader, variant === 'embedded' && styles.modalHeaderEmbedded]}
                    onPress={toggle}
                    activeOpacity={0.85}
                    accessibilityLabel="Collapse milestone rewards"
                >
                    <Text style={styles.modalTitle}>{expandedHeaderTitle}</Text>
                    <View style={styles.modalHeaderChevronWrap} pointerEvents="none">
                        <Ionicons
                            name={variant === 'embedded' ? 'chevron-up' : 'chevron-down'}
                            size={22}
                            color="rgba(255,255,255,0.9)"
                        />
                    </View>
                </TouchableOpacity>

                {slots.map((slot, index) => {
                    const isLast = index === n - 1;
                    const lineUri = milestoneConnectorUri(slots, index, safeCurrent, n, 'vertical');
                    const iconUri = milestoneIconUri(slot, index, safeCurrent);
                    const isCurrent = index === safeCurrent;

                    return (
                        <View key={`m-${index}`} style={[styles.milestoneRow, isLast && styles.milestoneRowLast]}>
                            <View style={styles.milestoneLeft}>
                                <View style={styles.iconClip}>
                                    <Image
                                        source={{ uri: iconUri }}
                                        style={styles.iconFill}
                                        contentFit="cover"
                                    />
                                </View>
                                {!isLast && lineUri ? (
                                    <Image
                                        source={{ uri: lineUri }}
                                        style={[styles.connectingLineImage, { height: OPEN_ROW_GAP + 4 }]}
                                        contentFit="fill"
                                    />
                                ) : null}
                                {!isLast && !lineUri ? (
                                    <View
                                        style={[
                                            styles.connectingLineFallback,
                                            { height: OPEN_ROW_GAP + 4 },
                                            index <= safeCurrent && styles.lineFallbackCompleted,
                                        ]}
                                    />
                                ) : null}
                            </View>
                            <View style={styles.milestoneContent}>
                                <Text
                                    style={[
                                        styles.milestoneTitle,
                                        {
                                            color: slot.titleColorActive,
                                            opacity: isCurrent || index < safeCurrent ? 1 : 0.75,
                                        },
                                    ]}
                                >
                                    {slot.title}
                                </Text>
                                <Text style={[styles.milestoneDesc, { color: slot.subtitleColor }]}>
                                    {slot.subtitle}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    }

    const collapsedTrackEl = (
        <View style={styles.collapsedTrack}>
            <View style={styles.collapsedTrackerInner}>
                <View style={styles.collapsedNodesAndSegmentsRow}>
                    {slots.flatMap((slot, index) => {
                        const completed = index < safeCurrent;
                        const current = index === safeCurrent;
                        const iconUri = milestoneIconUri(slot, index, safeCurrent);
                        const node = (
                            <View
                                key={`nr-${index}`}
                                style={[styles.nodeSlot, current ? styles.nodeSlotCurrent : null]}
                            >
                                <View style={styles.nodeImageClip}>
                                    <Image
                                        source={{ uri: iconUri }}
                                        style={[
                                            styles.nodeImageFill,
                                            !current && !completed ? styles.nodeImageDim : null,
                                        ]}
                                        contentFit="cover"
                                    />
                                </View>
                            </View>
                        );
                        if (index >= n - 1) {
                            return [node];
                        }
                        const segIndex = index;
                        const uri = milestoneConnectorUri(slots, segIndex, safeCurrent, n, 'horizontal');
                        const bridge = (
                            <View key={`br-${segIndex}`} style={styles.collapsedSegmentBridge}>
                                <View style={styles.collapsedBridgeGrey} />
                                {uri ? (
                                    <Image
                                        source={{ uri }}
                                        style={styles.collapsedBridgeGoldImg}
                                        contentFit="fill"
                                    />
                                ) : (
                                    <View
                                        style={[
                                            styles.collapsedBridgeGoldFallback,
                                            segIndex <= safeCurrent && styles.lineFallbackCompleted,
                                        ]}
                                    />
                                )}
                            </View>
                        );
                        return [node, bridge];
                    })}
                </View>
            </View>
        </View>
    );

    return (
        <View style={surfaceCollapsed} accessibilityRole="summary">
            {variant === 'embedded' ? (
                <View style={styles.embeddedCollapsedRow}>
                    <View style={styles.embeddedCollapsedMain}>
                        <TouchableOpacity
                            style={[styles.collapsedHeader, styles.collapsedHeaderEmbedded]}
                            onPress={toggle}
                            activeOpacity={0.85}
                            accessibilityLabel="Expand milestone rewards"
                        >
                            <Text style={styles.collapsedTitle} numberOfLines={2}>
                                {collapsedTitle}
                            </Text>
                        </TouchableOpacity>
                        {collapsedTrackEl}
                    </View>
                    <TouchableOpacity
                        style={styles.embeddedChevronRail}
                        onPress={toggle}
                        activeOpacity={0.85}
                        accessibilityLabel="Expand milestone rewards"
                        accessibilityRole="button"
                    >
                        <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.95)" />
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <TouchableOpacity
                        style={styles.collapsedHeader}
                        onPress={toggle}
                        activeOpacity={0.85}
                        accessibilityLabel="Expand milestone rewards"
                    >
                        <Text style={styles.collapsedTitle} numberOfLines={2}>
                            {collapsedTitle}
                        </Text>
                        <Ionicons name="chevron-up" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                    {collapsedTrackEl}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        backgroundColor: '#101323E5',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        overflow: 'hidden',
    },
    surfaceEmbeddedExpanded: {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 24,
    },
    modalHeaderEmbedded: {
        alignItems: 'flex-start',
    },
    modalHeaderChevronWrap: {
        minWidth: 28,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 2,
    },
    modalTitle: {
        flex: 1,
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#FFFFFF',
        marginRight: 8,
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
        alignItems: 'center',
    },
    /** Expanded list: fixed box + cover so CDN glyphs read the same size. */
    iconClip: {
        width: 20,
        height: 20,
        borderRadius: 10,
        overflow: 'hidden',
        zIndex: 2,
    },
    iconFill: {
        width: '100%',
        height: '100%',
    },
    /** Collapsed track: same footprint for every milestone image. */
    nodeImageClip: {
        width: COLLAPSED_NODE_IMAGE,
        height: COLLAPSED_NODE_IMAGE,
        borderRadius: 10,
        overflow: 'hidden',
    },
    nodeImageFill: {
        width: '100%',
        height: '100%',
    },
    connectingLineImage: {
        width: LINE_WIDTH,
        position: 'absolute',
        top: 28,
        left: (MILESTONE_SLOT_WIDTH - LINE_WIDTH) / 2,
        zIndex: 1,
    },
    connectingLineFallback: {
        width: LINE_WIDTH,
        position: 'absolute',
        top: 28,
        left: (MILESTONE_SLOT_WIDTH - LINE_WIDTH) / 2,
        zIndex: 1,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    lineFallbackCompleted: {
        backgroundColor: '#E6B800',
    },
    milestoneContent: {
        flex: 1,
    },
    milestoneTitle: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        marginBottom: 2,
        lineHeight: 18,
    },
    milestoneDesc: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        lineHeight: 16,
    },
    card: {
        backgroundColor: '#101323E5',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 18,
    },
    /** Cart: flush under savings (square top); rounded bottom into cream scroll area. */
    surfaceEmbeddedCollapsed: {
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
    },
    collapsedHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    collapsedHeaderEmbedded: {
        marginBottom: 10,
    },
    embeddedCollapsedRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    embeddedCollapsedMain: {
        flex: 1,
        minWidth: 0,
    },
    embeddedChevronRail: {
        width: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
        marginTop: 2,
    },
    collapsedTitle: {
        flex: 1,
        fontSize: 18,
        fontFamily: Fonts.SemiBold,
        color: '#FFFFFF',
        paddingRight: 8,
    },
    collapsedTrack: {
        height: COLLAPSED_TRACK_HEIGHT,
        position: 'relative',
    },
    /** Reference `.tracker`: padding `0 10px`; line + nodes share this box (HTML `::before` is inside it). */
    collapsedTrackerInner: {
        flex: 1,
        paddingHorizontal: COLLAPSED_TRACKER_PADDING_H,
        justifyContent: 'flex-start',
        position: 'relative',
    },
    /** `[icon][flex-bridge][icon]…` — lines live only in bridges with horizontal + vertical gap from icons (ss). */
    collapsedNodesAndSegmentsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: COLLAPSED_ROW_MARGIN_TOP,
        width: '100%',
    },
    collapsedSegmentBridge: {
        flex: 1,
        minWidth: COLLAPSED_SEGMENT_H_GAP * 2,
        height: COLLAPSED_NODE_IMAGE,
        alignSelf: 'center',
        position: 'relative',
        zIndex: 1,
    },
    collapsedBridgeGrey: {
        position: 'absolute',
        left: COLLAPSED_SEGMENT_H_GAP,
        right: COLLAPSED_SEGMENT_H_GAP,
        top: COLLAPSED_LINE_TOP_IN_BRIDGE,
        height: 2,
        backgroundColor: '#4a4a4a',
    },
    collapsedBridgeGoldImg: {
        position: 'absolute',
        left: COLLAPSED_SEGMENT_H_GAP,
        right: COLLAPSED_SEGMENT_H_GAP,
        top: COLLAPSED_LINE_TOP_IN_BRIDGE,
        height: 2,
    },
    collapsedBridgeGoldFallback: {
        position: 'absolute',
        left: COLLAPSED_SEGMENT_H_GAP,
        right: COLLAPSED_SEGMENT_H_GAP,
        top: COLLAPSED_LINE_TOP_IN_BRIDGE,
        height: 2,
        borderRadius: 1,
        backgroundColor: 'transparent',
    },
    nodeSlot: {
        width: COLLAPSED_NODE_IMAGE,
        height: COLLAPSED_NODE_IMAGE,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    nodeSlotCurrent: {
        width: COLLAPSED_NODE_IMAGE,
        height: COLLAPSED_NODE_IMAGE,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    nodeImageDim: {
        opacity: 0.45,
    },
});
