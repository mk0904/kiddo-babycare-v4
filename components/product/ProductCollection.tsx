import React from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Product } from '@/types/product';
import { ProductCard } from './ProductCard';
import { shopifyApi, CollectionResponse } from '@/services/shopifyApi';

export interface CollectionComponentProps {
  products: any[]; // Full product objects
  productStyle?: any;
  contentWidth: number;
  listStyle?: any;
  productOptions?: any;
  productLayout?: any;
  productSource?: any;
  hasNextPage?: boolean;
  fetchMore?: (collectionId: string | null) => void;
  collectionId?: string | string[] | null; // Support both single and multiple collection IDs
  searchQuery?: string;
  isFetchingNextPage?: boolean;
  isRefetching?: boolean;
  refetch?: () => void;
}

export interface ProductCollectionProps {
  collectionId?: string | string[]; // Support single or multiple collection IDs
  collectionHandle?: string;
  searchQuery?: string;
  products?: any[]; // Full product objects
  CollectionComponent: React.ComponentType<CollectionComponentProps>;
  showHeading?: boolean;
  showSubTitle?: boolean;
  title?: string;
  subTitle?: string;
  showViewAll?: boolean;
  showCollectionImage?: boolean;
  style?: any;
  contentWidth?: number;
  productStyle?: any;
  productOptions?: any;
  productLayout?: any;
  productSource?: any;
  onViewAll?: () => void;
  limit?: number; // Limit number of products to show
  sortKey?: string;
  reverse?: boolean;
  filters?: any[];
  onFacetsLoaded?: (facets: any[]) => void;
  onResultsCount?: (count: number) => void;
  contentContainerStyle?: any;
}

interface Page {
  products: any[]; // Full product objects
  nextCursor: string | null;
  hasNextPage: boolean;
  filters?: any[];
}

/**
 * Base ProductCollection component
 * Now uses React Query's useInfiniteQuery for efficient data fetching and caching
 */
