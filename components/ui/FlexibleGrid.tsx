import { Colors, Fonts } from '@/constants/theme';
import {
  resolveFixedImageHeight,
  resolveImageHeightFromAspect,
  resolveRowWidths,
} from '@/utils/gridCellSizing';
import { Image as ExpoImage } from 'expo-image';
import React, { useMemo } from 'react';
import { shopifyImageUrl } from '@/utils/shopifyIds';
import {
    Dimensions,
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function resolveItemAspectRatio(item: GridItem, defaultAspectRatio: number): number {
  return typeof item.aspectRatio === 'number' && item.aspectRatio > 0
    ? item.aspectRatio
    : defaultAspectRatio;
}

function resolveItemHeight(
  item: GridItem,
  itemWidth: number,
  defaultAspectRatio: number,
  labelSpace: number
): number {
  return itemWidth / resolveItemAspectRatio(item, defaultAspectRatio) + labelSpace;
}

/**
 * FlexibleGrid - A flexible grid component with multiple layout patterns
 * 
 * Layout Types:
 * - 'uniform': All items same size (standard grid)
 * - 'first-item-2-col': First item spans 2 columns, rest are squares
 * - 'first-item-2-row': First item spans 2 rows, rest are squares  
 * - 'first-item-2x2': First item spans 2x2 (2 columns, 2 rows)
 * - 'masonry': Alternating sizes for visual interest (every 4th item is larger)
 * - 'featured-left': First item on left takes 2 rows, rest fill right
 * - 'featured-top': First item on top takes 2 columns, rest fill below
 * 
 * Example usage:
 * ```tsx
 * <FlexibleGrid
 *   items={categoryItems}
 *   layout="first-item-2-col"
 *   numColumns={3}
 *   gap={12}
 *   padding={16}
 *   aspectRatio={1}
 *   showLabels={true}
 * />
 * ```
 */
export type GridLayoutType =
  | 'uniform' // All items same size (default)
  | 'first-item-2-col' // First item spans 2 columns, rest are squares
  | 'first-item-2-row' // First item spans 2 rows, rest are squares
  | 'first-item-2x2' // First item spans 2x2 (2 columns, 2 rows)
  | 'masonry' // Alternating sizes for visual interest
  | 'featured-left' // First item on left takes 2 rows, rest fill right
  | 'featured-top'; // First item on top takes 2 columns, rest fill below

export interface GridItem {
  id: string;
  imageUrl?: string;
  imageSource?: any; // require() image
  label?: string;
  /** Cell width ÷ height when `itemHeight` is not set. */
  aspectRatio?: number;
  /** Row width share (e.g. 0.6). Use with grid `itemHeight` for same-height cells. */
  widthFraction?: number;
  onPress?: () => void;
  [key: string]: any; // Allow additional properties
}

export interface FlexibleGridProps {
  items: GridItem[];
  layout?: GridLayoutType;
  numColumns?: number; // Base number of columns (default: 3)
  gap?: number; // Gap between items (default: 12) - used for both colGap and rowGap
  colGap?: number; // Column gap (horizontal spacing) - overrides gap if specified
  rowGap?: number; // Row gap (vertical spacing) - overrides gap if specified
  padding?: number; // Container padding (default: 16)
  aspectRatio?: number; // Aspect ratio for square items (default: 1)
  /** Fixed image height (px). Same for all cells; use with per-item `widthFraction`. */
  itemHeight?: number;
  renderItem?: (item: GridItem, index: number, size: { width: number; height: number }) => React.ReactNode;
  imageResizeMode?: 'cover' | 'contain' | 'stretch';
  showLabels?: boolean;
  borderRadius?: number;
  labelStyle?: Record<string, any>; // Custom styles for labels (from blockStyles.text)
  firstItemSpan?: {
    colSpan?: number; // How many columns the first item should span (default: based on layout)
    rowSpan?: number; // How many rows the first item should span (default: based on layout)
  };
  /** When cells in a row have different heights, align within the row (default: top). */
  rowAlign?: 'top' | 'bottom';
}

export function FlexibleGrid({
  items,
  layout = 'uniform',
  numColumns = 3,
  gap = 12,
  colGap,
  rowGap,
  padding = 16,
  aspectRatio = 1,
  itemHeight: fixedItemHeight,
  renderItem,
  imageResizeMode = 'cover',
  showLabels = true,
  borderRadius = 12,
  labelStyle,
  firstItemSpan,
  rowAlign = 'top',
}: FlexibleGridProps) {
  // Use colGap/rowGap if specified, otherwise fall back to gap
  const finalColGap = colGap ?? gap;
  const finalRowGap = rowGap ?? gap;
  
  // Calculate available width - account for container padding
  // If padding is 0, we assume the parent container handles padding
  const availableWidth = padding > 0 ? SCREEN_WIDTH - padding * 2 : SCREEN_WIDTH;
  const totalGap = finalColGap * (numColumns - 1);
  const baseItemWidth = (availableWidth - totalGap) / numColumns;
  // Add space for label if showing labels
  const labelSpace = showLabels ? 40 : 0;
  const baseItemHeight = (baseItemWidth / aspectRatio) + labelSpace;
  const fixedImageHeight = resolveFixedImageHeight(fixedItemHeight, labelSpace, showLabels);

  const resolveCellHeight = (item: GridItem, itemWidth: number) => {
    if (fixedImageHeight != null) {
      return fixedImageHeight + labelSpace;
    }
    return (
      resolveImageHeightFromAspect(
        itemWidth,
        item.aspectRatio,
        aspectRatio,
        labelSpace,
        showLabels
      ) + labelSpace
    );
  };

  const uniformRowMetrics = useMemo(() => {
    if (layout !== 'uniform' && layout !== 'masonry') {
      return null;
    }
    const rowCount = Math.ceil(items.length / numColumns) || 0;
    const rowStartY: number[] = [];
    const rowMaxHeight: number[] = [];
    const rowWidths: number[][] = [];
    let y = 0;
    for (let row = 0; row < rowCount; row += 1) {
      rowStartY[row] = y;
      const rowStartIndex = row * numColumns;
      const rowItems = items.slice(rowStartIndex, rowStartIndex + numColumns);
      const widths = resolveRowWidths(rowItems, availableWidth, finalColGap);
      rowWidths[row] = widths;

      let maxH = 0;
      rowItems.forEach((item, col) => {
        const w = widths[col] ?? baseItemWidth;
        maxH = Math.max(maxH, resolveCellHeight(item, w));
      });
      rowMaxHeight[row] = maxH;
      y += maxH + finalRowGap;
    }
    return { rowStartY, rowMaxHeight, rowWidths };
  }, [
    layout,
    items,
    numColumns,
    baseItemWidth,
    aspectRatio,
    labelSpace,
    finalRowGap,
    availableWidth,
    finalColGap,
    fixedImageHeight,
    showLabels,
  ]);

  // Calculate item positions and sizes based on layout
  const itemLayouts = useMemo(() => {
    const layouts: Array<{
      item: GridItem;
      index: number;
      x: number;
      y: number;
      width: number;
      height: number;
      colSpan: number;
      rowSpan: number;
    }> = [];

    // Determine first item spans (use custom if provided, otherwise use layout defaults)
    const firstItemColSpan = firstItemSpan?.colSpan ?? 
      (layout === 'first-item-2-col' || layout === 'first-item-2x2' || layout === 'featured-top' ? 2 : 1);
    const firstItemRowSpan = firstItemSpan?.rowSpan ?? 
      (layout === 'first-item-2-row' || layout === 'first-item-2x2' || layout === 'featured-left' ? 2 : 1);
    
    // If custom spans are provided, use a custom layout logic
    const useCustomFirstItem = firstItemSpan && (firstItemSpan.colSpan !== undefined || firstItemSpan.rowSpan !== undefined);

    items.forEach((item, index) => {
      let itemWidth = baseItemWidth;
      let itemHeight = resolveItemHeight(item, baseItemWidth, aspectRatio, labelSpace);
      let colSpan = 1;
      let rowSpan = 1;
      let x = 0;
      let y = 0;

      if (index === 0 && useCustomFirstItem) {
        // Custom first item spans
        colSpan = firstItemColSpan;
        rowSpan = firstItemRowSpan;
        itemWidth = baseItemWidth * colSpan + finalColGap * (colSpan - 1);
        itemHeight =
          resolveItemHeight(item, itemWidth, aspectRatio, labelSpace) * rowSpan +
          finalRowGap * (rowSpan - 1);
        x = 0;
        y = 0;
      } else if (index === 0 && layout !== 'uniform' && layout !== 'masonry') {
        // Use layout-based spans for first item
        switch (layout) {
          case 'first-item-2-col':
          case 'featured-top':
            colSpan = 2;
            itemWidth = baseItemWidth * 2 + finalColGap;
            break;
          case 'first-item-2-row':
          case 'featured-left':
            rowSpan = 2;
            itemHeight =
              resolveItemHeight(item, itemWidth, aspectRatio, labelSpace) * 2 + finalRowGap;
            break;
          case 'first-item-2x2':
            colSpan = 2;
            rowSpan = 2;
            itemWidth = baseItemWidth * 2 + finalColGap;
            itemHeight =
              resolveItemHeight(item, itemWidth, aspectRatio, labelSpace) * 2 + finalRowGap;
            break;
        }
        x = 0;
        y = 0;
      } else {
        // Remaining items positioning
        if (index === 0) {
          // Already handled above - skip
        } else if (useCustomFirstItem || (layout !== 'uniform' && layout !== 'masonry')) {
          // Handle positioning when first item has custom spans or layout-based spans
          const adjustedIndex = index - 1;
          const availableCols = numColumns - firstItemColSpan;
          
          // Calculate which row and column this item should be in
          let targetRow = 0;
          let targetCol = 0;
          
          if (adjustedIndex < availableCols * firstItemRowSpan) {
            // Items that fit in the first N rows (where N = firstItemRowSpan)
            // These go to the right of the first item
            targetRow = Math.floor(adjustedIndex / availableCols);
            targetCol = (adjustedIndex % availableCols) + firstItemColSpan;
            x = targetCol * (baseItemWidth + finalColGap);
            y = targetRow * (baseItemHeight + finalRowGap);
          } else {
            // Items after the first N rows - use full grid
            const remainingIndex = adjustedIndex - (availableCols * firstItemRowSpan);
            targetRow = Math.floor(remainingIndex / numColumns) + firstItemRowSpan;
            targetCol = remainingIndex % numColumns;
            x = targetCol * (baseItemWidth + finalColGap);
            y = targetRow * (baseItemHeight + finalRowGap);
          }
        } else if (uniformRowMetrics) {
          const col = index % numColumns;
          const row = Math.floor(index / numColumns);
          const rowWidthList = uniformRowMetrics.rowWidths[row] ?? [];
          itemWidth = rowWidthList[col] ?? baseItemWidth;
          itemHeight = resolveCellHeight(item, itemWidth);
          x =
            rowWidthList.slice(0, col).reduce((acc, w) => acc + w, 0) +
            col * finalColGap;
          const rowY = uniformRowMetrics.rowStartY[row] ?? 0;
          const rowMax = uniformRowMetrics.rowMaxHeight[row] ?? itemHeight;
          y =
            rowAlign === 'bottom'
              ? rowY + Math.max(0, rowMax - itemHeight)
              : rowY;
        } else {
          const col = index % numColumns;
          const row = Math.floor(index / numColumns);
          x = col * (baseItemWidth + finalColGap);
          y = row * (baseItemHeight + finalRowGap);
          itemHeight = resolveItemHeight(item, baseItemWidth, aspectRatio, labelSpace);
        }
      }

      layouts.push({
        item,
        index,
        x,
        y,
        width: itemWidth,
        height: itemHeight,
        colSpan,
        rowSpan,
      });
    });

    return layouts;
  }, [
    items,
    layout,
    numColumns,
    finalColGap,
    finalRowGap,
    baseItemWidth,
    baseItemHeight,
    aspectRatio,
    labelSpace,
    firstItemSpan,
    uniformRowMetrics,
    rowAlign,
  ]);

  const defaultRenderItem = (
    item: GridItem,
    index: number,
    size: { width: number; height: number }
  ) => {
    // Calculate image height - leave space for label if showing labels
    const labelHeight = showLabels ? 40 : 0;
    const imageHeight = size.height - labelHeight;
    
    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          {
            width: size.width,
            height: size.height,
          },
        ]}
        onPress={item.onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.imageContainer, { 
          borderRadius,
          height: imageHeight,
          width: size.width,
        }]}>
          {item.imageUrl ? (
            <ExpoImage
              source={{ uri: shopifyImageUrl(item.imageUrl, Math.round(size.width * 2)) }}
              style={[styles.image, { borderRadius }]}
              contentFit={imageResizeMode === 'stretch' ? 'fill' : imageResizeMode}
            />
          ) : item.imageSource ? (
            <Image
              source={item.imageSource}
              style={[styles.image, { borderRadius }]}
              resizeMode={imageResizeMode}
            />
          ) : (
            <View style={[styles.placeholder, { borderRadius }]}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
        {showLabels && item.label && (
          <Text 
            style={[
              styles.label, 
              { width: size.width },
              labelStyle, // Apply custom label styles from config (overrides defaults)
            ]} 
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {item.label}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderItemFn = renderItem || defaultRenderItem;

  // Calculate container height
  const maxY = Math.max(...itemLayouts.map((layout) => layout.y + layout.height));
  const containerHeight = maxY + padding;

  return (
    <View style={[styles.container, { padding, paddingBottom: padding }]}>
      <View style={[styles.gridContainer, { minHeight: containerHeight }]}>
        {itemLayouts.map(({ item, index, x, y, width, height }) => (
          <View
            key={item.id || index}
            style={[
              styles.itemWrapper,
              {
                position: 'absolute',
                left: x,
                top: y,
                width,
                minHeight: height,
              },
            ]}
          >
            {renderItemFn(item, index, { width, height })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  gridContainer: {
    position: 'relative',
    width: '100%',
  },
  itemWrapper: {
    overflow: 'visible',
    alignItems: 'flex-start',
  },
  itemContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  imageContainer: {
    backgroundColor: Colors.backgroundWhite,
    overflow: 'hidden',
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.grey,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Fonts.Regular,
  },
  label: {
    fontSize: 11,
    fontFamily: Fonts.Medium,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 0,
    marginTop: 4,
  },
});
