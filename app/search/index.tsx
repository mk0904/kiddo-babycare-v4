import HorizontalProductList from '@/components/content/HorizontalProductList';
import { ProductCard } from '@/components/products/ProductCard';
import BaseModal from '@/components/ui/BaseModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { FilterSortPills } from '@/components/ui/FilterSortPills';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import { Colors, Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { useScrollTracking } from '@/hooks/useScrollTracking';
import { appConfigService } from '@/services/appConfigService';
import { configService } from '@/services/configService';
import { searchaniseApi } from '@/services/searchaniseApi';
import { selfSearchApi } from '@/services/selfSearchApi';
import { shopifyApi } from '@/services/shopifyApi';
import { isProductAvailable } from '@/utils/availability';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    InteractionManager,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DEFAULT_SORT_OPTIONS = [
    { value: 'relevance', label: 'Relevance', order: 'asc' },
    { value: 'title', label: 'Name: A to Z', order: 'asc' },
    { value: 'title', label: 'Name: Z to A', order: 'desc' },
    { value: 'price', label: 'Price: Low to High', order: 'asc' },
    { value: 'price', label: 'Price: High to Low', order: 'desc' },
    { value: 'created', label: 'Newest', order: 'desc' },
    { value: 'sales_amount', label: 'Bestselling', order: 'desc' },
];

