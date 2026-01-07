import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    InteractionManager,
    Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { shopifyApi } from '@/services/shopifyApi';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { useScrollTracking } from '@/hooks/useScrollTracking';
import { Fonts, Colors } from '@/constants/theme';
import HorizontalProductList from '@/components/content/HorizontalProductList';
import ImageViewerModal from '@/components/ui/ImageViewerModal';
import UniversalAdd from '@/components/ui/UniversalAdd';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import { TryBuyModal as TryAndBuyModal } from '@/components/product/TryBuyModal';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [tryAndBuyModalVisible, setTryAndBuyModalVisible] = useState(false);
    const imageFlatListRef = useRef<any>(null);
    const { addToCart } = useCart();
    const { user, isAuthenticated } = useAuth();
    const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
    const [wishlistLoading, setWishlistLoading] = useState(false);
    const imageGestureRef = useRef({ isHorizontal: false });

    // Initialize variant from product data
    const initializeVariant = useCallback((productData: any) => {
        if (!productData) return;

        let variants = [];
        if (productData.variants?.edges) {
            variants = productData.variants.edges.map((e: any) => e.node);
        } else if (Array.isArray(productData.variants)) {
            variants = productData.variants;
        }

        // Find first available variant, fallback to first variant if none available
        const firstVariant = variants.find((v: any) => v.availableForSale !== false) || variants[0];

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
                setRecommendedProducts(recommendations);
            }
        } catch (error) {
            console.error('Error loading recommendations:', error);
        }
    };

    useEffect(() => {
        loadProductDetails();
    }, [loadProductDetails]);

    const handleAddToCart = async () => {
        if (selectedVariant && selectedVariant.availableForSale) {
            try {
                await addToCart(product, selectedVariant, 1);
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

    const formattedPrice = useMemo(() => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
        }).format(basePrice);
    }, [basePrice]);

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
                    <Text style={styles.title}>{product.title}</Text>
                    {product.vendor && <Text style={styles.vendorText}>{product.vendor}</Text>}

                    {productOptions.length > 0 && (
                        <View style={styles.variantsContainer}>
                            {productOptions.map((option: any) => (
                                <View key={option.name} style={styles.optionContainer}>
                                    <Text style={styles.optionLabel}>
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
                                                        !isOptionAvailable && styles.variantTextDisabled
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

                    {/* Separator */}
                    <View style={styles.separator} />

                    {/* Description Accordion */}
                    {product.description && (
                        <View style={styles.accordionContainer}>
                            <TouchableOpacity
                                style={styles.accordionHeader}
                                onPress={() => toggleSection('description')}
                                activeOpacity={0.7}
                            >
                                <View style={styles.accordionTitleContainer}>
                                    <Ionicons name="document-text-outline" size={20} color={Colors.text} style={styles.accordionIcon} />
                                    <Text style={styles.accordionTitle}>Product Details</Text>
                                </View>
                                <Ionicons
                                    name={expandedSections['description'] ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={Colors.textSecondary}
                                />
                            </TouchableOpacity>
                            {expandedSections['description'] && (
                                <View style={styles.accordionContent}>
                                    <Text style={styles.descriptionBody}>{product.description}</Text>
                                </View>
                            )}
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
                                    <Text style={styles.specValue}>{fabric}</Text>
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
                                    <Text style={styles.specValue}>{washCare}</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {recommendedProducts.length > 0 && (
                        <HorizontalProductList
                            products={recommendedProducts}
                            title="You May Also Like"
                            onProductPress={(p) => router.push({ pathname: '/product/[id]', params: { id: p.id, handle: p.handle } })}
                        />
                    )}
                </View>
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <View style={styles.priceContainer}>
                    <Text style={styles.priceText}>{formattedPrice}</Text>
                    <Text style={styles.taxLabel}>Inclusive of all taxes</Text>
                </View>
                {selectedVariant && selectedVariant.availableForSale && (selectedVariant.quantityAvailable === null || selectedVariant.quantityAvailable > 0) ? (
                    <UniversalAdd
                        item={product}
                        selectedVariant={selectedVariant}
                        variant="pdp"
                        addText="Add to Cart"
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
    },
    priceText: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
    },
    taxLabel: {
        fontSize: 10,
        color: '#999',
        marginTop: 2,
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
});

export default ProductDetailScreen;
