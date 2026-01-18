import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StyleProp,
    ViewStyle,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { FastFilters } from './FastFilters';

interface FilterSortPillsProps {
    totalItems: number;
    activeFiltersCount: number;
    onFiltersPress: () => void;
    onSortPress: () => void;
    facets?: any[];
    selectedFilters?: any;
    onFastFilterToggle?: (attribute: string, value: any) => void;
    style?: StyleProp<ViewStyle>;
}

export const FilterSortPills: React.FC<FilterSortPillsProps> = ({
    totalItems,
    activeFiltersCount,
    onFiltersPress,
    onSortPress,
    facets = [],
    selectedFilters = {},
    onFastFilterToggle,
    style,
}) => {
    const [scrollOffset, setScrollOffset] = useState(0);
    const expandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animatedValue = useRef(new Animated.Value(0)).current;

    const handleFastFilterToggle = (attribute: string, value: any) => {
        if (onFastFilterToggle) {
            onFastFilterToggle(attribute, value);
        }
    };

    const handleScrollChange = (offset: number) => {
        // Clear any pending expand timeout
        if (expandTimeoutRef.current) {
            clearTimeout(expandTimeoutRef.current);
            expandTimeoutRef.current = null;
        }

        setScrollOffset(offset);

        // Smooth spring animation based on scroll position
        // 0 = expanded, 1 = collapsed
        const targetValue = offset > 20 ? 1 : 0;
        
        Animated.spring(animatedValue, {
            toValue: targetValue,
            useNativeDriver: false, // We need to animate width
            tension: 65,
            friction: 9,
        }).start();

        // If scrolled back to start (or very close), ensure expanded state
        if (offset <= 15) {
            expandTimeoutRef.current = setTimeout(() => {
                Animated.spring(animatedValue, {
                    toValue: 0,
                    useNativeDriver: false,
                    tension: 65,
                    friction: 9,
                }).start();
                setScrollOffset(0);
            }, 200);
        }
    };

    useEffect(() => {
        return () => {
            if (expandTimeoutRef.current) {
                clearTimeout(expandTimeoutRef.current);
            }
        };
    }, []);

    const hasFastFilters = facets.length > 0 && onFastFilterToggle;

    // Interpolated values for smooth transitions
    const buttonWidth = useMemo(() => {
        return animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [80, 32], // ~80px when expanded (fits "Filters" text), 32px when collapsed
            extrapolate: 'clamp',
        });
    }, []);

    const paddingHorizontal = useMemo(() => {
        return animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [14, 0],
            extrapolate: 'clamp',
        });
    }, []);

    const textOpacity = useMemo(() => {
        return animatedValue.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [1, 0.3, 0],
            extrapolate: 'clamp',
        });
    }, []);

    const textWidth = useMemo(() => {
        return animatedValue.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [50, 25, 0],
            extrapolate: 'clamp',
        });
    }, []);

    const iconScale = useMemo(() => {
        return animatedValue.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.1], // Slightly scale up icon when collapsed for better visibility
            extrapolate: 'clamp',
        });
    }, []);

    const textMarginLeft = useMemo(() => {
        return animatedValue.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [5, 2.5, 0],
            extrapolate: 'clamp',
        });
    }, []);

    return (
        <View style={[styles.container, style]}>
            {/* Filter & Sort Buttons - Left side (with text, collapse to icons when scrolling left) */}
            <View style={styles.actionsContainer}>
                <Animated.View
                    style={[
                        styles.actionButton,
                        {
                            width: buttonWidth,
                            paddingHorizontal: paddingHorizontal,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.actionButtonInner}
                        onPress={onFiltersPress}
                        activeOpacity={0.7}
                    >
                            <Animated.View
                                style={{
                                    transform: [{ scale: iconScale }],
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Ionicons name="filter-outline" size={16} color={Colors.text} />
                            </Animated.View>
                        <Animated.View
                            style={{
                                opacity: textOpacity,
                                width: textWidth,
                                overflow: 'hidden',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginLeft: textMarginLeft,
                            }}
                        >
                            <Text style={styles.actionButtonText}>Filters</Text>
                        </Animated.View>
                        {activeFiltersCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{activeFiltersCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View
                    style={[
                        styles.actionButton,
                        {
                            width: buttonWidth,
                            paddingHorizontal: paddingHorizontal,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.actionButtonInner}
                        onPress={onSortPress}
                        activeOpacity={0.7}
                    >
                            <Animated.View
                                style={{
                                    transform: [{ scale: iconScale }],
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}
                            >
                                <Ionicons name="swap-vertical-outline" size={16} color={Colors.text} />
                            </Animated.View>
                        <Animated.View
                            style={{
                                opacity: textOpacity,
                                width: textWidth,
                                overflow: 'hidden',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginLeft: textMarginLeft,
                            }}
                        >
                            <Text style={styles.actionButtonText}>Sort</Text>
                        </Animated.View>
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* Fast Filters - Right side (scrollable) */}
            {hasFastFilters && (
                <View style={styles.fastFiltersContainer}>
                    <FastFilters
                        facets={facets}
                        selectedFilters={selectedFilters}
                        onFilterToggle={handleFastFilterToggle}
                        onScrollChange={handleScrollChange}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 6,
        backgroundColor: Colors.backgroundWhite,
        gap: 8,
        height: 44,
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        flexShrink: 0,
    },
    actionButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 20,
        paddingVertical: 6,
        height: 32,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    actionButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        position: 'relative',
    },
    iconContainer: {
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    actionButtonText: {
        fontSize: 13,
        color: Colors.text,
        fontFamily: Fonts.Medium,
    },
    fastFiltersContainer: {
        flex: 1,
        minWidth: 0, // Allows flex to shrink below content size
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: Colors.primary,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: Colors.backgroundWhite,
    },
    badgeText: {
        fontSize: 10,
        color: Colors.backgroundWhite,
        fontFamily: Fonts.Bold,
    },
});
