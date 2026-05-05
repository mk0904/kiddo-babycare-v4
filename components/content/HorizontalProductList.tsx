import { ProductCard } from '@/components/products/ProductCard';
import { HorizontalProductListSkeleton } from '@/components/ui/SkeletonLoader';
import { Colors, Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { shopifyApi } from '@/services/shopifyApi';
import { sortInStockFirst } from '@/utils/availability';
import { processFontStyle } from '@/utils/fontUtils';
import { FlashList } from '@shopify/flash-list';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ImageBackground,
    InteractionManager,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface HorizontalProductListProps {
    collectionIds?: string[];
    products?: any[];
    config?: {
        limit?: number;
        itemsPerView?: number;
        itemSpacing?: number;
        sidePadding?: number;
        seeAllText?: string; // Configurable "See All" button text
        showSeeAll?: boolean; // Show "See All" button
    };
    styles?: any;
    title?: string;
    onProductPress?: (product: any) => void;
    onAddToCart?: (product: any) => void;
    onSeeMore?: () => void;
    onCollectionPress?: (collection: any) => void;
    showSeeMore?: boolean; // Legacy prop for backward compatibility
    /** Called when products have finished loading (with the loaded products array). */
    onProductsLoaded?: (products: any[]) => void;
    /** External value that triggers a re-render when it changes (e.g. cart items length). */
    refreshKey?: any;
}

const HorizontalProductList: React.FC<HorizontalProductListProps> = ({
    collectionIds = [],
    products: directProducts,
    config = {},
    styles: customStyles = {},
    title,
    onProductPress,
    onAddToCart,
    onSeeMore,
    onCollectionPress,
    showSeeMore = false,
    onProductsLoaded,
    refreshKey,
}) => {
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [collections, setCollections] = useState<any[]>([]);
    const flatListRef = useRef<any>(null);

    const {
        limit = 10,
        itemsPerView = 2.2, // Default to showing a bit of the next item
        itemSpacing = 12,
        sidePadding = 20,
        seeAllText = 'See All', // Default text for "See All" button
        showSeeAll = false, // Default to false, can be enabled via config
    } = config;

    const { width: screenWidth } = useDeviceDimensions();
    const paddingLeft = sidePadding > 0 ? sidePadding : 20;

    const itemWidth = useMemo(() => {
        const paddingRight = sidePadding > 0 ? sidePadding : 20;
        const totalPadding = paddingLeft + paddingRight;
        const totalSpacing = itemSpacing * (Math.ceil(itemsPerView) - 1);
        const availableWidth = screenWidth - totalPadding - totalSpacing;
        return availableWidth / itemsPerView;
    }, [itemsPerView, itemSpacing, paddingLeft, sidePadding, screenWidth]);

    const collectionIdsKey = useMemo(() => {
        return JSON.stringify(collectionIds?.sort() || []);
    }, [collectionIds]);

    useEffect(() => {
        if (directProducts && directProducts.length > 0) {
            const sorted = sortInStockFirst(directProducts);
            setProducts(sorted);
            setLoading(false);
            onProductsLoaded?.(sorted);
            return;
        }

        const task = InteractionManager.runAfterInteractions(() => {
            loadProducts();
        });
        return () => task.cancel();
    }, [collectionIdsKey, directProducts]);

    const loadProducts = useCallback(async () => {
        try {
            setLoading(true);
            const allProducts: any[] = [];
            const loadedCollections: any[] = [];

            const collectionPromises = collectionIds.map(async (collectionId) => {
                try {
                    const [collectionDetails, collection] = await Promise.all([
                        shopifyApi.getCollectionById(collectionId).catch(() => null),
                        shopifyApi.getProductsByCollection(collectionId, limit > 0 ? limit : 20),
                    ]);

                    if (collectionDetails) {
                        loadedCollections.push(collectionDetails);
                    }

                    if (collection?.products?.edges) {
                        return collection.products.edges.map((edge: any) => edge.node);
                    }
                    return [];
                } catch (err) {
                    return [];
                }
            });

            const productsArrays = await Promise.all(collectionPromises);

            productsArrays.forEach(prods => {
                allProducts.push(...prods);
            });

            setCollections(loadedCollections);
            const sortedProducts = sortInStockFirst(allProducts);
            const limitedProducts = limit > 0 ? sortedProducts.slice(0, limit) : sortedProducts;
            setProducts(limitedProducts);
            onProductsLoaded?.(limitedProducts);
        } catch (error) {
            console.error('Error loading products:', error);
            onProductsLoaded?.([]);
        } finally {
            setLoading(false);
        }
    }, [collectionIds, limit]);

    const {
        backgroundImage,
        ...containerStylesWithoutBg
    } = customStyles.container || {};

    const containerStyle = useMemo(() => [
        defaultStyles.container,
        containerStylesWithoutBg,
    ], [containerStylesWithoutBg]);

    const titleStyle = useMemo(() => [
        defaultStyles.title,
        customStyles.title
            ? processFontStyle(customStyles.title, Fonts.FredokaSemiBold)
            : {},
    ], [customStyles.title]);

    const titleContainerStyle = useMemo(() => [
        defaultStyles.titleContainer,
        { paddingHorizontal: sidePadding },
        customStyles.titleContainer, // Allow overriding titleContainer styles from config
    ], [sidePadding, customStyles.titleContainer]);

    const contentStyle = useMemo(() => [
        defaultStyles.content,
        customStyles.content,
    ], [customStyles.content]);

    const contentContainerStyle = useMemo(() => [
        {
            paddingLeft: paddingLeft,
            paddingRight: sidePadding > 0 ? sidePadding : 20,
            paddingBottom: 8,
        }
    ], [paddingLeft, sidePadding]);

    const keyExtractor = useCallback((item: any, index: number) => {
        return item?.id || item?.node?.id || `product-${index}`;
    }, []);

    const normalizedProducts = useMemo(() => {
        return products.map((item) => ({
            ...item,
            id: item.id || item.node?.id,
            handle: item.handle || item.node?.handle,
            title: item.title || item.node?.title,
            variants: item.variants || item.node?.variants,
            images: item.images || item.node?.images,
        }));
    }, [products]);

    // Calculate average price for essentials collections
    const averageMarketPrice = useMemo(() => {
        const isEssentials = title && title.toLowerCase().includes('essentials');
        if (!isEssentials || normalizedProducts.length === 0) return null;

        const parsePrice = (priceValue: any) => {
            if (!priceValue) return 0;
            if (typeof priceValue === 'string') {
                const parsed = parseFloat(priceValue);
                return isNaN(parsed) ? 0 : parsed;
            }
            if (typeof priceValue === 'object' && priceValue.amount) {
                const parsed = parseFloat(priceValue.amount);
                return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
        };

        const prices: number[] = [];
        normalizedProducts.forEach((product) => {
            const firstVariant = product.variants?.edges?.[0]?.node ||
                (Array.isArray(product.variants) ? product.variants[0] : null);

            let price = 0;
            if (firstVariant?.price?.amount) {
                price = parsePrice(firstVariant.price.amount);
            } else if (product.priceRange?.minVariantPrice?.amount) {
                price = parsePrice(product.priceRange.minVariantPrice.amount);
            } else if (product.price) {
                price = parsePrice(product.price);
            }

            if (price > 0) {
                prices.push(price);
            }
        });

        if (prices.length === 0) return null;
        const sum = prices.reduce((acc, price) => acc + price, 0);
        return sum / prices.length;
    }, [normalizedProducts, title]);

    const productCardContainerStyle = useMemo(() => ({
        width: '100%',
        margin: 0,
    }), []);

    const itemWrapperStyle = useMemo(() => ({
        width: itemWidth,
        backgroundColor: 'transparent',
    }), [itemWidth]);

    const renderItem = useCallback(({ item }: { item: any }) => {
        const handlePress = onProductPress ? () => onProductPress(item) : undefined;
        const handleAddToCart = onAddToCart ? () => onAddToCart(item) : undefined;

        return (
            <View style={itemWrapperStyle}>
                <ProductCard
                    product={item}
                    onPress={handlePress}
                    onAddToCart={handleAddToCart}
                    containerStyle={productCardContainerStyle}
                    averageMarketPrice={averageMarketPrice}
                />
            </View>
        );
    }, [itemWrapperStyle, onProductPress, onAddToCart, productCardContainerStyle, averageMarketPrice]);

    const ItemSeparator = useCallback(() => {
        return <View style={{ width: itemSpacing }} />;
    }, [itemSpacing]);

    const handleScrollToIndexFailed = useCallback((info: any) => {
        if (flatListRef.current && info.highestMeasuredFrameIndex >= 0) {
            flatListRef.current.scrollToIndex({
                index: info.highestMeasuredFrameIndex,
                animated: true,
            });
        }
    }, []);

    const ContainerWrapper = backgroundImage ? ImageBackground : (View as any);

    const containerWrapperProps = useMemo(() => {
        if (backgroundImage) {
            return {
                source: { uri: backgroundImage },
                style: containerStyle,
                imageStyle: customStyles.container?.backgroundImageStyle || {},
                resizeMode: customStyles.container?.backgroundResizeMode || 'cover',
            };
        }
        return { style: containerStyle };
    }, [backgroundImage, containerStyle, customStyles.container]);

    const handleSeeMore = useCallback(() => {
        if (onSeeMore) {
            onSeeMore();
        } else if (onCollectionPress && collections.length > 0) {
            onCollectionPress(collections[0]);
        } else if (onCollectionPress && collectionIds.length > 0) {
            shopifyApi.getCollectionById(collectionIds[0]).then(collection => {
                if (collection) {
                    onCollectionPress(collection);
                }
            }).catch(() => { });
        }
    }, [onSeeMore, onCollectionPress, collections, collectionIds]);

    if (loading) {
        return (
            <View style={[containerStyle as any, defaultStyles.loadingContainer]}>
                {title && title.trim() && (
                    <View style={[defaultStyles.titleContainer, { paddingHorizontal: sidePadding }]}>
                        <Text style={titleStyle as any}>{title}</Text>
                    </View>
                )}
                <HorizontalProductListSkeleton count={Math.ceil(itemsPerView)} />
            </View>
        );
    }

    if (!normalizedProducts || normalizedProducts.length === 0) {
        return null;
    }

    return (
        <ContainerWrapper {...containerWrapperProps}>
            {title && title.trim() && (
                <View style={titleContainerStyle as any}>
                    <Text
                        style={titleStyle as any}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                    >
                        {title}
                    </Text>
                    {(showSeeMore || showSeeAll) && (
                        <TouchableOpacity
                            onPress={handleSeeMore}
                            style={defaultStyles.seeMoreButton}
                            activeOpacity={0.7}
                        >
                            <Text style={defaultStyles.seeMoreText}>{seeAllText}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
            <View style={contentStyle as any}>
                <FlashList
                    ref={flatListRef}
                    data={normalizedProducts}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    horizontal={true}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={contentContainerStyle as any}
                    estimatedItemSize={itemWidth + itemSpacing}
                    drawDistance={(itemWidth + itemSpacing) * 2}
                    decelerationRate="normal"
                    nestedScrollEnabled={true}
                    scrollEnabled={true}
                    bounces={false}
                    scrollEventThrottle={32}
                    directionalLockEnabled={true}
                    windowSize={3}
                    removeClippedSubviews={true}
                    ItemSeparatorComponent={ItemSeparator}
                    onScrollToIndexFailed={handleScrollToIndexFailed}
                    overrideItemLayout={(layout: any) => {
                        layout.size = itemWidth + itemSpacing;
                    }}
                />
            </View>
        </ContainerWrapper>
    );
};

const defaultStyles = StyleSheet.create({
    container: {
        width: '100%',
        paddingVertical: 4,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
    },
    titleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    title: {
        fontSize: 18,
        letterSpacing: 0,
        color: Colors.text,
        fontFamily: Fonts.FredokaSemiBold,
        flex: 1,
        flexShrink: 1,
        marginRight: 8,
    },
    seeMoreButton: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        flexShrink: 0,
    },
    seeMoreText: {
        fontSize: 14,
        color: Colors.primary,
        fontFamily: Fonts.SemiBold,
    },
    content: {
        width: '100%',
    },
});

const areEqual = (prevProps: any, nextProps: any) => {
    const prevIds = JSON.stringify(prevProps.collectionIds?.sort() || []);
    const nextIds = JSON.stringify(nextProps.collectionIds?.sort() || []);
    if (prevIds !== nextIds) return false;

    const prevProducts = JSON.stringify(prevProps.products || []);
    const nextProducts = JSON.stringify(nextProps.products || []);
    if (prevProducts !== nextProducts) return false;

    return (
        prevProps.title === nextProps.title &&
        prevProps.showSeeMore === nextProps.showSeeMore &&
        JSON.stringify(prevProps.config) === JSON.stringify(nextProps.config) &&
        prevProps.onProductPress === nextProps.onProductPress &&
        prevProps.onAddToCart === nextProps.onAddToCart &&
        prevProps.onSeeMore === nextProps.onSeeMore &&
        prevProps.onCollectionPress === nextProps.onCollectionPress &&
        prevProps.refreshKey === nextProps.refreshKey
    );
};

export default memo(HorizontalProductList, areEqual);
