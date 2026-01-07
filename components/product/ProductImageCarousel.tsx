import React, { useState, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions, FlatList, TouchableOpacity, Text } from 'react-native';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ASPECT_RATIO = 4 / 5; // Standard fashion aspect ratio
const CAROUSEL_HEIGHT = SCREEN_WIDTH / ASPECT_RATIO;

interface ProductImageCarouselProps {
    images: string[];
    onImagePress?: (index: number) => void;
}

export const ProductImageCarousel = ({ images, onImagePress }: ProductImageCarouselProps) => {
    const [activeIndex, setActiveIndex] = useState(0);

    const onScroll = (event: any) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        const roundIndex = Math.round(index);
        if (roundIndex !== activeIndex) {
            setActiveIndex(roundIndex);
        }
    };

    if (!images || images.length === 0) {
        return (
            <View style={[styles.container, styles.emptyContainer]}>
                <Ionicons name="image-outline" size={48} color={Colors.textSecondary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={images}
                keyExtractor={(_, index) => `product-img-${index}`}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => onImagePress?.(index)}
                        style={styles.imageContainer}
                    >
                        <Image
                            source={{ uri: item }}
                            style={styles.image}
                            resizeMode="cover" // or 'contain' depending on design
                        />
                    </TouchableOpacity>
                )}
            />

            {/* Pagination Dots */}
            {images.length > 1 && (
                <View style={styles.pagination}>
                    {images.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === activeIndex && styles.activeDot,
                            ]}
                        />
                    ))}
                </View>
            )}

            {/* Image Counter Badge */}
            <View style={styles.counterBadge}>
                <Text style={styles.counterText}>
                    {activeIndex + 1}/{images.length}
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        height: CAROUSEL_HEIGHT,
        backgroundColor: '#fff',
        position: 'relative',
    },
    emptyContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    imageContainer: {
        width: SCREEN_WIDTH,
        height: CAROUSEL_HEIGHT,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    pagination: {
        position: 'absolute',
        bottom: 20,
        flexDirection: 'row',
        alignSelf: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    activeDot: {
        backgroundColor: Colors.primary,
        width: 20, // Elongated active dot
        borderColor: Colors.primary,
    },
    counterBadge: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    counterText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
});
