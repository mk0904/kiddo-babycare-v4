import AccountNewIcon from '@/assets/icons/account-new.svg';
import CategoriesNewIcon from '@/assets/icons/categories-new.svg';
import HomeNewIcon from '@/assets/icons/home-new.svg';
import TicketingNewIcon from '@/assets/icons/ticketing-new.svg';
import WishlistBoxNewIcon from '@/assets/icons/wishlist-box-new.svg';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import { GlassPillSurface } from '@/components/ui/GlassPillSurface';
import { LiveDeliveryTabBanner } from '@/components/ui/LiveDeliveryTabBanner';
import { TabBarTabButton } from '@/components/ui/TabBarTabButton';
import { Fonts } from '@/constants/theme';
import { useLiveDeliveryStackOffset } from '@/context/LiveDeliveryStackOffsetContext';
import { useMilestoneDockHeightSafe } from '@/context/MilestoneDockContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { configService } from '@/services/configService';
import { TabBarConfig } from '@/types/tabBarTypes';
import {
    GLASS_PILL_TEXT_COLOR,
    MILESTONE_NAV_GAP
} from '@/utils/tabBarLayout';
import { resolveLensPreset } from '@/utils/tabBarLensMath';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { GlassContainer, GlassView } from 'expo-glass-effect';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    Platform,
    StyleSheet,
    View,
    useWindowDimensions
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useDerivedValue,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAV_BAR_WIDTH = 368;
const NAV_BAR_HEIGHT = 60;
/** Same gap on all sides between outer nav bar and inner active pill. */
const PILL_OUTER_INSET = 2;
const LABEL_COLOR = GLASS_PILL_TEXT_COLOR;
const TAB_ITEM_CONTENT_PADDING = 0;
const FLOATING_BOTTOM_MARGIN = -10;
const TAB_ICON_LABEL_GAP = 3;
const TAB_LABEL_LINE_HEIGHT = 14;
const TAB_ICON_SIZE = 14;
const TAB_CONTENT_HEIGHT = TAB_ICON_SIZE + TAB_ICON_LABEL_GAP + TAB_LABEL_LINE_HEIGHT;

function getNavBarBorderRadius(barHeight: number) {
    return barHeight / 2;
}

function getIndicatorBorderRadius(pillHeight: number) {
    return pillHeight / 2;
}

function getIndicatorVerticalMetrics(barHeight: number) {
    const height = barHeight - PILL_OUTER_INSET * 2;
    const top = PILL_OUTER_INSET;
    const borderRadius = getIndicatorBorderRadius(height);
    return { top, height, borderRadius };
}

function getIndicatorMetrics(layout: TabLayout, barHeight: number) {
    const { top, height, borderRadius } = getIndicatorVerticalMetrics(barHeight);
    // Always respect PILL_OUTER_INSET — a min-width floor makes sides look tighter than top/bottom.
    const width = Math.max(0, layout.width - PILL_OUTER_INSET * 2);
    const centerX = getTabIconCenterX(layout);
    return {
        x: centerX - width / 2,
        width,
        top,
        height,
        borderRadius,
    };
}

/** Pill stretches while sliding for the liquid-glass droplet effect. */
const TRAVEL_OVERFLOW = 10;
const GLASS_CONTAINER_SPACING = 8;
const SLIDE_SPRING = { damping: 26, stiffness: 320, mass: 0.72 };
const POP_SPRING = { damping: 16, stiffness: 280, mass: 0.65 };
const TRAVEL_HOLD_MS = 80;
const PILL_DRAG_LONG_PRESS_MS = 220;

function clampValue(value: number, min: number, max: number) {
    'worklet';
    return Math.min(max, Math.max(min, value));
}

const SCREENS_WITH_TAB_BAR = ['index', 'category', 'ticketing', 'account'];

type TabIconComponent = React.ComponentType<{ width?: number; height?: number; color?: string; isFocused?: boolean }>;

