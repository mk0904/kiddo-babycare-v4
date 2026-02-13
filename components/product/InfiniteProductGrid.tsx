import React from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View, FlatList, Dimensions } from 'react-native';
import { ProductCard } from './ProductCard';
import { CollectionComponentProps, ProductCollection, ProductCollectionProps } from './ProductCollection';
import { EmptyState } from '@/components/ui/EmptyState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const InfiniteGrid: React.FC<CollectionComponentProps & { scrollable?: boolean }> = ({
  products,
  productStyle,
  hasNextPage,
  fetchMore,
  collectionId,
  contentWidth,
  listStyle,
  productOptions,
  productLayout,
  scrollable = false,
  isFetchingNextPage,
  isRefetching,
  refetch,
}) => {
  // Get configurable values from productOptions, with defaults
  const paddingHorizontal = productOptions?.paddingHorizontal ?? productOptions?.horizontalPadding ?? 8;
  const gap = productOptions?.gap ?? 8;
  const rowGap = productOptions?.rowGap ?? productOptions?.gap ?? 8;
  const colGap = productOptions?.colGap ?? productOptions?.gap ?? 8;
  
  // Calculate available width: screen width minus padding (always use screen width for consistency)
  const availableWidth = SCREEN_WIDTH - paddingHorizontal * 2;
  
  // Card width: (availableWidth - colGap) / 2
  // Don't floor - use exact calculation to avoid gaps
  const productCardWidth = (availableWidth - colGap) / 2;


  const productCardStyle = React.useMemo(() => {
    return {
      ...productStyle,
      root: {
        ...productStyle?.root,
        width: productCardWidth,
      },
    };
  }, [productCardWidth, productStyle]);

  // Match gauntlet: simple renderItem, no wrapper Views
  const renderItem = React.useCallback(
    ({ item }: { item: any }) => {
      return (
        <ProductCard
          product={item}
          containerStyle={productCardStyle?.root}
          numColumns={productOptions?.numColumns}
          width={productCardWidth}
          collectionId={collectionId}
        />
      );
    },
    [productCardStyle, productOptions, productCardWidth, collectionId]
  );

  // Match gauntlet: simple keyExtractor
  const keyExtractor = React.useCallback((item: any) => {
    return item.id || item.handle || item;
  }, []);

  // Handle empty state
  if (!Array.isArray(products) || products.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="cube-outline"
          title="No Products Available"
          subtitle="New products coming soon!"
        />
      </View>
    );
  }

  // Simple: 8px padding, 8px gap, that's it
  return (
    <FlatList
      data={products}
      numColumns={2}
      keyExtractor={keyExtractor}
      showsVerticalScrollIndicator={false}
      renderItem={renderItem}
      refreshControl={
        refetch ? (
          <RefreshControl
            tintColor={'blue'}
            refreshing={isRefetching || false}
            onRefresh={refetch}
          />
        ) : undefined
      }
      scrollEnabled={scrollable}
      initialNumToRender={6}
      windowSize={4}
      maxToRenderPerBatch={6}
      contentContainerStyle={[
        {
          paddingHorizontal: paddingHorizontal,
          paddingTop: 12,
          paddingBottom: 8,
        },
        listStyle?.contentContainer,
      ]}
      columnWrapperStyle={{
        justifyContent: 'space-between',
        width: availableWidth, // Match exactly with card calculation
        marginBottom: rowGap, // Add row gap between rows
      }}
      onEndReached={(d) => {
        if (hasNextPage && fetchMore) {
          const id = Array.isArray(collectionId) ? collectionId[0] : collectionId;
          fetchMore(id || null);
        }
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={styles.footer}>
            <ActivityIndicator size="small" color="#000" />
          </View>
        ) : null
      }
    />
  );
};

const styles = StyleSheet.create({
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export interface InfiniteProductGridProps
  extends Omit<ProductCollectionProps, 'CollectionComponent'> {
  collectionId?: string;
  collectionHandle?: string;
  searchQuery?: string;
  products?: any[]; // Full product objects
  setDynamicFooter?: (footer: any) => void;
  scrollable?: boolean; // Allow scrolling when used as main content (not nested)
  sortKey?: string;
  reverse?: boolean;
  filters?: any[];
  onFacetsLoaded?: (facets: any[]) => void;
  onResultsCount?: (count: number) => void;
  contentContainerStyle?: any;
  genderFilter?: string | null;
  ageFilter?: string | null;
}

export function InfiniteProductGrid({
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
  setDynamicFooter,
  scrollable = false,
  sortKey,
  reverse,
  filters,
  onFacetsLoaded,
  onResultsCount,
  contentContainerStyle,
  genderFilter,
  ageFilter,
}: InfiniteProductGridProps) {
  return (
    <ProductCollection
      collectionId={collectionId}
      collectionHandle={collectionHandle}
      searchQuery={searchQuery}
      products={products}
      CollectionComponent={(props) => <InfiniteGrid {...props} scrollable={scrollable} />}
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
      sortKey={sortKey}
      reverse={reverse}
      filters={filters}
      onFacetsLoaded={onFacetsLoaded}
      onResultsCount={onResultsCount}
      contentContainerStyle={contentContainerStyle}
      genderFilter={genderFilter}
      ageFilter={ageFilter}
    />
  );
}
