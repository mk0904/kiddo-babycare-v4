import { InfiniteProductGrid } from '@/components/products/InfiniteProductGrid';
import BaseModal from '@/components/ui/BaseModal';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { FilterSortPills } from '@/components/ui/FilterSortPills';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import { MilestoneTabDock } from '@/components/ui/MilestoneTabDock';
import { Colors, Fonts } from '@/constants/theme';
import { useMilestoneDockHeightSafe } from '@/context/MilestoneDockContext';
import { appConfigService } from '@/services/appConfigService';
import { configService } from '@/services/configService';
import { shopifyApi } from '@/services/shopifyApi';
import { useCartItemCount } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Dimensions,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Gender filter options
const GENDER_OPTIONS = [
    { label: 'Boys', value: 'boys' },
    { label: 'Girls', value: 'girls' },
    { label: 'Unisex', value: 'unisex' },
];

// Age filter options
const AGE_OPTIONS = [
    { label: '0 - 6M', value: '0-6m' },
    { label: '6 - 12M', value: '6-12m' },
    { label: '1 - 2Y', value: '1-2y' },
    { label: '2 - 3Y', value: '2-3y' },
    { label: '3 - 4Y', value: '3-4y' },
    { label: '4 - 5Y', value: '4-5y' },
    { label: '5 - 6Y', value: '5-6y' },
    { label: '6 - 7Y', value: '6-7y' },
];

// Diaper size options in specific order
const DIAPER_SIZE_OPTIONS = [
    { label: 'New Born', value: 'New Born' },
    { label: 'XXS', value: 'XXS' },
    { label: 'XS', value: 'XS' },
    { label: 'Small', value: 'Small' },
    { label: 'Medium', value: 'Medium' },
    { label: 'Large', value: 'Large' },
    { label: 'XL', value: 'XL' },
    { label: 'XXL', value: 'XXL' },
    { label: 'XXXL', value: 'XXXL' },
];

