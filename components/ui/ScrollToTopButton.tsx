import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Colors } from '@/constants/theme';

const TAB_BAR_HEIGHT = 60;

interface ScrollToTopButtonProps {
    visible: boolean;
    onPress: () => void;
    bottomOffset?: number;
}

export const ScrollToTopButton = ({
    visible,
    onPress,
    bottomOffset = 80,
}: ScrollToTopButtonProps) => {
    const insets = useSafeAreaInsets();
    const { isVisible: isTabBarVisible } = useTabBarVisibility();

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    const bottomInset = Math.max(insets.bottom, 0);
    const baseBottomOffset = TAB_BAR_HEIGHT + bottomInset + 18;
    const hiddenBottomOffset = bottomInset + 18;
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
    }, [isTabBarVisible, baseBottomOffset, hiddenBottomOffset]);

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