export default function SearchScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { handleScroll } = useScrollTracking();
    const initialQuery = typeof params.query === 'string' ? params.query : '';
    const collectionHandle = typeof params.collectionHandle === 'string' ? params.collectionHandle : null;

    // Get product grid defaults from config
    const gridDefaults = configService.getProductGridDefaults();
    const GAP = gridDefaults.colGap ?? gridDefaults.gap ?? 8;
    const ROW_GAP = gridDefaults.rowGap ?? gridDefaults.gap ?? 8;
    const HORIZONTAL_PADDING = gridDefaults.paddingHorizontal ?? 8;

    // Create styles with config values
    const styles = createStyles(HORIZONTAL_PADDING);

    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [facets, setFacets] = useState<any[]>([]);
    const [selectedFilters, setSelectedFilters] = useState<any>({});
    const [sortBy, setSortBy] = useState('relevance');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [startIndex, setStartIndex] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [sortOptions, setSortOptions] = useState(DEFAULT_SORT_OPTIONS);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    const searchTimeoutRef = useRef<any>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const requestIdRef = useRef(0);
    const tagFetchTimeoutsRef = useRef<any[]>([]);

    // Debounced search effect
    useEffect(() => {
        // Cancel any ongoing requests
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Clear all tag fetch timeouts
        tagFetchTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        tagFetchTimeoutsRef.current = [];

        // Clear previous timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Increment request ID to ignore stale responses
        requestIdRef.current += 1;
        const currentRequestId = requestIdRef.current;

        // Don't search if query is empty and no collection
        if (!searchQuery.trim() && !collectionHandle) {
            setProducts([]);
            setTotalItems(0);
            setFacets([]);
            setLoading(false);
            setHasMore(false);
            setStartIndex(0);
            return;
        }

        // Set loading state immediately
        setLoading(true);

        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();

        // Debounce the search
        searchTimeoutRef.current = setTimeout(() => {
            if (currentRequestId === requestIdRef.current) {
                performSearch(false, abortControllerRef.current?.signal || undefined, currentRequestId);
            }
        }, 300);

        // Cleanup
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [searchQuery]);

    // Initial search if there's a query or collection
    useEffect(() => {
        if (initialQuery || collectionHandle) {
            performSearch(false);
        }
    }, []);

    // Re-search when filters or sort change
    useEffect(() => {
        if (products.length > 0 || searchQuery.trim() || collectionHandle) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();
            requestIdRef.current += 1;
            const currentRequestId = requestIdRef.current;
            performSearch(false, abortControllerRef.current.signal, currentRequestId);
        }
    }, [selectedFilters, sortBy, sortOrder]);

    // Load search history from AsyncStorage
    const loadSearchHistory = useCallback(async () => {
        try {
            const saved = await AsyncStorage.getItem('search_history');
            if (saved) {
                const parsed = JSON.parse(saved);
                setSearchHistory(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
            }
        } catch (error) {
            console.error('Error loading search history:', error);
        }
    }, []);

    // Save search query to history
    const saveToSearchHistory = useCallback(async (query: string) => {
        if (!query.trim()) return;

        try {
            const saved = await AsyncStorage.getItem('search_history');
            let history: string[] = saved ? JSON.parse(saved) : [];

            // Remove if already exists
            history = history.filter((item) => item.toLowerCase() !== query.trim().toLowerCase());

            // Add to beginning
            history.unshift(query.trim());

            // Keep only last 3
            history = history.slice(0, 3);

            await AsyncStorage.setItem('search_history', JSON.stringify(history));
            setSearchHistory(history);
        } catch (error) {
            console.error('Error saving search history:', error);
        }
    }, []);

    // Remove item from search history
    const handleRemoveFromHistory = useCallback(async (item: string) => {
        try {
            const saved = await AsyncStorage.getItem('search_history');
            let history: string[] = saved ? JSON.parse(saved) : [];

            history = history.filter((h) => h.toLowerCase() !== item.toLowerCase());

            await AsyncStorage.setItem('search_history', JSON.stringify(history));
            setSearchHistory(history.slice(0, 3));
        } catch (error) {
            console.error('Error removing from search history:', error);
        }
    }, []);

    // Load search history on mount
    useEffect(() => {
        loadSearchHistory();
    }, [loadSearchHistory]);

    const performSearch = useCallback(async (loadMore = false, signal?: AbortSignal, requestId?: number) => {
        try {
            if (signal?.aborted) return;
            if (requestId !== undefined && requestId !== requestIdRef.current) return;

            if (!loadMore) {
                setLoading(true);
                setLoadingMore(false);
                setStartIndex(0);
                // Clear old facets when starting new search to ensure fresh data
                setFacets([]);
            } else {
                setLoadingMore(true);
            }

            const currentIndex = loadMore ? startIndex : 0;
            const searchParams = {
                q: searchQuery.trim(),
                collection: collectionHandle,
                filters: selectedFilters,
                sortBy,
                sortOrder,
                startIndex: currentIndex,
                maxResults: 12, // Increased for better pagination
                facets: true,
            };

            const config = appConfigService.getConfig();
            const result = config?.isSelfSearchEnabled
                ? await selfSearchApi.searchProducts(searchParams, signal)
                : await searchaniseApi.searchProducts(searchParams, signal);

            if (signal?.aborted || (requestId !== undefined && requestId !== requestIdRef.current)) {
                return;
            }

            if (result) {
                // Save to search history if search was successful and not loading more
                // Filter out invalid products, then hide out-of-stock (search screen only)
                const nodesFromApi = result.products.edges
                    .map((edge: any) => edge.node)
                    .filter((p: any) => p && p.id);
                const paginationBatchSize = nodesFromApi.length;
                let newProducts = nodesFromApi.filter((p: any) => isProductAvailable(p));

                if (!loadMore && searchQuery.trim()) {
                    saveToSearchHistory(searchQuery.trim());

                    // Track search performed (count of in-stock results shown)
                    try {
                        const { trackSearchPerformed } = require('@/utils/mixpanelHelpers');
                        trackSearchPerformed(searchQuery.trim(), newProducts.length);
                    } catch (e) {
                        console.warn('Mixpanel tracking error:', e);
                    }
                }

                // Update products immediately (without tags) to prevent UI freeze
                if (loadMore) {
                    setProducts((prev) => {
                        const existingIds = new Set(prev.map((p: any) => p?.id).filter(Boolean));
                        const uniqueNewProducts = newProducts.filter((p: any) => p?.id && !existingIds.has(p.id));
                        return [...prev.filter((p: any) => p && p.id), ...uniqueNewProducts];
                    });
                } else {
                    setProducts(newProducts);
                    const facetsData = result.facets || [];
                    // Debug: Log facets structure
                    if (__DEV__ && facetsData.length > 0) {
                        console.log('[Search] Facets received:', facetsData.length, 'facets');
                        console.log('[Search] First facet structure:', JSON.stringify(facetsData[0], null, 2));
                    }
                    setFacets(facetsData);
                }

                // Prefetch images immediately so they're in cache by the time cards render.
                // This eliminates the skeleton-loader delay for the Searchanise image_link
                // URLs which are valid Shopify CDN URLs and don't need Shopify API enrichment.
                if (newProducts.length > 0) {
                    newProducts.forEach((product: any) => {
                        const imageUrl = product.images?.edges?.[0]?.node?.url;
                        if (imageUrl && imageUrl.includes('cdn.shopify.com')) {
                            Image.prefetch(imageUrl).catch(() => { });
                        }
                    });
                }

                // Fetch tags + Shopify images asynchronously after UI update.
                // Run for ALL pages (including loadMore) so that paginated results
                // also get proper Shopify CDN images — Searchanise image_link URLs
                // from later pages are sometimes not Shopify CDN and fail to render.
                if (newProducts.length > 0) {
                    const currentRequestId = requestIdRef.current;

                    InteractionManager.runAfterInteractions(() => {
                        if (currentRequestId !== requestIdRef.current) {
                            return;
                        }

                        // Use a larger batch size for subsequent pages to reduce total round-trips
                        const batchSize = loadMore ? 8 : 5;
                        const batches = [];
                        for (let i = 0; i < newProducts.length; i += batchSize) {
                            batches.push(newProducts.slice(i, i + batchSize));
                        }

                        batches.forEach((batch, batchIndex) => {
                            const timeoutId = setTimeout(async () => {
                                if (currentRequestId !== requestIdRef.current) {
                                    return;
                                }

                                const tagPromises = batch.map(async (product: any) => {
                                    try {
                                        if (product.id) {
                                            const fullProduct = await shopifyApi.getProductById(product.id);
                                            if (fullProduct) {
                                                return {
                                                    productId: product.id,
                                                    tags: fullProduct.tags,
                                                    metafields: fullProduct.metafields,
                                                    variants: fullProduct.variants,
                                                    // Carry Shopify images so cards always use CDN-hosted URLs
                                                    images: fullProduct.images,
                                                };
                                            }
                                        }
                                    } catch (error) {
                                        // Silently fail - enrichment is optional
                                    }
                                    return null;
                                });

                                const tagResults = await Promise.all(tagPromises);

                                if (currentRequestId !== requestIdRef.current) {
                                    return;
                                }

                                setProducts((prev) => {
                                    if (currentRequestId !== requestIdRef.current) {
                                        return prev;
                                    }
                                    const nextProducts = prev.map((product: any) => {
                                        const enriched = tagResults.find((r: any) => r && r.productId === product.id);
                                        if (!enriched) return product;
                                        const updates: any = {};
                                        if (enriched.tags) updates.tags = enriched.tags;
                                        if (enriched.metafields) updates.metafields = enriched.metafields;
                                        if (enriched.variants) updates.variants = enriched.variants;
                                        // Only replace images if the current image_link is NOT already a
                                        // Shopify CDN URL. If it is, the prefetch already primed the cache
                                        // and swapping the URL would trigger a second unnecessary load.
                                        if (enriched.images) {
                                            const existingUrl = product.images?.edges?.[0]?.node?.url || '';
                                            if (!existingUrl.includes('cdn.shopify.com')) {
                                                updates.images = enriched.images;
                                            }
                                        }
                                        if (Object.keys(updates).length === 0) return product;
                                        return { ...product, ...updates };
                                    });
                                    // Re-evaluate stock availability after getting real variants from Shopify
                                    return nextProducts.filter((p: any) => isProductAvailable(p));
                                });
                            }, batchIndex * 150);

                            tagFetchTimeoutsRef.current.push(timeoutId);
                        });
                    });
                }

                setTotalItems(result.totalItems || 0);
                setHasMore(result.products.pageInfo?.hasNextPage || false);
                // Advance by API batch size so pagination stays aligned with Searchanise (client-side OOS filter does not change offset)
                setStartIndex(currentIndex + paginationBatchSize);
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
                return;
            }

            if (requestId === undefined || requestId === requestIdRef.current) {
                setProducts([]);
                setTotalItems(0);
            }
        } finally {
            if (requestId === undefined || requestId === requestIdRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [searchQuery, collectionHandle, selectedFilters, sortBy, sortOrder, startIndex]);

    const handleFilterChange = (newFilters: any) => {
        setSelectedFilters(newFilters);

        // Track filters applied
        try {
            const { trackFiltersApplied } = require('@/utils/mixpanelHelpers');
            const filterProps: any = {};
            if (newFilters.ageGroup) filterProps.ageGroup = newFilters.ageGroup;
            if (newFilters.brand) filterProps.brand = newFilters.brand;
            if (newFilters.priceRange) filterProps.priceRange = newFilters.priceRange;
            // Add any other filter properties
            Object.keys(newFilters).forEach(key => {
                if (newFilters[key] && !['ageGroup', 'brand', 'priceRange'].includes(key)) {
                    filterProps[key] = newFilters[key];
                }
            });
            if (Object.keys(filterProps).length > 0) {
                trackFiltersApplied(filterProps);
            }
        } catch (e) {
            console.warn('Mixpanel tracking error:', e);
        }
    };

    const handleFastFilterToggle = (attribute: string, value: any) => {
        setSelectedFilters((prev: any) => {
            const current = prev[attribute] || [];
            const isSelected = Array.isArray(current) && current.includes(value);

            // For price/range filters, replace instead of add (single selection)
            const isPriceFilter = attribute === 'price' ||
                attribute === 'price_range' ||
                attribute?.toLowerCase().includes('price');

            if (isSelected) {
                // Remove filter
                const { [attribute]: _, ...rest } = prev;
                return rest;
            } else {
                // For price filters, replace; for others, add
                if (isPriceFilter) {
                    return { ...prev, [attribute]: [value] };
                } else {
                    return { ...prev, [attribute]: [...current, value] };
                }
            }
        });
    };

    const handleProductPress = (product: any) => {
        // Track the click in Searchanise analytics so it shows in the dashboard
        if (searchQuery.trim()) {
            const config = appConfigService.getConfig();
            if (config?.isSelfSearchEnabled) {
                selfSearchApi.trackProductClick(searchQuery.trim(), product.id);
            } else {
                searchaniseApi.trackProductClick(searchQuery.trim(), product.id);
            }
        }
        router.push({
            pathname: '/products/[id]',
            params: { id: product.id, handle: product.handle },
        } as any);
    };

    const handleSortSelect = (option: { value: string; order: string }) => {
        setSortBy(option.value);
        setSortOrder(option.order);
        setShowSortModal(false);
    };

    const getActiveFiltersCount = () => {
        return Object.keys(selectedFilters).length;
    };

    const getSortLabel = () => {
        const option = DEFAULT_SORT_OPTIONS.find(
            (opt) => opt.value === sortBy && opt.order === sortOrder
        );
        return option?.label || 'Relevance';
    };

    // Calculate card width from current window width so layout is correct on all devices and rotation
    const { width: screenWidth } = useDeviceDimensions();
    const cardWidth = useMemo(() => {
        const totalPadding = HORIZONTAL_PADDING * 2;
        const totalGap = GAP;
        const availableWidth = screenWidth - totalPadding - totalGap;
        return availableWidth / 2;
    }, [GAP, HORIZONTAL_PADDING, screenWidth]);


    const keyExtractor = useCallback((item: any, index: number) => {
        return item.id ? String(item.id) : (item._id ? String(item._id) : `product-${item.handle || index}`);
    }, []);

    const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
        if (!item || !item.id) return null;

        const isLastInRow = (index + 1) % 2 === 0;
        return (
            <View style={{
                width: cardWidth,
                marginRight: isLastInRow ? 0 : GAP,
                marginBottom: ROW_GAP,
            }}>
                <ProductCard
                    product={item}
                    onPress={() => handleProductPress(item)}
                    width={cardWidth}
                />
            </View>
        );
    }, [cardWidth]);

    const handleLoadMore = useCallback(() => {
        // Prevent multiple simultaneous load more requests
        if (hasMore && !loading && !loadingMore) {
            performSearch(true);
        }
    }, [hasMore, loading, loadingMore, performSearch]);

    const hasResults = products.length > 0 && totalItems > 0;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.searchInputContainer}>
                        <TouchableOpacity
                            style={styles.backButtonContainer}
                            onPress={() => router.back()}
                        >
                            <Ionicons name="arrow-back" size={20} color="#666666" />
                        </TouchableOpacity>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search products..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            returnKeyType="search"
                            autoFocus={!initialQuery}
                            placeholderTextColor="#666666"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (abortControllerRef.current) {
                                        abortControllerRef.current.abort();
                                    }
                                    tagFetchTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
                                    tagFetchTimeoutsRef.current = [];
                                    setSearchQuery('');
                                    setProducts([]);
                                    setTotalItems(0);
                                    setFacets([]);
                                    setLoading(false);
                                    setHasMore(false);
                                    setStartIndex(0);
                                }}
                            >
                                <Ionicons name="close-circle" size={18} color="#999" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Toolbar - Only show when there are results */}
                {hasResults && (
                    <>
                        <View style={styles.toolbarContainer}>
                            <FilterSortPills
                                totalItems={totalItems}
                                activeFiltersCount={getActiveFiltersCount()}
                                onFiltersPress={() => setShowFiltersModal(true)}
                                onSortPress={() => setShowSortModal(true)}
                                facets={facets.map((f: any) => {
                                    const attribute = f.attribute || f.id || f.field || f.name;
                                    const title = f.title || f.label || f.name || attribute;
                                    const type = f.type || f.data_type || (f.buckets ? 'select' : 'LIST');
                                    let buckets = f.buckets || f.values || f.data || [];

                                    if (Array.isArray(buckets)) {
                                        buckets = buckets.map((bucket: any) => ({
                                            value: bucket.value || bucket.id || bucket.title || bucket.label,
                                            label: bucket.label || bucket.title || bucket.value || bucket.name,
                                            count: bucket.count || 0,
                                            from: bucket.from,
                                            to: bucket.to,
                                            min: bucket.min,
                                            max: bucket.max,
                                        })).filter((b: any) => b.value || b.label);
                                    }

                                    return {
                                        ...f,
                                        attribute,
                                        title,
                                        type,
                                        buckets: Array.isArray(buckets) ? buckets : [],
                                    };
                                }).filter((f: any) => f.buckets && f.buckets.length > 0 && f.attribute)}
                                selectedFilters={selectedFilters}
                                onFastFilterToggle={handleFastFilterToggle}
                            />
                        </View>
                    </>
                )}

                {/* Products List */}
                {loading && products.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : products.length === 0 && searchQuery.trim() ? (
                    <EmptyState
                        icon="search-outline"
                        iconSize={64}
                        title="No products found"
                        subtitle="Try adjusting your search or filters"
                    />
                ) : products.length === 0 ? (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ flexGrow: 1 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.emptyStateContainer}>
                            <EmptyState
                                icon="search-outline"
                                iconSize={48}
                                title="Start typing to search"
                                style={styles.emptyState}
                            />
                        </View>

                        {/* Search History */}
                        {searchHistory.length > 0 && (
                            <View style={styles.searchHistoryContainer}>
                                <Text style={styles.searchHistoryTitle}>Recent Searches</Text>
                                {searchHistory.map((item, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={styles.searchHistoryItem}
                                        onPress={() => {
                                            setSearchQuery(item);
                                        }}
                                    >
                                        <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
                                        <Text style={styles.searchHistoryText}>{item}</Text>
                                        <TouchableOpacity
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                handleRemoveFromHistory(item);
                                            }}
                                            style={styles.removeHistoryButton}
                                        >
                                            <Ionicons name="close" size={16} color={Colors.textSecondary} />
                                        </TouchableOpacity>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Featured Products */}
                        <HorizontalProductList
                            collectionIds={[
                                'gid://shopify/Collection/507808678177',
                                'gid://shopify/Collection/507808645409',
                                'gid://shopify/Collection/507806449953',
                                'gid://shopify/Collection/508173123873',
                            ]}
                            config={{
                                limit: 20,
                                itemsPerView: 2.1,
                                itemSpacing: 12,
                                sidePadding: 16,
                            }}
                            title="Featured Products"
                            styles={{
                                container: {
                                    paddingVertical: 16,
                                },
                                title: {
                                    fontSize: 16,
                                    fontWeight: '600',
                                    color: '#363636',
                                },
                                titleContainer: {
                                    marginBottom: 20,
                                },
                            }}
                            onProductPress={(product) => {
                                if (product?.id || product?.handle) {
                                    const routeParam = product.id || product.handle;
                                    router.push(`/products/${encodeURIComponent(routeParam)}` as any);
                                }
                            }}
                        />
                    </ScrollView>
                ) : (
                    <FlatList
                        data={Array.isArray(products) ? products.filter((p: any) => p && p.id) : []}
                        renderItem={renderItem}
                        keyExtractor={keyExtractor}
                        numColumns={2}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        scrollEventThrottle={16}
                        onScroll={handleScroll}
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        columnWrapperStyle={styles.columnWrapper}
                        ListFooterComponent={
                            loadingMore ? (
                                <View style={styles.footerLoaderContainer}>
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                    <Text style={styles.footerLoaderText}>Loading more products...</Text>
                                </View>
                            ) : hasMore && products.length > 0 ? (
                                <View style={styles.footerSpacer} />
                            ) : null
                        }
                        removeClippedSubviews={Platform.OS === 'android'}
                        initialNumToRender={12}
                        maxToRenderPerBatch={12}
                        windowSize={Platform.OS === 'ios' ? 15 : 10}
                        updateCellsBatchingPeriod={50}
                    />
                )}

                {/* Sort Modal */}
                <BaseModal
                    visible={showSortModal}
                    onClose={() => setShowSortModal(false)}
                    title="Sort By"
                    type="bottomSheet"
                    closeButtonPosition="above"
                    containerStyle={styles.sortModalContent}
                    contentStyle={styles.sortModalContentWrapper}
                >
                    <ScrollView
                        style={styles.sortListContainer}
                        contentContainerStyle={styles.sortListContent}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                    >
                        {sortOptions.map((option, index) => {
                            const isSelected = sortBy === option.value && sortOrder === option.order;
                            return (
                                <TouchableOpacity
                                    key={`${option.value}-${option.order}-${index}`}
                                    style={styles.sortListItem}
                                    onPress={() => handleSortSelect(option)}
                                >
                                    <Text
                                        style={[
                                            styles.sortListItemText,
                                            isSelected && styles.sortListItemTextSelected,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                    <View style={[
                                        styles.radioOuter,
                                        isSelected && styles.radioOuterSelected,
                                    ]}>
                                        {isSelected && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </BaseModal>

                {/* Filter Panel Modal */}
                <FilterPanel
                    visible={showFiltersModal}
                    onClose={() => setShowFiltersModal(false)}
                    facets={facets.map((f: any) => {
                        // Handle different facet structures from Searchanise
                        // Searchanise facets can have: id, attribute, title, label, buckets, values, data
                        let attribute = f.attribute || f.id || f.field || f.name;
                        const title = f.title || f.label || f.name || attribute;
                        const type = f.type || f.data_type || (f.buckets ? 'select' : 'LIST');
                        let buckets = f.buckets || f.values || f.data || [];

                        // Map brand/vendor attributes correctly for Searchanise
                        // Searchanise uses 'vendor' for brand filtering
                        if (attribute?.toLowerCase().includes('brand') || title?.toLowerCase().includes('brand')) {
                            attribute = 'vendor';
                        }

                        // Ensure buckets have the right structure
                        if (Array.isArray(buckets)) {
                            buckets = buckets.map((bucket: any) => {
                                // Normalize bucket structure
                                return {
                                    value: bucket.value || bucket.id || bucket.title || bucket.label,
                                    label: bucket.label || bucket.title || bucket.value || bucket.name,
                                    count: bucket.count || 0,
                                    from: bucket.from,
                                    to: bucket.to,
                                    min: bucket.min,
                                    max: bucket.max,
                                };
                            }).filter((b: any) => b.value || b.label);
                        }

                        return {
                            ...f,
                            attribute,
                            title,
                            type,
                            buckets: Array.isArray(buckets) ? buckets : [],
                        };
                    }).filter((f: any) => f.buckets && f.buckets.length > 0 && f.attribute)}
                    selectedFilters={selectedFilters}
                    onApplyFilters={handleFilterChange}
                    totalResults={totalItems}
                />
            </KeyboardAvoidingView>
            <FloatingCartButton showTabBar={false} />
        </SafeAreaView>
    );
}

// Create styles function that accepts padding values
const createStyles = (horizontalPadding: number) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: horizontalPadding,
        paddingVertical: 10,
        backgroundColor: Colors.backgroundWhite,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 25,
        paddingHorizontal: 16,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    backButtonContainer: {
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#666666',
        fontFamily: Fonts.Medium,
        includeFontPadding: false,
        textAlignVertical: 'center',
        letterSpacing: 0.2,
        padding: 0,
        margin: 0,
    },
    searchRightIcon: {
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
    },
    toolbarContainer: {
        backgroundColor: Colors.backgroundWhite,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    sortModalContent: {
        maxHeight: '50%',
    },
    sortModalContentWrapper: {
        paddingBottom: 20,
    },
    sortListContainer: {
        maxHeight: 400,
    },
    sortListContent: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 8,
    },
    sortListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 4,
        paddingVertical: 14,
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.border,
        backgroundColor: Colors.backgroundWhite,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuterSelected: {
        borderColor: Colors.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.primary,
    },
    sortListItemText: {
        fontSize: 16,
        color: Colors.text,
        fontFamily: Fonts.Regular,
        flex: 1,
    },
    sortListItemTextSelected: {
        color: Colors.primary,
        fontFamily: Fonts.SemiBold,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: horizontalPadding,
        paddingTop: 12,
        paddingBottom: 100,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    footerLoaderContainer: {
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footerLoaderText: {
        marginTop: 12,
        fontSize: 14,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
    },
    footerSpacer: {
        height: 40,
    },
    emptyStateContainer: {
        flex: 1,
        justifyContent: 'center',
        minHeight: 200,
    },
    emptyState: {
        paddingHorizontal: 20,
    },
    searchHistoryContainer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    searchHistoryTitle: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
        marginBottom: 12,
    },
    searchHistoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        marginBottom: 8,
    },
    searchHistoryText: {
        flex: 1,
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.text,
        marginLeft: 12,
    },
    removeHistoryButton: {
        padding: 4,
    },
});
