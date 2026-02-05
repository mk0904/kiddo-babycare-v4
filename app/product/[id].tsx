import HorizontalProductList from '@/components/content/HorizontalProductList';
import { InfiniteProductGrid as InfiniteProductGridComponent } from '@/components/product/InfiniteProductGrid';
import { TryBuyModal as TryAndBuyModal } from '@/components/product/TryBuyModal';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import ImageViewerModal from '@/components/ui/ImageViewerModal';
import UniversalAdd from '@/components/ui/UniversalAdd';
import BaseModal from '@/components/ui/BaseModal';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useRecentlyViewed } from '@/context/RecentlyViewedContext';
import { useWishlist } from '@/context/WishlistContext';
import { useScrollTracking } from '@/hooks/useScrollTracking';
import { configService } from '@/services/configService';
import { shopifyApi } from '@/services/shopifyApi';
import { useCartStore } from '@/store/cartStore';
import { processFontStyle } from '@/utils/fontUtils';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Event Date Picker Component - Shows next 7 days
const EventDatePicker: React.FC<{
    selectedDate: Date | null;
    onDateSelect: (date: Date) => void;
}> = ({ selectedDate, onDateSelect }) => {
    // Generate next 7 days
    const getNext7Days = useMemo(() => {
        const days = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            days.push(date);
        }
        return days;
    }, []);

    const formatDateLabel = (date: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const dateToCheck = new Date(date);
        dateToCheck.setHours(0, 0, 0, 0);
        
        if (dateToCheck.getTime() === today.getTime()) {
            return 'Today';
        } else if (dateToCheck.getTime() === tomorrow.getTime()) {
            return 'Tomorrow';
        } else {
            return date.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
            });
        }
    };

    const isDateSelected = (date: Date) => {
        if (!selectedDate) return false;
        return date.toDateString() === selectedDate.toDateString();
    };

    const next7Days = getNext7Days;

    return (
        <View style={datePickerStyles.container}>
            <ScrollView 
                style={datePickerStyles.daysList} 
                contentContainerStyle={datePickerStyles.daysListContent}
                showsVerticalScrollIndicator={false}
            >
                {next7Days.length > 0 ? next7Days.map((date, index) => {
                    const isSelected = isDateSelected(date);
                    return (
                        <TouchableOpacity
                            key={`date-${index}-${date.getTime()}`}
                            style={[
                                datePickerStyles.dateOption,
                                isSelected && datePickerStyles.dateOptionSelected
                            ]}
                            onPress={() => onDateSelect(date)}
                            activeOpacity={0.7}
                        >
                            <View style={datePickerStyles.dateOptionContent}>
                                <Text style={[
                                    datePickerStyles.dateLabel,
                                    isSelected && datePickerStyles.dateLabelSelected
                                ]}>
                                    {formatDateLabel(date)}
                                </Text>
                                <Text style={[
                                    datePickerStyles.dateSubLabel,
                                    isSelected && datePickerStyles.dateSubLabelSelected
                                ]}>
                                    {date.toLocaleDateString('en-US', { 
                                        month: 'long', 
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </Text>
                            </View>
                            {isSelected && (
                                <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                            )}
                        </TouchableOpacity>
                    );
                }) : (
                    <View style={datePickerStyles.emptyState}>
                        <Text style={datePickerStyles.emptyStateText}>No dates available</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const datePickerStyles = StyleSheet.create({
    container: {
        padding: 20,
        minHeight: 300,
        maxHeight: 500,
    },
    daysList: {
        flex: 1,
    },
    daysListContent: {
        paddingBottom: 10,
    },
    dateOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    dateOptionSelected: {
        borderColor: Colors.primary,
        backgroundColor: '#FFF5F5',
    },
    dateOptionContent: {
        flex: 1,
    },
    dateLabel: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
        marginBottom: 4,
    },
    dateLabelSelected: {
        color: Colors.primary,
    },
    dateSubLabel: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
    },
    dateSubLabelSelected: {
        color: Colors.text,
    },
    emptyState: {
        padding: 20,
        alignItems: 'center',
    },
    emptyStateText: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.textSecondary,
    },
});

const ProductDetailScreen = () => {
    const params = useLocalSearchParams();
    const router = useRouter();
    const { handleScroll } = useScrollTracking();
    const insets = useSafeAreaInsets();

    const productId = typeof params.id === 'string' ? params.id : null;
    const productHandle = typeof params.handle === 'string' ? params.handle : null;

    const [product, setProduct] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedVariant, setSelectedVariant] = useState<any>(null);
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);
    const [recentlyViewedProducts, setRecentlyViewedProducts] = useState<any[]>([]);
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [tryAndBuyModalVisible, setTryAndBuyModalVisible] = useState(false);
    const imageFlatListRef = useRef<any>(null);
    const { user, isAuthenticated } = useAuth();
    const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
    const { addToRecentlyViewed, getRecentlyViewed } = useRecentlyViewed();
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const imageGestureRef = useRef({ isHorizontal: false });
    
    // Event date selection state
    const [selectedEventDate, setSelectedEventDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    
    // Collection IDs that require date selection
    const TICKETING_COLLECTION_IDS = [
        'gid://shopify/Collection/509771120929', // Events
        'gid://shopify/Collection/509726458145', // Playhouses
        'gid://shopify/Collection/509771153697', // Petting Farms
    ];
    
    // Check if product is from ticketing collections (Events, Playhouses, Petting Farms)
    const isTicketingProduct = useMemo(() => {
        // Check if we came from a ticketing collection (check route params)
        const collectionId = params.collectionId as string;
        const fromTicketing = collectionId && TICKETING_COLLECTION_IDS.some(id => 
            collectionId === id || collectionId.includes(id.split('/').pop() || '')
        );
        
        // Or check if product has relevant tags
        const hasTicketingTag = product?.tags?.some((tag: any) => {
            const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
            return tagLower.includes('event') || 
                   tagLower.includes('playhouse') || 
                   tagLower.includes('petting') ||
                   tagLower.includes('farm');
        });
        
        // Or check if product belongs to any ticketing collection
        const belongsToTicketing = product?.collections?.some((col: any) => {
            const colId = col?.id || col?.node?.id || '';
            return TICKETING_COLLECTION_IDS.some(ticketingId => 
                colId === ticketingId || colId.includes(ticketingId.split('/').pop() || '')
            );
        });
        
        const result = fromTicketing || hasTicketingTag || belongsToTicketing;
        // Debug logging
        if (__DEV__) {
            console.log('[DatePicker] isTicketingProduct check:', {
                fromTicketing,
                hasTicketingTag,
                belongsToTicketing,
                result,
                collectionId: params.collectionId,
                productTags: product?.tags,
            });
        }
        return result;
    }, [params, product]);
    
    // Get product detail config
    const productDetailConfig = configService.getProductDetailConfig();
    const recommendationsConfig = productDetailConfig?.sections?.recommendations || {};
    const recentlyViewedConfig = productDetailConfig?.sections?.recentlyViewed || {};
    const productStyles = productDetailConfig?.styles || {};

    // Initialize variant from product data
    const initializeVariant = useCallback((productData: any) => {
        if (!productData) return;

        let variants = [];
        if (productData.variants?.edges) {
            variants = productData.variants.edges.map((e: any) => e.node);
        } else if (Array.isArray(productData.variants)) {
            variants = productData.variants;
        }

        // Find first available variant (check both availableForSale and quantityAvailable)
        // Fallback to first variant if none available
        const firstVariant = variants.find((v: any) => {
            if (v.availableForSale === false) return false;
            if (v.quantityAvailable !== undefined && v.quantityAvailable !== null) {
                return v.quantityAvailable > 0;
            }
            return v.availableForSale !== false;
        }) || variants[0];

        if (firstVariant) {
            setSelectedVariant(firstVariant);
            if (firstVariant.selectedOptions) {
                const initialOptions: Record<string, string> = {};
                firstVariant.selectedOptions.forEach((opt: any) => {
                    initialOptions[opt.name] = opt.value;
                });
                setSelectedOptions(initialOptions);
            }
        }
    }, []);

    // Accordion State
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        description: true,
        material: false,
        wash_care: false,
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const loadProductDetails = useCallback(async () => {
        try {
            setLoading(true);
            let fullProduct = null;

            if (productHandle) {
                fullProduct = await shopifyApi.getProductByHandle(productHandle);
            }

            if (!fullProduct && productId) {
                fullProduct = await shopifyApi.getProductById(productId);
            }

            if (fullProduct) {
                setProduct(fullProduct);
                initializeVariant(fullProduct);
                loadProductRecommendations(fullProduct.id);
                
                // Add to recently viewed
                let imageUrl = '';
                if (fullProduct?.images?.edges) {
                    imageUrl = fullProduct.images.edges[0]?.node?.url || '';
                } else if (Array.isArray(fullProduct?.images)) {
                    imageUrl = fullProduct.images[0]?.url || fullProduct.images[0] || '';
                }
                
                addToRecentlyViewed({
                    id: fullProduct.id,
                    handle: fullProduct.handle,
                    title: fullProduct.title,
                    image: imageUrl,
                });
                
                // Track Product Viewed event
                try {
                    const { mixpanel } = require('@/mixpanel');
                    if (mixpanel) {
                        const price = parseFloat(
                            fullProduct.priceRange?.minVariantPrice?.amount || 
                            fullProduct.variants?.edges?.[0]?.node?.price?.amount || 
                            '0'
                        );
                        mixpanel.track('Product Viewed', {
                            productId: fullProduct.id,
                            productName: fullProduct.title,
                            productHandle: fullProduct.handle,
                            price,
                            currency: fullProduct.priceRange?.minVariantPrice?.currencyCode || 'INR',
                        });
                    }
                } catch (e) {
                    console.warn('Mixpanel tracking error:', e);
                }
                
                // Load recently viewed products (excluding current)
                loadRecentlyViewedProducts(fullProduct.handle);
            }
        } catch (error) {
            console.error('Error loading product details:', error);
        } finally {
            setLoading(false);
        }
    }, [productId, productHandle, initializeVariant]);

    // ... (omitting unchanged parts for brevity if possible in single hunk, but since it's scattered, I'll do multiple replacements or one big block if contiguous)

    // Wait, I should probably do multiple smaller replacements for safety and clarity.
    // Let's split this. First, variant logic.


    const loadProductRecommendations = async (id: string) => {
        try {
            const recommendations = await shopifyApi.getProductRecommendations(id);
            if (recommendations) {
                const limit = recommendationsConfig.limit || 10;
                setRecommendedProducts(recommendations.slice(0, limit));
            }
        } catch (error) {
            console.error('Error loading recommendations:', error);
        }
    };

    const loadRecentlyViewedProducts = async (excludeHandle: string) => {
        try {
            const recentlyViewed = getRecentlyViewed(excludeHandle);
            if (recentlyViewed.length === 0) {
                setRecentlyViewedProducts([]);
                return;
            }

            const limit = recentlyViewedConfig.limit || 10;
            // Fetch product details for recently viewed handles
            const productPromises = recentlyViewed.slice(0, limit).map((item) =>
                shopifyApi.getProductByHandle(item.handle).catch(() => null)
            );

            const products = await Promise.all(productPromises);
            const validProducts = products.filter((p) => p !== null);
            setRecentlyViewedProducts(validProducts);
        } catch (error) {
            console.error('Error loading recently viewed products:', error);
        }
    };

    // Helper function to render product sections based on config
    const renderProductSection = (
        products: any[],
        config: any,
        defaultTitle: string
    ) => {
        if (config.enabled === false || products.length === 0) return null;

        const sectionType = config.type || 'horizontalProductList';
        const title = config.title || defaultTitle;
        const gapStyle = config.gap || { height: 8, backgroundColor: '#f5f5f5', marginTop: 20 };

        const handleProductPress = (p: any) => {
            router.push({ pathname: '/product/[id]', params: { id: p.id, handle: p.handle } });
        };

        return (
            <>
                <View style={[styles.recommendationsGap, gapStyle]} />
                {sectionType === 'infiniteProductGrid' ? (
                    <InfiniteProductGridComponent
                        products={products}
                        title={title}
                        showHeading={!!title}
                        style={{
                            root: config.styles?.container,
                            title: config.styles?.title,
                            list: config.styles?.list,
                        }}
                        contentWidth={SCREEN_WIDTH}
                        productOptions={config.config || {}}
                        scrollable={false}
                    />
                ) : (
                    <HorizontalProductList
                        products={products}
                        title={title}
                        onProductPress={handleProductPress}
                        config={config.config || {}}
                    />
                )}
            </>
        );
    };

    useEffect(() => {
        loadProductDetails();
    }, [loadProductDetails]);

    const handleAddToCart = async () => {
        if (selectedVariant && selectedVariant.availableForSale) {
            try {
                const addItem = useCartStore.getState().addItem;
                
                // Get image URL
                const imageUrl = selectedVariant.image?.url || 
                                product.images?.[0]?.url || 
                                product.featuredImage?.url || 
                                product.images?.edges?.[0]?.node?.url || 
                                '';

                // Get price
                const price = parseFloat(
                    selectedVariant.price?.amount || 
                    product.priceRange?.minVariantPrice?.amount || 
                    product.price?.amount || 
                    '0'
                );

                // Create cart item
                const cartItem = {
                    productId: productId || '',
                    variantId: selectedVariant.id || '',
                    title: product.title || product.name || 'Product',
                    variantTitle: selectedVariant.title,
                    price,
                    compareAtPrice: selectedVariant.compareAtPrice?.amount 
                        ? parseFloat(selectedVariant.compareAtPrice.amount) 
                        : undefined,
                    currencyCode: selectedVariant.price?.currencyCode || product.priceRange?.minVariantPrice?.currencyCode || 'INR',
                    image: imageUrl,
                    quantity: 1,
                    availableForSale: selectedVariant.availableForSale !== false,
                    tags: product.tags || [],
                };

                await addItem(cartItem);
            } catch (error: any) {
                alert(error.message || 'Failed to add item to cart. Please try again.');
            }
        }
    };

    const images = useMemo(() => {
        let extractedImages: string[] = [];
        if (product?.images?.edges) {
            extractedImages = product.images.edges.map((edge: any) => edge?.node?.url);
        } else if (Array.isArray(product?.images)) {
            extractedImages = product.images.map((img: any) => img?.url || img);
        } else if (product?.image) {
            extractedImages = [product.image.url || product.image];
        }
        return extractedImages.filter(Boolean);
    }, [product]);

    const variants = useMemo(() => {
        if (product?.variants?.edges) {
            return product.variants.edges.map((edge: any) => edge?.node).filter(Boolean);
        }
        if (Array.isArray(product?.variants)) {
            return product.variants.filter(Boolean);
        }
        return [];
    }, [product]);

    const productOptions = useMemo(() => {
        if (!product?.options) return [];
        const options = Array.isArray(product.options) ? product.options : [];
        if (variants.length <= 1) return [];
        return options.filter((option: any) => (option.values || []).length > 1);
    }, [product, variants.length]);

    const findVariantByOptions = useCallback((options: Record<string, string>, variantsList: any[]) => {
        if (!variantsList || variantsList.length === 0) return null;
        return variantsList.find((variant) => {
            if (!variant.selectedOptions) return false;
            return Object.keys(options).every((optionName) => {
                const selectedValue = options[optionName];
                return variant.selectedOptions.some(
                    (opt: any) => opt.name === optionName && opt.value === selectedValue
                );
            });
        });
    }, []);

    useEffect(() => {
        if (productOptions.length > 0 && variants.length > 0) {
            const matchingVariant = findVariantByOptions(selectedOptions, variants);
            if (matchingVariant) {
                setSelectedVariant(matchingVariant);
            }
        }
    }, [selectedOptions, variants, productOptions, findVariantByOptions]);

    const handleOptionSelect = (optionName: string, optionValue: string) => {
        setSelectedOptions((prev) => ({
            ...prev,
            [optionName]: optionValue,
        }));
    };

    const onImageScroll = (event: any) => {
        const slideSize = event.nativeEvent.layoutMeasurement?.width;
        const offset = event.nativeEvent.contentOffset?.x;
        if (!slideSize || offset === undefined) return;
        const index = Math.round(offset / slideSize);
        if (index >= 0 && index < images.length && index !== selectedImageIndex) {
            setSelectedImageIndex(index);
        }
    };

    const handleImagePress = () => {
        if (!imageGestureRef.current.isHorizontal) {
            setImageViewerVisible(true);
        }
    };

    const parsePriceSafely = (priceValue: any) => {
        if (!priceValue) return 0;
        const parsed = parseFloat(priceValue);
        return isNaN(parsed) ? 0 : parsed;
    };

    const basePrice = selectedVariant
        ? parsePriceSafely(selectedVariant.price?.amount)
        : parsePriceSafely(product?.priceRange?.minVariantPrice?.amount);

    const mrp = selectedVariant
        ? parsePriceSafely(selectedVariant.compareAtPrice?.amount)
        : 0;

    const savings = mrp > basePrice ? mrp - basePrice : 0;

    // Calculate discount percentage
    const discountPercentage = useMemo(() => {
        if (mrp > basePrice && mrp > 0) {
            const percentage = Math.round(((mrp - basePrice) / mrp) * 100);
            return percentage > 0 ? percentage : null;
        }
        return null;
    }, [mrp, basePrice]);

    const formattedPrice = useMemo(() => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(basePrice);
    }, [basePrice]);

    const formattedMRP = useMemo(() => {
        if (mrp <= 0) return null;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(mrp);
    }, [mrp]);

    const formattedSavings = useMemo(() => {
        if (savings <= 0) return null;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(savings);
    }, [savings]);

    const getMetafieldValue = (product: any, key: string) => {
        if (!product?.metafields) return null;
        if (Array.isArray(product.metafields.edges)) {
            const metafield = product.metafields.edges.find(
                (edge: any) => edge?.node?.key?.toLowerCase() === key.toLowerCase()
            );
            if (metafield?.node?.value) return metafield.node.value;
        }
        if (Array.isArray(product.metafields)) {
            const metafield = product.metafields.find(
                (m: any) => m?.key?.toLowerCase() === key.toLowerCase()
            );
            if (metafield?.value) return metafield.value;
        }
        return null;
    };

    const fabric = getMetafieldValue(product, 'fabric');
    const washCare = getMetafieldValue(product, 'wash_care');

    // Price comparison metafields - using exact metafield keys from Shopify
    const priceOnKiddo = getMetafieldValue(product, 'price_on_kiddo');
    const priceOnAmazon = getMetafieldValue(product, 'price_on_amazon');
    const priceOnFirstcry = getMetafieldValue(product, 'price_on_firstcry');
    const priceOnBlinkit = getMetafieldValue(product, 'price_on_blinkit');
    const priceOnZepto = getMetafieldValue(product, 'price_on_zepto');

    // Helper function to format price with rupee symbol
    const formatPriceWithRupee = (price: any) => {
        if (!price || price === '0' || price === 0) return '₹0';
        const priceStr = String(price).trim();
        // If it already starts with ₹, return as is
        if (priceStr.startsWith('₹')) return priceStr;
        // Otherwise, add ₹ prefix
        return `₹${priceStr}`;
    };

    // Check if product has Essentials tag
    const hasEssentialsTag = product?.tags?.some(
        (tag: any) => typeof tag === 'string' && tag.toLowerCase() === 'essentials'
    );

    // Show price comparison for all essential products
    // Display "0" for missing values
    const showPriceComparison = hasEssentialsTag;

    // Check if product is a diaper
    const isDiaper = useMemo(() => {
        if (!product) return false;
        const title = (product.title || '').toLowerCase();
        const tags = (product.tags || []).map((tag: any) => 
            typeof tag === 'string' ? tag.toLowerCase() : ''
        );
        return title.includes('diaper') || tags.some((tag: string) => tag.includes('diaper'));
    }, [product]);

    const inWishlist = product ? isInWishlist(product.id) : false;

    const handleWishlistPress = async () => {
        if (wishlistLoading || !product) return;
        setWishlistLoading(true);
        try {
            if (inWishlist) {
                await removeFromWishlist(product.id);
            } else {
                await addToWishlist(product);
            }
        } catch (error) {
            console.error('Wishlist error:', error);
        } finally {
            setWishlistLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!product) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Product not found</Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{product.title}</Text>
                </View>
                <TouchableOpacity style={styles.wishlistButton} onPress={handleWishlistPress}>
                    <Ionicons
                        name={inWishlist ? "heart" : "heart-outline"}
                        size={24}
                        color={inWishlist ? Colors.primary : "#000"}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView
                onScroll={handleScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {images.length > 0 && (
                    <GestureHandlerRootView style={styles.imageContainer}>
                        <FlashList
                            {...({
                                ref: imageFlatListRef,
                                data: images,
                                horizontal: true,
                                pagingEnabled: true,
                                showsHorizontalScrollIndicator: false,
                                onScroll: onImageScroll,
                                scrollEventThrottle: 16,
                                onScrollBeginDrag: () => { imageGestureRef.current.isHorizontal = true; },
                                onScrollEndDrag: () => { setTimeout(() => { imageGestureRef.current.isHorizontal = false; }, 100); },
                                estimatedItemSize: SCREEN_WIDTH,
                                renderItem: ({ item }: { item: string }) => (
                                    <TouchableOpacity activeOpacity={1} onPress={handleImagePress} style={styles.imageTouchable}>
                                        <Image source={{ uri: item }} style={styles.mainImage} resizeMode="cover" />
                                    </TouchableOpacity>
                                ),
                            } as any)}
                        />
                        {images.length > 1 && (
                            <View style={styles.imageIndicators}>
                                {images.map((_, index) => (
                                    <View
                                        key={index}
                                        style={[styles.indicator, index === selectedImageIndex && styles.indicatorActive]}
                                    />
                                ))}
                            </View>
                        )}
                        {product.tags?.includes('fashion') && (
                            <TouchableOpacity style={styles.tryAndBuyTag} onPress={() => setTryAndBuyModalVisible(true)}>
                                <Ionicons name="shirt-outline" size={14} color="#fff" />
                                <Text style={styles.tryAndBuyTagText}>Try & Buy</Text>
                            </TouchableOpacity>
                        )}
                    </GestureHandlerRootView>
                )}

                <View style={styles.infoContainer}>
                    <Text style={[
                        styles.title,
                        productStyles.title && {
                            fontSize: productStyles.title.fontSize,
                            color: productStyles.title.color,
                            paddingHorizontal: productStyles.title.paddingHorizontal,
                            paddingTop: productStyles.title.paddingTop,
                            lineHeight: productStyles.title.lineHeight,
                            ...processFontStyle(productStyles.title, Fonts.Bold),
                        }
                    ]}>{product.title}</Text>
                    {product.vendor && (
                        <Text style={[
                            styles.vendorText,
                            productStyles.vendor && {
                                fontSize: productStyles.vendor.fontSize,
                                color: productStyles.vendor.color,
                                paddingHorizontal: productStyles.vendor.paddingHorizontal,
                                marginTop: productStyles.vendor.marginTop,
                                marginBottom: productStyles.vendor.marginBottom,
                                textTransform: productStyles.vendor.textTransform,
                                ...processFontStyle(productStyles.vendor, Fonts.Medium),
                            }
                        ]}>{product.vendor}</Text>
                    )}

                    {/* Price Section */}
                    <View style={styles.productPriceContainer}>
                        <View style={styles.productPriceRow}>
                            <Text style={styles.productPriceText}>{formattedPrice}</Text>
                            {formattedMRP && (
                                <Text style={styles.productMrpText}>{formattedMRP}</Text>
                            )}
                        </View>
                        {discountPercentage !== null && (
                            <Text style={styles.productSavingsText}>{discountPercentage}% off</Text>
                        )}
                    </View>

                    {productOptions.length > 0 && (
                        <View style={styles.variantsContainer}>
                            {productOptions.map((option: any) => (
                                <View key={option.name} style={styles.optionContainer}>
                                    <Text style={[
                                        styles.optionLabel,
                                        productStyles.variantLabel && {
                                            fontSize: productStyles.variantLabel.fontSize,
                                            color: productStyles.variantLabel.color,
                                            ...processFontStyle(productStyles.variantLabel, Fonts.SemiBold),
                                        }
                                    ]}>
                                        {option.name}{selectedOptions[option.name] ? `: ${selectedOptions[option.name]}` : ''}
                                    </Text>
                                    <View style={styles.variantsList}>
                                        {option.values.map((value: string) => {
                                            const isSelected = selectedOptions[option.name] === value;
                                            // Check if this option value is available in any variant
                                            const isOptionAvailable = variants.some((variant: any) => {
                                                if (!variant.selectedOptions) return false;
                                                return variant.selectedOptions.some(
                                                    (opt: any) => opt.name === option.name && opt.value === value
                                                ) && variant.availableForSale !== false;
                                            });

                                            return (
                                                <TouchableOpacity
                                                    key={value}
                                                    style={[
                                                        styles.variantButton,
                                                        isSelected && styles.variantButtonActive,
                                                        !isOptionAvailable && styles.variantButtonDisabled
                                                    ]}
                                                    onPress={() => handleOptionSelect(option.name, value)}
                                                    disabled={!isOptionAvailable}
                                                >
                                                    <Text style={[
                                                        styles.variantText,
                                                        isSelected && styles.variantTextActive,
                                                        !isOptionAvailable && styles.variantTextDisabled,
                                                        productStyles.variantButton && !isSelected && {
                                                            fontSize: productStyles.variantButton.fontSize,
                                                            color: productStyles.variantButton.color,
                                                            ...processFontStyle(productStyles.variantButton, Fonts.Medium),
                                                        }
                                                    ]}>
                                                        {value}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Date Selection - Only show for ticketing products (Events, Playhouses, Petting Farms) */}
                    {isTicketingProduct && (
                        <View style={styles.dateSelectionContainer}>
                            <Text style={styles.dateSelectionLabel}>Select Date</Text>
                            <TouchableOpacity
                                style={styles.dateSelectionButton}
                                onPress={() => setShowDatePicker(true)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="calendar-outline" size={20} color={Colors.text} style={styles.dateIcon} />
                                <Text style={[styles.dateSelectionText, !selectedEventDate && styles.dateSelectionPlaceholder]}>
                                    {selectedEventDate 
                                        ? selectedEventDate.toLocaleDateString('en-US', { 
                                            weekday: 'short', 
                                            year: 'numeric', 
                                            month: 'short', 
                                            day: 'numeric' 
                                        })
                                        : 'Select a date'
                                    }
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Separator */}
                    <View style={styles.separator} />

                    {/* Product Description - Display directly */}
                    {product.description && (
                        <View style={styles.descriptionContainer}>
                            <Text style={[
                                styles.descriptionBody,
                                productStyles.description && {
                                    fontSize: productStyles.description.fontSize,
                                    color: productStyles.description.color,
                                    lineHeight: productStyles.description.lineHeight,
                                    ...processFontStyle(productStyles.description, Fonts.Regular),
                                }
                            ]}>{product.description}</Text>
                        </View>
                    )}

                    {/* Price Comparison Chart - Display right after description */}
                    {showPriceComparison && (
                        <View style={styles.priceComparisonContainer}>
                            <Text style={styles.priceComparisonTitle}>Best Prices Guaranteed</Text>
                            <View style={styles.priceComparisonTable}>
                                {/* Header Row */}
                                <View style={[styles.priceComparisonRow, styles.priceComparisonHeaderRow]}>
                                    <Text style={styles.pricePlatformTextHeader}>Platform</Text>
                                    <Text style={styles.priceValueTextHeader}>
                                        {isDiaper ? 'Price per diaper' : 'Price'}
                                    </Text>
                                </View>
                                <View style={styles.priceComparisonRow}>
                                    <Text style={styles.pricePlatformText}>Amazon</Text>
                                    <Text style={styles.priceValueText}>{formatPriceWithRupee(priceOnAmazon)}</Text>
                                </View>
                                <View style={styles.priceComparisonRow}>
                                    <Text style={styles.pricePlatformText}>FirstCry</Text>
                                    <Text style={styles.priceValueText}>{formatPriceWithRupee(priceOnFirstcry)}</Text>
                                </View>
                                <View style={styles.priceComparisonRow}>
                                    <Text style={styles.pricePlatformText}>Blinkit</Text>
                                    <Text style={styles.priceValueText}>{formatPriceWithRupee(priceOnBlinkit)}</Text>
                                </View>
                                <View style={styles.priceComparisonRow}>
                                    <Text style={styles.pricePlatformText}>Zepto</Text>
                                    <Text style={styles.priceValueText}>{formatPriceWithRupee(priceOnZepto)}</Text>
                                </View>
                                <View style={[styles.priceComparisonRow, styles.priceComparisonRowKiddo]}>
                                    <View style={styles.kiddoRowContent}>
                                        <Ionicons name="star" size={12} color="#FFD700" style={styles.starIcon} />
                                        <Text style={styles.pricePlatformTextKiddo}>Kiddo</Text>
                                        <Ionicons name="star" size={12} color="#FFD700" style={styles.starIcon} />
                                    </View>
                                    <Text style={styles.priceValueTextKiddo}>{formatPriceWithRupee(priceOnKiddo)}</Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Material Accordion */}
                    {fabric && (
                        <View style={styles.accordionContainer}>
                            <TouchableOpacity
                                style={styles.accordionHeader}
                                onPress={() => toggleSection('material')}
                                activeOpacity={0.7}
                            >
                                <View style={styles.accordionTitleContainer}>
                                    <Ionicons name="shirt-outline" size={20} color={Colors.text} style={styles.accordionIcon} />
                                    <Text style={styles.accordionTitle}>Material</Text>
                                </View>
                                <Ionicons
                                    name={expandedSections['material'] ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={Colors.textSecondary}
                                />
                            </TouchableOpacity>
                            {expandedSections['material'] && (
                                <View style={styles.accordionContent}>
                                    <Text style={[
                                        styles.specValue,
                                        productStyles.material && {
                                            fontSize: productStyles.material.fontSize,
                                            color: productStyles.material.color,
                                            ...processFontStyle(productStyles.material, Fonts.Regular),
                                        }
                                    ]}>{fabric}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Wash Care Accordion */}
                    {washCare && (
                        <View style={styles.accordionContainer}>
                            <TouchableOpacity
                                style={styles.accordionHeader}
                                onPress={() => toggleSection('wash_care')}
                                activeOpacity={0.7}
                            >
                                <View style={styles.accordionTitleContainer}>
                                    <Ionicons name="water-outline" size={20} color={Colors.text} style={styles.accordionIcon} />
                                    <Text style={styles.accordionTitle}>Wash Care</Text>
                                </View>
                                <Ionicons
                                    name={expandedSections['wash_care'] ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={Colors.textSecondary}
                                />
                            </TouchableOpacity>
                            {expandedSections['wash_care'] && (
                                <View style={styles.accordionContent}>
                                    <Text style={[
                                        styles.specValue,
                                        productStyles.washCare && {
                                            fontSize: productStyles.washCare.fontSize,
                                            color: productStyles.washCare.color,
                                            ...processFontStyle(productStyles.washCare, Fonts.Regular),
                                        }
                                    ]}>{washCare}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {recommendationsConfig.enabled !== false && renderProductSection(
                        recommendedProducts,
                        recommendationsConfig,
                        "You May Also Like"
                    )}

                    {recentlyViewedConfig.enabled !== false && renderProductSection(
                        recentlyViewedProducts,
                        recentlyViewedConfig,
                        "Recently Viewed"
                    )}
                </View>
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <View style={styles.priceContainer}>
                    <View style={styles.priceRow}>
                        <Text style={styles.priceText}>{formattedPrice}</Text>
                        {formattedMRP && (
                            <Text style={styles.mrpText}>{formattedMRP}</Text>
                        )}
                    </View>
                    {discountPercentage !== null && (
                        <Text style={styles.savingsText}>{discountPercentage}% off</Text>
                    )}
                </View>
                {selectedVariant && selectedVariant.availableForSale && (selectedVariant.quantityAvailable === null || selectedVariant.quantityAvailable > 0) ? (
                    <UniversalAdd
                        item={product}
                        selectedVariant={selectedVariant}
                        variant="pdp"
                        addText="Add to Cart"
                        bookingDate={isTicketingProduct ? selectedEventDate : undefined}
                    />
                ) : (
                    <TouchableOpacity
                        style={[styles.addToCartButton, styles.disabledButton]}
                        disabled={true}
                    >
                        <Text style={styles.addToCartText}>Out of Stock</Text>
                    </TouchableOpacity>
                )}
            </View>

            <TryAndBuyModal visible={tryAndBuyModalVisible} onClose={() => setTryAndBuyModalVisible(false)} />
            <ImageViewerModal
                visible={imageViewerVisible}
                images={images}
                initialIndex={selectedImageIndex}
                onClose={() => setImageViewerVisible(false)}
            />
            
            {/* Date Picker Modal */}
            {isTicketingProduct && (
                <BaseModal
                    visible={showDatePicker}
                    onClose={() => setShowDatePicker(false)}
                    title="Select Date"
                    type="bottomSheet"
                >
                    <EventDatePicker
                        selectedDate={selectedEventDate}
                        onDateSelect={(date) => {
                            setSelectedEventDate(date);
                            setShowDatePicker(false);
                        }}
                    />
                </BaseModal>
            )}
            
            <FloatingCartButton showTabBar={false} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 10,
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
    wishlistButton: {
        padding: 8,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    imageContainer: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
        backgroundColor: '#f5f5f5',
    },
    imageTouchable: {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH,
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    imageIndicators: {
        position: 'absolute',
        bottom: 20,
        flexDirection: 'row',
        alignSelf: 'center',
    },
    indicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(0,0,0,0.2)', // Improved visibility on white/light backgrounds
        marginHorizontal: 4,
    },
    indicatorActive: {
        backgroundColor: Colors.primary, // Active color matches brand
        width: 20,
    },
    tryAndBuyTag: {
        position: 'absolute',
        bottom: 16,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 10,
    },
    tryAndBuyTagText: {
        color: '#fff',
        fontSize: 12,
        fontFamily: Fonts.Bold,
        marginLeft: 4,
    },
    infoContainer: {
        paddingTop: 10,
    },
    title: {
        fontSize: 20,
        fontFamily: Fonts.Bold,
        paddingHorizontal: 16, // Reduced
        paddingTop: 10,
        lineHeight: 28,
    },
    vendorText: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: '#666',
        paddingHorizontal: 16, // Reduced
        marginTop: 8,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    variantsContainer: {
        paddingHorizontal: 16, // Reduced padding
        marginTop: 20,
        marginBottom: 4,
    },
    optionContainer: {
        marginBottom: 24,
    },
    optionLabel: {
        fontSize: 16,
        color: '#333',
        marginBottom: 12,
        fontFamily: Fonts.SemiBold,
    },
    variantsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    variantButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
        minWidth: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    variantButtonActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    variantButtonDisabled: {
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        opacity: 0.5,
    },
    variantText: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    variantTextActive: {
        color: '#fff',
        fontFamily: Fonts.SemiBold,
    },
    variantTextDisabled: {
        color: '#9CA3AF',
    },
    dateSelectionContainer: {
        paddingHorizontal: 16,
        marginTop: 20,
        marginBottom: 4,
    },
    dateSelectionLabel: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
        marginBottom: 12,
    },
    dateSelectionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    dateIcon: {
        marginRight: 10,
    },
    dateSelectionText: {
        flex: 1,
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    dateSelectionPlaceholder: {
        color: Colors.textSecondary,
    },
    separator: {
        height: 8,
        backgroundColor: '#F9F9F9', // Light gray gap
        marginTop: 24, // Space above
        marginBottom: 8, // Space below
    },
    accordionContainer: {
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: '#fff',
        marginHorizontal: 16, // Inset container
    },
    accordionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 0, // Remove internal padding to align with edge of container (which is already inset 16)
    },
    accordionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accordionIcon: {
        marginRight: 12,
        color: '#666',
    },
    accordionTitle: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#1a1a1a',
    },
    accordionContent: {
        paddingHorizontal: 0,
        paddingBottom: 24,
        paddingLeft: 0, // Align text with icon (start flush left)
    },
    descriptionContainer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    descriptionBody: {
        fontSize: 14,
        color: '#4a4a4a',
        lineHeight: 24,
        fontFamily: Fonts.Regular,
    },
    specValue: {
        fontSize: 14,
        color: '#4a4a4a',
        fontFamily: Fonts.Regular,
        lineHeight: 24,
        textAlign: 'left',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        alignItems: 'center',
    },
    priceContainer: {
        flex: 1,
        flexDirection: 'column',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    priceText: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    mrpText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#999',
        textDecorationLine: 'line-through',
    },
    savingsText: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#4CAF50',
        marginTop: 4,
    },
    productPriceContainer: {
        marginTop: 12,
        marginBottom: 8,
        paddingLeft: 16,
    },
    productPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    productPriceText: {
        fontSize: 24,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    productMrpText: {
        fontSize: 18,
        fontFamily: Fonts.Regular,
        color: '#999',
        textDecorationLine: 'line-through',
    },
    productSavingsText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#4CAF50',
        marginTop: 6,
    },
    priceComparisonContainer: {
        marginTop: 20,
        marginBottom: 20,
        paddingHorizontal: 16,
        paddingTop: 0,
    },
    priceComparisonTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    priceComparisonTable: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    priceComparisonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    priceComparisonHeaderRow: {
        backgroundColor: '#F5F5F5',
        borderBottomWidth: 2,
        borderBottomColor: Colors.border,
        paddingVertical: 12,
    },
    priceComparisonRowKiddo: {
        backgroundColor: '#E8F5E9',
        borderBottomWidth: 0,
    },
    kiddoRowContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    starIcon: {
        marginHorizontal: 2,
    },
    pricePlatformText: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    pricePlatformTextHeader: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    pricePlatformTextKiddo: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
    },
    priceValueText: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    priceValueTextHeader: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    priceValueTextKiddo: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    addToCartButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 140,
        alignItems: 'center',
    },
    disabledButton: {
        backgroundColor: '#ccc',
    },
    addToCartText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
    },
    retryButton: {
        marginTop: 20,
        padding: 12,
        backgroundColor: Colors.primary,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#fff',
        fontFamily: Fonts.Bold,
    },
    recommendationsGap: {
        height: 0,
        backgroundColor: '#f5f5f5',
        marginTop: 20,
    },
});

export default ProductDetailScreen;
