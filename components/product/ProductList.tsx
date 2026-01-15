import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ProductCollection, CollectionComponentProps } from './ProductCollection';
import { ProductCard } from './ProductCard';
import { ProductCollectionProps } from './ProductCollection';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const List: React.FC<CollectionComponentProps> = ({
  products,
  productStyle,
  contentWidth,
  listStyle,
  productOptions,
  productLayout,
}) => {
  const { width } = useDeviceDimensions();
  const horizontal = productOptions?.horizontal ?? true;
  const itemGap = listStyle?.itemGap ?? 8;
  const itemsPerView = productOptions?.itemsPerView ?? 2;
  const sidePadding = productOptions?.sidePadding ?? 20;

  // Apply limit if specified in productOptions (safeguard)
  const limit = productOptions?.limit;
  const limitedProducts = React.useMemo(() => {
    if (limit && limit > 0 && Array.isArray(products)) {
      return products.slice(0, limit);
    }
    return products;
  }, [products, limit]);

  // Calculate item width based on itemsPerView (Kiddo pattern)
  const itemWidth = React.useMemo(() => {
    const totalPadding = sidePadding * 2;
    const totalSpacing = itemGap * (Math.ceil(itemsPerView) - 1);
    const availableWidth = width - totalPadding - totalSpacing;
    return availableWidth / itemsPerView;
  }, [itemsPerView, itemGap, sidePadding, width]);

  const productCardWidth = React.useMemo(() => {
    return productStyle?.root?.width ?? (horizontal ? itemWidth : contentWidth);
  }, [productStyle?.root?.width, horizontal, itemWidth, contentWidth]);

  const productCardStyle = React.useMemo(() => {
    return {
      ...productStyle,
      root: {
        ...productStyle?.root,
        width: productCardWidth,
      },
    };
  }, [productCardWidth, productStyle]);

  const { paddingLeft, paddingRight } = React.useMemo(() => {
    return {
      paddingLeft: (width - contentWidth) / 2,
      paddingRight: (width - contentWidth) / 2,
    };
  }, [contentWidth, width]);

  const renderItem = React.useCallback(
    ({ item }: { item: string }) => {
      // item is a product handle (string)
      return (
        <ProductCard
          product={item}
          style={productCardStyle}
          options={productOptions}
          width={productCardWidth}
        />
      );
    },
    [productCardStyle, productOptions, productCardWidth]
  );

  // Use FlashList for better performance
  const estimatedItemSize = React.useMemo(() => {
    return horizontal ? itemWidth + itemGap : itemWidth;
  }, [horizontal, itemWidth, itemGap]);

  return (
    <FlashList
      data={limitedProducts}
      horizontal={horizontal}
      estimatedItemSize={estimatedItemSize}
      estimatedListSize={{
        height: horizontal ? itemWidth : 400,
        width: horizontal ? 400 : contentWidth,
      }}
      scrollEnabled={horizontal} // Only enable scrolling for horizontal lists (not nested in vertical ScrollView)
      keyExtractor={(item) => item}
      contentContainerStyle={{
        paddingLeft: horizontal ? sidePadding : paddingLeft,
        paddingRight: horizontal ? sidePadding : paddingRight,
        paddingBottom: 8,
        ...listStyle?.root,
      }}
      showsHorizontalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={{ width: itemGap }} />}
      // Android performance optimizations (Kiddo pattern)
      drawDistance={horizontal ? (itemWidth + itemGap) * 2 : estimatedItemSize * 2}
      initialNumToRender={horizontal ? 3 : 4}
      maxToRenderPerBatch={2}
      windowSize={3}
      removeClippedSubviews={true}
      updateCellsBatchingPeriod={100}
      scrollEventThrottle={32} // Optimized for smooth scrolling
      decelerationRate="normal" // Changed from default "fast"
      overrideItemLayout={(layout) => {
        layout.size = estimatedItemSize;
      }}
      renderItem={renderItem}
    />
  );
};

export interface ProductListProps extends Omit<ProductCollectionProps, 'CollectionComponent'> {
  collectionId?: string | string[];
  collectionHandle?: string;
  searchQuery?: string;
  products?: string[];
}

export function ProductList({
  collectionId,
  collectionHandle,
  searchQuery = '',
  products,
  showHeading = true,
  title,
  subTitle,
  showViewAll = false,
  viewAllText,
  style,
  contentWidth,
  productStyle,
  productOptions,
  productLayout,
  productSource,
  onViewAll,
  limit,
}: ProductListProps) {
  return (
    <ProductCollection
      collectionId={collectionId}
      collectionHandle={collectionHandle}
      searchQuery={searchQuery}
      products={products}
      CollectionComponent={List}
      showHeading={showHeading}
      title={title}
      subTitle={subTitle}
      showViewAll={showViewAll}
      viewAllText={viewAllText}
      style={style}
      contentWidth={contentWidth}
      productStyle={productStyle}
      productOptions={productOptions}
      productLayout={productLayout}
      productSource={productSource}
      onViewAll={onViewAll}
      limit={limit}
    />
  );
}

