import { Fonts } from '@/constants/theme';
import type { MilestoneUIConfig } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    buildMilestoneUIModel,
    milestoneCurrentStepFromConfig,
    milestoneExpandedTitleFromConfig,
    resolveMilestoneConnectorUri,
    type ResolvedMilestoneSlot,
} from './milestoneUIFromConfig';

/** `dock`: above tab bar (rounded top). `embedded`: cart under savings (square top, rounded bottom into scroll). */
export type MilestoneTrackerVariant = 'dock' | 'embedded';

export interface MilestoneTrackerProps {
    /** Backend `milestoneUI` from GET /api/v1/app/config. When null/omitted, the strip is not rendered. */
    milestoneUI?: MilestoneUIConfig | null;
    /** When `milestoneUI.currentStepIndex` is unset, progress is inferred from each slot’s `isCompleted`. */
    currentStepIndex?: number;
    onExpandedChange?: (expanded: boolean) => void;
    /** `embedded` = bottom corners rounded for cart. Default `dock` = home strip with rounded top. */
    variant?: MilestoneTrackerVariant;
}

/** Expanded: `milestoneLeft` column width. Collapsed: row height for 32×32 nodes + glow. */
const MILESTONE_SLOT_WIDTH = 32;
const VERTICAL_LINE_FRAME_WIDTH = 16;
const OPEN_ROW_GAP = 32;
const EXPANDED_NODE_FRAME = 32;
const EXPANDED_NODE_BASE_SIZE = 20;
const EXPANDED_NODE_HIGHLIGHT_SIZE = 48;
const COLLAPSED_NODE_IMAGE = 20;
const COLLAPSED_NODE_FRAME = 32;
const COLLAPSED_NODE_BASE_SIZE = 20;
const COLLAPSED_NODE_HIGHLIGHT_SIZE = 48;
const COLLAPSED_ROW_MARGIN_TOP = 2;
const COLLAPSED_TRACK_BOTTOM_PAD = 10;
/** Horizontal gap between each icon edge and the line inside the flex bridge. */
const COLLAPSED_SEGMENT_H_GAP = 8;
/** Strip tall enough to preserve PNG gradients; centered on the 20px icon row. */
const COLLAPSED_H_LINE_FRAME_HEIGHT = 16;
const COLLAPSED_LINE_TOP_IN_BRIDGE = COLLAPSED_NODE_IMAGE / 2 - COLLAPSED_H_LINE_FRAME_HEIGHT / 2;
const COLLAPSED_TRACK_HEIGHT =
    COLLAPSED_ROW_MARGIN_TOP + COLLAPSED_NODE_IMAGE + COLLAPSED_TRACK_BOTTOM_PAD;

function milestoneIconUri(slot: ResolvedMilestoneSlot, index: number, currentStepIndex: number): string {
    const completed = index < currentStepIndex;
    const current = index === currentStepIndex;
    if (completed || current) return slot.activeIconUrl || slot.inactiveIconUrl;
    return slot.inactiveIconUrl || slot.activeIconUrl;
}

function shouldUseHighlightedSize(
    slots: ResolvedMilestoneSlot[],
    index: number,
    currentStepIndex: number
): boolean {
    const slot = slots[index];
    if (!slot) return false;

    const hasCompletionFlags = slots.some((item) => typeof item.isCompleted === 'boolean');
    if (!hasCompletionFlags) {
        return index === currentStepIndex;
    }

    if (slot.isCompleted !== false) return false;
    const previous = slots[index - 1];
    return index === 0 || previous?.isCompleted === true;
}

