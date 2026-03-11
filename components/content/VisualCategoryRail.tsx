import { Fonts } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import { CategoryRailBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import React, { useEffect, useState } from 'react';
import { Dimensions, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface VisualCategoryRailProps extends Omit<BaseContentBlockProps, 'onPress'> {
    block: CategoryRailBlock;
    onPress?: (link?: string, item?: any) => void;
}

interface RailItem {
    id: string;
    imageUrl?: string;
    label?: string;
    link?: string;
    collectionId?: string;
    _loaded?: boolean; // Internal flag to track if collection data was loaded
}

export function VisualCategoryRail({ block, onPress }: VisualCategoryRailProps) {
    const { width: screenWidth } = Dimensions.get('window');
    const { data = [], title, railConfig = {}, styles: blockStyles } = block;

    const gap = railConfig.gap ?? 16;
    const showLabel = railConfig.showLabel ?? true;
    const shape = railConfig.shape ?? 'circle';
    const itemsPerView = railConfig.itemsPerView;
    const bgImageUrl = railConfig.bgImageUrl;
    const resizeMode = railConfig.resizeMode ?? 'cover';
    
    // Support both width/height and size/aspectRatio
    const configWidth = railConfig.width ?? railConfig.size ?? 70;
    const configHeight = railConfig.height ?? railConfig.size ?? 70;
    const aspectRatio = railConfig.aspectRatio;

    // Calculate item width based on itemsPerView
    const itemWidth = itemsPerView 
        ? (screenWidth - (blockStyles?.container?.paddingHorizontal ?? 20) * 2) / itemsPerView - gap
        : configWidth;

    // Calculate height: use config height if provided, otherwise use aspect ratio, otherwise use width (square)
    let itemHeight: number;
    if (railConfig.height) {
        // If height is explicitly set, use it (scaled if itemsPerView is set)
        itemHeight = itemsPerView ? (itemWidth / configWidth) * configHeight : configHeight;
    } else if (aspectRatio && shape !== 'circle') {
        // Use aspect ratio if provided
        itemHeight = itemWidth / aspectRatio;
    } else if (shape === 'circle') {
        // For circles, height equals width
        itemHeight = itemWidth;
    } else {
        // Default to square or use config height
        itemHeight = itemsPerView ? itemWidth : configHeight;
    }

    const [items, setItems] = useState<RailItem[]>(data);
    const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

    let borderRadius = 0;
    if (shape === 'circle') borderRadius = Math.min(itemWidth, itemHeight) / 2;
    else if (shape === 'rounded') borderRadius = 12;
    // 'square' is 0

    // Fetch collection data for items that only have collectionId
    useEffect(() => {
        const fetchCollectionData = async () => {
            const itemsToFetch = data.filter(
                item => item.collectionId && (!item.imageUrl || !item.label)
            );

            if (itemsToFetch.length === 0) {
                setItems(data);
                return;
            }

            setLoadingItems(new Set(itemsToFetch.map(item => item.id)));

            const fetchedItems = await Promise.all(
                itemsToFetch.map(async (item) => {
                    try {
                        const collection = await shopifyApi.getCollectionById(item.collectionId!);
                        if (collection) {
                            return {
                                ...item,
                                imageUrl: item.imageUrl || collection.image?.url || '',
                                // Manual label overrides collection title if provided (even if empty string)
                                label: item.label !== undefined ? item.label : (collection.title || ''),
                                _loaded: true,
                            };
                        }
                        return item;
                    } catch (error) {
                        console.error(`Error fetching collection ${item.collectionId}:`, error);
                        return item;
                    }
                })
            );

            // Merge fetched items with original data
            const updatedItems = data.map((originalItem) => {
                const fetchedItem = fetchedItems.find(fi => fi.id === originalItem.id);
                return fetchedItem || originalItem;
            });

            setItems(updatedItems);
            setLoadingItems(new Set());
        };

        fetchCollectionData();
    }, [data]);

    const handlePress = (item: RailItem) => {
        if (onPress) {
            if (item.link) {
                onPress(item.link, item);
            } else if (item.collectionId) {
                // Extract collection handle or ID from collectionId
                const collectionId = item.collectionId;
                // If it's a GID, extract the numeric ID
                const match = collectionId.match(/gid:\/\/shopify\/Collection\/(\d+)/);
                const id = match ? match[1] : collectionId;
                onPress(`/collections/${id}`, item);
            }
        }
    };

    if (!items?.length) return null;

    // Title style with container padding if not explicitly set
    const containerPaddingHorizontal = blockStyles?.container?.paddingHorizontal ?? 20;
    // For horizontal ScrollView, use paddingLeft if explicitly set, otherwise use paddingHorizontal, otherwise default to 20
    // This ensures left padding is applied unless explicitly disabled
    const containerPaddingLeft = blockStyles?.container?.paddingLeft !== undefined 
        ? blockStyles.container.paddingLeft 
        : (blockStyles?.container?.paddingHorizontal !== undefined 
            ? blockStyles.container.paddingHorizontal 
            : 20);
    const containerPaddingRight = blockStyles?.container?.paddingRight !== undefined
        ? blockStyles.container.paddingRight
        : (blockStyles?.container?.paddingHorizontal !== undefined
            ? blockStyles.container.paddingHorizontal
            : 20);
    
    const titleStyle = {
        marginBottom: 15,
        fontSize: 18,
        letterSpacing: 0,
        // Apply container padding to title if not explicitly set in blockStyles.title
        paddingHorizontal: blockStyles?.title?.paddingHorizontal !== undefined
            ? blockStyles.title.paddingHorizontal
            : containerPaddingHorizontal,
        ...processFontStyle(blockStyles?.title, Fonts.Black),
    };

    // Extract horizontal and vertical padding from container styles to avoid double padding
    // BaseContentBlock will apply other container styles, but we handle padding here
    const containerPaddingVertical = blockStyles?.container?.paddingVertical ?? blockStyles?.container?.paddingTop ?? blockStyles?.container?.paddingBottom;
    const containerStylesWithoutPadding = blockStyles?.container ? {
        ...blockStyles.container,
        paddingLeft: undefined,
        paddingRight: undefined,
        paddingHorizontal: undefined,
        paddingVertical: undefined,
        paddingTop: undefined,
        paddingBottom: undefined,
    } : {};

    // Create a modified block without horizontal padding for BaseContentBlock
    // (we handle horizontal padding on ScrollView contentContainerStyle instead)
    const blockWithoutHorizontalPadding = {
        ...block,
        styles: {
            ...block.styles,
            container: containerStylesWithoutPadding,
        },
    };

    const scrollViewContent = (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
                styles.container,
                containerStylesWithoutPadding,
                {
                    gap,
                    paddingLeft: containerPaddingLeft,
                    paddingRight: containerPaddingRight,
                }
            ]}
        >
                {items.map((item, index) => {
                    const isLoading = loadingItems.has(item.id);
                    const displayImageUrl = item.imageUrl;
                    const displayLabel = item.label || '';

                    return (
                    <TouchableOpacity
                        key={item.id || index}
                            style={[
                                styles.item,
                                itemsPerView && { width: itemWidth },
                                blockStyles?.item
                            ]}
                        onPress={() => handlePress(item)}
                        activeOpacity={0.8}
                    >
                        <View
                            style={[
                                styles.imageContainer,
                                { 
                                    width: itemsPerView ? itemWidth : configWidth, 
                                    height: itemsPerView ? itemHeight : configHeight, 
                                    borderRadius 
                                },
                                blockStyles?.imageContainer
                            ]}
                        >
                                {isLoading ? (
                                    <View style={[styles.loadingPlaceholder, { borderRadius }]} />
                                ) : displayImageUrl ? (
                            <Image
                                        source={{ uri: displayImageUrl }}
                                style={[
                                    styles.image,
                                    { borderRadius },
                                    blockStyles?.image
                                ]}
                                resizeMode="cover"
                            />
                                ) : (
                                    <View style={[styles.placeholder, { borderRadius }]} />
                                )}
                        </View>
                            {showLabel && displayLabel && (
                            <Text
                                    style={[
                                        styles.label,
                                        { width: itemsPerView ? itemWidth : configWidth + 10 },
                                        processFontStyle(blockStyles?.text, Fonts.Medium),
                                        processFontStyle(blockStyles?.label, Fonts.Medium),
                                        { fontWeight: '700' } // Ensure subcategory names are bold
                                    ]}
                                numberOfLines={2}
                            >
                                    {displayLabel}
                            </Text>
                        )}
                    </TouchableOpacity>
                    );
                })}
        </ScrollView>
    );

    return (
        <BaseContentBlock block={blockWithoutHorizontalPadding}>
            {title && (
                <Text style={[styles.title, titleStyle]}>{title}</Text>
            )}
            {bgImageUrl ? (
                <ImageBackground
                    source={{ uri: bgImageUrl }}
                    style={[
                        styles.backgroundImage,
                        containerPaddingVertical !== undefined && {
                            paddingTop: blockStyles?.container?.paddingTop ?? containerPaddingVertical,
                            paddingBottom: blockStyles?.container?.paddingBottom ?? containerPaddingVertical,
                        }
                    ]}
                    resizeMode={resizeMode}
                >
                    {scrollViewContent}
                </ImageBackground>
            ) : (
                <View style={containerPaddingVertical !== undefined ? {
                    paddingTop: blockStyles?.container?.paddingTop ?? containerPaddingVertical,
                    paddingBottom: blockStyles?.container?.paddingBottom ?? containerPaddingVertical,
                } : undefined}>
                    {scrollViewContent}
                </View>
            )}
        </BaseContentBlock>
    );
}

const styles = StyleSheet.create({
    title: {
        fontSize: 18,
        fontFamily: Fonts.Black,
        letterSpacing: 0,
        marginBottom: 15,
    },
    container: {
        paddingVertical: 15,
        alignItems: 'flex-start',
    },
    item: {
        alignItems: 'center',
    },
    imageContainer: {
        backgroundColor: '#F2F2F2',
        marginBottom: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#EEEEEE',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    label: {
        fontSize: 12,
        color: '#333',
        textAlign: 'center',
        fontFamily: Fonts.Medium,
        fontWeight: '700',
        lineHeight: 16,
    },
    loadingPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#E0E0E0',
    },
    placeholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#F2F2F2',
    },
    backgroundImage: {
        width: '100%',
    },
});
