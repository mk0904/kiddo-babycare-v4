import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ProductCollection, CollectionComponentProps } from './ProductCollection';
import { ProductCard } from './ProductCard';
import { ProductCollectionProps } from './ProductCollection';

const Grid: React.FC<CollectionComponentProps> = ({
  products,
  productStyle,
  contentWidth,
  listStyle,
  productOptions,
  productLayout,
}) => {
  const itemGap = listStyle?.itemGap ?? 8;
  const productCardWidth = Math.floor((contentWidth - itemGap) / 2);

  const productCardStyle = React.useMemo(() => {
    return {
      ...productStyle,
      root: { ...productStyle?.root, width: productCardWidth },
    };
  }, [productCardWidth, productStyle]);

  // FlashList doesn't support numColumns directly, so we need to transform data into rows
  const rowData = React.useMemo(() => {
    const rows: string[][] = [];
    for (let i = 0; i < products.length; i += 2) {
      rows.push(products.slice(i, i + 2));
    }
    return rows;
  }, [products]);

  // Calculate estimated item size for FlashList
  const estimatedItemSize = React.useMemo(() => {
    return productCardWidth + 8; // card width + margin
  }, [productCardWidth]);

  return (
    <FlashList
      data={rowData}
      estimatedItemSize={estimatedItemSize}
      estimatedListSize={{
        height: 400,
        width: contentWidth,
      }}
      scrollEnabled={false} // Disable scrolling when nested in ScrollView
      keyExtractor={(_, index) => `row-${index}`}
      // Android performance optimizations (Kiddo pattern)
      drawDistance={estimatedItemSize * 2}
      initialNumToRender={4}
      maxToRenderPerBatch={2}
      windowSize={3}
      removeClippedSubviews={true}
      updateCellsBatchingPeriod={100}
      overrideItemLayout={(layout) => {
        layout.size = estimatedItemSize;
      }}
      renderItem={({ item: rowItems }) => {
        return (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: listStyle?.root?.paddingHorizontal || 16,
              marginBottom: itemGap,
            }}
          >
            {rowItems.map((item, index) => (
              <View
                key={`${item}-${index}`}
                style={{
                  width: productCardWidth,
                }}
              >
                <ProductCard
                  product={item}
                  style={productCardStyle}
                  options={productOptions}
                  width={productCardWidth}
                />
              </View>
            ))}
            {/* Fill empty space if odd number of items */}
            {rowItems.length === 1 && <View style={{ width: productCardWidth }} />}
          </View>
        );
      }}
      contentContainerStyle={listStyle?.contentContainer}
    />
  );
};

export interface ProductGridProps extends Omit<ProductCollectionProps, 'CollectionComponent'> {
  collectionId?: string | string[];
  collectionHandle?: string;
  searchQuery?: string;
  products?: string[]; // Product handles (strings)
}

export function ProductGrid({
  collectionId,
  collectionHandle,
  searchQuery = '',
  products,
  showHeading = true,
  title,
  subTitle,
  showViewAll = false,
  style,
  contentWidth,
  productStyle,
  productOptions,
  productLayout,
  productSource,
  onViewAll,
}: ProductGridProps) {
  return (
    <ProductCollection
      collectionId={collectionId}
      collectionHandle={collectionHandle}
      searchQuery={searchQuery}
      products={products}
      CollectionComponent={Grid}
      showHeading={showHeading}
      title={title}
      subTitle={subTitle}
      showViewAll={showViewAll}
      style={style}
      contentWidth={contentWidth}
      productStyle={productStyle}
      productOptions={productOptions}
      productLayout={productLayout}
      productSource={productSource}
      onViewAll={onViewAll}
    />
  );
}

