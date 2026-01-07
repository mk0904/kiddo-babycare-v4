import React, { useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Animated, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { TouchableOpacity } from 'react-native';
import { configService } from '@/services/configService';
import { TabBarConfig, TabBarItemConfig } from '@/types/tabBarTypes';

const DEFAULT_TAB_BAR_HEIGHT = 60;
const ICON_SIZE = 26;
const SCREENS_WITH_TAB_BAR = ['index', 'curated', 'account', 'wishlist'];

// Fallback icons when config doesn't have URLs
const FALLBACK_ICONS: Record<string, string> = {
    index: 'house.fill',
    curated: 'paperplane.fill',
    account: 'person.fill',
};

// Simple in-memory cache for SVGs
const SVG_CACHE: Record<string, string> = {};

// Component to fetch and render remote SVG
const RemoteSvgIcon = ({ url, color, size }: { url: string, color: string, size: number }) => {
    const [xml, setXml] = React.useState<string | null>(SVG_CACHE[url] || null);

    useEffect(() => {
        if (!url) return;

        // Check cache first
        if (SVG_CACHE[url]) {
            setXml(SVG_CACHE[url]);
            return;
        }

        fetch(url)
            .then(res => res.text())
            .then(text => {
                SVG_CACHE[url] = text;
                setXml(text);
            })
            .catch(err => console.log('[TabBar] SVG fetch error:', err));
    }, [url]);

    if (!xml) return <View style={{ width: size, height: size }} />; // Placeholder

    return <SvgXml xml={xml} width={size} height={size} color={color} pointerEvents="none" />;
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
    // Get dynamic styles from config
    const stylesConfig = tabBarConfig?.styles || {};
    const tabBarHeight = stylesConfig.height || DEFAULT_TAB_BAR_HEIGHT;
    const iconSize = stylesConfig.iconSize || ICON_SIZE;
    const activeColor = stylesConfig.activeTintColor || Colors.light.tabIconSelected;
    const inactiveColor = stylesConfig.inactiveTintColor || Colors.light.tabIconDefault;

    const bottomInset = Math.max(insets.bottom, 0);
    const totalHeight = tabBarHeight + bottomInset;

    useEffect(() => {
        Animated.spring(translateY, {
            toValue: isVisible ? 0 : totalHeight,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
            velocity: 0,
        }).start();
    }, [isVisible, totalHeight, translateY]);

    const shouldShowTabBar = useMemo(() => {
        try {
            const { state } = props;
            if (!state || !state.routes || state.index === undefined) {
                return false;
            }
            const activeTab = state.routes[state.index];
            const activeTabName = activeTab?.name;
            return SCREENS_WITH_TAB_BAR.includes(activeTabName);
        } catch (error) {
            return false;
        }
    }, [props.state]);

    // Render tab icon based on config
    const renderTabIcon = (routeName: string, isFocused: boolean) => {
        const itemConfig = tabBarConfig?.items?.[routeName];
        const iconUrl = isFocused ? itemConfig?.activeIcon : itemConfig?.icon;

        // If we have a valid URL
        if (iconUrl && iconUrl.length > 0) {
            // Handle SVG
            if (iconUrl.split('?')[0].toLowerCase().endsWith('.svg')) {
                return (
                    <RemoteSvgIcon
                        url={iconUrl}
                        color={isFocused ? activeColor : inactiveColor}
                        size={iconSize}
                    />
                );
            }

            // Handle PNG/JPG/WebP handled by expo-image
            return (
                <Image
                    source={{ uri: iconUrl }}
                    style={[
                        styles.tabIcon,
                        { width: iconSize, height: iconSize },
                        // Apply tint only if it's not a multi-colored image (PNG/JPG)
                        // distinct from SVG which is handled above
                        // using strict check to avoid tinting actual images
                        !iconUrl.split('?')[0].toLowerCase().endsWith('.png') &&
                        !iconUrl.split('?')[0].toLowerCase().endsWith('.jpg') && {
                            tintColor: isFocused ? activeColor : inactiveColor
                        }
                    ]}
                    contentFit="contain"
                />
            );
        }

        // If no valid URL, return null (user requested to remove fallbacks)
        return null;
    };

    // Get label from config or fallback to options.title
    const getTabLabel = (routeName: string, optionsTitle?: string) => {
        const itemConfig = tabBarConfig?.items?.[routeName];
        return itemConfig?.label || optionsTitle || routeName;
    };

    return (
        <View style={styles.wrapper} pointerEvents="box-none">
            <FloatingCartButton showTabBar={shouldShowTabBar} />

            {shouldShowTabBar && (
                <Animated.View
                    style={[
                        styles.shadowWrapper,
                        { transform: [{ translateY }] }
                    ]}
                >
                    <View style={[styles.container, { height: totalHeight }]}>
                        <View style={styles.backgroundLayer} />

                        {Platform.OS === 'ios' && (
                            <BlurView
                                intensity={80}
                                tint="light"
                                style={StyleSheet.absoluteFill}
                            />
                        )}

                        <View style={[styles.borderLine, {
                            backgroundColor: stylesConfig.backgroundColor ? 'transparent' : 'rgba(0, 0, 0, 0.08)'
                        }]} />

                        <View style={[
                            styles.contentWrapper,
                            {
                                height: tabBarHeight,
                                backgroundColor: stylesConfig.backgroundColor || '#FFFFFF'
                            }
                        ]}>
                            {props.state.routes.map((route, index) => {
                                const { options } = props.descriptors[route.key];
                                const isFocused = props.state.index === index;

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
        overflow: 'hidden',
        width: '100%',
        backgroundColor: '#FFFFFF',
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
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
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
    tabIcon: {
        width: 26,
        height: 26,
    },
    tabLabel: {
        fontSize: 10,
        fontFamily: Fonts.Medium,
    },
});

export default TabBar;
