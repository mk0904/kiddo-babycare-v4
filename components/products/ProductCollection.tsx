import { Colors, Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { shopifyApi } from '@/services/shopifyApi';
import { analyticsService } from '@/services/analyticsService';
import { sortInStockFirst } from '@/utils/availability';
import { processFontStyle } from '@/utils/fontUtils';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { ProductCardSkeleton } from '@/components/ui/SkeletonLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  onScroll?: (event: any) => void;
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
  viewAllText?: string; // Configurable "View All" button text
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
  genderFilter?: string | null;
  ageFilter?: string | null;
  pageCategory?: 'fashion' | 'toys' | 'essentials' | 'other' | null;
  onScroll?: (event: any) => void;
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
  viewAllText = 'View All', // Default text
  showCollectionImage = false,
  style,
  contentWidth,
  productStyle,
  productOptions,
  productLayout,
  productSource,

  onViewAll,
  limit,
  sortKey,
  reverse = false,
  filters = [],
  onFacetsLoaded,
  onResultsCount,
  contentContainerStyle,
  genderFilter,
  ageFilter,
  pageCategory,
  onScroll,
}: ProductCollectionProps) {
  const { width: windowWidth } = useDeviceDimensions();

  // Determine which collection ID to use (must be before hooks)
  const collectionIdToUse = React.useMemo(() => {
    if (providedProducts) return null; // Don't fetch if products are provided
    return Array.isArray(collectionId)
      ? collectionId[0]
      : collectionId || collectionHandle;
  }, [providedProducts, collectionId, collectionHandle]);

  // Helper function to check if tags match gender
  const matchesGender = React.useCallback((tags: string[], gender: string) => {
    const genderLower = gender.toLowerCase();
    const tagStrings = tags.map(t => t.toLowerCase());
    
    if (genderLower === 'boys') {
      return tagStrings.some(tag => tag === 'boy' || tag === 'boys' || tag.startsWith('boy '));
    } else if (genderLower === 'girls') {
      return tagStrings.some(tag => tag === 'girl' || tag === 'girls' || tag.startsWith('girl '));
    } else if (genderLower === 'unisex') {
      return tagStrings.some(tag => tag === 'unisex');
    }
    return false;
  }, []);


  // Helper function to check if variants match age (variant-based filtering)
  const matchesAgeByVariant = React.useCallback((variants: any[], age: string) => {
    if (!variants || variants.length === 0) return false;
    
    const ageLower = age.toLowerCase();
    const normalizeAgeValue = (value: string): string => {
      return value.replace(/\s+/g, '').toLowerCase();
    };
    
    const ageMappings: { [key: string]: string[] } = {
      '0-6m': ['0-1m', '0-2m', '0-3m', '1-3m', '3m', '3-6m', '6m', 'n/b', 'nb'],
      '6-12m': ['6-9m', '9-12m', '9m', '12m', '6-12m', '12-15m', '15-18m', '18m'],
      '1-2y': ['12-18m', '18-24m', '24m', '1y', '1-1.5y', '1.5-2y', '2y'],
      '2-3y': ['24-36m', '36m', '2-2.5y', '2.5-3y', '2-3y', '3y'],
      '3-4y': ['3-3.5y', '3.5-4y', '3-4y', '4y'],
      '4-5y': ['4-4.5y', '4.5-5y', '4-5y', '5y'],
      '5-6y': ['5-5.5y', '5.5-6y', '5-6y', '6y'],
      '6-7y': ['6-7y', '7y'],
    };
    
    const targetPatterns = ageMappings[ageLower] || [];
    
    return variants.some((variant: any) => {
      if (!variant.availableForSale || variant.quantityAvailable === 0) {
        return false;
      }
      
      const selectedOptions = variant.selectedOptions || [];
      return selectedOptions.some((option: any) => {
        const optionName = (option.name || '').toLowerCase();
        const optionValue = (option.value || '').toLowerCase().trim();
        
        const isAgeRelatedOption = 
          optionName.includes('age') || 
          optionName.includes('size') ||
          optionName === 'size' ||
          optionName === 'age';
        
        if (isAgeRelatedOption) {
          const normalizedOptionValue = normalizeAgeValue(optionValue);
          return targetPatterns.some(pattern => {
            const normalizedPattern = normalizeAgeValue(pattern);
            return normalizedOptionValue === normalizedPattern;
          });
        }
        
        return false;
      });
    });
  }, []);

  // Client-side filter functions for API filters (Price, Brand, Product Type, Tags, etc.)
  const applyClientSideFilters = React.useCallback((products: any[], filters: any[]) => {
    console.log('🔍 [ClientFilter] Called with filters:', filters);
    console.log('🔍 [ClientFilter] Filters length:', filters?.length || 0);
    console.log('🔍 [ClientFilter] Products count:', products.length);
    
    if (!filters || filters.length === 0) {
      console.log('🔍 [ClientFilter] No filters, returning all products');
      return products;
    }
    
    console.log('🔍 [ClientFilter] Applying filters:', JSON.stringify(filters, null, 2));
    console.log('🔍 [ClientFilter] Products count before:', products.length);
    
    // Group filters by type for OR logic within same type, AND logic across types
    const groupedFilters: { [key: string]: any[] } = {};
    filters.forEach((filter: any) => {
      if (filter.price) {
        if (!groupedFilters.price) groupedFilters.price = [];
        groupedFilters.price.push(filter);
      } else if (filter.productVendor) {
        if (!groupedFilters.productVendor) groupedFilters.productVendor = [];
        groupedFilters.productVendor.push(filter);
      } else if (filter.productType) {
        if (!groupedFilters.productType) groupedFilters.productType = [];
        groupedFilters.productType.push(filter);
      } else if (filter.productTag) {
        if (!groupedFilters.productTag) groupedFilters.productTag = [];
        groupedFilters.productTag.push(filter);
      } else if (filter.variantOption) {
        if (!groupedFilters.variantOption) groupedFilters.variantOption = [];
        groupedFilters.variantOption.push(filter);
      } else if (filter.productCollection) {
        if (!groupedFilters.productCollection) groupedFilters.productCollection = [];
        groupedFilters.productCollection.push(filter);
      } else if (filter.productMetafield) {
        if (!groupedFilters.productMetafield) groupedFilters.productMetafield = [];
        groupedFilters.productMetafield.push(filter);
      }
    });
    
    console.log('🔍 [ClientFilter] Grouped filters:', groupedFilters);
    
    return products.filter((product: any) => {
      // For each filter type group, check if product matches ANY filter in that group (OR logic)
      // Across different filter types, product must match ALL groups (AND logic)
      
      // Price filter group - only one price filter should exist, but handle multiple
      if (groupedFilters.price) {
        // Get product price from various possible locations
        const productPrice = parseFloat(
          product.priceRange?.minVariantPrice?.amount || 
          product.priceRange?.minVariantPrice || 
          product.variants?.edges?.[0]?.node?.price?.amount ||
          product.variants?.[0]?.price?.amount ||
          product.price?.amount ||
          product.price ||
          '0'
        );
        
        const priceMatch = groupedFilters.price.some((filter: any) => {
          // Handle different price filter structures
          const priceFilter = filter.price || filter;
          const min = priceFilter.min !== undefined ? parseFloat(priceFilter.min) : undefined;
          const max = priceFilter.max !== undefined ? parseFloat(priceFilter.max) : undefined;
          
          // Debug first product
          if (products.indexOf(product) === 0) {
            console.log('[ClientFilter] 💰 Price filter check:', {
              productTitle: product.title || product.node?.title,
              productPrice: productPrice,
              priceFilter: priceFilter,
              min: min,
              max: max,
              minMatch: min === undefined || productPrice >= min,
              maxMatch: max === undefined || productPrice <= max
            });
          }
          
          const minMatch = min === undefined || productPrice >= min;
          const maxMatch = max === undefined || productPrice <= max;
          return minMatch && maxMatch;
        });
        
        if (!priceMatch) {
          // Debug first mismatch
          if (products.indexOf(product) === 0) {
            console.log('[ClientFilter] 💰 Price filter mismatch:', {
              productTitle: product.title || product.node?.title,
              productPrice: productPrice,
              filters: groupedFilters.price
            });
          }
          return false;
        }
      }
      
      // Vendor/Brand filter group - match ANY selected vendor (OR logic)
      if (groupedFilters.productVendor) {
        const productVendor = (product.vendor || '').toLowerCase().trim();
        const vendorMatch = groupedFilters.productVendor.some((filter: any) => {
          const filterVendor = String(filter.productVendor || '').toLowerCase().trim();
          return productVendor === filterVendor;
        });
        if (!vendorMatch) return false;
      }
      
      // Product type filter group - match ANY selected product type (OR logic)
      if (groupedFilters.productType) {
        const productType = (product.productType || product.node?.productType || '').toLowerCase().trim();
        const typeMatch = groupedFilters.productType.some((filter: any) => {
          const filterType = String(filter.productType || '').toLowerCase().trim();
          return productType === filterType;
        });
        
        if (!typeMatch) {
          // Debug first mismatch
          if (products.indexOf(product) === 0) {
            console.log('[ClientFilter] Product type mismatch:', {
              productTitle: product.title || product.node?.title,
              productType: product.productType || product.node?.productType,
              normalizedProductType: productType,
              filterTypes: groupedFilters.productType.map((f: any) => f.productType)
            });
          }
          return false;
        }
      }
      
      // Tag filter group - match ANY selected tag (OR logic)
      if (groupedFilters.productTag) {
        const tags = (product.tags || []).map((t: string) => String(t).toLowerCase().trim());
        const tagMatch = groupedFilters.productTag.some((filter: any) => {
          const filterTag = String(filter.productTag || '').toLowerCase().trim();
          return tags.includes(filterTag);
        });
        if (!tagMatch) return false;
      }
      
      // Variant option filter group - match ANY selected variant option (OR logic)
      if (groupedFilters.variantOption) {
        const variants = product.variants?.edges || product.variants || [];
        const variantList = variants.map((v: any) => v.node || v);
        const variantMatch = groupedFilters.variantOption.some((filter: any) => {
          return variantList.some((variant: any) => {
            const selectedOptions = variant.selectedOptions || [];
            return selectedOptions.some((option: any) => {
              const optionName = String(option.name || '').toLowerCase().trim();
              const optionValue = String(option.value || '').toLowerCase().trim();
              const filterName = String(filter.variantOption.name || '').toLowerCase().trim();
              const filterValue = String(filter.variantOption.value || '').toLowerCase().trim();
              return optionName === filterName && optionValue === filterValue;
            });
          });
        });
        if (!variantMatch) return false;
      }
      // Collection filter group - match ANY selected collection (OR logic)
      if (groupedFilters.productCollection) {
        const collections = product.collections?.edges || product.collections || [];
        const collectionIds = collections.map((c: any) => {
          const col = c.node || c;
          return col.id || col;
        });
        const collectionMatch = groupedFilters.productCollection.some((filter: any) => {
          const filterCollection = String(filter.productCollection || '');
          return collectionIds.includes(filterCollection);
        });
        if (!collectionMatch) return false;
      }
      
      // Product Metafield filter group - match ANY selected metafield value (OR logic)
      if (groupedFilters.productMetafield) {
        const metafields = product.metafields || [];
        const metafieldMatch = groupedFilters.productMetafield.some((filter: any) => {
          const filterNamespace = (filter.productMetafield.namespace || '').toLowerCase().trim();
          const filterKey = (filter.productMetafield.key || '').toLowerCase().trim();
          const filterValue = String(filter.productMetafield.value || '').toLowerCase().trim();
          
          return metafields.some((mf: any) => {
            if (!mf) return false;
            const mfNamespace = (mf.namespace || '').toLowerCase().trim();
            const mfKey = (mf.key || '').toLowerCase().trim();
            const mfValue = String(mf.value || '').toLowerCase().trim();
            
            // Handle both exact match and comma-separated lists in metafield value
            const isMatch = mfNamespace === filterNamespace && mfKey === filterKey;
            if (!isMatch) return false;
            
            const mfValues = mfValue.split(',').map(v => v.trim().toLowerCase());
            return mfValues.includes(filterValue);
          });
        });
        
        if (!metafieldMatch) return false;
      }
      
      return true;
    });
  }, []);

  // Fetch products using React Query's useInfiniteQuery
  // Must be called unconditionally (rules of hooks)
  // When limit is set, fetch exactly that many (for efficiency)
  // When no limit, fetch a reasonable page size
  const pageSize = limit && limit > 0 ? limit : 50;
  
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery<Page>({
    // Remove filters from queryKey - fetch all products without filters
    queryKey: ['products', collectionIdToUse, searchQuery, sortKey, reverse, limit],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      if (!collectionIdToUse) {
        return {
          products: [],
          nextCursor: null,
          hasNextPage: false,
        };
      }

      // Fetch WITHOUT filters - we'll apply filters client-side
      const result = await shopifyApi.getProductsByCollection(
        collectionIdToUse!,
        pageSize,
        pageParam as string | null,
        sortKey,
        reverse,
        [] // No filters - fetch all products
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
    placeholderData: keepPreviousData,
  });

  // Automatically load more pages initially to show more products upfront (like search results)
  // Only do this if limit is not set (for infinite grids)
  React.useEffect(() => {
    if (limit && limit > 0) return; // Don't auto-load when limit is set
    
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
  }, [data?.pages, hasNextPage, isFetchingNextPage, fetchNextPage, pageSize, limit]);

  // Effect to notify parent about loaded facets (fetch once without filters to get all facets)
  const lastFacetsRef = React.useRef<any>(null);
  React.useEffect(() => {
    // Get facets from first page (we fetch without filters, so facets show all available options)
    const firstPage = data?.pages?.[0];
    if (firstPage?.filters && firstPage.filters !== lastFacetsRef.current) {
      lastFacetsRef.current = firstPage.filters;
      // @ts-ignore
      onFacetsLoaded?.(firstPage.filters);
    }
  }, [data?.pages, onFacetsLoaded]);

  // Flatten all pages into a single array of product objects
  const allProducts = React.useMemo(() => {
    let products = data?.pages.flatMap((page) => page.products) || [];
    
    console.log('📦 [ProductCollection] allProducts useMemo - Filters prop:', filters);
    console.log('📦 [ProductCollection] Filters type:', typeof filters);
    console.log('📦 [ProductCollection] Filters is array?', Array.isArray(filters));
    console.log('📦 [ProductCollection] Filters length:', filters?.length || 0);
    console.log('📦 [ProductCollection] Products before filter:', products.length);
    
    // Apply API filters client-side (Price, Brand, Product Type, Tags, etc.)
    if (filters && filters.length > 0) {
      console.log('📦 [ProductCollection] ✅ Applying client-side filters, count:', filters.length);
      products = applyClientSideFilters(products, filters);
      console.log('📦 [ProductCollection] ✅ Products after filter:', products.length);
    } else {
      console.log('📦 [ProductCollection] ❌ No filters to apply');
    }
    
    // Apply gender filter (client-side tag filtering)
    if (genderFilter) {
      products = products.filter((product: any) => {
        const tags = product.tags || [];
        return matchesGender(tags, genderFilter);
      });
    }
    
    // Apply age filter (Toy-aware filtering)
    if (ageFilter) {
      products = products.filter((product: any) => {
        const isToyCategory = pageCategory === 'toys';
        const isToyProduct = (product.productType || product.node?.productType || '').toLowerCase().includes('toy');
        
        if (isToyCategory || isToyProduct) {
          // Toys: Tag matching only (e.g., "Toys for 6 - 12 M")
          const tags = (product.tags || []).map((t: string) => t.toLowerCase().replace(/\s+/g, ''));
          const toyPattern = `toysfor${ageFilter}`;
          return tags.includes(toyPattern);
        } else {
          // Others: Variant matching only (Size/Age options)
          const variants = product.variants?.edges || product.variants || [];
          const variantList = variants.map((v: any) => v.node || v);
          return matchesAgeByVariant(variantList, ageFilter);
        }
      });
    }
    
    // Sort in-stock first, out-of-stock at end
    products = sortInStockFirst(products);

    // Apply limit if specified
    return limit && limit > 0 ? products.slice(0, limit) : products;
  }, [data, limit, filters, genderFilter, ageFilter, matchesGender, matchesAgeByVariant, applyClientSideFilters]);

  // Notify parent about result count
  React.useEffect(() => {
    onResultsCount?.(allProducts.length);
  }, [allProducts.length, onResultsCount]);

  // Firebase Ecommerce Tracking - View Item List
  React.useEffect(() => {
    if (allProducts.length > 0) {
      analyticsService.logViewItemList({
        item_list_id: typeof collectionId === 'string' ? collectionId : undefined,
        item_list_name: title || (typeof collectionId === 'string' ? collectionId : 'Collection'),
        items: allProducts.slice(0, 10).map(product => ({
          item_id: product.id,
          item_name: product.title,
          item_category: product.tags?.[0],
          price: parseFloat(product.priceRange?.minVariantPrice?.amount || '0'),
        })),
      });
    }
  }, [allProducts.length, title, collectionId]);

  // Handle fetch more callback (must be before conditional returns)
  const handleFetchMore = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Memoize default values: use window width when contentWidth not provided so layout is correct on all devices
  const defaultContentWidth = React.useMemo(() => contentWidth ?? windowWidth, [contentWidth, windowWidth]);
  const defaultProductStyle = React.useMemo(() => productStyle || {}, [productStyle]);

  // If products are provided directly, use them without fetching
  if (providedProducts) {
    // Apply all filters client-side
    let filteredProducts = providedProducts;
    
    // Apply API filters client-side (Price, Brand, Product Type, Tags, etc.)
    if (filters && filters.length > 0) {
      filteredProducts = applyClientSideFilters(filteredProducts, filters);
    }
    
    // Apply gender filter
    if (genderFilter) {
      filteredProducts = filteredProducts.filter((product: any) => {
        const tags = product.tags || [];
        return matchesGender(tags, genderFilter);
      });
    }
    
    // Apply age filter (Toy-aware filtering)
    if (ageFilter) {
      filteredProducts = filteredProducts.filter((product: any) => {
        const isToyCategory = pageCategory === 'toys';
        const isToyProduct = (product.productType || product.node?.productType || '').toLowerCase().includes('toy');
        
        if (isToyCategory || isToyProduct) {
          // Toys: Tag matching only
          const tags = (product.tags || []).map((t: string) => t.toLowerCase().replace(/\s+/g, ''));
          const toyPattern = `toysfor${ageFilter}`;
          return tags.includes(toyPattern);
        } else {
          // Others: Variant matching only
          const variants = product.variants?.edges || product.variants || [];
          const variantList = variants.map((v: any) => v.node || v);
          return matchesAgeByVariant(variantList, ageFilter);
        }
      });
    }
    
    // Apply limit if specified
    const limitedProvidedProducts = limit && limit > 0 
      ? filteredProducts.slice(0, limit) 
      : filteredProducts;
    
    return (
      <View style={[styles.container, style?.root]}>
        {showHeading && title && (
          <View style={[styles.header, style?.header]}>
            <Text 
              style={[styles.title, processFontStyle(style?.title, Fonts.Bold)]} 
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {showViewAll && onViewAll && (
              <TouchableOpacity 
                style={[styles.viewAllButton, style?.viewAllButton]} 
                onPress={onViewAll}
                activeOpacity={0.7}
              >
                <Text style={[styles.viewAll, style?.viewAll]}>{viewAllText || 'View All'}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}
        {showSubTitle && subTitle && (
          <Text style={[styles.subTitle, style?.subTitle]}>{subTitle}</Text>
        )}
        <CollectionComponent
          products={limitedProvidedProducts}
          productStyle={defaultProductStyle}
          contentWidth={defaultContentWidth}
          listStyle={style?.list}
          productOptions={productOptions}
          productLayout={productLayout}
          productSource={productSource}
          hasNextPage={false}
          collectionId={Array.isArray(collectionId) ? collectionId[0] : collectionId || null}
          searchQuery={searchQuery}
          onScroll={onScroll}
        />
      </View>
    );
  }

  // If no collection ID, return null
  if (!collectionIdToUse) {
    return null;
  }

  // Loading state with Skeleton layout for instant perceived performance
  if (isLoading && allProducts.length === 0) {
    // Calculate card width for 2 columns with standard padding
    const padding = 16;
    const gap = 8;
    const availableWidth = defaultContentWidth - (padding * 2);
    const cardWidth = (availableWidth - gap) / 2;

    return (
      <View style={[styles.container, style?.root]}>
        {showHeading && title && (
          <View style={[styles.header, style?.header]}>
            <Text style={[styles.title, style?.title]} numberOfLines={2}>{title}</Text>
          </View>
        )}
        <View style={{ paddingHorizontal: padding, paddingTop: 12 }}>
          {[0, 1, 2].map((rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: gap }}>
              <ProductCardSkeleton width={cardWidth} />
              <ProductCardSkeleton width={cardWidth} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Note: Empty state is handled by CollectionComponent (InfiniteGrid)

  return (
    <View style={[styles.container, style?.root]}>
      {showHeading && title && (
        <View style={[styles.header, style?.header]}>
          <Text 
            style={[styles.title, style?.title]} 
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {showViewAll && onViewAll && (
            <TouchableOpacity 
              style={[styles.viewAllButton, style?.viewAllButton]} 
              onPress={onViewAll}
              activeOpacity={0.7}
            >
              <Text style={[styles.viewAll, style?.viewAll]}>{viewAllText || 'View All'}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
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
        hasNextPage={limit && limit > 0 ? false : hasNextPage} // Disable pagination when limit is set
        fetchMore={limit && limit > 0 ? undefined : handleFetchMore} // Disable fetchMore when limit is set
        collectionId={collectionIdToUse}
        searchQuery={searchQuery}
        isFetchingNextPage={isFetchingNextPage}
        isRefetching={isRefetching}
        refetch={refetch}
        onScroll={onScroll}
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
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.Bold,
    color: '#000',
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  viewAll: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.Medium,
    color: Colors.primary,
  },
  subTitle: {
    fontSize: 14,
    color: '#666',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
});