export function ProductCollection({
  collectionId,
  collectionHandle,
  searchQuery = '',
  products: providedProducts,
  CollectionComponent,
  showHeading = false,
  showSubTitle = false,
  title,
  subTitle,
  showViewAll = false,
  showCollectionImage = false,
  style,
  contentWidth,
  productStyle,
  productOptions,
  productLayout,
  productSource,

  onViewAll,
  limit,
  sortKey = 'BEST_SELLING',
  reverse = false,
  filters = [],
  onFacetsLoaded,
  onResultsCount,
  contentContainerStyle,
}: ProductCollectionProps) {
  // Determine which collection ID to use (must be before hooks)
  const collectionIdToUse = React.useMemo(() => {
    if (providedProducts) return null; // Don't fetch if products are provided
    return Array.isArray(collectionId)
      ? collectionId[0]
      : collectionId || collectionHandle;
  }, [providedProducts, collectionId, collectionHandle]);

  // Fetch products using React Query's useInfiniteQuery
  // Must be called unconditionally (rules of hooks)
  // Increase initial page size to load more products upfront (like search results)
  const pageSize = limit || 50; // Increased from 20 to 50 to show more products initially
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery<Page>({
    queryKey: ['products', collectionIdToUse, searchQuery, sortKey, reverse, JSON.stringify(filters)],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!collectionIdToUse) {
        return {
          products: [],
          nextCursor: null,
          hasNextPage: false,
        };
      }

      const result = await shopifyApi.getProductsByCollection(
        collectionIdToUse!,
        pageSize,
        pageParam as string | null,
        sortKey,
        reverse,
        filters
      );

      if (!result?.products) {
        return {
          products: [],
          nextCursor: null,
          hasNextPage: false,
        };
      }

      const products = result.products.edges
        .map((edge) => edge.node)
        .filter((node): node is any => Boolean(node));

      return {
        products: products,
        nextCursor: result.products.pageInfo.endCursor,
        hasNextPage: result.products.pageInfo.hasNextPage,
        filters: result.products.filters, // Pass filters back
      };
    },
    getNextPageParam: (lastPage) => {
      return lastPage.hasNextPage ? lastPage.nextCursor : undefined;
    },
    enabled: !!collectionIdToUse, // Only fetch when we have a collection ID
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Automatically load more pages initially to show more products upfront (like search results)
  React.useEffect(() => {
    if (data?.pages && data.pages.length > 0 && hasNextPage && !isFetchingNextPage) {
      const totalProductsLoaded = data.pages.reduce((sum, page) => sum + page.products.length, 0);
      // Load up to 3-4 pages initially (approximately 150-200 products) to show "all products opened"
      const targetInitialProducts = pageSize * 3;
      if (totalProductsLoaded < targetInitialProducts) {
        // Small delay to avoid overwhelming the API
        const timer = setTimeout(() => {
          fetchNextPage();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [data?.pages, hasNextPage, isFetchingNextPage, fetchNextPage, pageSize]);

  // Effect to notify parent about loaded facets (from first page)
  React.useEffect(() => {
    if (data?.pages[0]?.filters) {
      // @ts-ignore
      onFacetsLoaded?.(data.pages[0].filters);
    }
  }, [data?.pages]);

  // Flatten all pages into a single array of product objects
  const allProducts = React.useMemo(
    () => data?.pages.flatMap((page) => page.products) || [],
    [data]
  );

  // Notify parent about result count
  React.useEffect(() => {
    onResultsCount?.(allProducts.length);
  }, [allProducts.length]);

  // Handle fetch more callback (must be before conditional returns)
  const handleFetchMore = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Memoize default values
  const defaultContentWidth = React.useMemo(() => contentWidth || 400, [contentWidth]);
  const defaultProductStyle = React.useMemo(() => productStyle || {}, [productStyle]);

  // If products are provided directly, use them without fetching
  if (providedProducts) {
    return (
      <View style={[styles.container, style?.root]}>
        {showHeading && title && (
          <View style={[styles.header, style?.header]}>
            <Text style={[styles.title, style?.title]}>{title}</Text>
            {showViewAll && onViewAll && (
              <Text style={[styles.viewAll, style?.viewAll]} onPress={onViewAll}>
                View All
              </Text>
            )}
          </View>
        )}
        {showSubTitle && subTitle && (
          <Text style={[styles.subTitle, style?.subTitle]}>{subTitle}</Text>
        )}
        <CollectionComponent
          products={providedProducts}
          productStyle={defaultProductStyle}
          contentWidth={defaultContentWidth}
          listStyle={style?.list}
          productOptions={productOptions}
          productLayout={productLayout}
          productSource={productSource}
          hasNextPage={false}
          collectionId={Array.isArray(collectionId) ? collectionId[0] : collectionId || null}
          searchQuery={searchQuery}
        />
      </View>
    );
  }

  // If no collection ID, return null
  if (!collectionIdToUse) {
    return null;
  }

  // Loading state
  if (isLoading && allProducts.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer, style?.root]}>
        <ActivityIndicator size="small" color="#000" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  // Empty state
  if (allProducts.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style?.root]}>
      {showHeading && title && (
        <View style={[styles.header, style?.header]}>
          <Text style={[styles.title, style?.title]}>{title}</Text>
          {showViewAll && onViewAll && (
            <Text style={[styles.viewAll, style?.viewAll]} onPress={onViewAll}>
              View All
            </Text>
          )}
        </View>
      )}
      {showSubTitle && subTitle && (
        <Text style={[styles.subTitle, style?.subTitle]}>{subTitle}</Text>
      )}
      <CollectionComponent
        products={allProducts}
        productStyle={defaultProductStyle}
        contentWidth={defaultContentWidth}
        listStyle={{
          ...style?.list,
          contentContainer: contentContainerStyle, // Merge contentContainerStyle into listStyle
        }}
        productOptions={productOptions}
        productLayout={productLayout}
        productSource={productSource}
        hasNextPage={hasNextPage}
        fetchMore={handleFetchMore}
        collectionId={collectionIdToUse}
        searchQuery={searchQuery}
        isFetchingNextPage={isFetchingNextPage}
        isRefetching={isRefetching}
        refetch={refetch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  subTitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
});