const TAB_ICONS: Record<string, TabIconComponent> = {
    index: ({ color }) => (
        <View style={{ width: 24, height: 24, position: 'relative' }}>
            <HomeNewIcon width={18} height={18.733} color={color} style={{ position: 'absolute', top: 2.27, left: 3 }} />
        </View>
    ),
    category: ({ color }) => (
        <View style={{ width: 24, height: 24, position: 'relative' }}>
            <CategoriesNewIcon width={18} height={18.733} color={color} style={{ position: 'absolute', top: 2.27, left: 3 }} />
        </View>
    ),
    ticketing: ({ color }) => (
        <View style={{ width: 24, height: 24, position: 'relative' }}>
            <TicketingNewIcon width={18} height={18.733} color={color} style={{ position: 'absolute', top: 2.27, left: 3 }} />
        </View>
    ),
    wishlist: ({ color }) => (
        <View style={{ width: 24, height: 24, position: 'relative' }}>
            <WishlistBoxNewIcon width={18} height={18.733} color={color} style={{ position: 'absolute', top: 2.27, left: 3 }} />
        </View>
    ),
    account: ({ color }) => (
        <View style={{ width: 24, height: 24, position: 'relative' }}>
            <AccountNewIcon width={18} height={18.733} color={color} style={{ position: 'absolute', top: 2.27, left: 3 }} />
        </View>
    ),
};

const DEFAULT_TAB_LABELS: Record<string, string> = {
    index: 'Home',
    category: 'Categories',
    ticketing: 'Tickets',
    wishlist: 'Wishlist',
    account: 'Account',
};

type TabLayout = { x: number; width: number; iconCenterOffset?: number };

function getTabIconCenterX(layout: TabLayout) {
    const offset =
        layout.iconCenterOffset != null
            ? layout.iconCenterOffset
            : layout.width / 2;
    return layout.x + offset;
}

function getIndicatorRestMetrics(barHeight: number) {
    return getIndicatorVerticalMetrics(barHeight);
}

function getIndicatorTravelMetrics(barHeight: number) {
    const rest = getIndicatorRestMetrics(barHeight);
    return {
        top: rest.top - TRAVEL_OVERFLOW,
        height: rest.height + TRAVEL_OVERFLOW * 2,
    };
}

type GlassShapeProps = {
    borderRadius?: number;
    borderCurve?: 'continuous' | 'circular';
};

function glassShapeProps(radius: number): GlassShapeProps {
    return { borderRadius: radius, borderCurve: 'continuous' };
}

const AnimatedGlassView = Reanimated.createAnimatedComponent(GlassView);

