import { MilestoneCartRow } from '@/components/ui/MilestoneCartRow';
import { useMilestoneDock } from '@/context/MilestoneDockContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { configService } from '@/services/configService';
import type { MilestoneUIConfig } from '@/types/appConfig';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type MilestoneDockAnchorMode = 'tabBar' | 'safeAreaOnly';

export type MilestoneTabDockProps = {
    milestoneUI: MilestoneUIConfig | null;
    /** When false, the strip is hidden and dock height is cleared (e.g. Home welcome modal). */
    visible: boolean;
    onMilestoneExpandedChange: (expanded: boolean) => void;
    isInlineWithCart: boolean;
    /**
     * `tabBar`: Home / Category — anchor above tab bar, moves with tab-bar hide-on-scroll.
     * `safeAreaOnly`: Full-screen stack routes (e.g. collection grid) — above home indicator only.
     */
    anchorMode: MilestoneDockAnchorMode;
};

/**
 * Bottom milestone strip + optional inline cart CTA; reports height for `TabBar` / `FloatingCartButton` spacing.
 */
export function MilestoneTabDock({
    milestoneUI,
    visible,
    onMilestoneExpandedChange,
    isInlineWithCart,
    anchorMode,
}: MilestoneTabDockProps) {
    const insets = useSafeAreaInsets();
    const { setMilestoneDockHeight } = useMilestoneDock();
    const { isVisible: isTabBarVisible } = useTabBarVisibility();

    const tabBarStackBottom = useMemo(() => {
        const tabBarHeight = configService.getTabBarConfig()?.styles?.height ?? 60;
        return Math.max(insets.bottom, 0) + tabBarHeight;
    }, [insets.bottom]);

    const milestoneDockWhenTabHidden = useMemo(() => Math.max(insets.bottom, 0) + 4, [insets.bottom]);
    const safeAreaOnlyBottom = useMemo(() => Math.max(insets.bottom, 0) + 8, [insets.bottom]);

    const bottomAnim = useRef(new Animated.Value(tabBarStackBottom)).current;
    const tabBarAnimDidMount = useRef(false);

    useEffect(() => {
        if (anchorMode === 'safeAreaOnly') {
            bottomAnim.setValue(safeAreaOnlyBottom);
            return;
        }
        const to = isTabBarVisible ? tabBarStackBottom : milestoneDockWhenTabHidden;
        if (!tabBarAnimDidMount.current) {
            tabBarAnimDidMount.current = true;
            bottomAnim.setValue(to);
            return;
        }
        bottomAnim.setValue(to);
    }, [
        anchorMode,
        isTabBarVisible,
        tabBarStackBottom,
        milestoneDockWhenTabHidden,
        safeAreaOnlyBottom,
        bottomAnim,
    ]);

    useFocusEffect(
        useCallback(() => {
            return () => setMilestoneDockHeight(0);
        }, [setMilestoneDockHeight])
    );

    useEffect(() => {
        if (!visible) {
            setMilestoneDockHeight(0);
        }
    }, [visible, setMilestoneDockHeight]);

    const onDockLayout = useCallback(
        (e: LayoutChangeEvent) => {
            if (!visible) return;
            setMilestoneDockHeight(e.nativeEvent.layout.height);
        },
        [visible, setMilestoneDockHeight]
    );

    if (!visible) {
        return null;
    }

    return (
        <Animated.View
            style={[styles.milestoneDock, { bottom: bottomAnim }]}
            pointerEvents="box-none"
            onLayout={onDockLayout}
        >
            <MilestoneCartRow
                milestoneUI={milestoneUI}
                onMilestoneExpandedChange={onMilestoneExpandedChange}
                isInlineWithCart={isInlineWithCart}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    milestoneDock: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10000,
        elevation: 10000,
    },
});
