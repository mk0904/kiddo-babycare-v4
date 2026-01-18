import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Fonts } from '@/constants/theme';
import { InfiniteProductGrid } from '@/components/product/InfiniteProductGrid';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { FilterSortPills } from '@/components/ui/FilterSortPills';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import BaseModal from '@/components/ui/BaseModal';
import { shopifyApi } from '@/services/shopifyApi';
import { configService } from '@/services/configService';
import { Ionicons } from '@expo/vector-icons';

export default function InfinityScreen() {
    const { collectionId, title } = useLocalSearchParams<{ collectionId: string; title: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Get product grid defaults from config
    const gridDefaults = configService.getProductGridDefaults();

    const [loading, setLoading] = useState(true);
    const [collection, setCollection] = useState<any>(null);

    // Filter & Sort State
    const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
    const [activeFiltersCount, setActiveFiltersCount] = useState(0);
    const [facets, setFacets] = useState<any[]>([]);
    const [selectedFilters, setSelectedFilters] = useState<any>({});
    const [sortKey, setSortKey] = useState('BEST_SELLING');
    const [reverse, setReverse] = useState(false);

    const [totalItems, setTotalItems] = useState(0);

    // Transform local filters to Shopify API format
    const [apiFilters, setApiFilters] = useState<any[]>([]);

    useEffect(() => {
        async function fetchCollectionInfo() {
            if (collectionId) {
                setLoading(true);
                try {
                    // Format ID if needed
                    const formattedId = collectionId.startsWith('gid://')
                        ? collectionId
                        : `gid://shopify/Collection/${collectionId}`;

                    const data = await shopifyApi.getCollectionById(formattedId);
                    setCollection(data);
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            }
        }
        fetchCollectionInfo();
    }, [collectionId]);

    // Handle facets loaded from the product query
    const handleFacetsLoaded = (loadedFacets: any[]) => {
        if (loadedFacets && loadedFacets.length > 0) {
            setFacets(loadedFacets);
        }
    };

    const handleApplyFilters = (filters: any) => {
        setSelectedFilters(filters);
        setIsFilterPanelVisible(false);

        // Count active filters
        let count = 0;
        const newApiFilters: any[] = [];

        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (Array.isArray(value) && value.length > 0) {
                count += value.length;
                // Construct API filter object
                // Check if it's a price range or simple list
                value.forEach(val => {
                    try {
                        // Try to parse if it's a JSON string value (from some implementations)
                        // checking if val matches price range structure
                        newApiFilters.push(JSON.parse(val));
                    } catch (e) {
                        // It's likely a simple value, find the input in facets
                        // We need to map the selected value label back to the input JSON required by Shopify
                        // This is a simplification; robust implementation needs more complex mapping
                        const facet = facets.find(f => f.attribute === key || f.id === key);
                        if (facet) {
                            const bucket = facet.buckets?.find((b: any) => b.label === val || b.value === val);
                            if (bucket && bucket.input) {
                                try {
                                    newApiFilters.push(JSON.parse(bucket.input));
                                } catch (err) {
                                    console.warn("Could not parse filter input", bucket.input);
                                }
                            }
                        }
                    }
                });
            }
        });
        setActiveFiltersCount(count);
        setApiFilters(newApiFilters);
    };

    const [showSortModal, setShowSortModal] = useState(false);

    const SORT_OPTIONS = [
        { label: 'Relevance', key: 'RELEVANCE', reverse: false },
        { label: 'Best Selling', key: 'BEST_SELLING', reverse: false },
        { label: 'Name: A-Z', key: 'TITLE', reverse: false },
        { label: 'Name: Z-A', key: 'TITLE', reverse: true },
        { label: 'Price: Low to High', key: 'PRICE', reverse: false },
        { label: 'Price: High to Low', key: 'PRICE', reverse: true },
        { label: 'Newest', key: 'CREATED', reverse: true },
    ];

    const handleSortPress = () => {
        setShowSortModal(true);
    };

    const handleSortSelect = (option: typeof SORT_OPTIONS[0]) => {
        setSortKey(option.key);
        setReverse(option.reverse);
        setShowSortModal(false);
    };

    const sortLabel = () => {
        const option = SORT_OPTIONS.find(opt => opt.key === sortKey && opt.reverse === reverse);
        return option?.label || 'Sort';
    };

    const handleFastFilterToggle = (attribute: string, value: any) => {
        const currentFilters = { ...selectedFilters };
        const currentValues = currentFilters[attribute] || [];
        
        // For price/range filters, replace instead of add (single selection)
        const isPriceFilter = attribute === 'price' || 
                             attribute === 'price_range' || 
                             attribute?.toLowerCase().includes('price');
        
        if (Array.isArray(currentValues)) {
            const isSelected = currentValues.includes(value);
            
            if (isSelected) {
                // Remove filter
                const { [attribute]: _, ...rest } = currentFilters;
                handleApplyFilters(rest);
            } else {
                // For price filters, replace; for others, add
                if (isPriceFilter) {
                    handleApplyFilters({ ...currentFilters, [attribute]: [value] });
                } else {
                    handleApplyFilters({ ...currentFilters, [attribute]: [...currentValues, value] });
                }
            }
        } else {
            handleApplyFilters({ ...currentFilters, [attribute]: [value] });
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Custom Header matching PDP style */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {collection?.title || title || 'Products'}
                        </Text>
                    </View>
                    <View style={styles.headerRightPlaceholder} />
                </View>

                <FilterSortPills
                    totalItems={totalItems}
                    activeFiltersCount={activeFiltersCount}
                    onFiltersPress={() => setIsFilterPanelVisible(true)}
                    onSortPress={handleSortPress}
                    facets={facets.map((f: any) => {
                        // Handle different facet structures from Shopify
                        const attribute = f.attribute || f.id || f.field || f.name;
                        const title = f.title || f.label || f.name || attribute;
                        const type = f.type || f.data_type || (f.buckets ? 'select' : 'LIST');
                        let buckets = f.buckets || f.values || f.data || [];
                        
                        // Ensure buckets have the right structure
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
                    style={styles.pills}
                />

                <View style={styles.gridContainer}>
                    <InfiniteProductGrid
                        collectionId={collectionId.startsWith('gid://') ? collectionId : `gid://shopify/Collection/${collectionId}`}
                        sortKey={sortKey}
                        reverse={reverse}
                        filters={apiFilters}
                        onFacetsLoaded={handleFacetsLoaded}
                        onResultsCount={setTotalItems}
                        style={{ root: { flex: 1 } }}
                        productOptions={{
                            numColumns: 2,
                            gap: gridDefaults.gap,
                            rowGap: gridDefaults.rowGap,
                            colGap: gridDefaults.colGap,
                            paddingHorizontal: gridDefaults.paddingHorizontal,
                            horizontalPadding: gridDefaults.paddingHorizontal, // Backward compatibility
                        }}
                        scrollable={true}
                    />
                </View>

                <FilterPanel
                    visible={isFilterPanelVisible}
                    onClose={() => setIsFilterPanelVisible(false)}
                    facets={facets.map((f: any) => {
                        // Handle different facet structures from Shopify
                        const attribute = f.attribute || f.id || f.field || f.name;
                        const title = f.title || f.label || f.name || attribute;
                        const type = f.type || f.data_type || (f.buckets ? 'select' : 'LIST');
                        let buckets = f.buckets || f.values || f.data || [];
                        
                        // Ensure buckets have the right structure
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
                    onApplyFilters={handleApplyFilters}
                    totalResults={totalItems}
                />

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
                        showsVerticalScrollIndicator={false}
                    >
                        {SORT_OPTIONS.map((option, index) => {
                            const isSelected = sortKey === option.key && reverse === option.reverse;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.sortListItem}
                                    onPress={() => handleSortSelect(option)}
                                >
                                    <Text style={[
                                        styles.sortListItemText,
                                        isSelected && styles.sortListItemTextSelected
                                    ]}>
                                        {option.label}
                                    </Text>
                                    <View style={[
                                        styles.radioOuter,
                                        isSelected && styles.radioOuterSelected
                                    ]}>
                                        {isSelected && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </BaseModal>
            </SafeAreaView>
            <FloatingCartButton showTabBar={false} />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        zIndex: 10,
    },
    backButton: {
        padding: 8,
    },
    headerTitleContainer: {
        flex: 1,
        marginHorizontal: 10,
    },
    headerTitle: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#000',
    },
    headerRightPlaceholder: {
        width: 40, // Match back button width for centering
    },
    pills: {
        zIndex: 10,
    },
    gridContainer: {
        flex: 1,
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
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.border,
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
});
