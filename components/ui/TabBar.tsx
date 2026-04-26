import CategoryActive from '@/assets/icons/category-active.svg';
import CategoryInactive from '@/assets/icons/category-inactive-fill.svg';
import HomeActive from '@/assets/icons/home-active-fill.svg';
import HomeInactive from '@/assets/icons/home-inactive-fill.svg';
import ProfileActive from '@/assets/icons/profile-active-fill.svg';
import ProfileInactive from '@/assets/icons/profile-inactive-fill.svg';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import {
    LiveDeliveryTabBanner
} from '@/components/ui/LiveDeliveryTabBanner';
import { Colors, Fonts } from '@/constants/theme';
import { useLiveDeliveryStackOffset } from '@/context/LiveDeliveryStackOffsetContext';
import { useMilestoneDockHeightSafe } from '@/context/MilestoneDockContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { configService } from '@/services/configService';
import { TabBarConfig } from '@/types/tabBarTypes';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DEFAULT_TAB_BAR_HEIGHT = 60;
const ICON_SIZE = 26;
const SCREENS_WITH_TAB_BAR = ['index', 'category', 'ticketing', 'account'];

type TabIconSource = React.ComponentType<{ width?: number; height?: number }> | number;

const TAB_ICONS: Record<string, { active: TabIconSource; inactive: TabIconSource }> = {
    index: { active: HomeActive, inactive: HomeInactive },
    category: { active: CategoryActive, inactive: CategoryInactive },
    ticketing: {
        active: require('@/assets/icons/ticket-active.png'),
        inactive: require('@/assets/icons/ticketicon.png'),
    },
    account: { active: ProfileActive, inactive: ProfileInactive },
};

