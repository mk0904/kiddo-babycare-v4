import { InfiniteProductGrid } from '@/components/product/InfiniteProductGrid';
import BaseModal from '@/components/ui/BaseModal';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { FilterSortPills } from '@/components/ui/FilterSortPills';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import { Colors, Fonts } from '@/constants/theme';
import { configService } from '@/services/configService';
import { shopifyApi } from '@/services/shopifyApi';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function InfinityScreen() {
    const { collectionId, title, hideFilters } = useLocalSearchParams<{ collectionId: string; title: string; hideFilters?: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const shouldHideFilters = hideFilters === 'true';

    // Get product grid defaults from config
    const gridDefaults = configService.getProductGridDefaults();

    const [loading, setLoading] = useState(true);
    const [collection, setCollection] = useState<any>(null);

    // Filter & Sort State
    const [isFilterPanelVisible, setIsFilterPanelVisible] = useState(false);
    const [activeFiltersCount, setActiveFiltersCount] = useState(0);
    const [facets, setFacets] = useState<any[]>([]);
    const [selectedFilters, setSelectedFilters] = useState<any>({});
    const [sortKey, setSortKey] = useState<string | undefined>(undefined);
    const [reverse, setReverse] = useState(false);
    
    // Gender & Age Filter State
    const [showGenderModal, setShowGenderModal] = useState(false);
    const [showAgeModal, setShowAgeModal] = useState(false);
    const [selectedGender, setSelectedGender] = useState<string | null>(null);
    const [selectedAge, setSelectedAge] = useState<string | null>(null);

    const [totalItems, setTotalItems] = useState(0);

    // Transform local filters to Shopify API format
    const [apiFilters, setApiFilters] = useState<any[]>([]);

    // Helper function to determine if gender filter should be shown
    // Gender filter should only be available in clothing category (girls/boys)
    // and NOT when viewing a gender-specific collection
    const shouldShowGenderFilter = () => {
        if (!collection) return false; // Default to false if collection not loaded yet
        
        const collectionTitle = (collection.title || '').toLowerCase();
        const collectionHandle = (collection.handle || '').toLowerCase();
        const titleParam = (title || '').toLowerCase();
        
        // Combine all text sources for checking
        const allText = `${collectionTitle} ${collectionHandle} ${titleParam}`.toLowerCase();
        
        // Check if collection is already gender-specific (girls/boys specific carousel)
        // This includes collections with "girls", "boys", "girl's", "boy's" in the title
        const isGenderSpecific = 
            allText.includes('girls') || 
            allText.includes('boys') ||
            allText.includes("girl's") ||
            allText.includes("boy's") ||
            allText.includes("girl ") ||
            allText.includes("boy ");
        
        // If it's already gender-specific, don't show gender filter
        if (isGenderSpecific) {
            return false;
        }
        
        // Check if it's a non-clothing category (babycare, toys, babygear)
        // Gender filter should only be available in clothing category
        const isNonClothingCategory = 
            allText.includes('babycare') ||
            allText.includes('baby care') ||
            allText.includes('toys') ||
            allText.includes('toy') ||
            allText.includes('babygear') ||
            allText.includes('baby gear') ||
            allText.includes('diaper') ||
            allText.includes('feeding') ||
            allText.includes('stroller') ||
            allText.includes('car seat');
        
        // If it's a non-clothing category, don't show gender filter
        if (isNonClothingCategory) {
            return false;
        }
        
        // Show gender filter only for clothing categories (not non-clothing, not gender-specific)
        // Default to true for clothing items (assumes clothing unless proven otherwise)
        return true;
    };

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

    // Sync gender and age from selectedFilters
    useEffect(() => {
        if (selectedFilters.gender && Array.isArray(selectedFilters.gender) && selectedFilters.gender.length > 0) {
            setSelectedGender(selectedFilters.gender[0]);
        } else {
            setSelectedGender(null);
        }
        if (selectedFilters.age && Array.isArray(selectedFilters.age) && selectedFilters.age.length > 0) {
            setSelectedAge(selectedFilters.age[0]);
        } else {
            setSelectedAge(null);
        }
    }, [selectedFilters]);

    // Handle facets loaded from the product query
    const handleFacetsLoaded = (loadedFacets: any[]) => {
        if (loadedFacets && loadedFacets.length > 0) {
            if (__DEV__) {
                console.log('[Facets] Loaded facets:', loadedFacets.length);
                const brandFacet = loadedFacets.find((f: any) => 
                    (f.attribute || f.id || f.title || f.label || '').toLowerCase().includes('brand') ||
                    (f.attribute || f.id || f.title || f.label || '').toLowerCase().includes('vendor')
                );
                if (brandFacet) {
                    console.log('[Facets] Brand/Vendor facet found:', {
                        attribute: brandFacet.attribute || brandFacet.id,
                        title: brandFacet.title || brandFacet.label,
                        buckets: brandFacet.buckets?.length || brandFacet.values?.length,
                        firstBucket: brandFacet.buckets?.[0] || brandFacet.values?.[0]
                    });
                } else {
                    console.log('[Facets] No brand/vendor facet found. Available facets:', loadedFacets.map((f: any) => ({
                        attribute: f.attribute || f.id,
                        title: f.title || f.label
                    })));
                }
            }
            setFacets(loadedFacets);
        }
    };

    const handleApplyFilters = (filters: any) => {
        setSelectedFilters(filters);
        setIsFilterPanelVisible(false);

        // Count active filters (including gender and age)
        let count = 0;
        const newApiFilters: any[] = [];

        // Count gender and age filters separately
        if (selectedGender) count += 1;
        if (selectedAge) count += 1;

        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (Array.isArray(value) && value.length > 0) {
                // Don't double count gender and age
                if (key !== 'gender' && key !== 'age') {
                    count += value.length;
                }
                
                // Map filter keys to standardized names
                let filterKey = key;
                if (key?.toLowerCase().includes('brand') || key === 'brand') {
                    filterKey = 'vendor';
                } else if (key?.toLowerCase().includes('product_type') || key?.toLowerCase().includes('producttype') || key === 'product_type' || key === 'productType') {
                    filterKey = 'product_type';
                }
                
                // Construct API filter object
                // Check if it's a price range or simple list
                value.forEach(val => {
                    let filterAdded = false;
                    
                    // Special handling for price filters - they come as "min,max" strings
                    const isPriceFilter = key?.toLowerCase().includes('price') || filterKey?.toLowerCase().includes('price');
                    if (isPriceFilter && typeof val === 'string' && val.includes(',')) {
                        const parts = val.split(/[,\-]/);
                        if (parts.length === 2) {
                            const min = parseFloat(parts[0]);
                            const max = parseFloat(parts[1]);
                            if (!isNaN(min) && !isNaN(max)) {
                                const priceFilter = { price: { min: min, max: max } };
                                newApiFilters.push(priceFilter);
                                console.log('[Filter] ✅ Created price filter:', priceFilter);
                                filterAdded = true;
                            }
                        }
                    }
                    
                    if (!filterAdded) {
                        try {
                            // Try to parse if it's a JSON string value (from some implementations)
                            // checking if val matches price range structure
                            newApiFilters.push(JSON.parse(val));
                            filterAdded = true;
                        } catch (e) {
                        // It's likely a simple value, find the input in facets
                        // CRITICAL: Shopify provides the exact filter format in bucket.input - we MUST use it
                        
                        // If val is an ID format (like "filter.p.vendor.bumzee"), we need to search ALL facets
                        // because the ID contains the attribute info
                        const isIdFormat = typeof val === 'string' && val.includes('filter.p.');
                        
                        let facet = null;
                        if (isIdFormat) {
                            // Extract attribute from ID: "filter.p.vendor.bumzee" -> "filter.p.vendor"
                            const idParts = val.split('.');
                            if (idParts.length >= 3) {
                                const idAttribute = idParts.slice(0, 3).join('.'); // "filter.p.vendor"
                                console.log('[Filter] ID format detected, searching for attribute:', idAttribute);
                                console.log('[Filter] Available facets:', facets.map((f: any) => ({ 
                                    attribute: f.attribute, 
                                    id: f.id, 
                                    title: f.title,
                                    buckets: f.buckets?.length 
                                })));
                                
                                facet = facets.find(f => {
                                    const facetAttr = f.attribute || f.id || f.field || f.name;
                                    const matches = facetAttr === idAttribute || facetAttr === key || facetAttr === filterKey;
                                    if (matches) {
                                        console.log('[Filter] ✅ Matched facet by attribute:', facetAttr);
                                    }
                                    return matches;
                                });
                                
                                if (!facet) {
                                    console.log('[Filter] ⚠️ No facet found for ID attribute:', idAttribute);
                                }
                            }
                        }
                        
                        // If not found by ID or not ID format, use normal lookup
                        if (!facet) {
                            facet = facets.find(f => {
                                const facetAttr = f.attribute || f.id || f.field || f.name;
                                const facetTitle = f.title || f.label || f.name || '';
                                // Check both original key and mapped filterKey (for brand->vendor mapping, product_type mapping)
                                const isBrandKey = key?.toLowerCase().includes('brand') || key === 'brand';
                                const isVendorKey = filterKey === 'vendor' || facetAttr?.toLowerCase().includes('vendor');
                                const isBrandFacet = facetTitle?.toLowerCase().includes('brand') || facetTitle?.toLowerCase().includes('vendor');
                                
                                const isProductTypeKey = filterKey === 'product_type' || key?.toLowerCase().includes('product_type') || key?.toLowerCase().includes('producttype');
                                const isProductTypeFacet = facetAttr?.toLowerCase().includes('product_type') || facetTitle?.toLowerCase().includes('product type');
                                
                                return facetAttr === key || 
                                       facetAttr === filterKey || 
                                       f.id === key ||
                                       (isBrandKey && (isVendorKey || isBrandFacet)) ||
                                       (isBrandFacet && isBrandKey) ||
                                       (isProductTypeKey && isProductTypeFacet) ||
                                       (isProductTypeFacet && isProductTypeKey);
                            });
                        }
                        
                        if (facet) {
                            console.log('[Filter] Found facet (raw):', facet);
                            
                            // Shopify GraphQL returns facets with either "buckets" or "values" array
                            const bucketArray = facet.buckets || facet.values || [];
                            console.log('[Filter] Found facet (parsed):', { 
                                attribute: facet.attribute, 
                                id: facet.id,
                                field: facet.field,
                                name: facet.name,
                                title: facet.title || facet.label,
                                buckets: facet.buckets?.length,
                                values: facet.values?.length,
                                bucketArray: bucketArray.length,
                                hasBuckets: !!facet.buckets,
                                hasValues: !!facet.values
                            });
                            
                            if (bucketArray.length === 0) {
                                console.log('[Filter] ⚠️ No buckets/values found in facet');
                            }
                            
                            // Find the matching bucket by label, value, or id
                            // PRIORITY: ID match first (for ID format values), then label/value
                            const bucket = bucketArray.find((b: any) => {
                                // Exact ID match (highest priority for ID format values)
                                if (b.id && b.id === val) {
                                    console.log('[Filter] ✅ Matched bucket by ID:', b.id);
                                    return true;
                                }
                                // Exact label/value match
                                if (b.label === val || b.value === val) {
                                    console.log('[Filter] ✅ Matched bucket by label/value:', b.label || b.value);
                                    return true;
                                }
                                // Case-insensitive match
                                if (typeof val === 'string') {
                                    if (b.label?.toLowerCase() === val.toLowerCase() || b.value?.toLowerCase() === val.toLowerCase()) {
                                        console.log('[Filter] ✅ Matched bucket by case-insensitive label/value');
                                        return true;
                                    }
                                }
                                return false;
                            });
                            
                            if (!bucket && isIdFormat) {
                                const bucketArray = facet.buckets || facet.values || [];
                                console.log('[Filter] ⚠️ Bucket not found for ID:', val, 'Available buckets/values:', bucketArray.map((b: any) => ({ id: b.id, label: b.label })));
                            }
                            
                            if (bucket) {
                                console.log('[Filter] Found bucket:', { label: bucket.label, value: bucket.value, id: bucket.id, input: bucket.input });
                                
                                // PRIORITY 1: Use bucket.input if available (Shopify's exact filter format)
                                if (bucket.input && !filterAdded) {
                                    try {
                                        // Try parsing as JSON first
                                        const parsed = typeof bucket.input === 'string' ? JSON.parse(bucket.input) : bucket.input;
                                        if (parsed && typeof parsed === 'object') {
                                            newApiFilters.push(parsed);
                                            console.log('[Filter] ✅ Using bucket.input:', parsed);
                                            filterAdded = true;
                                        }
                                    } catch (err) {
                                        console.log('[Filter] ⚠️ Failed to parse bucket.input as JSON:', err);
                                        // If not JSON, use the input directly if it's an object
                                        if (typeof bucket.input === 'object' && bucket.input !== null) {
                                            newApiFilters.push(bucket.input);
                                            console.log('[Filter] ✅ Using bucket.input (object):', bucket.input);
                                            filterAdded = true;
                                        }
                                    }
                                }
                                
                                // PRIORITY 2: For brand/vendor filters, create productVendor filter using bucket value
                                if (!filterAdded && (filterKey === 'vendor' || key?.toLowerCase().includes('brand') || facet.title?.toLowerCase().includes('brand'))) {
                                    // Use bucket.label (e.g., "Bumzee") or bucket.value, NOT bucket.id
                                    // bucket.id is like "filter.p.vendor.bumzee" which is wrong
                                    const vendorValue = bucket.label || bucket.value || val;
                                    // Only use if it's not the ID format (doesn't contain "filter.p.")
                                    if (!vendorValue.includes('filter.p.')) {
                                        const vendorFilter = { productVendor: vendorValue };
                                        newApiFilters.push(vendorFilter);
                                        console.log('[Filter] Created productVendor filter:', vendorFilter);
                                        filterAdded = true;
                                    }
                                }
                                
                                // PRIORITY 3: For product type filters, create productType filter using bucket value
                                if (!filterAdded && (filterKey === 'product_type' || filterKey === 'productType' || key?.toLowerCase().includes('product_type') || key?.toLowerCase().includes('producttype') || facet.title?.toLowerCase().includes('product type') || facet.id?.includes('product_type') || facet.label?.toLowerCase().includes('product type'))) {
                                    // Use bucket.label (e.g., "Accessories") or bucket.value, NOT bucket.id
                                    const productTypeValue = bucket.label || bucket.value || val;
                                    // Only use if it's not the ID format (doesn't contain "filter.p.")
                                    if (!productTypeValue.includes('filter.p.')) {
                                        const productTypeFilter = { productType: productTypeValue };
                                        newApiFilters.push(productTypeFilter);
                                        console.log('[Filter] ✅ Created productType filter:', productTypeFilter);
                                        filterAdded = true;
                                    }
                                }
                            }
                        }
                        
                        // FALLBACK: For brand/vendor filters without facet match, create filter directly
                        // BUT only if val is not an ID format (doesn't contain "filter.p.")
                        if (!filterAdded && (filterKey === 'vendor' || key?.toLowerCase().includes('brand'))) {
                            // Don't use ID format - skip if it looks like an ID
                            if (!val.includes('filter.p.')) {
                                const vendorFilter = { productVendor: val };
                                newApiFilters.push(vendorFilter);
                                console.log('[Filter] Fallback productVendor filter:', vendorFilter);
                                filterAdded = true;
                            } else {
                                console.log('[Filter] ⚠️ Skipping ID format value:', val, '- Need to find bucket.label instead');
                            }
                        }
                        
                        // FALLBACK: For product type filters without facet match, create filter directly
                        // BUT only if val is not an ID format (doesn't contain "filter.p.")
                        if (!filterAdded && (filterKey === 'product_type' || filterKey === 'productType' || key?.toLowerCase().includes('product_type') || key?.toLowerCase().includes('producttype'))) {
                            // Don't use ID format - skip if it looks like an ID
                            if (!val.includes('filter.p.')) {
                                const productTypeFilter = { productType: val };
                                newApiFilters.push(productTypeFilter);
                                console.log('[Filter] Fallback productType filter:', productTypeFilter);
                                filterAdded = true;
                            } else {
                                console.log('[Filter] ⚠️ Skipping ID format value:', val, '- Need to find bucket.label instead');
                            }
                        }
                        
                        if (!filterAdded) {
                            if (__DEV__) console.warn('[Filter] Could not create filter for:', key, val, 'Facets:', facets.length);
                        }
                        // Note: Gender and age filters are handled separately via tag filtering
                        // They are not added to ProductFilter array as productTag is not a valid field
                        }
                    }
                });
            }
        });
        
        console.log('🎯 [Filter] Applied filters:', filters);
        console.log('🎯 [Filter] API filters:', newApiFilters);
        console.log('🎯 [Filter] API filters count:', newApiFilters.length);
        console.log('🎯 [Filter] API filters JSON:', JSON.stringify(newApiFilters, null, 2));
        
        setActiveFiltersCount(count);
        // Store filters for client-side filtering (don't send to API)
        setApiFilters(newApiFilters);
        console.log('🎯 [Filter] ✅ apiFilters state updated');
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

    // Gender filter options - matching actual tag formats
    const GENDER_OPTIONS = [
        { label: 'Boys', value: 'boys' },
        { label: 'Girls', value: 'girls' },
        { label: 'Unisex', value: 'unisex' },
    ];

    // Age filter options - matching actual tag formats
    const AGE_OPTIONS = [
        { label: '3-6 months', value: '3-6m' },
        { label: '6-12 months', value: '6-12m' },
        { label: '1-2 years', value: '1-2y' },
        { label: '2-3 years', value: '2-3y' },
        { label: '3-4 years', value: '3-4y' },
        { label: '4-5 years', value: '4-5y' },
        { label: '5+ years', value: '5+y' },
    ];

    const handleGenderSelect = (gender: string) => {
        if (selectedGender === gender) {
            // Deselect if already selected (toggle off)
            setSelectedGender(null);
            // Remove gender filter from selectedFilters
            const { gender: _, ...rest } = selectedFilters;
            setSelectedFilters(rest);
            // Recalculate filter count and API filters
            handleApplyFilters(rest);
        } else {
            // Select new gender (toggle on)
            setSelectedGender(gender);
            // Add gender filter to selectedFilters
            const newFilters = { ...selectedFilters, gender: [gender] };
            setSelectedFilters(newFilters);
            handleApplyFilters(newFilters);
        }
        // Close modal after selection/deselection
        setShowGenderModal(false);
    };

    const handleAgeSelect = (age: string) => {
        if (selectedAge === age) {
            // Deselect if already selected (toggle off)
            setSelectedAge(null);
            // Remove age filter from selectedFilters
            const { age: _, ...rest } = selectedFilters;
            setSelectedFilters(rest);
            // Recalculate filter count and API filters
            handleApplyFilters(rest);
        } else {
            // Select new age (toggle on)
            setSelectedAge(age);
            // Add age filter to selectedFilters
            const newFilters = { ...selectedFilters, age: [age] };
            setSelectedFilters(newFilters);
            handleApplyFilters(newFilters);
        }
        // Close modal after selection/deselection
        setShowAgeModal(false);
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

                {!shouldHideFilters && (
                    <FilterSortPills
                        totalItems={totalItems}
                        activeFiltersCount={activeFiltersCount}
                        onFiltersPress={() => setIsFilterPanelVisible(true)}
                        onSortPress={handleSortPress}
                        onGenderPress={() => setShowGenderModal(true)}
                        onAgePress={() => setShowAgeModal(true)}
                        selectedGender={selectedGender}
                        selectedAge={selectedAge}
                        facets={[]}
                        selectedFilters={selectedFilters}
                        style={styles.pills}
                        showGenderFilter={shouldShowGenderFilter()}
                    />
                )}

                <View style={styles.gridContainer}>
                    <InfiniteProductGrid
                        collectionId={collectionId.startsWith('gid://') ? collectionId : `gid://shopify/Collection/${collectionId}`}
                        sortKey={sortKey}
                        reverse={reverse}
                        filters={apiFilters} // Pass filters for client-side filtering
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
                        // Pass gender and age for client-side filtering
                        genderFilter={selectedGender}
                        ageFilter={selectedAge}
                    />
                </View>

                {!shouldHideFilters && (
                    <FilterPanel
                        visible={isFilterPanelVisible}
                        onClose={() => setIsFilterPanelVisible(false)}
                    facets={facets.map((f: any) => {
                        // Handle different facet structures from Shopify
                        let attribute = f.attribute || f.id || f.field || f.name;
                        const title = f.title || f.label || f.name || attribute;
                        const type = f.type || f.data_type || (f.buckets ? 'select' : 'LIST');
                        let buckets = f.buckets || f.values || f.data || [];
                        
                        // Map brand/vendor attributes correctly
                        // Shopify uses 'vendor' for brand filtering in ProductFilter
                        const isBrandFacet = attribute?.toLowerCase().includes('brand') || 
                                           title?.toLowerCase().includes('brand') ||
                                           title?.toLowerCase().includes('vendor') ||
                                           attribute?.toLowerCase().includes('vendor');
                        if (isBrandFacet) {
                            attribute = 'vendor';
                        }
                        
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
                                input: bucket.input, // CRITICAL: Preserve the input field - this contains the exact filter format
                                id: bucket.id, // Preserve id for matching
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
                )}

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

                {/* Gender Filter Modal */}
                <BaseModal
                    visible={showGenderModal}
                    onClose={() => setShowGenderModal(false)}
                    title="Select Gender"
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
                        {GENDER_OPTIONS.map((option, index) => {
                            const isSelected = selectedGender === option.value;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.sortListItem}
                                    onPress={() => handleGenderSelect(option.value)}
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

                {/* Age Filter Modal */}
                <BaseModal
                    visible={showAgeModal}
                    onClose={() => setShowAgeModal(false)}
                    title="Select Age"
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
                        {AGE_OPTIONS.map((option, index) => {
                            const isSelected = selectedAge === option.value;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.sortListItem}
                                    onPress={() => handleAgeSelect(option.value)}
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
        paddingTop: 16,
        paddingBottom: 16,
    },
    sortListItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 18,
    },
    sortListItemText: {
        fontSize: 16,
        color: Colors.text,
        fontFamily: Fonts.Regular,
        flex: 1,
        marginRight: 12,
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