export const TabBar = (props: BottomTabBarProps) => {
    const insets = useSafeAreaInsets();
    const { width: windowWidth } = useWindowDimensions();
    const { isVisible, scrollProgress } = useTabBarVisibility();
    const translateY = useRef(new Animated.Value(0)).current;

    const indicatorX = useSharedValue(0);
    const indicatorWidth = useSharedValue(0);
    const restMetrics = getIndicatorVerticalMetrics(NAV_BAR_HEIGHT);
    const indicatorTop = useSharedValue(restMetrics.top);
    const indicatorHeight = useSharedValue(restMetrics.height);
    const indicatorBorderRadius = useSharedValue(restMetrics.borderRadius);
    const indicatorTargetX = useSharedValue(0);
    const indicatorStartX = useSharedValue(0);
    const pillDragging = useSharedValue(0);
    const dragOriginX = useSharedValue(0);
    const dragMinX = useSharedValue(0);
    const dragMaxX = useSharedValue(0);
    const navPopX = useSharedValue(1);
    const navPopY = useSharedValue(1);
    const barHeightSv = useSharedValue(NAV_BAR_HEIGHT);
    const scrollProgressSv = useSharedValue(0);
    const smoothScrollProgress = useSharedValue(0);
    const tabSlot0X = useSharedValue(0);
    const tabSlot0W = useSharedValue(0);
    const tabSlot1X = useSharedValue(0);
    const tabSlot1W = useSharedValue(0);
    const tabSlot2X = useSharedValue(0);
    const tabSlot2W = useSharedValue(0);
    const tabSlot3X = useSharedValue(0);
    const tabSlot3W = useSharedValue(0);
    const tabIcon0Cx = useSharedValue(0);
    const tabIcon1Cx = useSharedValue(0);
    const tabIcon2Cx = useSharedValue(0);
    const tabIcon3Cx = useSharedValue(0);
    const tabSlots = useMemo(
        () => [
            { x: tabSlot0X, w: tabSlot0W, iconCx: tabIcon0Cx },
            { x: tabSlot1X, w: tabSlot1W, iconCx: tabIcon1Cx },
            { x: tabSlot2X, w: tabSlot2W, iconCx: tabIcon2Cx },
            { x: tabSlot3X, w: tabSlot3W, iconCx: tabIcon3Cx },
        ],
        [
            tabSlot0X, tabSlot0W, tabIcon0Cx,
            tabSlot1X, tabSlot1W, tabIcon1Cx,
            tabSlot2X, tabSlot2W, tabIcon2Cx,
            tabSlot3X, tabSlot3W, tabIcon3Cx,
        ]
    );

    const tabLayouts = useRef<Record<number, TabLayout>>({});
    const prevActiveIndexRef = useRef<number | null>(null);
    const isPillDraggingRef = useRef(false);
    const [indicatorReady, setIndicatorReady] = React.useState(false);

    const [tabBarConfig, setTabBarConfig] = React.useState<TabBarConfig | null>(
        configService.getTabBarConfig()
    );

    useEffect(() => {
        const syncTabBarConfig = () => {
            setTabBarConfig(configService.getTabBarConfig());
        };
        syncTabBarConfig();
        const unsubscribe = configService.subscribe(() => {
            syncTabBarConfig();
        });
        return unsubscribe;
    }, []);

    const stylesConfig = tabBarConfig?.styles || {};
    const lensPreset = useMemo(
        () => resolveLensPreset(stylesConfig.lensPreset),
        [stylesConfig.lensPreset]
    );

    useEffect(() => {
        if (!__DEV__) return;
        console.warn(
            `[KIDDO] TabBar lens: ${stylesConfig.lensPreset ?? 'apple (default)'} (maxScale=${lensPreset.maxScale})`
        );
    }, [stylesConfig.lensPreset, lensPreset.maxScale]);

    const tabBarHeight = stylesConfig.height || NAV_BAR_HEIGHT;
    const bottomInset = Math.max(insets.bottom, 0);

    useEffect(() => {
        barHeightSv.value = tabBarHeight;
    }, [barHeightSv, tabBarHeight]);
    const totalHeight = tabBarHeight + FLOATING_BOTTOM_MARGIN + bottomInset;
    const pillWidth = Math.min(NAV_BAR_WIDTH, windowWidth - 32);

    const { stackExtraPx: liveDeliveryStackExtra, setStackExtraPx: setLiveDeliveryStackExtra } =
        useLiveDeliveryStackOffset();

    const visibleTabs = useMemo(() => {
        return tabBarConfig?.visibleTabs || SCREENS_WITH_TAB_BAR;
    }, [tabBarConfig]);

    const shouldShowTabBar = useMemo(() => {
        try {
            const { state } = props;
            if (!state || !state.routes || state.index === undefined) {
                return false;
            }
            const activeTab = state.routes[state.index];
            const activeTabName = activeTab?.name;
            return visibleTabs.includes(activeTabName);
        } catch {
            return false;
        }
    }, [props.state, visibleTabs]);

    // Always show the tab bar when it should be visible - shrink instead of hide
    const isTabBarVisible = shouldShowTabBar;

    const milestoneDockHeight = useMilestoneDockHeightSafe();
    const isMilestoneCollapsed = milestoneDockHeight > 0 && milestoneDockHeight < 120;
    const milestoneStripReserveForStack =
        shouldShowTabBar && isMilestoneCollapsed
            ? Math.max(milestoneDockHeight, 0) + MILESTONE_NAV_GAP
            : 0;
    const milestoneReserveForCart =
        shouldShowTabBar && isMilestoneCollapsed
            ? milestoneStripReserveForStack + 4
            : 0;

    useEffect(() => {
        // Disable translateY animation - navbar should shrink in place, not slide down
        translateY.setValue(0);
    }, [translateY]);

    useEffect(() => {
        scrollProgressSv.value = scrollProgress;
    }, [scrollProgress, scrollProgressSv]);

    // Smooth scroll progress using useDerivedValue
    const smoothProgress = useDerivedValue(() => {
        return withTiming(scrollProgressSv.value, {
            duration: 200,
        });
    });

    const activeVisibleIndex = useMemo(() => {
        const activeRoute = props.state.routes[props.state.index];
        const name = activeRoute?.name;
        const idx = visibleTabs.indexOf(name);
        return idx >= 0 ? idx : 0;
    }, [props.state.index, props.state.routes, visibleTabs]);

    const setIndicatorPosition = (index: number) => {
        const layout = tabLayouts.current[index];
        if (!layout) return;
        const metrics = getIndicatorMetrics(layout, tabBarHeight);
        indicatorX.value = metrics.x;
        indicatorWidth.value = metrics.width;
        indicatorTop.value = metrics.top;
        indicatorHeight.value = metrics.height;
        indicatorBorderRadius.value = metrics.borderRadius;
        indicatorTargetX.value = metrics.x;
        indicatorStartX.value = metrics.x;
    };

    const playNavPopAnimation = () => {
        if (Platform.OS === 'android') return; // Disable full-bar scaling on Android to eliminate blur flicker!
        navPopX.value = withSequence(
            withTiming(1.05, { duration: 140, easing: Easing.out(Easing.cubic) }),
            withSpring(1, POP_SPRING)
        );
        navPopY.value = withSequence(
            withTiming(1.08, { duration: 140, easing: Easing.out(Easing.cubic) }),
            withSpring(1, POP_SPRING)
        );
    };

    const playTravelIndicatorAnimation = () => {
        if (Platform.OS === 'android') return;

        const travel = getIndicatorTravelMetrics(tabBarHeight);
        const rest = getIndicatorRestMetrics(tabBarHeight);

        indicatorTop.value = withSequence(
            withTiming(travel.top, { duration: 120, easing: Easing.out(Easing.cubic) }),
            withTiming(travel.top, { duration: TRAVEL_HOLD_MS }),
            withSpring(rest.top, POP_SPRING)
        );
        indicatorHeight.value = withSequence(
            withTiming(travel.height, { duration: 120, easing: Easing.out(Easing.cubic) }),
            withTiming(travel.height, { duration: TRAVEL_HOLD_MS }),
            withSpring(rest.height, POP_SPRING)
        );
        indicatorBorderRadius.value = withSequence(
            withTiming(getIndicatorBorderRadius(travel.height), { duration: 120, easing: Easing.out(Easing.cubic) }),
            withTiming(getIndicatorBorderRadius(travel.height), { duration: TRAVEL_HOLD_MS }),
            withSpring(rest.borderRadius, POP_SPRING)
        );
    };

    const animateToTab = useCallback((index: number) => {
        const layout = tabLayouts.current[index];
        if (!layout) return;

        const metrics = getIndicatorMetrics(layout, tabBarHeight);
        indicatorStartX.value = indicatorX.value;
        indicatorTargetX.value = metrics.x;
        playNavPopAnimation();
        playTravelIndicatorAnimation();

        if (Platform.OS === 'android') {
            indicatorX.value = withSpring(metrics.x, SLIDE_SPRING);
            indicatorWidth.value = metrics.width; // Snap width instantly on Android to avoid layout thrashing
        } else {
            indicatorX.value = withSpring(metrics.x, SLIDE_SPRING);
            indicatorWidth.value = withSpring(metrics.width, SLIDE_SPRING);
        }
    }, [indicatorBorderRadius, indicatorHeight, indicatorStartX, indicatorTargetX, indicatorTop, indicatorWidth, indicatorX, navPopX, navPopY, tabBarHeight]);

    const updateDragBounds = useCallback(() => {
        const lastIdx = visibleTabs.length - 1;
        const first = tabLayouts.current[0];
        const last = tabLayouts.current[lastIdx];
        if (!first || !last) return;

        dragMinX.value = getIndicatorMetrics(first, tabBarHeight).x;
        dragMaxX.value = getIndicatorMetrics(last, tabBarHeight).x;
    }, [dragMaxX, dragMinX, tabBarHeight, visibleTabs.length]);

    const setPillDragging = useCallback((dragging: boolean) => {
        isPillDraggingRef.current = dragging;
    }, []);

    const finishPillDrag = useCallback(
        (pillX: number) => {
            isPillDraggingRef.current = false;

            let nearest = 0;
            let minDist = Infinity;
            for (let i = 0; i < visibleTabs.length; i++) {
                const layout = tabLayouts.current[i];
                if (!layout) continue;
                const metrics = getIndicatorMetrics(layout, tabBarHeight);
                const dist = Math.abs(metrics.x - pillX);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = i;
                }
            }

            prevActiveIndexRef.current = nearest;
            animateToTab(nearest);

            const tabName = visibleTabs[nearest];
            const route = props.state.routes.find((r) => r.name === tabName);
            const routeIndex = props.state.routes.findIndex((r) => r.name === tabName);

            if (routeIndex >= 0 && routeIndex !== props.state.index && route) {
                props.navigation.navigate(route.name, route.params);
            }
        },
        [animateToTab, props.navigation, props.state.index, props.state.routes, tabBarHeight, visibleTabs]
    );

    const pillPanGesture = useMemo(
        () =>
            Gesture.Pan()
                .activateAfterLongPress(PILL_DRAG_LONG_PRESS_MS)
                .onStart(() => {
                    'worklet';
                    pillDragging.value = 1;
                    dragOriginX.value = indicatorX.value;
                    indicatorStartX.value = indicatorX.value;
                    indicatorTargetX.value = indicatorX.value;
                    runOnJS(setPillDragging)(true);
                })
                .onUpdate((event) => {
                    'worklet';
                    indicatorX.value = clampValue(
                        dragOriginX.value + event.translationX,
                        dragMinX.value,
                        dragMaxX.value
                    );
                })
                .onFinalize(() => {
                    'worklet';
                    if (pillDragging.value > 0.5) {
                        pillDragging.value = 0;
                        runOnJS(finishPillDrag)(indicatorX.value);
                    }
                }),
        [
            dragMaxX,
            dragMinX,
            dragOriginX,
            finishPillDrag,
            indicatorStartX,
            indicatorTargetX,
            indicatorX,
            pillDragging,
            setPillDragging,
        ]
    );

    useEffect(() => {
        tabLayouts.current = {};
        prevActiveIndexRef.current = null;
        setIndicatorReady(false);
    }, [pillWidth, visibleTabs.join('|')]);

    useEffect(() => {
        if (!shouldShowTabBar || !indicatorReady) return;

        if (isPillDraggingRef.current) return;

        if (prevActiveIndexRef.current === null) {
            prevActiveIndexRef.current = activeVisibleIndex;
            setIndicatorPosition(activeVisibleIndex);
            return;
        }

        if (prevActiveIndexRef.current !== activeVisibleIndex) {
            animateToTab(activeVisibleIndex);
            prevActiveIndexRef.current = activeVisibleIndex;
        }
    }, [activeVisibleIndex, indicatorReady, shouldShowTabBar]);

    const handleTabLayout = (visibleIndex: number) => (event: {
        nativeEvent: { layout: { x: number; width: number } };
    }) => {
        const { x, width } = event.nativeEvent.layout;
        const prev = tabLayouts.current[visibleIndex];
        tabLayouts.current[visibleIndex] = {
            x,
            width,
            iconCenterOffset: prev?.iconCenterOffset,
        };
        tabSlots[visibleIndex].x.value = x;
        tabSlots[visibleIndex].w.value = width;
        if (prev?.iconCenterOffset != null) {
            tabSlots[visibleIndex].iconCx.value = x + prev.iconCenterOffset;
        }

        const measured = Object.keys(tabLayouts.current).length;
        if (measured >= visibleTabs.length && !indicatorReady) {
            setIndicatorReady(true);
            setIndicatorPosition(activeVisibleIndex);
            updateDragBounds();
        }
    };

    const handleIconLayout = (visibleIndex: number) => (event: {
        nativeEvent: { layout: { x: number; width: number } };
    }) => {
        const { x, width } = event.nativeEvent.layout;
        const tab = tabLayouts.current[visibleIndex];
        if (!tab) return;

        const iconCenterOffset = TAB_ITEM_CONTENT_PADDING + x + width / 2;
        tabLayouts.current[visibleIndex] = { ...tab, iconCenterOffset };
        tabSlots[visibleIndex].iconCx.value = tab.x + iconCenterOffset;

        if (visibleIndex === activeVisibleIndex && indicatorReady) {
            setIndicatorPosition(activeVisibleIndex);
        }
    };

    const navAnimatedStyle = useAnimatedStyle(() => {
        const translateY = smoothProgress.value * (totalHeight + 20); // Move fully off-screen
        return {
            transform: [
                { translateY },
                { scaleX: navPopX.value },
                { scaleY: navPopY.value }
            ],
            transformOrigin: 'center',
        };
    });

    const navBarBorderRadius = getNavBarBorderRadius(tabBarHeight);

    const indicatorGlassAnimatedStyle = useAnimatedStyle(() => {
        if (Platform.OS === 'android') {
            // Use translateX instead of left — avoids native layout recalculation every frame
            return {
                position: 'absolute',
                left: 0,
                transform: [{ translateX: indicatorX.value }],
                width: indicatorWidth.value,
                top: indicatorTop.value,
                height: indicatorHeight.value,
                borderRadius: indicatorBorderRadius.value,
                overflow: 'hidden',
                zIndex: 3,
                transformOrigin: 'center',
            };
        }
        return {
            position: 'absolute',
            left: indicatorX.value,
            transform: [],
            width: indicatorWidth.value,
            top: indicatorTop.value,
            height: indicatorHeight.value,
            borderRadius: indicatorBorderRadius.value,
            overflow: 'hidden',
            zIndex: 3,
            transformOrigin: 'center',
        };
    });

    const restIndicatorShape = getIndicatorVerticalMetrics(tabBarHeight);

    const renderNavGlassBackground = (borderRadius: number) => (
        <GlassPillSurface borderRadius={borderRadius} glassEffectStyle="regular" />
    );

    const renderSlidingIndicator = () => {
        if (Platform.OS === 'android') {
            return (
                <Reanimated.View
                    pointerEvents="none"
                    style={[
                        indicatorGlassAnimatedStyle,
                        {
                            backgroundColor: 'rgba(0, 0, 0, 0.1)',
                            borderWidth: 1.5,
                            borderColor: 'rgba(0, 0, 0, 0.12)',
                        }
                    ]}
                />
            );
        }

        return (
            <GestureDetector gesture={pillPanGesture}>
                <Reanimated.View style={indicatorGlassAnimatedStyle}>
                    <AnimatedGlassView
                        pointerEvents="none"
                        {...glassShapeProps(restIndicatorShape.borderRadius)}
                        style={StyleSheet.absoluteFill}
                        glassEffectStyle={indicatorReady ? 'clear' : 'none'}
                        isInteractive={false}
                        tintColor="rgba(0, 0, 0, 0.1)"
                        colorScheme="light"
                    />
                </Reanimated.View>
            </GestureDetector>
        );
    };

    const renderTabIcon = (routeName: string, isFocused: boolean) => {
        const IconComponent = TAB_ICONS[routeName];
        if (!IconComponent) return null;
        const color = isFocused ? '#000000' : 'rgba(0, 0, 0, 0.5)';
        return <IconComponent width={24} height={24} color={color} isFocused={isFocused} />;
    };

    const getTabLabel = (routeName: string, optionsTitle?: string) => {
        const itemConfig = tabBarConfig?.items?.[routeName];
        const label =
            itemConfig?.label || DEFAULT_TAB_LABELS[routeName] || optionsTitle || routeName;
        if (routeName === 'category' && label.trim().toLowerCase() === 'category') {
            return 'Categories';
        }
        return label;
    };

    const renderTabButtons = () =>
        visibleTabs
            .map((tabName) => props.state.routes.find((route) => route.name === tabName))
            .filter((route) => route !== undefined)
            .map((route, visibleIndex) => {
                const { options } = props.descriptors[route.key];
                const originalIndex = props.state.routes.findIndex((r) => r.key === route.key);
                const isFocused = props.state.index === originalIndex;
                const slot = tabSlots[visibleIndex];

                // Android: fire pill animation on touch-down (onPressIn) for zero-delay response
                const onPressIn = () => {
                    if (Platform.OS === 'android' && !isFocused) {
                        animateToTab(visibleIndex);
                        prevActiveIndexRef.current = visibleIndex;
                    }
                };

                const onPress = () => {
                    const event = props.navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });
                    
                    try {
                        const { trackNavbarTapped } = require('@/utils/mixpanelHelpers');
                        trackNavbarTapped(route.name);
                    } catch (e) {
                        console.warn('Analytics tracking error:', e);
                    }

                    if (!isFocused && !event.defaultPrevented) {
                        props.navigation.navigate(route.name, route.params);
                    }
                };

                const onLongPress = () => {
                    props.navigation.emit({
                        type: 'tabLongPress',
                        target: route.key,
                    });
                };

                return (
                    <TabBarTabButton
                        key={route.key}
                        isFocused={isFocused}
                        tabSlotX={slot.x}
                        tabSlotWidth={slot.w}
                        tabIconCenterX={slot.iconCx}
                        indicatorX={indicatorX}
                        indicatorWidth={indicatorWidth}
                        indicatorTop={indicatorTop}
                        indicatorHeight={indicatorHeight}
                        barHeight={barHeightSv}
                        indicatorTargetX={indicatorTargetX}
                        indicatorStartX={indicatorStartX}
                        pillDragging={pillDragging}
                        lensPreset={lensPreset}
                        scrollProgress={smoothProgress}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={options.tabBarAccessibilityLabel}
                        testID={(options as { tabBarTestID?: string }).tabBarTestID}
                        onPress={onPress}
                        onPressIn={onPressIn}
                        onLongPress={onLongPress}
                        onLayout={handleTabLayout(visibleIndex)}
                        onIconLayout={handleIconLayout(visibleIndex)}
                        icon={renderTabIcon(route.name, isFocused)}
                        label={getTabLabel(route.name, options.title)}
                    />
                );
            });

    return (
        <View style={styles.wrapper} pointerEvents="box-none">
            <LiveDeliveryTabBanner
                showTabBar={shouldShowTabBar}
                tabStackHeight={totalHeight}
                onStackOffsetChange={setLiveDeliveryStackExtra}
                milestoneStripBottomReserve={milestoneStripReserveForStack}
            />
            <FloatingCartButton
                showTabBar={shouldShowTabBar}
                tabBarReserveHeight={shouldShowTabBar ? totalHeight : undefined}
                anchorExtraOffset={liveDeliveryStackExtra + milestoneReserveForCart}
                activeRouteName={props.state.routes[props.state.index]?.name}
            />

            {shouldShowTabBar && (
                <Reanimated.View
                    style={[
                        styles.shadowWrapper,
                        {
                            opacity: 1, // Always visible
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.floatingOuter,
                            { paddingBottom: bottomInset + FLOATING_BOTTOM_MARGIN },
                        ]}
                    >
                        <Reanimated.View
                            style={[
                                styles.glassPill,
                                navAnimatedStyle,
                                {
                                    width: pillWidth,
                                    height: tabBarHeight,
                                    borderRadius: navBarBorderRadius,
                                },
                            ]}
                        >
                            {Platform.OS === 'android' ? (
                                <View
                                    style={[
                                        StyleSheet.absoluteFill,
                                        { borderRadius: navBarBorderRadius, overflow: 'hidden' },
                                    ]}
                                    pointerEvents="box-none"
                                >
                                    {renderNavGlassBackground(navBarBorderRadius)}
                                    <View style={styles.tabsRow} pointerEvents="box-none">
                                        {renderTabButtons()}
                                        {renderSlidingIndicator()}
                                    </View>
                                </View>
                            ) : (
                                <GlassContainer
                                    style={[
                                        StyleSheet.absoluteFill,
                                        { borderRadius: navBarBorderRadius },
                                    ]}
                                    spacing={GLASS_CONTAINER_SPACING}
                                    pointerEvents="box-none"
                                >
                                    {renderNavGlassBackground(navBarBorderRadius)}
                                    <View style={styles.tabsRow} pointerEvents="box-none">
                                        {renderTabButtons()}
                                        {renderSlidingIndicator()}
                                    </View>
                                </GlassContainer>
                            )}
                        </Reanimated.View>
                    </View>
                </Reanimated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'transparent',
        zIndex: 1000,
        elevation: 1000,
    },
    shadowWrapper: {
        overflow: 'visible',
        width: '100%',
    },
    floatingOuter: {
        alignItems: 'center',
        width: '100%',
        overflow: 'visible',
    },
    glassPill: {
        overflow: 'visible',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 12,
    },
    glassPillClip: {
        overflow: 'hidden',
    },
    tabsRow: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 2,
    },
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
        gap: TAB_ICON_LABEL_GAP,
        width: '100%',
        paddingHorizontal: 2,
    },
    tabLabel: {
        fontSize: 12,
        lineHeight: TAB_LABEL_LINE_HEIGHT,
        fontFamily: Fonts.LexendSemiBold,
        fontWeight: '600',
        color: LABEL_COLOR,
        textAlign: 'center',
        width: '100%',
    },
});

export default TabBar;