export const TabBar = (props: BottomTabBarProps) => {
    const insets = useSafeAreaInsets();
    const { isVisible } = useTabBarVisibility();
    const translateY = useRef(new Animated.Value(0)).current;

    // Live config subscription
    const [tabBarConfig, setTabBarConfig] = React.useState<TabBarConfig | null>(
        configService.getTabBarConfig()
    );

    useEffect(() => {
        // Initial fetch
        setTabBarConfig(configService.getTabBarConfig());

        // Subscribe to changes
        const unsubscribe = configService.subscribe((newConfig) => {
            setTabBarConfig(newConfig.tabBar || null);
        });

        return unsubscribe;
    }, []);

    // Get dynamic styles from config
    const stylesConfig = tabBarConfig?.styles || {};
    const tabBarHeight = stylesConfig.height || DEFAULT_TAB_BAR_HEIGHT;
    const iconSize = stylesConfig.iconSize || ICON_SIZE;
    const activeColor = stylesConfig.activeTintColor || Colors.light.tabIconSelected;
    const inactiveColor = stylesConfig.inactiveTintColor || Colors.light.tabIconDefault;

    const bottomInset = Math.max(insets.bottom, 0);
    const totalHeight = tabBarHeight + bottomInset;

    const { stackExtraPx: liveDeliveryStackExtra, setStackExtraPx: setLiveDeliveryStackExtra } =
        useLiveDeliveryStackOffset();

    // Get visible tabs from config, fallback to default
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
        } catch (error) {
            return false;
        }
    }, [props.state, visibleTabs]);

    const activeTabName = useMemo(() => {
        try {
            const { state } = props;
            if (!state?.routes?.length || state.index === undefined) return '';
            return state.routes[state.index]?.name ?? '';
        } catch {
            return '';
        }
    }, [props.state]);

    const milestoneDockHeight = useMilestoneDockHeightSafe();
    /** Milestone strip only exists on Home (see `MilestoneTracker` on index screen). */
    const isHomeTab = activeTabName === 'index';
    /** Collapsed milestone strip: height comes from `MilestoneCartRow` on Home. */
    const isMilestoneCollapsed = milestoneDockHeight > 0 && milestoneDockHeight < 120;
    const milestoneStripReserveForStack =
        shouldShowTabBar && isHomeTab && isMilestoneCollapsed
            ? Math.max(milestoneDockHeight, 0) + 12
            : 0;
    const milestoneReserveForCart =
        shouldShowTabBar && isHomeTab && isMilestoneCollapsed
            ? milestoneStripReserveForStack + 4
            : 0;

    useEffect(() => {
        Animated.spring(translateY, {
            toValue: isVisible ? 0 : totalHeight,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
            velocity: 0,
        }).start();
    }, [isVisible, totalHeight, translateY]);

    // Render tab icon: use config URLs (e.g. Shopify) when set, otherwise fall back to local assets
    const renderTabIcon = (routeName: string, isFocused: boolean) => {
        const itemConfig = tabBarConfig?.items?.[routeName];
        const configIconUrl = isFocused ? itemConfig?.activeIcon : itemConfig?.icon;

        if (configIconUrl && typeof configIconUrl === 'string' && configIconUrl.startsWith('http')) {
            return (
                <Image
                    source={{ uri: configIconUrl }}
                    style={{ width: iconSize, height: iconSize }}
                    contentFit="contain"
                />
            );
        }

        const icons = TAB_ICONS[routeName];
        if (!icons) return null;
        const iconSource = isFocused ? icons.active : icons.inactive;
        if (typeof iconSource === 'function') {
            const IconComponent = iconSource;
            return <IconComponent width={iconSize} height={iconSize} />;
        }
        return (
            <Image
                source={iconSource}
                style={{ width: iconSize, height: iconSize }}
                contentFit="contain"
            />
        );
    };

    // Get label from config or fallback to options.title
    const getTabLabel = (routeName: string, optionsTitle?: string) => {
        const itemConfig = tabBarConfig?.items?.[routeName];
        return itemConfig?.label || optionsTitle || routeName;
    };

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
            />

            {shouldShowTabBar && (
                <Animated.View
                    style={[
                        styles.shadowWrapper,
                        { transform: [{ translateY }] }
                    ]}
                >
                    <View style={[
                        styles.container,
                        {
                            height: totalHeight,
                            // Shadow from config
                            shadowColor: stylesConfig.shadowColor || '#000',
                            shadowOffset: stylesConfig.shadowOffset || { width: 0, height: -2 },
                            shadowOpacity: stylesConfig.shadowOpacity !== undefined ? stylesConfig.shadowOpacity : 0.15,
                            shadowRadius: stylesConfig.shadowRadius !== undefined ? stylesConfig.shadowRadius : 6,
                            // Android elevation (convert shadowRadius to elevation)
                            elevation: stylesConfig.shadowRadius !== undefined ? Math.ceil(stylesConfig.shadowRadius * 1.5) : 10,
                        }
                    ]}>
                        <View style={styles.backgroundLayer} />

                        {Platform.OS === 'ios' && (
                            <BlurView
                                intensity={80}
                                tint="light"
                                style={StyleSheet.absoluteFill}
                            />
                        )}

                        <View style={[styles.borderLine, {
                            backgroundColor: stylesConfig.backgroundColor ? 'transparent' : Colors.border
                        }]} />

                        <View style={[
                            styles.contentWrapper,
                            {
                                height: tabBarHeight,
                                backgroundColor: stylesConfig.backgroundColor || '#FFFFFF'
                            }
                        ]}>
                            {visibleTabs
                                .map((tabName) => props.state.routes.find((route) => route.name === tabName))
                                .filter((route) => route !== undefined)
                                .map((route) => {
                                const { options } = props.descriptors[route.key];
                                const originalIndex = props.state.routes.findIndex((r) => r.key === route.key);
                                const isFocused = props.state.index === originalIndex;

                                const onPress = () => {
                                    const event = props.navigation.emit({
                                        type: 'tabPress',
                                        target: route.key,
                                        canPreventDefault: true,
                                    });

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
                                    <TouchableOpacity
                                        key={route.key}
                                        accessibilityRole="button"
                                        accessibilityState={isFocused ? { selected: true } : {}}
                                        accessibilityLabel={options.tabBarAccessibilityLabel}
                                        testID={(options as any).tabBarTestID}
                                        onPress={onPress}
                                        onLongPress={onLongPress}
                                        style={styles.tabItem}
                                    >
                                        {renderTabIcon(route.name, isFocused)}
                                        <Text
                                            style={[
                                                styles.tabLabel,
                                                { color: isFocused ? activeColor : inactiveColor }
                                            ]}
                                        >
                                            {getTabLabel(route.name, options.title)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        {bottomInset > 0 && <View style={{ height: bottomInset, backgroundColor: '#FFFFFF' }} />}
                    </View>
                </Animated.View>
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
    container: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'visible',
        width: '100%',
        backgroundColor: '#FFFFFF',
        // Shadow values will be applied dynamically from config
    },
    backgroundLayer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFFFFF', // Default bg, overridden by style contentWrapper
    },
    borderLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: Colors.border,
    },
    contentWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        gap: 2,
    },
    tabLabel: {
        fontSize: 10,
        fontFamily: Fonts.Medium,
    },
});

export default TabBar;
