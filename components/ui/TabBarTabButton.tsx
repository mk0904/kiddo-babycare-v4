import { Fonts } from '@/constants/theme';
import {
    computeTabBarLensFromSharedValues,
    LensPresetParams,
} from '@/utils/tabBarLensMath';
import React from 'react';
import {
    AccessibilityRole,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Reanimated, {
    SharedValue,
    useAnimatedStyle,
} from 'react-native-reanimated';

type TabBarTabButtonProps = {
    tabSlotX: SharedValue<number>;
    tabSlotWidth: SharedValue<number>;
    tabIconCenterX: SharedValue<number>;
    indicatorX: SharedValue<number>;
    indicatorWidth: SharedValue<number>;
    indicatorTop: SharedValue<number>;
    indicatorHeight: SharedValue<number>;
    barHeight: SharedValue<number>;
    indicatorTargetX: SharedValue<number>;
    indicatorStartX: SharedValue<number>;
    pillDragging: SharedValue<number>;
    lensPreset: LensPresetParams;
    accessibilityRole?: AccessibilityRole;
    accessibilityState?: { selected?: boolean };
    accessibilityLabel?: string;
    testID?: string;
    onPress: () => void;
    onLongPress: () => void;
    onLayout: (event: {
        nativeEvent: { layout: { x: number; width: number } };
    }) => void;
    onIconLayout: (event: {
        nativeEvent: { layout: { x: number; width: number } };
    }) => void;
    icon: React.ReactNode;
    label: string;
};

function buildLensTransform(
    lens: ReturnType<typeof computeTabBarLensFromSharedValues>,
    strength: number
) {
    'worklet';
    const s = strength;
    return [
        { translateX: lens.pullX * s },
        { translateY: lens.pullY * s },
        { rotate: `${lens.rotate * s}rad` },
        { skewX: `${lens.skewX * s}rad` },
        { skewY: `${lens.skewY * s}rad` },
        { scaleX: 1 + (lens.scaleX - 1) * s },
        { scaleY: 1 - (1 - lens.scaleY) * s },
    ];
}

export function TabBarTabButton({
    tabSlotX,
    tabSlotWidth,
    tabIconCenterX,
    indicatorX,
    indicatorWidth,
    indicatorTop,
    indicatorHeight,
    barHeight,
    indicatorTargetX,
    indicatorStartX,
    pillDragging,
    lensPreset,
    icon,
    label,
    onPress,
    onLongPress,
    onLayout,
    onIconLayout,
    accessibilityRole,
    accessibilityState,
    accessibilityLabel,
    testID,
}: TabBarTabButtonProps) {
    const { maxScale, minScaleY, skew, pull, rotate, fadeTravelPx } = lensPreset;

    const iconLensStyle = useAnimatedStyle(() => {
        const lens = computeTabBarLensFromSharedValues(
            tabSlotX,
            tabSlotWidth,
            tabIconCenterX,
            indicatorX,
            indicatorWidth,
            indicatorTop,
            indicatorHeight,
            barHeight,
            indicatorTargetX,
            indicatorStartX,
            pillDragging,
            maxScale,
            minScaleY,
            skew,
            pull,
            rotate,
            fadeTravelPx
        );

        return {
            transform: buildLensTransform(lens, 1),
        };
    }, [maxScale, minScaleY, skew, pull, rotate, fadeTravelPx]);

    const labelLensStyle = useAnimatedStyle(() => {
        const lens = computeTabBarLensFromSharedValues(
            tabSlotX,
            tabSlotWidth,
            tabIconCenterX,
            indicatorX,
            indicatorWidth,
            indicatorTop,
            indicatorHeight,
            barHeight,
            indicatorTargetX,
            indicatorStartX,
            pillDragging,
            maxScale,
            minScaleY,
            skew,
            pull,
            rotate,
            fadeTravelPx
        );

        return {
            transform: buildLensTransform(lens, 0.72),
        };
    }, [maxScale, minScaleY, skew, pull, rotate, fadeTravelPx]);

    return (
        <Pressable
            accessibilityRole={accessibilityRole}
            accessibilityState={accessibilityState}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            onPress={onPress}
            onLongPress={onLongPress}
            onLayout={onLayout}
            style={styles.tabItemOuter}
            hitSlop={4}
        >
            <View style={styles.tabItem} pointerEvents="none">
                <Reanimated.View style={[styles.tabItemContent, iconLensStyle]}>
                    <View style={styles.iconWrap} onLayout={onIconLayout}>
                        {icon}
                    </View>
                    <Reanimated.Text
                        style={[styles.tabLabel, labelLensStyle]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.85}
                    >
                        {label}
                    </Reanimated.Text>
                </Reanimated.View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    tabItemOuter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    tabItemContent: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        width: '100%',
        paddingHorizontal: 2,
        overflow: 'visible',
    },
    iconWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        overflow: 'visible',
    },
    tabLabel: {
        fontSize: 12,
        lineHeight: 18,
        fontFamily: Fonts.LexendSemiBold,
        fontWeight: '600',
        color: '#FAFAFA',
        textAlign: 'center',
        width: '100%',
    },
});
