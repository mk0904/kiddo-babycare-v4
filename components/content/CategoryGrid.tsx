import { FlexibleGrid, GridItem, GridLayoutType } from '@/components/ui/FlexibleGrid';
import { Colors, Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { configService } from '@/services/configService';
import { shopifyApi } from '@/services/shopifyApi';
import { CategoryGridBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface CollectionItem {
  id: string;
  name: string;
  imageUrl: string;
  aspectRatio?: number;
  widthFraction?: number;
}

interface CategoryGridProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: CategoryGridBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function CategoryGrid({ block, onPress }: CategoryGridProps) {
  const router = useRouter();
  const { width } = useDeviceDimensions();
  const { title, categoryKeys = [], collectionIds, gridConfig = {}, styles: blockStyles } = block;
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load collections if collectionIds are provided (similar to ImageGrid)
  const loadCollections = useCallback(async () => {
    if (!collectionIds || collectionIds.length === 0) {
      setCollections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Use Promise.allSettled to handle individual failures
      const collectionPromises = collectionIds.map((collection) => {
        // Skip network fetch if config already provides the name and image!
        if (typeof collection === 'object' && collection.name && collection.imageUrl) {
          return Promise.resolve(collection);
        }
        return shopifyApi.getCollectionById(
          typeof collection === 'object' ? collection.id : collection
        ).catch((error) => {
          console.error(`[CategoryGrid] Error loading collection:`, error);
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
              
            // If the result was mocked from the config above, use it directly
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
      console.error('[CategoryGrid] Error fetching collections:', error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [collectionIds]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Get all categories from config
  const categories = useMemo(() => {
    const configCategories = configService.getCategories();
    if (!configCategories?.order) {
      return [];
    }

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

  // Filter categories if categoryKeys specified
  const filteredCategories = useMemo(() => {
    if (categoryKeys.length === 0) {
      return categories;
    }
    return categories.filter((cat) => categoryKeys.includes(cat.key));
  }, [categories, categoryKeys]);

  // Convert to GridItem format
  // If collectionIds are provided, use collections; otherwise use categories
  const gridItems: GridItem[] = useMemo(() => {
    let items: GridItem[] = [];

    if (collectionIds && collectionIds.length > 0) {
      // Use collections from collectionIds
      items = collections.map((collection, index) => {
        // Use the full collection ID (keep gid:// format if present)
        const collectionId = collection.id;

        return {
          id: collection.id,
          label: collection.name,
          imageUrl: collection.imageUrl,
          imageSource: undefined,
          aspectRatio: collection.aspectRatio,
          widthFraction: collection.widthFraction,
          onPress: () => {
            // Track grid cell click
            try {
              const { trackGridCellClicked } = require('@/utils/mixpanelHelpers');
              trackGridCellClicked(
                block.id || 'category-grid',
                index + 1,
                collectionId,
                collection.name,
                undefined,
                undefined,
                collections.length,
                numColumns
              );
            } catch (e) {
              console.warn('Grid cell click tracking error:', e);
            }
            // Pass collection info to onPress handler (let parent handleBlockPress handle navigation)
            // This ensures consistent navigation behavior across home and category pages
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
      // Use categories
      items = filteredCategories.map((category, index) => ({
        id: category.key,
        label: category.label,
        imageUrl: category.iconUrl,
        imageSource: category.iconImage,
        onPress: () => {
          // Track grid cell click
          try {
            const { trackGridCellClicked } = require('@/utils/mixpanelHelpers');
            trackGridCellClicked(
              block.id || 'category-grid',
              index + 1,
              undefined,
              undefined,
              category.key,
              category.label,
              filteredCategories.length,
              numColumns
            );
          } catch (e) {
            console.warn('Grid cell click tracking error:', e);
          }
          if (category.key === 'all') {
            router.push('/(tabs)' as any);
          } else {
            router.push({
              pathname: '/(tabs)',
              params: { category: category.key },
            } as any);
          }
          onPress?.(undefined, category);
        },
      }));
    }

    // Apply limit if specified
    const limit = gridConfig.limit ?? 0;
    if (limit > 0) {
      items = items.slice(0, limit);
    }

    return items;
  }, [filteredCategories, collections, collectionIds, router, onPress, gridConfig.limit, block.id, numColumns]);

  // Get grid config with defaults (matching ImageGrid pattern)
  const numColumns = gridConfig.numColumns ?? 3;
  const colGap = gridConfig.colGap ?? gridConfig.gap ?? 12;
  const rowGap = gridConfig.rowGap ?? gridConfig.gap ?? 12;
  const aspectRatio = gridConfig.aspectRatio ?? 1;
  const resizeMode = gridConfig.resizeMode || gridConfig.imageResizeMode || 'cover';
  
  // Check if text display is set to "none" (matching ImageGrid pattern)
  const textDisplay = blockStyles?.text?.display;
  const shouldHideLabels = textDisplay === 'none' || textDisplay === 'hidden';
  
  // Determine if labels should be shown
  const showLabels = shouldHideLabels ? false : (gridConfig.showLabels !== false);
  
  const borderRadius = gridConfig.borderRadius ?? 12;
  
  // Get container styles (matching ImageGrid pattern)
  // Extract paddingHorizontal before spreading, so we can use it for FlexibleGrid
  const containerPaddingFromStyles = blockStyles?.container?.paddingHorizontal;
  const containerPaddingHorizontal = containerPaddingFromStyles || gridConfig.padding || 16;
  
  // Create container style without paddingHorizontal (FlexibleGrid will handle it)
  const {
    paddingHorizontal: _,
    ...containerStyleWithoutPadding
  } = blockStyles?.container || {};
  
  // Create final container style with paddingHorizontal explicitly set to 0
  // This will override any paddingHorizontal from blockStyles.container in BaseContentBlock
  const containerStyle = {
    marginVertical: 0,
    paddingHorizontal: 0, // Explicitly set to 0 to override blockStyles padding
    ...containerStyleWithoutPadding,
  };

  // Title style (matching ImageGrid pattern)
  const titleStyle = {
    marginBottom: 8,
    fontSize: 18,
    letterSpacing: 0,
    paddingHorizontal: blockStyles?.title?.paddingHorizontal !== undefined
      ? blockStyles.title.paddingHorizontal
      : (containerStyle.paddingHorizontal || containerPaddingHorizontal),
    // Do not spread raw blockStyles.title after processFontStyle — that re-applies
    // fontWeight and can break custom fonts (e.g. bogart) on section titles.
    ...processFontStyle(blockStyles?.title, Fonts.Black),
  };

  // Text/label style under each cell: configurable via styles.text (fontSize, fontWeight, fontFamily, etc.)
  // Do not spread raw blockStyles.text after processFontStyle — that re-applies fontWeight and can
  // break custom fonts (e.g. lexend-medium) on cell labels.
  const { fontWeight: _labelFw, fontFamily: _labelFf, ...textStyleRest } = blockStyles?.text || {};
  const processedTextStyle = processFontStyle(blockStyles?.text, Fonts.Bold);
  const textStyle = {
    color: '#666666',
    textAlign: 'center' as const,
    fontSize: 12,
    ...processedTextStyle,
    ...textStyleRest,
  };

  // Calculate gap for FlexibleGrid (use colGap as default, FlexibleGrid will handle rowGap separately if needed)
  // Note: FlexibleGrid currently uses a single 'gap' prop, so we use colGap
  // If rowGap differs, we might need to update FlexibleGrid to support separate gaps
  const gap = colGap;

  return (
    <BaseContentBlock block={block} style={containerStyle}>
      {title && (
        <Text style={titleStyle}>{title}</Text>
      )}
      <FlexibleGrid
        items={gridItems}
        layout={(gridConfig.layout || 'first-item-2-col') as GridLayoutType}
        numColumns={numColumns}
        gap={gap}
        colGap={colGap}
        rowGap={rowGap}
        padding={containerPaddingHorizontal}
        aspectRatio={aspectRatio}
        imageResizeMode={resizeMode as 'cover' | 'contain' | 'stretch'}
        showLabels={showLabels}
        borderRadius={borderRadius}
        labelStyle={textStyle}
        firstItemSpan={gridConfig.firstItemSpan}
        rowAlign={gridConfig.rowAlign}
        itemHeight={gridConfig.itemHeight}
      />
    </BaseContentBlock>
  );
}

const defaultStyles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontFamily: Fonts.Black,
    fontWeight: '900',
    color: Colors.text,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
});
