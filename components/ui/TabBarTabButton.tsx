import { triggerTabPressHaptic } from '@/components/haptic-tab';
import { Fonts } from '@/constants/theme';
import {
    computeTabBarLensFromSharedValues,
    LensPresetParams,
} from '@/utils/tabBarLensMath';
import React, { useEffect } from 'react';
import {
    AccessibilityRole,
    Platform,
    Pressable,
    StyleSheet,
    View
} from 'react-native';
import Reanimated, {
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';

type TabBarTabButtonProps = {
    isFocused: boolean;
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
    scrollProgress: SharedValue<number>; // 0 = fully visible, 1 = fully shrunk
    accessibilityRole?: AccessibilityRole;
    accessibilityState?: { selected?: boolean };
    accessibilityLabel?: string;
    testID?: string;
    onPress: () => void;
    onPressIn?: () => void;
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

// Snappy spring config for Android tab transitions — runs entirely on the UI thread.
const ANDROID_ICON_SPRING = { damping: 18, stiffness: 280, mass: 0.6 };
const ANDROID_LABEL_SPRING = { damping: 20, stiffness: 280, mass: 0.6 };

export function TabBarTabButton({
    isFocused,
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
    scrollProgress,
    icon,
    label,
    onPress,
    onPressIn,
    onLongPress,
    onLayout,
    onIconLayout,
    accessibilityRole,
    accessibilityState,
    accessibilityLabel,
    testID,
}: TabBarTabButtonProps) {
    const { maxScale, minScaleY, skew, pull, rotate, fadeTravelPx } = lensPreset;

    // SharedValue mirror of `isFocused` — lets animations run 100% on the UI thread
    // without waiting for a JS-side re-render to cross the bridge.
    const focusedSV = useSharedValue(isFocused ? 1 : 0);
    useEffect(() => {
        focusedSV.value = isFocused ? 1 : 0;
    }, [isFocused, focusedSV]);

    const iconLensStyle = useAnimatedStyle(() => {
        if (Platform.OS === 'android') {
            const focused = focusedSV.value;
            return {
                opacity: withTiming(focused > 0.5 ? 1 : 0.75, { duration: 120 }),
            };
        }

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

        // Move icon down when label fades out to center it vertically in pill
        // Label height is 18px + 4px gap = 22px, move down by half (~11px)
        const translateY = scrollProgress.value * 11;
        const lensTransform = buildLensTransform(lens, 1);
        
        return {
            transform: [
                { translateY },
                ...lensTransform
            ],
        };
    }, [maxScale, minScaleY, skew, pull, rotate, fadeTravelPx, focusedSV, scrollProgress]);

    const labelLensStyle = useAnimatedStyle(() => {
        if (Platform.OS === 'android') {
            const focused = focusedSV.value;
            return {
                opacity: withTiming(focused > 0.5 ? 1 : 0.65, { duration: 120 }),
            };
        }

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
            opacity: 1 - scrollProgress.value, // Hide label when scrolled
        };
    }, [maxScale, minScaleY, skew, pull, rotate, fadeTravelPx, focusedSV, scrollProgress]);

    return (
        <Pressable
            accessibilityRole={accessibilityRole}
            accessibilityState={accessibilityState}
            accessibilityLabel={accessibilityLabel}
            testID={testID}
            onPressIn={(e) => {
                triggerTabPressHaptic();
                onPressIn?.();
            }}
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
                        style={[styles.tabLabel, labelLensStyle, { color: isFocused ? '#1A1A1A' : 'rgba(0, 0, 0, 0.5)' }]}
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
        width: 24,
        height: 24,
        overflow: 'visible',
    },
    tabLabel: {
        fontSize: 12,
        lineHeight: 18,
        fontFamily: Fonts.LexendSemiBold,
        fontWeight: '600',
        color: '#1A1A1A',
        textAlign: 'center',
        width: '100%',
    },
});
