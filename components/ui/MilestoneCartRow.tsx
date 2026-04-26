import MilestoneTracker from '@/components/home/MilestoneTracker';
import { buildMilestoneUIModel } from '@/components/home/milestoneUIFromConfig';
import { useMilestoneInlineCartController } from '@/context/MilestoneInlineCartContext';
import type { MilestoneUIConfig } from '@/types/appConfig';
import { getHomeMilestoneRowLayout } from '@/utils/homeMilestoneRowLayout';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FloatingCartCta } from './FloatingCartCta';

export type MilestoneCartRowProps = {
    milestoneUI: MilestoneUIConfig | null;
    onMilestoneExpandedChange: (expanded: boolean) => void;
    /** `cart has items` && `!milestone expanded` (same as `isInlineCartVisible` on Home). */
    isInlineWithCart: boolean;
};

/**
 * Pairs `MilestoneTracker` with the shared `View cart` CTA on Home using the same 70% / 30% split as
 * `getHomeMilestoneRowLayout`, so alignment stays in one place app-wide. When this row is active, the
 * context tells `FloatingCartButton` not to render (avoids a duplicate CTA).
 */
export function MilestoneCartRow({ milestoneUI, onMilestoneExpandedChange, isInlineWithCart }: MilestoneCartRowProps) {
    const { width: windowWidth } = useWindowDimensions();
    const setMilestoneInlineCartInRow = useMilestoneInlineCartController()?.setMilestoneInlineCartInRow;
    const scaleAnim = useRef(new Animated.Value(0)).current;

    const hasMilestone = useMemo(() => {
        const model = buildMilestoneUIModel(milestoneUI ?? undefined);
        return Boolean(model && (model.slots?.length ?? 0) > 0);
    }, [milestoneUI]);

    const showInline = Boolean(isInlineWithCart && hasMilestone);
    const rowLayout = useMemo(() => getHomeMilestoneRowLayout(windowWidth), [windowWidth]);

    useEffect(() => {
        if (!setMilestoneInlineCartInRow) {
            return;
        }
        if (showInline) {
            setMilestoneInlineCartInRow(true);
        } else {
            setMilestoneInlineCartInRow(false);
        }
        return () => setMilestoneInlineCartInRow(false);
    }, [showInline, setMilestoneInlineCartInRow]);

    // Match `FloatingCartButton` entrance when the CTA is inside this row
    useEffect(() => {
        if (!showInline) {
            return;
        }
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
        }).start();
    }, [showInline, scaleAnim]);

    useEffect(() => {
        if (showInline) {
            return;
        }
        scaleAnim.setValue(0);
    }, [showInline, scaleAnim]);

    if (!hasMilestone) {
        return null;
    }

    /**
     * One stable tree: `MilestoneTracker` must stay under the same `milestoneCol` parent. If we swap
     * to a different branch when `showInline` flips (e.g. expand opens modal, `isInlineWithCart` false),
     * React remounts the tracker, resets `expanded` to false, and the modal never appears.
     */
    return (
        <View style={styles.splitRow} pointerEvents="box-none">
            <View
                style={[
                    styles.milestoneCol,
                    showInline
                        ? {
                              width: rowLayout.milestoneWidth,
                              marginLeft: rowLayout.sideInset,
                              marginRight: rowLayout.gap,
                          }
                        : {
                              flex: 1,
                              minWidth: 0,
                              marginLeft: rowLayout.sideInset,
                              marginRight: rowLayout.sideInset,
                          },
                ]}
                pointerEvents="box-none"
            >
                <MilestoneTracker
                    milestoneUI={milestoneUI}
                    onExpandedChange={onMilestoneExpandedChange}
                    inlineInCartRow={showInline}
                />
            </View>
            {showInline ? (
                <View
                    style={[
                        styles.cartCol,
                        { width: rowLayout.cartColumnWidth, marginRight: rowLayout.sideInset },
                    ]}
                >
                    <Animated.View
                        style={{
                            transform: [{ scale: scaleAnim }],
                            opacity: scaleAnim,
                            alignSelf: 'stretch',
                        }}
                    >
                        <FloatingCartCta inMilestoneRow testID="milestone-row-view-cart" />
                    </Animated.View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    splitRow: {
        flexDirection: 'row',
        width: '100%',
        alignItems: 'flex-start',
    },
    milestoneCol: {
        minWidth: 0,
    },
    cartCol: {
        minWidth: 0,
    },
});