export default function InfinityScreen() {
    const { collectionId, title, hideFilters } = useLocalSearchParams<{ collectionId: string; title: string; hideFilters?: string }>();
    const router = useRouter();
    const cartItemCount = useCartItemCount();
    const milestoneDockHeight = useMilestoneDockHeightSafe();
    const shouldHideFilters = hideFilters === 'true';

    const [milestoneExpanded, setMilestoneExpanded] = useState(false);
    const [milestoneUiRev, setMilestoneUiRev] = useState(0);

    useEffect(() => {
        const off = appConfigService.subscribe(() => setMilestoneUiRev((x) => x + 1));
        setMilestoneUiRev((x) => x + 1);
        return off;
    }, []);

    const milestoneUI = useMemo(() => appConfigService.getMilestoneUI(), [milestoneUiRev]);

    const isInlineCartVisible = cartItemCount > 0 && !milestoneExpanded;
    const isMilestoneCollapsed = milestoneDockHeight > 0 && milestoneDockHeight < 120;
    const floatingCartMilestoneReserve = isMilestoneCollapsed
        ? Math.max(milestoneDockHeight, 0) + 12 + 4
        : 0;

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

    const [pageCategory, setPageCategory] = useState<'fashion' | 'toys' | 'essentials' | 'diapers' | 'formula' | 'other' | null>(null);

    // Brand Filter State
    const [showBrandModal, setShowBrandModal] = useState(false);
    const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
    const [brandOptions, setBrandOptions] = useState<{ label: string; value: string }[]>([]);

    // Size Filter State
    const [showSizeModal, setShowSizeModal] = useState(false);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [sizeOptions, setSizeOptions] = useState<{ label: string; value: string }[]>([]);

    // Stage Filter State
    const [showStageModal, setShowStageModal] = useState(false);
    const [selectedStage, setSelectedStage] = useState<string | null>(null);
    const [stageOptions, setStageOptions] = useState<{ label: string; value: string }[]>([]);



    // Transform local filters to Shopify API format
    const [apiFilters, setApiFilters] = useState<any[]>([]);

    // Babycare collection sidebar (subcategories) – configurable per collection, starts below filters row
    const sidebarSubcategories = useMemo(
        () => (collectionId ? configService.getBabycareCollectionSidebar(collectionId) : null),
        [collectionId]
    );

    // When sidebar is shown, subcategory tap updates content in place (no navigation)
    const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
    const [activeTitle, setActiveTitle] = useState<string | null>(null);
    // Measured width of the grid container (so product cards adapt and don't get cropped when sidebar is present)
    const [gridContainerWidth, setGridContainerWidth] = useState<number | null>(null);
    const effectiveCollectionId = (sidebarSubcategories?.length && activeCollectionId) ? activeCollectionId : (collectionId || '');
    const effectiveTitle = (sidebarSubcategories?.length && activeTitle !== null) ? activeTitle : (title || collection?.title || 'Products');

    useEffect(() => {
        if (collectionId && sidebarSubcategories?.length) {
            setActiveCollectionId(collectionId.startsWith('gid://') ? collectionId : `gid://shopify/Collection/${collectionId}`);
            setActiveTitle(title || '');
        }
    }, [collectionId, title, sidebarSubcategories?.length]);

    useEffect(() => {
        if (effectiveCollectionId && sidebarSubcategories?.length) {
            const formattedId = effectiveCollectionId.startsWith('gid://') ? effectiveCollectionId : `gid://shopify/Collection/${effectiveCollectionId}`;
            shopifyApi.getCollectionById(formattedId).then(setCollection).catch(() => setCollection(null));
        }
    }, [effectiveCollectionId, sidebarSubcategories?.length]);

    // Helper function to determine if gender filter should be shown
    // Gender filter should only be available in clothing category (girls/boys)
    // and NOT when viewing a gender-specific collection
    const shouldShowGenderFilter = () => {
        if (!collection) return false; // Default to false if collection not loaded yet
        
        const collectionTitle = (collection.title || '').toLowerCase();
        const collectionHandle = (collection.handle || '').toLowerCase();
        if (shouldHideFilters) return false;
        
        // Show gender filter ONLY for fashion category
        if (pageCategory === 'fashion') {
            const allText = (effectiveTitle || '').toLowerCase();
            const isGenderSpecific = 
                allText.includes('girls') || 
                allText.includes('boys') ||
                allText.includes("girl's") ||
                allText.includes("boy's") ||
                allText.includes("girl ") ||
                allText.includes("boy ");
            
            // If it's already gender-specific (e.g. "Girls Tops"), don't show the filter
            if (isGenderSpecific) return false;
            return true;
        }
        
        // Hide for Toys, Essentials, and others
        return false;
    };

    const shouldShowAgeFilter = () => {
        if (shouldHideFilters) return false;
        
        // Show age filter for Fashion and Toys
        // (Essentials/Other usually use different sizing like weight or volume)
        return pageCategory === 'fashion' || pageCategory === 'toys';
    };

    const shouldShowBrandFilter = () => {
        if (shouldHideFilters) return false;
        // Show Brand filter for Essentials, Diapers, and Formula
        return pageCategory === 'essentials' || pageCategory === 'diapers' || pageCategory === 'formula';
    };

    const shouldShowSizeFilter = () => {
        if (shouldHideFilters) return false;
        // Show Size filter specifically for Diapers
        return pageCategory === 'diapers';
    };

    const shouldShowStageFilter = () => {
        if (shouldHideFilters) return false;
        // Show Stage filter specifically for Formula
        return pageCategory === 'formula';
    };

    useEffect(() => {
        async function fetchCollectionInfo() {
            if (effectiveCollectionId) {
                setLoading(true);
                try {
                    const info = await shopifyApi.getCollectionById(effectiveCollectionId);
                    setCollection(info);
                    
                    // Identify category from "Category" metafield
                    const categoryValue = info?.categoryMetafield?.value?.toLowerCase();
                    if (categoryValue === 'fashion') {
                        setPageCategory('fashion');
                    } else if (categoryValue === 'toys') {
                        setPageCategory('toys');
                    } else if (categoryValue === 'essentials') {
                        setPageCategory('essentials');
                    } else if (categoryValue === 'diapers') {
                        setPageCategory('diapers');
                    } else if (categoryValue === 'formula') {
                        setPageCategory('formula');
                    } else {
                        // Fallback logic if metafield is missing
                        const allText = (info?.title || info?.handle || '').toLowerCase();
                        if (allText.includes('toys') || allText.includes('toy')) {
                            setPageCategory('toys');
                        } else if (allText.includes('formula')) {
                            setPageCategory('formula');
                        } else if (allText.includes('diaper')) {
                            setPageCategory('diapers');
                        } else if (allText.includes('babycare') || allText.includes('feeding')) {
                            setPageCategory('essentials');
                        } else {
                            setPageCategory('fashion'); // Default to fashion
                        }
                    }
                } catch (error) {
                    console.error('Error fetching collection info:', error);
                } finally {
                    setLoading(false);
                }
            }
        }
        fetchCollectionInfo();
    }, [effectiveCollectionId]);

    const handleBrandSelect = (brand: string) => {
        if (selectedBrand === brand) {
            setSelectedBrand(null);
            const { vendor: _, ...rest } = selectedFilters;
            setSelectedFilters(rest);
            handleApplyFilters(rest);
        } else {
            setSelectedBrand(brand);
            const newFilters = { ...selectedFilters, vendor: [brand] };
            setSelectedFilters(newFilters);
            handleApplyFilters(newFilters);
        }
        setShowBrandModal(false);
    };

    const handleSizeSelect = (size: string) => {
        if (selectedSize === size) {
            setSelectedSize(null);
            // Clear all possible size filter keys
            const { size: _, 'custom.sizes': __, 'custom.Sizes': ___, 'filter.p.m.custom.sizes': ____, ...rest } = selectedFilters;
            setSelectedFilters(rest);
            handleApplyFilters(rest);
        } else {
            setSelectedSize(size);
            
            // For Diapers, we want to EXCLUSIVELY use the Sizes metafield facet
            let sizeKey = 'size';
            if (pageCategory === 'diapers') {
                const diaperFacet = facets.find((f: any) => {
                    const attr = (f.attribute || f.id || '').toLowerCase();
                    const title = (f.title || f.label || '').toLowerCase();
                    return attr.includes('custom.sizes') || title.toLowerCase() === 'sizes';
                });
                sizeKey = diaperFacet?.attribute || diaperFacet?.id || 'filter.p.m.custom.sizes';
            } else {
                // Identify the correct filter key from facets for other categories
                const sizeFacet = facets.find((f: any) => {
                    const attr = (f.attribute || f.id || f.field || f.name || '').toLowerCase();
                    const title = (f.title || f.label || '').toLowerCase();
                    return attr.includes('size') || title.includes('size');
                });
                sizeKey = sizeFacet?.attribute || sizeFacet?.id || 'size';
            }
            
            const newFilters = { ...selectedFilters, [sizeKey]: [size] };
            setSelectedFilters(newFilters);
            handleApplyFilters(newFilters);
        }
        setShowSizeModal(false);
    };

    const handleStageSelect = (stage: string) => {
        if (selectedStage === stage) {
            setSelectedStage(null);
            const { 'custom.pack_size': _, 'custom.stage': __, 'custom.Stage': ___, 'custom.Pack Size': ____, ...rest } = selectedFilters;
            setSelectedFilters(rest);
            handleApplyFilters(rest);
        } else {
            setSelectedStage(stage);
            // Identify the correct filter key from facets (look for Pack Size or Stage)
            const stageFacet = facets.find((f: any) => {
                const attr = (f.attribute || f.id || f.field || f.name || '').toLowerCase();
                const title = (f.title || f.label || '').toLowerCase();
                return attr.includes('pack_size') || attr.includes('stage') || title.includes('pack size') || title.includes('stage');
            });
            const stageKey = stageFacet?.attribute || stageFacet?.id || 'custom.stage';
            const newFilters = { ...selectedFilters, [stageKey]: [stage] };
            setSelectedFilters(newFilters);
            handleApplyFilters(newFilters);
        }
        setShowStageModal(false);
    };

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
            setFacets(loadedFacets);

            // Extract brand options from vendor facet for the quick-filter bubble
            const vendorFacet = loadedFacets.find((f: any) => 
                (f.attribute || f.id || f.field || f.name || '').toLowerCase() === 'vendor' ||
                (f.title || f.label || '').toLowerCase().includes('brand')
            );
            if (vendorFacet) {
                const options = (vendorFacet.buckets || vendorFacet.values || []).map((b: any) => ({
                    label: b.label || b.title || b.value,
                    value: b.value || b.id || b.label
                }));
                setBrandOptions(options);
            }

            // For Diapers, we specifically look for the "Sizes" metafield facet
            if (pageCategory === 'diapers') {
                const diaperFacet = loadedFacets.find((f: any) => {
                    const attr = (f.attribute || f.id || '').toLowerCase();
                    const title = (f.title || f.label || '').toLowerCase();
                    return attr.includes('custom.sizes') || title.toLowerCase() === 'sizes';
                });

                const uniqueOptionsMap = new Map();
                if (diaperFacet) {
                    const buckets = (diaperFacet.buckets || diaperFacet.values || []);
                    buckets.forEach((b: any) => {
                        const label = b.label || b.title || b.value;
                        const value = b.value || b.id || b.label;
                        if (label) uniqueOptionsMap.set(label.toLowerCase(), { label, value });
                    });
                }

                // Show the FULL standardized list but map to facet values if they exist
                const options = DIAPER_SIZE_OPTIONS.map(opt => {
                    const facetMatch = uniqueOptionsMap.get(opt.label.toLowerCase());
                    return {
                        ...opt,
                        value: facetMatch ? facetMatch.value : opt.value,
                        available: !!facetMatch
                    };
                });
                setSizeOptions(options);
            } else {
                // For other categories, extract size options from all Size/Sizes related facets
                const sizeFacets = loadedFacets.filter((f: any) => {
                    const attr = (f.attribute || f.id || f.field || f.name || '').toLowerCase();
                    const title = (f.title || f.label || '').toLowerCase();
                    return attr.includes('size') || title.includes('size');
                });

                if (sizeFacets.length > 0) {
                    const allBuckets = sizeFacets.reduce((acc: any[], facet: any) => {
                        const buckets = (facet.buckets || facet.values || []);
                        return [...acc, ...buckets];
                    }, []);

                    const uniqueOptionsMap = new Map();
                    allBuckets.forEach((b: any) => {
                        const label = b.label || b.title || b.value;
                        const value = b.value || b.id || b.label;
                        if (label && !uniqueOptionsMap.has(label.toLowerCase())) {
                            uniqueOptionsMap.set(label.toLowerCase(), { label, value });
                        }
                    });
                    setSizeOptions(Array.from(uniqueOptionsMap.values()));
                }
            }

            // Extract stage options from Pack Size/Stage facet for the quick-filter bubble
            const stageFacet = loadedFacets.find((f: any) => {
                const attr = (f.attribute || f.id || f.field || f.name || '').toLowerCase();
                const title = (f.title || f.label || '').toLowerCase();
                return attr.includes('pack_size') || attr.includes('stage') || title.includes('pack size') || title.includes('stage');
            });
            if (stageFacet) {
                const options = (stageFacet.buckets || stageFacet.values || []).map((b: any) => ({
                    label: b.label || b.title || b.value,
                    value: b.value || b.id || b.label
                }));
                setStageOptions(options);
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
                                filterAdded = true;
                            }
                        }
                    }
                    
                    if (!filterAdded) {
                        try {
                            newApiFilters.push(JSON.parse(val));
                            filterAdded = true;
                        } catch (e) {
                        const isIdFormat = typeof val === 'string' && val.includes('filter.p.');
                        
                        let facet = null;
                        if (isIdFormat) {
                            const idParts = val.split('.');
                            if (idParts.length >= 3) {
                                const idAttribute = idParts.slice(0, 3).join('.');
                                facet = facets.find(f => {
                                    const facetAttr = f.attribute || f.id || f.field || f.name;
                                    return facetAttr === idAttribute || facetAttr === key || facetAttr === filterKey;
                                });
                            }
                        }
                        
                        if (!facet) {
                            facet = facets.find(f => {
                                const facetAttr = f.attribute || f.id || f.field || f.name;
                                const facetTitle = f.title || f.label || f.name || '';
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
                            const bucketArray = facet.buckets || facet.values || [];
                            const bucket = bucketArray.find((b: any) => {
                                if (b.id && b.id === val) return true;
                                if (b.label === val || b.value === val) return true;
                                if (typeof val === 'string') {
                                    if (b.label?.toLowerCase() === val.toLowerCase() || b.value?.toLowerCase() === val.toLowerCase()) return true;
                                }
                                return false;
                            });
                            
                            if (bucket) {
                                if (bucket.input && !filterAdded) {
                                    try {
                                        const parsed = typeof bucket.input === 'string' ? JSON.parse(bucket.input) : bucket.input;
                                        if (parsed && typeof parsed === 'object') {
                                            newApiFilters.push(parsed);
                                            filterAdded = true;
                                        }
                                    } catch (err) {
                                        if (typeof bucket.input === 'object' && bucket.input !== null) {
                                            newApiFilters.push(bucket.input);
                                            filterAdded = true;
                                        }
                                    }
                                }
                                
                                if (!filterAdded && (filterKey === 'vendor' || key?.toLowerCase().includes('brand') || facet.title?.toLowerCase().includes('brand'))) {
                                    const vendorValue = bucket.label || bucket.value || val;
                                    if (!vendorValue.includes('filter.p.')) {
                                        const vendorFilter = { productVendor: vendorValue };
                                        newApiFilters.push(vendorFilter);
                                        filterAdded = true;
                                    }
                                }
                                
                                if (!filterAdded && (filterKey === 'product_type' || filterKey === 'productType' || key?.toLowerCase().includes('product_type') || key?.toLowerCase().includes('producttype') || facet.title?.toLowerCase().includes('product type') || facet.id?.includes('product_type') || facet.label?.toLowerCase().includes('product type'))) {
                                    const productTypeValue = bucket.label || bucket.value || val;
                                    if (!productTypeValue.includes('filter.p.')) {
                                        const productTypeFilter = { productType: productTypeValue };
                                        newApiFilters.push(productTypeFilter);
                                        filterAdded = true;
                                    }
                                }
                            }
                        }
                        
                        if (!filterAdded && (filterKey === 'vendor' || key?.toLowerCase().includes('brand'))) {
                            if (!val.includes('filter.p.')) {
                                const vendorFilter = { productVendor: val };
                                newApiFilters.push(vendorFilter);
                                filterAdded = true;
                            }
                        }
                        
                        if (!filterAdded && (filterKey === 'product_type' || filterKey === 'productType' || key?.toLowerCase().includes('product_type') || key?.toLowerCase().includes('producttype'))) {
                            if (!val.includes('filter.p.')) {
                                const productTypeFilter = { productType: val };
                                newApiFilters.push(productTypeFilter);
                                filterAdded = true;
                            }
                        }

                        // RIGID DIAPER SIZE FILTERING:
                        // If it's a size filter in the diapers category, and not yet added, 
                        // force a productMetafield filter for the "Sizes" metafield.
                        if (!filterAdded && pageCategory === 'diapers' && (key?.toLowerCase().includes('size') || filterKey?.toLowerCase().includes('size'))) {
                            // Only apply if it matches our standardized list values
                            const isStandardSize = DIAPER_SIZE_OPTIONS.some(o => 
                                o.label.toLowerCase() === val.toLowerCase() || 
                                o.value.toLowerCase() === val.toLowerCase()
                            );
                            
                            if (isStandardSize) {
                                // Construct a rigid metafield filter for Shopify
                                // We use 'custom' namespace and 'sizes' key as specified by user
                                const rigidSizeFilter = {
                                    productMetafield: {
                                        namespace: "custom",
                                        key: "sizes",
                                        value: val
                                    }
                                };
                                newApiFilters.push(rigidSizeFilter);
                                filterAdded = true;
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

    const handleGenderSelect = (gender: string) => {
        if (selectedGender === gender) {
            setSelectedGender(null);
            const { gender: _, ...rest } = selectedFilters;
            setSelectedFilters(rest);
            handleApplyFilters(rest);
        } else {
            setSelectedGender(gender);
            const newFilters = { ...selectedFilters, gender: [gender] };
            setSelectedFilters(newFilters);
            handleApplyFilters(newFilters);
        }
        setShowGenderModal(false);
    };

    const handleAgeSelect = (age: string) => {
        if (selectedAge === age) {
            setSelectedAge(null);
            const { age: _, ...rest } = selectedFilters;
            setSelectedFilters(rest);
            handleApplyFilters(rest);
        } else {
            setSelectedAge(age);
            const newFilters = { ...selectedFilters, age: [age] };
            setSelectedFilters(newFilters);
            handleApplyFilters(newFilters);
        }
        setShowAgeModal(false);
    };

    const handleSharePress = async () => {
        try {
            const numericId = collectionId?.replace('gid://shopify/Collection/', '').split('?')[0];
            const url = `https://allforkiddo.com/infinity/${numericId}`;
            await Share.share({
                message: `Check out this collection on Kiddo: ${effectiveTitle}\n${url}`,
                url: url,
            });
        } catch (error) {
            console.error('Error sharing collection:', error);
        }
    };

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {effectiveTitle}
                        </Text>
                    </View>
                    <TouchableOpacity 
                        style={styles.shareButton} 
                        onPress={handleSharePress}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="share-social-outline" size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                {!shouldHideFilters && (
                    <FilterSortPills
                        totalItems={totalItems}
                        activeFiltersCount={activeFiltersCount}
                        onFiltersPress={() => setIsFilterPanelVisible(true)}
                        onSortPress={handleSortPress}
                        onGenderPress={() => setShowGenderModal(true)}
                        onAgePress={() => setShowAgeModal(true)}
                        onBrandPress={() => setShowBrandModal(true)}
                        onSizePress={() => setShowSizeModal(true)}
                        onStagePress={() => setShowStageModal(true)}
                        selectedGender={selectedGender}
                        selectedAge={selectedAge}
                        selectedBrand={selectedBrand}
                        selectedSize={selectedSize}
                        selectedStage={selectedStage}
                        facets={facets}
                        selectedFilters={selectedFilters}
                        style={styles.pills}
                        showGenderFilter={shouldShowGenderFilter()}
                        showAgeFilter={shouldShowAgeFilter()}
                        showBrandFilter={shouldShowBrandFilter()}
                        showSizeFilter={shouldShowSizeFilter()}
                        showStageFilter={shouldShowStageFilter()}
                    />
                )}

                <View style={styles.contentRow}>
                    {sidebarSubcategories && sidebarSubcategories.length > 0 && (
                        <View style={styles.sidebarShadowWrapper}>
                            <ScrollView
                                style={styles.sidebar}
                                contentContainerStyle={styles.sidebarContent}
                                showsVerticalScrollIndicator={false}
                            >
                            {sidebarSubcategories.map((sub) => {
                                const subId = sub.collectionId.startsWith('gid://') ? sub.collectionId : `gid://shopify/Collection/${sub.collectionId}`;
                                const currentNorm = effectiveCollectionId?.replace(/^gid:\/\/shopify\/Collection\//i, '').split('?')[0] || '';
                                const subNorm = sub.collectionId.replace(/^gid:\/\/shopify\/Collection\//i, '').split('?')[0] || '';
                                const isSelected = currentNorm === subNorm;
                                const imageUri = sub.imageUrl
                                    ? (() => {
                                          const t = configService.getConfigLoadedAt();
                                          if (t == null) return sub.imageUrl!;
                                          const sep = sub.imageUrl!.includes('?') ? '&' : '?';
                                          return `${sub.imageUrl!}${sep}_t=${t}`;
                                      })()
                                    : null;
                                return (
                                    <TouchableOpacity
                                        key={sub.collectionId}
                                        style={[styles.sidebarItem, isSelected && styles.sidebarItemSelected]}
                                        onPress={() => {
                                            setActiveCollectionId(subId);
                                            setActiveTitle(sub.label || '');
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        {imageUri ? (
                                            <Image source={{ uri: imageUri }} style={styles.sidebarItemImage} contentFit="cover" />
                                        ) : (
                                            <View style={styles.sidebarItemPlaceholder}>
                                                <Ionicons name="pricetag-outline" size={18} color="#999" />
                                            </View>
                                        )}
                                        <Text style={[styles.sidebarItemLabel, isSelected && styles.sidebarItemLabelSelected]} numberOfLines={2}>
                                            {sub.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        </View>
                    )}
                    <View
                        style={styles.gridContainer}
                        onLayout={(e) => setGridContainerWidth(e.nativeEvent.layout.width)}
                    >
                    <InfiniteProductGrid
                        key={effectiveCollectionId}
                        collectionId={effectiveCollectionId.startsWith('gid://') ? effectiveCollectionId : `gid://shopify/Collection/${effectiveCollectionId}`}
                        contentWidth={sidebarSubcategories?.length ? (gridContainerWidth != null && gridContainerWidth > 0 ? gridContainerWidth : Dimensions.get('window').width - 50) : undefined}
                        sortKey={sortKey}
                        reverse={reverse}
                        filters={apiFilters} // Pass filters for client-side filtering
                        onFacetsLoaded={handleFacetsLoaded}
                        onResultsCount={setTotalItems}
                        style={{ root: { flex: 1 } }}
                        contentContainerStyle={{ paddingBottom: 120 }}
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
                        pageCategory={pageCategory}
                    />
                    </View>
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
                            })).filter((b: any) => {
                                if (!b.value && !b.label) return false;
                                
                                const val = (b.value || b.label || '').toLowerCase().replace(/\s+/g, '');
                                const IGNORE_LIST = [
                                    'defaulttitle', 'allages', 'onesize'
                                ];
                                
                                // For Fashion, we might want to hide specific technical sizes that are handled by the top Age bar
                                if (pageCategory === 'fashion') {
                                    IGNORE_LIST.push('s', 'm', 'l', 'xl', 'xxl', '8-9y', '9-10y', '11-12y', '12-18y', '13-14y');
                                }
                                
                                return !IGNORE_LIST.includes(val);
                            });
                        }
                        
                        return {
                        ...f,
                            attribute,
                            title,
                            type,
                            buckets: Array.isArray(buckets) ? buckets : [],
                        };
                    }).filter((f: any) => {
                        if (!f.buckets || f.buckets.length === 0 || !f.attribute) return false;
                        const attr = (f.attribute || '').toLowerCase();
                        const titleLower = (f.title || '').toLowerCase();
                        const exclude = ['collections', 'tags', 'availability'];
                        if (exclude.some((key) => attr === key || titleLower === key || attr.includes(key) || titleLower.includes(key))) return false;
                        return true;
                    })}
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
                {/* Brand Filter Modal */}
                <BaseModal
                    visible={showBrandModal}
                    onClose={() => setShowBrandModal(false)}
                    title="Select Brand"
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
                        {brandOptions.map((option, index) => {
                            const isSelected = selectedBrand === option.value;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.sortListItem}
                                    onPress={() => handleBrandSelect(option.value)}
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
                {/* Size Filter Modal */}
                <BaseModal
                    visible={showSizeModal}
                    onClose={() => setShowSizeModal(false)}
                    title="Select Size"
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
                        {sizeOptions.map((option, index) => {
                            const isSelected = selectedSize === option.value;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.sortListItem}
                                    onPress={() => handleSizeSelect(option.value)}
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
                {/* Stage Filter Modal */}
                <BaseModal
                    visible={showStageModal}
                    onClose={() => setShowStageModal(false)}
                    title="Select Stage"
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
                        {stageOptions.map((option, index) => {
                            const isSelected = selectedStage === option.value;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.sortListItem}
                                    onPress={() => handleStageSelect(option.value)}
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
            <MilestoneTabDock
                milestoneUI={milestoneUI}
                visible
                onMilestoneExpandedChange={setMilestoneExpanded}
                isInlineWithCart={isInlineCartVisible}
                anchorMode="safeAreaOnly"
            />
            <FloatingCartButton
                showTabBar={false}
                anchorExtraOffset={floatingCartMilestoneReserve}
                activeRouteName="infinity"
            />
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
        fontFamily: Fonts.LexendSemiBold,
        color: '#000',
    },
    shareButton: {
        padding: 8,
    },
    pills: {
        zIndex: 10,
    },
    contentRow: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebarShadowWrapper: {
        width: 80,
        maxWidth: 80,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 1, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 6,
    },
    sidebar: {
        width: 80,
        maxWidth: 80,
        borderRightWidth: 1,
        borderRightColor: '#e8e8e8',
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    sidebarContent: {
        paddingVertical: 8,
        paddingHorizontal: 4,
        paddingBottom: 24,
    },
    sidebarItem: {
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: 0,
        position: 'relative',
    },
    sidebarItemSelected: {
        backgroundColor: '#FFEBEE',
        borderRightWidth: 4,
        borderRightColor: Colors.primary,
    },
    sidebarItemImage: {
        width: 52,
        height: 52,
        borderRadius: 26,
        marginBottom: 4,
    },
    sidebarItemPlaceholder: {
        width: 52,
        height: 52,
        borderRadius: 26,
        marginBottom: 4,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sidebarItemLabel: {
        fontSize: 9,
        fontFamily: Fonts.LexendRegular,
        color: '#363636',
        textAlign: 'center',
    },
    sidebarItemLabelSelected: {
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.primary,
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
        fontFamily: Fonts.LexendRegular,
        flex: 1,
        marginRight: 12,
    },
    sortListItemTextSelected: {
        color: Colors.primary,
        fontFamily: Fonts.LexendSemiBold,
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