export function MilestoneTracker({
    milestoneUI = null,
    currentStepIndex: currentStepProp = 0,
    onExpandedChange,
    variant = 'dock',
}: MilestoneTrackerProps) {
    const [expanded, setExpanded] = useState(false);

    const milestoneModel = useMemo(
        () => buildMilestoneUIModel(milestoneUI ?? undefined),
        [milestoneUI],
    );
    const slots = milestoneModel?.slots ?? [];
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

    if (!milestoneModel || slots.length === 0) {
        return null;
    }

    const n = slots.length;
    const connector = (stepIndex: number, axis: 'horizontal' | 'vertical') =>
        resolveMilestoneConnectorUri(milestoneModel, stepIndex, axis, safeCurrent);

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
                    // Expanded list: horizontal connector assets between rows.
                    const lineUri = connector(index, 'horizontal');
                    const iconUri = milestoneIconUri(slot, index, safeCurrent);
                    const isCurrent = index === safeCurrent;
                    const useHighlightedSize = shouldUseHighlightedSize(slots, index, safeCurrent);

                    return (
                        <View key={`m-${index}`} style={[styles.milestoneRow, isLast && styles.milestoneRowLast]}>
                            <View style={styles.milestoneLeft}>
                                <View style={styles.iconClip}>
                                    {iconUri ? (
                                        <Image
                                            source={{ uri: iconUri }}
                                            style={[
                                                styles.iconFill,
                                                useHighlightedSize && styles.iconFillHighlighted,
                                            ]}
                                            contentFit="contain"
                                        />
                                    ) : null}
                                </View>
                                {!isLast && lineUri ? (
                                    <Image
                                        source={{ uri: lineUri }}
                                        style={[styles.connectingLineImage, { height: OPEN_ROW_GAP + 8 }]}
                                        contentFit="contain"
                                        allowDownscaling={false}
                                    />
                                ) : null}
                            </View>
                            <View style={styles.milestoneContent}>
                                <Text
                                    style={[
                                        styles.milestoneTitle,
                                        slot.titleColorActive ? { color: slot.titleColorActive } : null,
                                        { opacity: isCurrent || index < safeCurrent ? 1 : 0.6 },
                                    ]}
                                >
                                    {slot.title}
                                </Text>
                                <Text
                                    style={[
                                        styles.milestoneDesc,
                                        slot.subtitleColor ? { color: slot.subtitleColor } : null,
                                    ]}
                                >
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
                        const iconUri = milestoneIconUri(slot, index, safeCurrent);
                        const useHighlightedSize = shouldUseHighlightedSize(slots, index, safeCurrent);
                        const node = (
                            <View
                                key={`nr-${index}`}
                                style={styles.nodeSlot}
                            >
                                <View style={styles.nodeImageClip}>
                                    {iconUri ? (
                                        <Image
                                            source={{ uri: iconUri }}
                                            style={[
                                                styles.nodeImageFill,
                                                useHighlightedSize && styles.nodeImageFillHighlighted,
                                            ]}
                                            contentFit="contain"
                                        />
                                    ) : null}
                                </View>
                            </View>
                        );
                        if (index >= n - 1) {
                            return [node];
                        }
                        const segIndex = index;
                        // Collapsed strip: vertical connector assets between icons.
                        const uri = connector(segIndex, 'vertical');
                        const bridge = (
                            <View key={`br-${segIndex}`} style={styles.collapsedSegmentBridge}>
                                {uri ? (
                                    <Image
                                        source={{ uri }}
                                        style={styles.collapsedBridgeGoldImg}
                                        contentFit="contain"
                                        allowDownscaling={false}
                                    />
                                ) : null}
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
        backgroundColor: 'rgba(16, 19, 35, 0.8)',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        overflow: 'hidden',
        zIndex: 10,
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
        fontSize: Fonts.LargeFontSize,
        fontFamily: Fonts.LexendBold,
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
        position: 'relative',
        zIndex: 1,
    },
    /** Expanded list: fixed box + cover; stacked above vertical connector line. */
    iconClip: {
        width: EXPANDED_NODE_FRAME,
        height: EXPANDED_NODE_FRAME,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        zIndex: 20,
        elevation: 8,
    },
    iconFill: {
        width: EXPANDED_NODE_BASE_SIZE,
        height: EXPANDED_NODE_BASE_SIZE,
        opacity: 1,
    },
    iconFillHighlighted: {
        width: EXPANDED_NODE_HIGHLIGHT_SIZE,
        height: EXPANDED_NODE_HIGHLIGHT_SIZE,
    },
    /** Collapsed track: same footprint; clip sits above horizontal segment images. */
    nodeImageClip: {
        width: COLLAPSED_NODE_FRAME,
        height: COLLAPSED_NODE_FRAME,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        zIndex: 22,
    },
    nodeImageFill: {
        width: COLLAPSED_NODE_BASE_SIZE,
        height: COLLAPSED_NODE_BASE_SIZE,
        opacity: 1,
    },
    nodeImageFillHighlighted: {
        width: COLLAPSED_NODE_HIGHLIGHT_SIZE,
        height: COLLAPSED_NODE_HIGHLIGHT_SIZE,
    },
    connectingLineImage: {
        width: VERTICAL_LINE_FRAME_WIDTH,
        position: 'absolute',
        top: 28,
        left: (MILESTONE_SLOT_WIDTH - VERTICAL_LINE_FRAME_WIDTH) / 2,
        zIndex: 2,
        elevation: 0,
    },
    milestoneContent: {
        flex: 1,
    },
    milestoneTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendRegular,
        marginBottom: 2,
        color: '#FFFFFF',
    },
    milestoneDesc: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#FFFFFF99',
    },
    card: {
        backgroundColor: 'rgba(16, 19, 35, 0.8)',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 0,
        zIndex: 10,
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
        marginBottom: 8,
    },
    collapsedHeaderEmbedded: {
        marginBottom: 4,
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
        width: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
        marginTop: 2,
    },
    collapsedTitle: {
        flex: 1,
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#FFFFFF',
    },
    collapsedTrack: {
        height: COLLAPSED_TRACK_HEIGHT,
        position: 'relative',
        zIndex: 0,
        elevation: 12,
    },
    /** Reference `.tracker`: padding `0 10px`; line + nodes share this box (HTML `::before` is inside it). */
    collapsedTrackerInner: {
        flex: 1,
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
        overflow: 'visible',
        backgroundColor: 'none',
    },
    /** PNG gradient is in the asset — use `cover` + enough height; z-index below icons (20) but above row. */
    collapsedBridgeGoldImg: {
        position: 'absolute',
        left: COLLAPSED_SEGMENT_H_GAP,
        right: COLLAPSED_SEGMENT_H_GAP,
        top: COLLAPSED_LINE_TOP_IN_BRIDGE,
        height: COLLAPSED_H_LINE_FRAME_HEIGHT,
        zIndex: 8,
        elevation: 4,
        opacity: 1,
    },
    nodeSlot: {
        width: COLLAPSED_NODE_IMAGE,
        height: COLLAPSED_NODE_IMAGE,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        zIndex: 20,
        elevation: 10,
    },
});
