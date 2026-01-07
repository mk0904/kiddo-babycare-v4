import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Dimensions,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    InteractionManager,
} from 'react-native';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { searchaniseApi } from '@/services/searchaniseApi';
import { shopifyApi } from '@/services/shopifyApi';
import { ProductCard } from '@/components/product/ProductCard';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { FilterSortPills } from '@/components/ui/FilterSortPills';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import BaseModal from '@/components/ui/BaseModal';
import { useScrollTracking } from '@/hooks/useScrollTracking';
import { Colors, Fonts } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 8;
const HORIZONTAL_PADDING = 8;

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

    const performSearch = useCallback(async (loadMore = false, signal?: AbortSignal, requestId?: number) => {
        try {
            if (signal?.aborted) return;
            if (requestId !== undefined && requestId !== requestIdRef.current) return;

            if (!loadMore) {
                setLoading(true);
                setLoadingMore(false);
                setStartIndex(0);
            } else {
                setLoadingMore(true);
            }

            const currentIndex = loadMore ? startIndex : 0;
            const result = await searchaniseApi.searchProducts({
                q: searchQuery.trim(),
                collection: collectionHandle,
                filters: selectedFilters,
                sortBy,
                sortOrder,
                startIndex: currentIndex,
                maxResults: 24, // Increased for better pagination
                facets: true,
            }, signal);

            if (signal?.aborted || (requestId !== undefined && requestId !== requestIdRef.current)) {
                return;
            }

            if (result) {
                // Filter out invalid products first
                let newProducts = result.products.edges
                    .map((edge: any) => edge.node)
                    .filter((p: any) => p && p.id);

                // Update products immediately (without tags) to prevent UI freeze
                if (loadMore) {
                    setProducts((prev) => [...prev.filter((p: any) => p && p.id), ...newProducts]);
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

                // Fetch tags asynchronously after UI update
                if (newProducts.length > 0 && !loadMore) {
                    const currentRequestId = requestIdRef.current;

                    InteractionManager.runAfterInteractions(() => {
                        if (currentRequestId !== requestIdRef.current) {
                            return;
                        }

                        const batchSize = 5;
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
                                            if (fullProduct?.tags) {
                                                return { productId: product.id, tags: fullProduct.tags };
                                            }
                                        }
        } catch (error) {
                                        // Silently fail - tags are optional
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
                                    return prev.map((product: any) => {
                                        const tagResult = tagResults.find((r: any) => r && r.productId === product.id);
                                        if (tagResult && tagResult.tags) {
                                            return { ...product, tags: tagResult.tags };
                                        }
                                        return product;
                                    });
                                });
                            }, batchIndex * 100);

                            tagFetchTimeoutsRef.current.push(timeoutId);
                        });
                    });
                }

                setTotalItems(result.totalItems || 0);
                setHasMore(result.products.pageInfo?.hasNextPage || false);
                setStartIndex(currentIndex + newProducts.length);
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
        router.push({
            pathname: '/product/[id]',
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

    // Calculate card width with proper spacing
    const cardWidth = useMemo(() => {
        const totalPadding = HORIZONTAL_PADDING * 2; // 8px left + 8px right = 16px
        const totalGap = GAP; // 8px gap between items
        const availableWidth = SCREEN_WIDTH - totalPadding - totalGap;
        return availableWidth / 2;
    }, []);


    const keyExtractor = useCallback((item: any) => {
        return item.id || item._id || `product-${item.handle}`;
    }, []);

    const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
        if (!item || !item.id) return null;

        const isLastInRow = (index + 1) % 2 === 0;
            return (
            <View style={{
                width: cardWidth,
                marginRight: isLastInRow ? 0 : GAP,
                marginBottom: GAP,
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
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>

                    <View style={styles.searchInputContainer}>
                        <View style={styles.searchIconContainer}>
                            <Ionicons name="search" size={20} color="#666666" />
                        </View>
                    <TextInput
                            style={styles.searchInput}
                            placeholder="Search products..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        returnKeyType="search"
                            autoFocus={!initialQuery}
                            placeholderTextColor="#666666"
                        />
                        {searchQuery.length > 0 ? (
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
                        ) : (
                            <View style={styles.searchRightIcon}>
                                <Ionicons name="mic-outline" size={18} color="#999999" />
                            </View>
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
                    <EmptyState
                        icon="search-outline"
                        iconSize={64}
                        title="Start typing to search"
                    />
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
                        onEndReachedThreshold={0.3}
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
                        const attribute = f.attribute || f.id || f.field || f.name;
                        const title = f.title || f.label || f.name || attribute;
                        const type = f.type || f.data_type || (f.buckets ? 'select' : 'LIST');
                        let buckets = f.buckets || f.values || f.data || [];
                        
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingVertical: 12,
        backgroundColor: Colors.backgroundWhite,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        marginRight: 10,
        padding: 4,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        paddingHorizontal: 16,
        height: 48,
    },
    searchIconContainer: {
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#666666',
        fontFamily: Fonts.Medium,
        includeFontPadding: false,
        textAlignVertical: 'center',
        letterSpacing: 0.2,
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
        maxHeight: '60%',
        height: '60%',
    },
    sortModalContentWrapper: {
        flex: 1,
    },
    sortListContainer: {
        flex: 1,
    },
    sortListContent: {
        padding: 20,
        paddingTop: 10,
    },
    sortListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
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
        paddingHorizontal: HORIZONTAL_PADDING,
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
});
