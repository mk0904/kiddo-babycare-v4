import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SkeletonLoaderProps {
    width?: number | string;
    height?: number | string;
    style?: ViewStyle;
    borderRadius?: number;
    variant?: 'default' | 'product' | 'text' | 'circle';
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    width,
    height = 20,
    style,
    borderRadius = 8,
    variant = 'default',
}) => {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [animatedValue]);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    const getSkeletonStyle = () => {
        switch (variant) {
            case 'product':
                return {
                    width: width || '100%',
                    height: height || 200,
                    borderRadius: borderRadius || 12,
                };
            case 'text':
                return {
                    width: width || '100%',
                    height: height || 16,
                    borderRadius: borderRadius || 4,
                };
            case 'circle':
                return {
                    width: width || height || 50,
                    height: height || width || 50,
                    borderRadius: (typeof width === 'number' ? width : typeof height === 'number' ? height : 50) / 2,
                };
            default:
                return {
                    width: width || '100%',
                    height: height || 20,
                    borderRadius: borderRadius || 8,
                };
        }
    };

    return (
        <Animated.View
            style={[
                styles.skeleton,
                getSkeletonStyle() as any,
                { opacity: opacity as any },
                style,
            ]}
        />
    );
};

// Product Card Skeleton
export const ProductCardSkeleton = ({ width = '100%' }) => {
    return (
        <View style={[styles.productCardContainer, { width: width as any }]}>
            <SkeletonLoader variant="product" height={180} borderRadius={12} />
            <View style={styles.productCardContent}>
                <SkeletonLoader variant="text" height={14} width="80%" style={styles.marginTop} />
                <SkeletonLoader variant="text" height={14} width="60%" style={styles.marginTopSmall} />
                <SkeletonLoader variant="text" height={16} width="40%" style={styles.marginTop} />
            </View>
        </View>
    );
};

// Horizontal Product List Skeleton
export const HorizontalProductListSkeleton = ({ count = 3 }) => {
    return (
        <View style={styles.horizontalListContainer}>
            {Array.from({ length: count }).map((_, index) => (
                <View key={index} style={styles.horizontalItem}>
                    <SkeletonLoader variant="product" height={200} width={150} borderRadius={12} />
                    <View style={styles.horizontalItemContent}>
                        <SkeletonLoader variant="text" height={12} width="90%" style={styles.marginTop} />
                        <SkeletonLoader variant="text" height={12} width="70%" style={styles.marginTopSmall} />
                        <SkeletonLoader variant="text" height={14} width="50%" style={styles.marginTop} />
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: '#E0E0E0',
    },
    productCardContainer: {
        marginBottom: 16,
    },
    productCardContent: {
        marginTop: 8,
        paddingHorizontal: 4,
    },
    horizontalListContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginTop: 12,
    },
    horizontalItem: {
        marginRight: 12,
        width: 150,
    },
    horizontalItemContent: {
        marginTop: 8,
    },
    marginTop: {
        marginTop: 12,
    },
    marginTopSmall: {
        marginTop: 6,
    },
});

export default SkeletonLoader;
