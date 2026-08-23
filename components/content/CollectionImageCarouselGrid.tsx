import OptimizedImage from '@/components/ui/OptimizedImage';
import UniversalAdd from '@/components/ui/UniversalAdd';
import { Colors, Fonts } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import {
    CollectionImageCarouselGridBlock,
    CollectionImageCarouselGridCardConfig,
} from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { shopifyImageUrl } from '@/utils/shopifyIds';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props extends Omit<BaseContentBlockProps, 'onPress'> {
    block: CollectionImageCarouselGridBlock;
    onPress?: (link?: string, item?: any) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card: Image Layout  (full-bleed single image)
// ─────────────────────────────────────────────────────────────────────────────

interface ImageCardProps {
    card: CollectionImageCarouselGridCardConfig;
    cardWidth: number;
    cardHeight: number;
    borderRadius: number;
    onPress?: (link?: string, item?: any) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({ card, cardWidth, cardHeight, borderRadius, onPress }) => {
    const handlePress = useCallback(() => {
        if (!onPress) return;
        const payload = { collectionId: card.collectionId, title: card.title };
        onPress(card.link, payload);
    }, [card, onPress]);

    return (
        <TouchableOpacity
            activeOpacity={0.88}
            onPress={handlePress}
            style={[s.imageCardContainer, { width: cardWidth, height: cardHeight, borderRadius }]}
        >
            {card.imageUrl ? (
                <OptimizedImage
                    source={{ uri: shopifyImageUrl(card.imageUrl, Math.round(cardWidth * 2)) }}
                    style={[StyleSheet.absoluteFill, { borderRadius }]}
                    contentFit="cover"
                    transition={0}
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, s.imagePlaceholder, { borderRadius }]} />
            )}
            {(card.title || card.subtitle) && (
                <View style={[s.imageOverlay, { borderBottomLeftRadius: borderRadius, borderBottomRightRadius: borderRadius }]}>
                    {card.title && (
                        <Text style={s.imageOverlayTitle} numberOfLines={1}>{card.title}</Text>
                    )}
                    {card.subtitle && (
                        <Text style={s.imageOverlaySubtitle} numberOfLines={1}>{card.subtitle}</Text>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Card: Grid Layout  (X×Y mini image grid)
// ─────────────────────────────────────────────────────────────────────────────

interface GridCardProps {
    card: CollectionImageCarouselGridCardConfig;
    cardWidth: number;
    cardHeight: number;
    borderRadius: number;
    onPress?: (link?: string, item?: any) => void;
}

const GridCard: React.FC<GridCardProps> = ({ card, cardWidth, cardHeight, borderRadius, onPress }) => {
    const cfg = card.gridConfig ?? {};
    const columns = cfg.columns ?? 2;
    const gap = cfg.gap ?? 8;
    const aspectRatio = cfg.aspectRatio ?? 1;
    const resizeMode = cfg.resizeMode ?? 'cover';
    const cellBorderRadius = cfg.borderRadius ?? 12;
    const showLabels = cfg.showLabels !== false;
    const maxRows = cfg.rows;

    const items = useMemo(() => {
        let all = card.gridItems ?? [];
        if (maxRows) all = all.slice(0, columns * maxRows);
        return all;
    }, [card.gridItems, columns, maxRows]);

    const CARD_PADDING = 12;
    const HEADER_HEIGHT = (card.title || card.subtitle || card.headerImage) ? (card.headerHeight ?? 52) : 0;
    const FOOTER_HEIGHT = 36;
    const LABEL_HEIGHT = showLabels ? 22 : 0; // per-row label area

    // Available height for the grid body (card minus header, footer, top+bottom padding)
    const bodyHeight = cardHeight - HEADER_HEIGHT - FOOTER_HEIGHT - CARD_PADDING * 2;

    const cellWidth = (cardWidth - CARD_PADDING * 2 - gap * (columns - 1)) / columns;

    // Ideal height from aspect ratio
    const idealImageHeight = cellWidth / aspectRatio;

    // Max height allowed so all rows fit without clipping:
    // bodyHeight = numRows * (imageH + LABEL_HEIGHT) + (numRows - 1) * gap
    // => imageH = (bodyHeight - (numRows-1)*gap - numRows*LABEL_HEIGHT) / numRows
    const numRows = maxRows ?? Math.ceil((card.gridItems?.length ?? 0) / columns);
    const safeRows = Math.max(numRows, 1);
    const maxImageHeight = (bodyHeight - (safeRows - 1) * gap - safeRows * LABEL_HEIGHT) / safeRows;

    const cellImageHeight = Math.min(idealImageHeight, Math.max(maxImageHeight, 20));

    const rows = useMemo(() => {
        const result: typeof items[number][][] = [];
        for (let i = 0; i < items.length; i += columns) {
            result.push(items.slice(i, i + columns));
        }
        return result;
    }, [items, columns]);

    const handleCellPress = useCallback((gridItem: typeof items[number]) => {
        if (!onPress) return;
        const payload = { collectionId: gridItem.collectionId, title: gridItem.label };
        onPress(gridItem.link, payload);
    }, [onPress]);

    const handleHeaderPress = useCallback(() => {
        if (!onPress) return;
        const payload = { collectionId: card.collectionId, title: card.title };
        onPress(card.link, payload);
    }, [card, onPress]);

    const cardContent = (
        <>
            {(card.title || card.subtitle || card.headerImage) && (
                <TouchableOpacity onPress={handleHeaderPress} activeOpacity={0.85} style={card.headerImage ? [s.cardHeaderImageContainer, { height: HEADER_HEIGHT }] : [s.cardHeader, { minHeight: HEADER_HEIGHT }]}>
                    {card.headerImage ? (
                        <OptimizedImage
                            source={{ uri: shopifyImageUrl(card.headerImage, Math.round(cardWidth * 2)) }}
                            style={[s.cardHeaderImage, { height: HEADER_HEIGHT }]}
                            contentFit="cover"
                            transition={0}
                        />
                    ) : (
                        <View style={s.cardHeaderTexts}>
                            {card.title && <Text style={[s.cardTitle, card.cardStyles?.title]} numberOfLines={1}>{card.title}</Text>}
                           {card.subtitle && <Text style={[s.cardSubtitle, card.cardStyles?.subtitle]} numberOfLines={1}>{card.subtitle}</Text>}
                        </View>
                    )}
                    {!card.headerImage && (
                        <View style={s.cardHeaderArrow}>
                            <Text style={s.cardHeaderArrowText}>›</Text>
                        </View>
                    )}
                </TouchableOpacity>
            )}
            <View style={[s.gridBody, { padding: CARD_PADDING, gap, height: bodyHeight, overflow: 'hidden', justifyContent: 'center' }]}>
                {rows.map((row, rowIdx) => (
                    <View key={`row-${rowIdx}`} style={[s.gridRow, { gap }]}>
                        {row.map((gridItem) => (
                            <TouchableOpacity key={gridItem.id} activeOpacity={0.85} onPress={() => handleCellPress(gridItem)} style={{ width: cellWidth }}>
                                <OptimizedImage
                                    source={{ uri: shopifyImageUrl(gridItem.imageUrl, Math.round(cellWidth * 2)) }}
                                    style={{ width: cellWidth, height: cellImageHeight, borderRadius: cellBorderRadius, backgroundColor: '#f5f5f5' }}
                                    contentFit={resizeMode}
                                    transition={0}
                                />
                                {showLabels && gridItem.label && (
                                    <Text style={s.gridCellLabel} numberOfLines={1} ellipsizeMode="tail">{gridItem.label}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </View>
            <TouchableOpacity onPress={handleHeaderPress} activeOpacity={0.7} style={s.cardFooter}>
                <Text style={s.seeAllText}>See all »</Text>
            </TouchableOpacity>
        </>
    );

    if (card.gradientColors && card.gradientColors.length > 0) {
        return (
            <LinearGradient
                colors={card.gradientColors}
                style={[s.cardWrapper, { width: cardWidth, height: cardHeight, borderRadius }]}
            >
                {cardContent}
            </LinearGradient>
        );
    }

    return (
        <View style={[s.cardWrapper, { width: cardWidth, height: cardHeight, borderRadius, backgroundColor: card.backgroundColor ?? Colors.backgroundWhite }]}>
            {cardContent}
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Card: List Layout  (vertical product list — image + name + price + ATC)
// ─────────────────────────────────────────────────────────────────────────────

interface ListCardProps {
    card: CollectionImageCarouselGridCardConfig;
    cardWidth: number;
    cardHeight: number;
    borderRadius: number;
    onPress?: (link?: string, item?: any) => void;
    onProductPress?: (product: any) => void;
}

const ListCard: React.FC<ListCardProps> = ({ card, cardWidth, cardHeight, borderRadius, onPress, onProductPress }) => {
    const cfg = card.listConfig ?? {};
    const limit = cfg.limit ?? 4;
    const showPrice = cfg.showPrice !== false;
    const showAddToCart = cfg.showAddToCart !== false;
    const imageSize = cfg.imageSize ?? 72;

    const [products, setProducts] = useState<any[]>(card.products ?? []);
    const [loading, setLoading] = useState(!card.products?.length && !!card.collectionId);
    const router = useRouter();

    const HEADER_HEIGHT = (card.title || card.subtitle || card.headerImage) ? (card.headerHeight ?? 52) : 0;

    useEffect(() => {
        if (card.products?.length) {
            setProducts(card.products.slice(0, limit));
            return;
        }
        if (!card.collectionId) { setLoading(false); return; }

        let cancelled = false;
        setLoading(true);
        shopifyApi.getProductsByCollection(card.collectionId, limit)
            .then((res: any) => {
                if (cancelled) return;
                const prods = (res?.products?.edges ?? []).map((e: any) => e.node);
                setProducts(prods.slice(0, limit));
            })
            .catch(() => { if (!cancelled) setProducts([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [card.collectionId, card.products, limit]);

    const handleHeaderPress = useCallback(() => {
        if (!onPress) return;
        onPress(card.link, { collectionId: card.collectionId, title: card.title });
    }, [card, onPress]);

    const handleProductPress = useCallback((product: any) => {
        if (onProductPress) { onProductPress(product); return; }
        const routeParam = product.id || product.handle;
        if (routeParam) router.push({ pathname: `/products/${encodeURIComponent(routeParam)}` } as any);
    }, [onProductPress, router]);

    const getPrice = (product: any) => {
        const v = product.variants?.edges?.[0]?.node || product.variants?.[0] || {};
        const amount = v.price?.amount || product.priceRange?.minVariantPrice?.amount || '0';
        const num = parseFloat(amount);
        return Number.isFinite(num) && num > 0 ? `₹${num.toFixed(0)}` : null;
    };

    const getImageUrl = (product: any) =>
        product.images?.edges?.[0]?.node?.url ||
        product.images?.[0]?.url ||
        product.featuredImage?.url || '';

    const listCardContent = (
        <>
            {(card.title || card.subtitle || card.headerImage) && (
                <TouchableOpacity onPress={handleHeaderPress} activeOpacity={0.85} style={card.headerImage ? [s.cardHeaderImageContainer, { height: HEADER_HEIGHT }] : [s.cardHeader, { minHeight: HEADER_HEIGHT }]}>
                    {card.headerImage ? (
                        <OptimizedImage
                            source={{ uri: shopifyImageUrl(card.headerImage, Math.round(cardWidth * 2)) }}
                            style={[s.cardHeaderImage, { height: HEADER_HEIGHT }]}
                            contentFit="cover"
                            transition={0}
                        />
                    ) : (
                        <View style={s.cardHeaderTexts}>
                            {card.title && <Text style={[s.cardTitle, card.cardStyles?.title]} numberOfLines={1}>{card.title}</Text>}
                            {card.subtitle && <Text style={[s.cardSubtitle, card.cardStyles?.subtitle]} numberOfLines={1}>{card.subtitle}</Text>}
                        </View>
                    )}
                    {!card.headerImage && (
                        <View style={s.cardHeaderArrow}>
                            <Text style={s.cardHeaderArrowText}>›</Text>
                        </View>
                    )}
                </TouchableOpacity>
            )}

            {(() => {
                const HEADER_HEIGHT = (card.title || card.subtitle || card.headerImage) ? (card.headerHeight ?? 52) : 0;
                const FOOTER_HEIGHT = 36;
                const bodyHeight = cardHeight - HEADER_HEIGHT - FOOTER_HEIGHT;

                if (loading) {
                    return (
                        <View style={[s.listLoadingContainer, { height: bodyHeight }]}>
                            <ActivityIndicator color={Colors.primary} size="small" />
                        </View>
                    );
                }

                return (
                    <ScrollView
                        style={{ height: bodyHeight }}
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={false}
                        bounces={true}
                    >
                        {products.map((product, idx) => {
                            const priceStr = showPrice ? getPrice(product) : null;
                            const imageUri = shopifyImageUrl(getImageUrl(product), imageSize * 2);
                            const isLast = idx === products.length - 1;
                            return (
                                <TouchableOpacity
                                    key={product.id || idx}
                                    activeOpacity={0.8}
                                    onPress={() => handleProductPress(product)}
                                    style={[
                                        s.listRow,
                                        !isLast && s.listRowDivider,
                                    ]}
                                >
                                    <View style={[s.listImageWrap, { width: imageSize, height: imageSize }]}>
                                        {imageUri ? (
                                            <Image
                                                source={{ uri: imageUri }}
                                                style={[s.listImage, { width: imageSize, height: imageSize }]}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={[s.listImagePlaceholder, { width: imageSize, height: imageSize }]} />
                                        )}
                                    </View>
                                    <View style={s.listInfo}>
                                        <Text style={s.listProductName} numberOfLines={2} ellipsizeMode="tail">
                                            {product.title || product.name || ''}
                                        </Text>
                                        {priceStr && <Text style={s.listPrice} numberOfLines={1}>{priceStr}</Text>}
                                    </View>
                                    {showAddToCart && (
                                        <View style={s.listAddWrap} pointerEvents="box-none">
                                            <UniversalAdd item={product} variant="prominent" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                        {products.length === 0 && (
                            <View style={s.listEmpty}>
                                <Text style={s.listEmptyText}>No products</Text>
                            </View>
                        )}
                    </ScrollView>
                );
            })()}
            <TouchableOpacity onPress={handleHeaderPress} activeOpacity={0.7} style={s.cardFooter}>
                <Text style={s.seeAllText}>See all »</Text>
            </TouchableOpacity>
        </>
    );

    if (card.gradientColors && card.gradientColors.length > 0) {
        return (
            <LinearGradient
                colors={card.gradientColors}
                style={[s.cardWrapper, { width: cardWidth, height: cardHeight, borderRadius }]}
            >
                {listCardContent}
            </LinearGradient>
        );
    }

    return (
        <View style={[s.cardWrapper, { width: cardWidth, height: cardHeight, borderRadius, backgroundColor: card.backgroundColor ?? Colors.backgroundWhite }]}>
            {listCardContent}
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Carousel Card Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

interface CarouselCardProps {
    card: CollectionImageCarouselGridCardConfig;
    cardWidth: number;
    cardHeight: number;
    borderRadius: number;
    marginRight: number;
    onPress?: (link?: string, item?: any) => void;
    onProductPress?: (product: any) => void;
    blockCardStyle?: any;
}

const CarouselCard: React.FC<CarouselCardProps> = ({ card, cardWidth, cardHeight, borderRadius, marginRight, onPress, onProductPress, blockCardStyle }) => (
    <View style={[{ marginRight }, blockCardStyle]}>
        {card.layout === 'image' && (
            <ImageCard card={card} cardWidth={cardWidth} cardHeight={cardHeight} borderRadius={borderRadius} onPress={onPress} />
        )}
        {card.layout === 'grid' && (
            <GridCard card={card} cardWidth={cardWidth} cardHeight={cardHeight} borderRadius={borderRadius} onPress={onPress} />
        )}
        {card.layout === 'list' && (
            <ListCard card={card} cardWidth={cardWidth} cardHeight={cardHeight} borderRadius={borderRadius} onPress={onPress} onProductPress={onProductPress} />
        )}
    </View>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function CollectionImageCarouselGrid({ block, onPress }: Props) {
    const { cards = [], title, carouselConfig = {}, styles: blockStyles } = block;

    const cardWidth = carouselConfig.cardWidth ?? Math.round(SCREEN_WIDTH * 0.85);
    const aspectRatio = carouselConfig.aspectRatio;
    const cardHeight = aspectRatio ? Math.round(cardWidth / aspectRatio) : (carouselConfig.cardHeight ?? 340);
    const gap = carouselConfig.gap ?? 12;
    const borderRadius = carouselConfig.borderRadius ?? 20;
    const paddingHorizontal = carouselConfig.paddingHorizontal ?? 16;
    const showIndicators = carouselConfig.showIndicators !== false;

    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const titleStyle = useMemo(
        () => ({ ...sMain.title, ...processFontStyle(blockStyles?.title, Fonts.LexendBold) }),
        [blockStyles?.title],
    );

    const snapInterval = cardWidth + gap;

    const handleScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
            setActiveIndex(Math.max(0, Math.min(idx, cards.length - 1)));
        },
        [snapInterval, cards.length],
    );

    const renderCard = useCallback(
        ({ item, index }: { item: CollectionImageCarouselGridCardConfig; index: number }) => (
            <CarouselCard
                card={item}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                borderRadius={borderRadius}
                marginRight={index === cards.length - 1 ? 0 : gap}
                onPress={onPress}
                blockCardStyle={blockStyles?.card}
            />
        ),
        [cards.length, cardWidth, cardHeight, borderRadius, gap, onPress, blockStyles?.card],
    );

    const keyExtractor = useCallback((item: CollectionImageCarouselGridCardConfig) => item.id, []);

    if (!cards.length) return null;

    return (
        <BaseContentBlock block={block}>
            <View style={sMain.inner}>
                {!!title?.trim() && <Text style={titleStyle}>{title}</Text>}

                <FlatList
                    ref={flatListRef}
                    data={cards}
                    keyExtractor={keyExtractor}
                    renderItem={renderCard}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    bounces={false}
                    decelerationRate="fast"
                    snapToInterval={snapInterval}
                    snapToAlignment="start"
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingHorizontal, paddingVertical: 4 }}
                />

                {showIndicators && cards.length > 1 && (
                    <View style={sMain.dotsRow}>
                        {cards.map((_, i) => (
                            <View key={i} style={[sMain.dot, i === activeIndex && sMain.dotActive]} />
                        ))}
                    </View>
                )}
            </View>
        </BaseContentBlock>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    // Image card
    imageCardContainer: { overflow: 'hidden', backgroundColor: '#f0f0f0' },
    imagePlaceholder: { backgroundColor: '#e0e0e0' },
    imageOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 14, paddingVertical: 12,
        backgroundColor: 'rgba(0,0,0,0.38)',
    },
    imageOverlayTitle: { fontFamily: Fonts.LexendBold, fontSize: 16, color: '#fff', letterSpacing: 0.2 },
    imageOverlaySubtitle: { fontFamily: Fonts.LexendRegular, fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 2 },

    // Shared card wrapper
    cardWrapper: {
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,
        elevation: 3,
    },

    // Card header (grid + list cards)
    cardHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
        minHeight: 52,
    },
    cardHeaderImageContainer: {
        height: 52,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    },
    cardHeaderImage: {
        flex: 1,
        height: 52,
        borderRadius: 0,
    },
    cardHeaderTexts: { flex: 1 },
    cardTitle: { fontFamily: Fonts.LexendBold, fontSize: 15, color: Colors.text },
    cardSubtitle: { fontFamily: Fonts.LexendRegular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
    cardHeaderArrow: { width: 28, alignItems: 'center', justifyContent: 'center' },
    cardHeaderArrowText: { fontSize: 22, color: Colors.textSecondary, fontFamily: Fonts.Regular },

    // Card footer
    cardFooter: {
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    seeAllText: {
        fontFamily: Fonts.SemiBold,
        fontSize: 13,
        color: Colors.primary,
    },

    // Grid card
    gridBody: { flex: 1 },
    gridRow: { flexDirection: 'row' },
    gridCellLabel: { fontFamily: Fonts.Medium, fontSize: 11, color: Colors.text, textAlign: 'center', marginTop: 5 },

    // List card
    listLoadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 10 },
    listRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
    listImageWrap: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#f5f5f5', flexShrink: 0 },
    listImage: { borderRadius: 10 },
    listImagePlaceholder: { borderRadius: 10, backgroundColor: '#e8e8e8' },
    listInfo: { flex: 1, justifyContent: 'center', gap: 3 },
    listProductName: { fontFamily: Fonts.Medium, fontSize: 13, color: Colors.text, lineHeight: 18 },
    listPrice: { fontFamily: Fonts.Bold, fontSize: 13, color: Colors.text },
    listAddWrap: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
    listEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
    listEmptyText: { fontFamily: Fonts.Regular, fontSize: 13, color: Colors.textSecondary },
});

const sMain = StyleSheet.create({
    inner: { width: SCREEN_WIDTH },
    title: { fontSize: 15, color: Colors.text, fontFamily: Fonts.LexendBold, marginBottom: 10, paddingHorizontal: 16 },
    dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10, marginBottom: 2 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
    dotActive: { width: 18, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
});
