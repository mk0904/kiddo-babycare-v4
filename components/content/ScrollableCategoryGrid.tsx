import { Colors, Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { configService } from '@/services/configService';
import { shopifyApi } from '@/services/shopifyApi';
import { CategoryGridBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { shopifyImageUrl } from '@/utils/shopifyIds';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface CollectionItem {
  id: string;
  name: string;
  imageUrl: string;
  aspectRatio?: number;
  widthFraction?: number;
}

interface ScrollableCategoryGridProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: CategoryGridBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function ScrollableCategoryGrid({ block, onPress }: ScrollableCategoryGridProps) {
  const router = useRouter();
  const { width: SCREEN_WIDTH } = useDeviceDimensions();
  const { title, categoryKeys = [], collectionIds, gridConfig = {}, styles: blockStyles } = block;
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadCollections = useCallback(async () => {
    if (!collectionIds || collectionIds.length === 0) {
      setCollections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const collectionPromises = collectionIds.map((collection) => {
        if (typeof collection === 'object' && collection.name && collection.imageUrl) {
          return Promise.resolve(collection);
        }
        return shopifyApi.getCollectionById(
          typeof collection === 'object' ? collection.id : collection
        ).catch((error) => {
          console.error(`[ScrollableCategoryGrid] Error loading collection:`, error);
          return null;
        });
      });

      const results = await Promise.allSettled(collectionPromises);

      const validCollections = results
        .map((result, index) => {
          if (result.status === 'fulfilled' && result.value !== null) {
            const collectionDef = typeof collectionIds[index] === 'object'
              ? collectionIds[index]
              : { id: collectionIds[index], name: '' };
              
            if (result.value.imageUrl && typeof result.value.title === 'undefined') {
                return result.value as CollectionItem;
            }

            const item: CollectionItem = {
              id: result.value.id,
              name: collectionDef.name || result.value.title,
              imageUrl: collectionDef.imageUrl || result.value.image?.url || '',
            };
            if (typeof collectionDef === 'object') {
              if (collectionDef.aspectRatio != null) {
                item.aspectRatio = collectionDef.aspectRatio;
              }
              if (collectionDef.widthFraction != null) {
                item.widthFraction = collectionDef.widthFraction;
              }
            }
            return item;
          }
          return null;
        })
        .filter((col): col is CollectionItem => col !== null);

      setCollections(validCollections);
    } catch (error) {
      console.error('[ScrollableCategoryGrid] Error fetching collections:', error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [collectionIds]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // For scrollable grid, numColumns determines how many items we see on screen AT ONCE
  // and we use gridConfig.rows (default 2) to determine the vertical layout.
  const numColumns = gridConfig.numColumns ?? 3.5; // Show 3.5 items width-wise by default
  const numRows = (gridConfig as any).rows ?? 2;

  const categories = useMemo(() => {
    const configCategories = configService.getCategories();
    if (!configCategories?.order) return [];

    const categoryOrder = configCategories.order;
    const categoryItems = configCategories.items || {};

    return categoryOrder.map((key) => {
      const categoryDef = categoryItems[key];
      const defaultLabels: Record<string, string> = {
        all: 'See all',
        girls: 'Girls',
        boys: 'Boys',
        babycare: 'Baby Care',
        toys: 'Toys',
        babygear: 'Baby Gear',
      };
      const defaultIcons: Record<string, any> = {
        all: require('@/assets/images/shopall-selected.png'),
        girls: require('@/assets/images/girls-fashion-selected.png'),
        boys: require('@/assets/images/boys-fashion-selected.png'),
        babycare: require('@/assets/images/babycare-selected.png'),
        toys: require('@/assets/images/toys-selected.png'),
        babygear: require('@/assets/images/Baby-Gear.png'),
      };

      const icon = (categoryDef as { icon?: string })?.icon;
      const iconUrl = typeof icon === 'string' ? icon : undefined;
      return {
        key,
        label: categoryDef?.label || defaultLabels[key] || key,
        iconImage: iconUrl ? undefined : defaultIcons[key],
        iconUrl: iconUrl || undefined,
      };
    });
  }, []);

  const filteredCategories = useMemo(() => {
    if (categoryKeys.length === 0) return categories;
    return categories.filter((cat) => categoryKeys.includes(cat.key));
  }, [categories, categoryKeys]);

  const gridItems = useMemo(() => {
    let items: any[] = [];
    if (collectionIds && collectionIds.length > 0) {
      items = collections.map((collection, index) => {
        const collectionId = collection.id;
        return {
          id: collection.id,
          label: collection.name,
          imageUrl: collection.imageUrl,
          imageSource: undefined,
          onPress: () => {
            onPress?.(`/collections/${collectionId}`, {
              ...collection,
              collectionId: collectionId,
              collectionName: collection.name,
              name: collection.name,
            });
          },
        };
      });
    } else {
      items = filteredCategories.map((category, index) => ({
        id: category.key,
        label: category.label,
        imageUrl: category.iconUrl,
        imageSource: category.iconImage,
        onPress: () => {
          if (category.key === 'all') {
            router.push('/(tabs)' as any);
          } else {
            router.push({ pathname: '/(tabs)', params: { category: category.key } } as any);
          }
          onPress?.(undefined, category);
        },
      }));
    }

    const limit = gridConfig.limit ?? 0;
    if (limit > 0) {
      items = items.slice(0, limit);
    }
    return items;
  }, [filteredCategories, collections, collectionIds, router, onPress, gridConfig.limit]);

  const colGap = gridConfig.colGap ?? gridConfig.gap ?? 12;
  const rowGap = gridConfig.rowGap ?? gridConfig.gap ?? 12;
  const aspectRatio = gridConfig.aspectRatio ?? 1;
  const resizeMode = gridConfig.resizeMode || gridConfig.imageResizeMode || 'cover';
  const textDisplay = blockStyles?.text?.display;
  const shouldHideLabels = textDisplay === 'none' || textDisplay === 'hidden';
  const showLabels = shouldHideLabels ? false : (gridConfig.showLabels !== false);
  const borderRadius = gridConfig.borderRadius ?? 12;
  const cellBackgroundColor = (blockStyles as any)?.cell?.backgroundColor || (gridConfig as any)?.cellBackgroundColor || Colors.backgroundWhite;
  
  const containerPaddingFromStyles = blockStyles?.container?.paddingHorizontal;
  let rawPadding = containerPaddingFromStyles !== undefined ? containerPaddingFromStyles : (gridConfig.padding ?? 16);
  let containerPaddingHorizontal = 16;
  if (typeof rawPadding === 'string' && rawPadding.endsWith('%')) {
    containerPaddingHorizontal = (parseFloat(rawPadding) / 100) * SCREEN_WIDTH;
  } else {
    containerPaddingHorizontal = Number(rawPadding) || 16;
  }

  const { paddingHorizontal: _, ...containerStyleWithoutPadding } = blockStyles?.container || {};
  const containerStyle = {
    marginVertical: 0,
    paddingHorizontal: 0,
    ...containerStyleWithoutPadding,
  };

  const titleStyle = {
    marginBottom: 8,
    fontSize: 18,
    letterSpacing: 0,
    paddingHorizontal: blockStyles?.title?.paddingHorizontal !== undefined
      ? blockStyles.title.paddingHorizontal
      : containerPaddingHorizontal,
    ...processFontStyle(blockStyles?.title, Fonts.Black),
  };

  const scale = (gridConfig as any).proportionalScale ? SCREEN_WIDTH / 390 : 1;
  const scaledColGap = colGap * scale;
  const scaledRowGap = rowGap * scale;

  const { fontWeight: _labelFw, fontFamily: _labelFf, ...textStyleRest } = blockStyles?.text || {};
  const processedTextStyle = processFontStyle(blockStyles?.text, Fonts.Bold);
  const baseFontSize = textStyleRest.fontSize ?? processedTextStyle.fontSize ?? 12;
  const baseLineHeight = textStyleRest.lineHeight ?? processedTextStyle.lineHeight;
  const baseMarginTop = textStyleRest.marginTop ?? 0;
  
  const textStyle = {
    color: '#666666',
    textAlign: 'center' as const,
    ...processedTextStyle,
    ...textStyleRest,
    fontSize: baseFontSize * scale,
    lineHeight: baseLineHeight ? baseLineHeight * scale : undefined,
    marginTop: baseMarginTop * scale,
  };

  // Calculate sizes
  const availableWidth = SCREEN_WIDTH - containerPaddingHorizontal * 2;
  const itemWidth = (availableWidth - scaledColGap * (Math.floor(numColumns) - 1)) / numColumns;
  const labelSpace = showLabels ? 40 : 0;
  const itemHeight = (itemWidth / aspectRatio) + labelSpace;

  // The wrapper height needs to exactly match (numRows * itemHeight) + (numRows - 1) * scaledRowGap
  const wrapperHeight = numRows * itemHeight + (numRows - 1) * scaledRowGap;

  const layoutType = gridConfig.layout || 'uniform';

  const itemLayouts = useMemo(() => {
    const layouts = [];
    let currentCol = 0;
    let currentRow = 0;

    for (let index = 0; index < gridItems.length; index++) {
      let w = itemWidth;
      let h = itemHeight;
      let x = 0;
      let y = 0;

      if (index === 0 && layoutType === 'featured-left') {
        w = itemWidth;
        h = itemHeight * 2 + scaledRowGap;
        x = 0;
        y = 0;
        currentCol = 1;
      } else {
        x = currentCol * (itemWidth + scaledColGap);
        y = currentRow * (itemHeight + scaledRowGap);
        
        currentRow++;
        if (currentRow >= numRows) {
          currentRow = 0;
          currentCol++;
        }
      }
      
      layouts.push({ w, h, x, y, item: gridItems[index], index });
    }
    return layouts;
  }, [gridItems, layoutType, itemWidth, itemHeight, scaledColGap, scaledRowGap, numRows]);

  const wrapperWidth = itemLayouts.length > 0 
    ? Math.max(...itemLayouts.map(l => l.x + l.w))
    : availableWidth;

  return (
    <BaseContentBlock block={block} style={containerStyle}>
      {title && (
        <Text style={titleStyle}>{title}</Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: containerPaddingHorizontal,
          paddingBottom: 8,
        }}
      >
        <View
          style={{
            position: 'relative',
            height: wrapperHeight,
            width: wrapperWidth,
          }}
        >
          {itemLayouts.map(({ w, h, x, y, item, index }) => {
            const imgHeight = h - labelSpace;
            return (
              <TouchableOpacity
                key={item.id || index}
                style={{ width: w, height: h, position: 'absolute', left: x, top: y }}
                onPress={item.onPress}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.imageContainer,
                    {
                      width: w,
                      height: imgHeight,
                      borderRadius,
                      backgroundColor: cellBackgroundColor,
                    },
                  ]}
                >
                  {item.imageUrl ? (
                    <ExpoImage
                      source={{ uri: shopifyImageUrl(item.imageUrl, Math.round(w * 2)) }}
                      style={[{ width: '100%', height: '100%' }, { borderRadius }]}
                      contentFit={resizeMode as any}
                    />
                  ) : item.imageSource ? (
                    <ExpoImage
                      source={item.imageSource}
                      style={[{ width: '100%', height: '100%' }, { borderRadius }]}
                      contentFit={resizeMode as any}
                    />
                  ) : (
                    <View style={[{ width: '100%', height: '100%', backgroundColor: '#f0f0f0' }, { borderRadius }]} />
                  )}
                </View>
                {showLabels && item.label && (
                  <Text style={[textStyle, { width: w }]} numberOfLines={2}>
                    {item.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </BaseContentBlock>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    overflow: 'hidden',
  },
});
