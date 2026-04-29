import MilestoneTracker from '@/components/home/MilestoneTracker';
import { areAllMilestoneSlotsCompleted, buildMilestoneUIModel } from '@/components/home/milestoneUIFromConfig';
import { useMilestoneInlineCartController } from '@/context/MilestoneInlineCartContext';
import { useCartItemCount } from '@/store/cartStore';
import type { MilestoneUIConfig } from '@/types/appConfig';
import { getHomeMilestoneRowLayout } from '@/utils/homeMilestoneRowLayout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { FloatingCartCta } from './FloatingCartCta';

export type MilestoneCartRowProps = {
    milestoneUI: MilestoneUIConfig | null;
    onMilestoneExpandedChange: (expanded: boolean) => void;
    /** Not used for layout split anymore, purely for tracker state if needed. */
    isInlineWithCart: boolean;
};

/**
 * Pairs `MilestoneTracker` with the shared `View cart` CTA on Home using the same 70% / 30% split as
 * `getHomeMilestoneRowLayout`, so alignment stays in one place app-wide. 
 */
export function MilestoneCartRow({ milestoneUI, onMilestoneExpandedChange, isInlineWithCart }: MilestoneCartRowProps) {
    const { width: windowWidth } = useWindowDimensions();
    const itemCount = useCartItemCount();
    const setMilestoneInlineCartInRow = useMilestoneInlineCartController()?.setMilestoneInlineCartInRow;
    /** `MilestoneTracker` is mounted but can return `null` (dismissed / async). */
    const [stripPaints, setStripPaints] = useState(false);
    const onStripPresenceChange = useCallback((visible: boolean) => {
        setStripPaints(visible);
    }, []);

    const isAllDoneFromConfig = useMemo(() => milestoneUI ? areAllMilestoneSlotsCompleted(milestoneUI) : false, [milestoneUI]);

    const [isCelebrationSeen, setIsCelebrationSeen] = useState<boolean | null>(null);
    useEffect(() => {
        const check = async () => {
            const val = await AsyncStorage.getItem('milestone_all_done_home_strip_seen_v1');
            setIsCelebrationSeen(val === 'true');
        };
        check();
    }, []);

    const hasMilestone = useMemo(() => {
        const model = buildMilestoneUIModel(milestoneUI ?? undefined);
        return Boolean(model && (model.slots?.length ?? 0) > 0);
    }, [milestoneUI]);

    // Show inline only if milestones exist AND they aren't all finished
    const isFinished = isAllDoneFromConfig || isCelebrationSeen === true;
    const showInline = Boolean(itemCount > 0 && hasMilestone && !isFinished && isInlineWithCart);

    useEffect(() => {
        if (!hasMilestone || isFinished) {
            setStripPaints(false);
        }
    }, [hasMilestone, isFinished]);
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


    if (!hasMilestone || isFinished) {
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
                    onStripPresenceChange={onStripPresenceChange}
                />
            </View>
            {showInline ? (
                <View
                    style={[
                        styles.cartCol,
                        { width: rowLayout.cartColumnWidth, marginRight: rowLayout.sideInset },
                    ]}
                >
                    <FloatingCartCta inMilestoneRow testID="milestone-row-view-cart" />
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
