import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Colors } from '@/constants/theme';

const TAB_BAR_HEIGHT = 60;
/** `FloatingCartButton` pill is 52px; this control is 48px — nudge `bottom` so vertical centers line up. */
const CENTER_MATCH_NUDGE = 2;

interface ScrollToTopButtonProps {
    visible: boolean;
    onPress: () => void;
    /**
     * Tab bar row + home indicator (`TabBar` `totalHeight` / `FloatingCartButton` `tabBarReserveHeight`).
     * When omitted, uses `TAB_BAR_HEIGHT` + safe-area bottom (may drift if tab bar height is configured).
     */
    tabBarReserveHeight?: number;
    /** Same stacking lift as View cart: live-delivery stack + home milestone reserve. */
    anchorExtraOffset?: number;
}

export const ScrollToTopButton = ({
    visible,
    onPress,
    tabBarReserveHeight,
    anchorExtraOffset = 0,
}: ScrollToTopButtonProps) => {
    const insets = useSafeAreaInsets();
    const { isVisible: isTabBarVisible } = useTabBarVisibility();

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const bottomInset = Math.max(insets.bottom, 0);
    const tabBarBlockHeight =
        tabBarReserveHeight != null && tabBarReserveHeight > 0
            ? tabBarReserveHeight
            : TAB_BAR_HEIGHT + bottomInset;
    const baseBottomOffset = tabBarBlockHeight + 18 + anchorExtraOffset + CENTER_MATCH_NUDGE;
    const hiddenBottomOffset = bottomInset + 18 + CENTER_MATCH_NUDGE;
    const bottomOffsetAnim = useRef(new Animated.Value(baseBottomOffset)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: visible ? 1 : 0,
                useNativeDriver: false,
                tension: 50,
                friction: 7,
            }),
            Animated.timing(opacityAnim, {
                toValue: visible ? 1 : 0,
                duration: 200,
                useNativeDriver: false,
            }),
        ]).start();
    }, [visible]);

    useEffect(() => {
        const targetOffset = isTabBarVisible ? baseBottomOffset : hiddenBottomOffset;
        Animated.spring(bottomOffsetAnim, {
            toValue: targetOffset,
            useNativeDriver: false,
            tension: 40,
            friction: 8,
        }).start();
    }, [isTabBarVisible, baseBottomOffset, hiddenBottomOffset, anchorExtraOffset, tabBarReserveHeight]);

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    bottom: bottomOffsetAnim,
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                },
            ]}
            pointerEvents={visible ? 'auto' : 'none'}
        >
            <TouchableOpacity
                style={styles.button}
                onPress={onPress}
                activeOpacity={0.8}
            >
                <Ionicons name="chevron-up" size={24} color="#2C6975" />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 16,
        zIndex: 999,
    },
    button: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(44, 105, 117, 0.2)',
        ...Platform.select({
            ios: {
                shadowColor: '#2C6975',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
            },
            android: {
                elevation: 6,
            },
        }),
    },
});

export default ScrollToTopButton;
