import { useMilestoneInlineCartActive } from '@/context/MilestoneInlineCartContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useCartItemCount } from '@/store/cartStore';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingCartCta } from './FloatingCartCta';

interface FloatingCartButtonProps {
    showTabBar?: boolean;
    /** Extra space reserved above the tab bar (e.g. live delivery pill + home milestone strip). */
    anchorExtraOffset?: number;
    /**
     * Pixel distance from screen bottom to the top of the tab bar (bar + home indicator).
     * When set, matches TabBar `totalHeight` so the cart anchor aligns with the real bar height from config.
     */
    tabBarReserveHeight?: number;
}

const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({
    showTabBar = false,
    anchorExtraOffset = 0,
    tabBarReserveHeight,
}) => {
    const itemCount = useCartItemCount();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const { isVisible: isTabBarVisible } = useTabBarVisibility();
    const cartInMilestoneRow = useMilestoneInlineCartActive();

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const bottomOffsetAnim = useRef(new Animated.Value(0)).current;

    const TAB_BAR_HEIGHT = 60;
    const bottomInset = Math.max(insets.bottom, 0);
    const tabBarBlockHeight =
        showTabBar && tabBarReserveHeight != null && tabBarReserveHeight > 0
            ? tabBarReserveHeight
            : showTabBar
                ? TAB_BAR_HEIGHT + bottomInset
                : bottomInset;
    const isCartScreen = pathname === '/cart';
    const isPDP = pathname?.includes('/products/');

    const PDP_PADDING_TOP = 16;
    const PDP_CONTENT_HEIGHT = 48;
    const PDP_PADDING_BOTTOM = Math.max(insets.bottom, 20);
    const PDP_BORDER = 1;
    const PDP_BOTTOM_BAR_HEIGHT = PDP_PADDING_TOP + PDP_CONTENT_HEIGHT + PDP_PADDING_BOTTOM + PDP_BORDER;

    const pdpBottomOffset = PDP_BOTTOM_BAR_HEIGHT + 12;
    const baseBottomOffset = tabBarBlockHeight + (anchorExtraOffset || 0);
    const hiddenBottomOffset = isPDP ? pdpBottomOffset : bottomInset + 18;

    useEffect(() => {
        if (itemCount > 0 && !isCartScreen) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
            }).start();
        } else {
            Animated.timing(scaleAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [itemCount, isCartScreen, scaleAnim]);

    useEffect(() => {
        const targetOffset =
            showTabBar && isTabBarVisible ? baseBottomOffset : hiddenBottomOffset;
        Animated.spring(bottomOffsetAnim, {
            toValue: targetOffset,
            useNativeDriver: false,
            tension: 40,
            friction: 8,
        }).start();
    }, [isTabBarVisible, showTabBar, baseBottomOffset, hiddenBottomOffset, anchorExtraOffset, bottomOffsetAnim]);

    if (itemCount === 0 || isCartScreen) {
        return null;
    }
    if (cartInMilestoneRow) {
        return null;
    }

    return (
        <Animated.View
            style={[styles.container, { bottom: bottomOffsetAnim }]}
            pointerEvents="box-none"
        >
            <Animated.View
                style={{
                    transform: [{ scale: scaleAnim }],
                    opacity: scaleAnim,
                }}
            >
                <FloatingCartCta onPress={() => router.push('/cart' as any)} testID="floating-view-cart" />
            </Animated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10000,
        elevation: 10000,
    },
});

export default FloatingCartButton;
