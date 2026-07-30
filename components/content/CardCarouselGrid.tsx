import OptimizedImage from '@/components/ui/OptimizedImage';
import { Colors, Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { shopifyApi } from '@/services/shopifyApi';
import { BaseBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { shopifyImageUrl } from '@/utils/shopifyIds';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ListRenderItem,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

export interface CardCarouselGridItem {
  id: string;
  title?: string;
  name?: string;
  imageUrl?: string;
  headerBannerUrl?: string; // Optional top header banner image for card
  collectionId?: string;
  link?: string;
  [key: string]: any;
}

// Preset vibrant, modern gradient color pairs
const GRADIENT_PALETTES: [string, string][] = [
  ['#FF7E5F', '#FEB47B'], // Coral Sunshine
  ['#6A11CB', '#2575FC'], // Ocean Deep
  ['#FF4E50', '#F9D423'], // Mango Sunrise
  ['#43E97B', '#38F9D7'], // Minty Fresh
  ['#FA709A', '#FEE140'], // Pink Lemonade
  ['#F093FB', '#F5576C'], // Berry Smoothie
  ['#5EE7DF', '#B490CA'], // Lavender Sky
  ['#D4FC79', '#96E6A1'], // Soft Spring
  ['#A8EDEA', '#FED6E3'], // Cotton Candy
  ['#89F7FE', '#66A6FF'], // Electric Ice
];

export interface CardCarouselGridBlock extends BaseBlock {
  type: 'cardCarouselGrid';
  title?: string;
  collectionIds?: Array<
    | string
    | {
        id: string;
        name?: string;
        title?: string;
        imageUrl?: string;
        headerBannerUrl?: string;
        link?: string;
      }
  >;
  data?: CardCarouselGridItem[];
  carouselGridConfig?: {
    /** Number of rows in grid area at bottom (default: 2) */
    numRows?: number;
    /** Number of columns in grid area at bottom (default: 2) */
    numColumns?: number;
    /** Aspect ratio for each card (width / height). Default 0.7 for vertical rectangle cards. */
    cardAspectRatio?: number;
    /** Fixed card width in px */
    cardWidth?: number;
    /** Fixed card height in px */
    cardHeight?: number;
    /** Horizontal gap between cards (default: 16) */
    cardGap?: number;
    /** Padding for the bottom grid area (default: 12) */
    gridPadding?: number;
    /** Gap between cells inside the grid (default: 6) */
    gridGap?: number;
    /** Border radius for the outer card (default: 16) */
    borderRadius?: number;
    /** Border radius for inner cell images (default: 8) */
    cellBorderRadius?: number;
    /** Show title/labels inside grid cells (default: true) */
    showCellLabels?: boolean;
    /** Image resize/content fit mode (default: 'cover') */
    imageContentFit?: 'cover' | 'contain' | 'fill';
    /** Outer horizontal padding for the carousel list (default: 16) */
    paddingHorizontal?: number;
    /** Enable random gradient background per card (default: true) */
    useRandomGradient?: boolean;
    /** Top header image height ratio relative to total card height (default: 0.42 = 42% top image, 58% bottom grid) */
    headerImageRatio?: number;
    /** Margin below top header image (default: 0) */
    headerImageBottomMargin?: number;
    /** Default header image URL if per-card headerBannerUrl is not provided */
    defaultHeaderImageUrl?: string;
    /** Per-card layout types. Array of layout types for each card index. If not provided, all cards use default grid layout. */
    cardLayoutTypes?: Array<'grid' | 'verticalRow'>;
  };
}

interface Props extends Omit<BaseContentBlockProps, 'onPress'> {
  block: CardCarouselGridBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function CardCarouselGrid({ block, onPress }: Props) {
  const { width: screenWidth } = useDeviceDimensions();
  const { title, collectionIds, data: inlineData, carouselGridConfig = {}, styles: blockStyles } = block;

  const [collections, setCollections] = useState<CardCarouselGridItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Configuration defaults
  const gridRows = carouselGridConfig.numRows ?? 2;
  const gridCols = carouselGridConfig.numColumns ?? 2;
  const itemsPerCard = gridRows * gridCols; // 4 items for 2x2 grid at bottom

  const cardAspectRatio = carouselGridConfig.cardAspectRatio ?? 0.7; // Vertical rectangle default
  const cardGap = carouselGridConfig.cardGap ?? 16;
  const gridPadding = carouselGridConfig.gridPadding ?? 12;
  const gridGap = carouselGridConfig.gridGap ?? 6;
  const borderRadius = carouselGridConfig.borderRadius ?? 16;
  const cellBorderRadius = carouselGridConfig.cellBorderRadius ?? 8;
  const showCellLabels = carouselGridConfig.showCellLabels ?? true;
  const imageContentFit = carouselGridConfig.imageContentFit ?? 'cover';
  const paddingHorizontal = carouselGridConfig.paddingHorizontal ?? 16;
  const useRandomGradient = carouselGridConfig.useRandomGradient !== false;
  const headerImageRatio = carouselGridConfig.headerImageRatio ?? 0.42; // 42% header image height, 58% bottom grid height
  const headerImageBottomMargin = carouselGridConfig.headerImageBottomMargin ?? 0;
  const cardLayoutTypes = carouselGridConfig.cardLayoutTypes || [];

  // Card dimensions logic
  const cardWidth = useMemo(() => {
    if (carouselGridConfig.cardWidth) return carouselGridConfig.cardWidth;
    return Math.round((screenWidth - paddingHorizontal * 2) * 0.82);
  }, [carouselGridConfig.cardWidth, screenWidth, paddingHorizontal]);

  const cardHeight = useMemo(() => {
    if (carouselGridConfig.cardHeight) return carouselGridConfig.cardHeight;
    return Math.round(cardWidth / cardAspectRatio);
  }, [carouselGridConfig.cardHeight, cardWidth, cardAspectRatio]);

  // Load collections dynamically if collectionIds provided
  const loadCollections = useCallback(async () => {
    if (!collectionIds || collectionIds.length === 0) {
      setCollections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const collectionPromises = collectionIds.map((item) => {
        const id = typeof item === 'object' ? item.id : item;
        const inlineDef = typeof item === 'object' ? item : { id, name: '', imageUrl: '', headerBannerUrl: '' };
        
        if (inlineDef.name && inlineDef.imageUrl) {
          return Promise.resolve({
            id,
            title: inlineDef.name || inlineDef.title,
            name: inlineDef.name || inlineDef.title,
            imageUrl: inlineDef.imageUrl,
            headerBannerUrl: inlineDef.headerBannerUrl,
            link: inlineDef.link,
          } as CardCarouselGridItem);
        }

        return shopifyApi.getCollectionById(id).then((res) => ({
          id,
          title: inlineDef.name || res.title,
          name: inlineDef.name || res.title,
          imageUrl: inlineDef.imageUrl || res.image?.url || '',
          headerBannerUrl: inlineDef.headerBannerUrl,
          link: inlineDef.link,
        })).catch((err) => {
          console.error(`[CardCarouselGrid] Failed to fetch collection ${id}:`, err);
          return null;
        });
      });

      const results = await Promise.allSettled(collectionPromises);
      const validItems = results
        .map((res) => (res.status === 'fulfilled' ? res.value : null))
        .filter((item): item is CardCarouselGridItem => item !== null);

      setCollections(validItems);
    } catch (err) {
      console.error('[CardCarouselGrid] Error fetching collection details:', err);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [collectionIds]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // Combine items from either inlineData or fetched collections
  const rawItems = useMemo(() => {
    if (inlineData && inlineData.length > 0) {
      return inlineData;
    }
    return collections;
  }, [inlineData, collections]);

  // Group items into cards (each card contains 4 items for the bottom 2x2 grid)
  const cardsData = useMemo(() => {
    if (!rawItems.length) return [];
    const grouped: CardCarouselGridItem[][] = [];
    for (let i = 0; i < rawItems.length; i += itemsPerCard) {
      grouped.push(rawItems.slice(i, i + itemsPerCard));
    }
    return grouped;
  }, [rawItems, itemsPerCard]);

  // Title style processing
  const titleStyle = useMemo(
    () => ({
      ...styles.sectionTitle,
      paddingHorizontal,
      ...processFontStyle(blockStyles?.title, Fonts.LexendBold),
    }),
    [blockStyles?.title, paddingHorizontal]
  );

  const handleCellPress = useCallback(
    (item: CardCarouselGridItem) => {
      if (!onPress) return;
      const collectionId = item.id?.includes('/') ? item.id.split('/').pop() || item.id : item.id;
      const route = item.link || (collectionId ? `/collections/${collectionId}` : undefined);
      onPress(route, item);
    },
    [onPress]
  );

  // Layout Calculations:
  // Top Header Image takes full cardWidth and top headerImageHeight (no top space/padding)
  const headerImageHeight = Math.floor(cardHeight * headerImageRatio);
  const bottomGridHeight = cardHeight - headerImageHeight - headerImageBottomMargin;

  // Bottom 2x2 grid cell calculations inside bottomGridHeight
  const availableGridWidth = cardWidth - gridPadding * 2;
  
  const cellWidth = Math.floor((availableGridWidth - gridGap * (gridCols - 1)) / gridCols);
  const labelHeight = showCellLabels ? 20 : 0;
  const cellTotalHeight = Math.floor((bottomGridHeight - gridPadding * 2 - 48 - gridGap * (gridRows - 1)) / gridRows); // 48px for see all button + margin
  const cellImageHeight = Math.max(20, cellTotalHeight - labelHeight);

  const renderCard: ListRenderItem<CardCarouselGridItem[]> = useCallback(
    ({ item: cardGridItems, index }) => {
      const isLast = index === cardsData.length - 1;
      const gradientColors = GRADIENT_PALETTES[index % GRADIENT_PALETTES.length];
      const cardLayoutType = cardLayoutTypes[index] || 'grid';

      // Top image URL preference: item's headerBannerUrl -> first item's imageUrl -> default fallback image
      const topBannerUrl =
        cardGridItems[0]?.headerBannerUrl ||
        carouselGridConfig.defaultHeaderImageUrl ||
        cardGridItems[0]?.imageUrl;

      // Vertical Row Layout
      if (cardLayoutType === 'verticalRow') {
        const rowHeight = Math.floor((bottomGridHeight - gridPadding * 2 - 48) / cardGridItems.length);

        return (
          <View
            style={[
              styles.cardWrapper,
              {
                width: cardWidth,
                height: cardHeight,
                marginRight: isLast ? 0 : cardGap,
                borderRadius,
              },
            ]}
          >
            <LinearGradient
              colors={useRandomGradient ? gradientColors : ['#FFFFFF', '#FFFFFF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.cardContainer,
                {
                  width: cardWidth,
                  height: cardHeight,
                  borderRadius,
                },
                blockStyles?.card,
              ]}
            >
              {/* Top Image */}
              <TouchableOpacity
                activeOpacity={0.9}
                disabled={!cardGridItems[0]}
                onPress={() => cardGridItems[0] && handleCellPress(cardGridItems[0])}
                style={[
                  styles.topImageContainer,
                  {
                    width: cardWidth,
                    height: headerImageHeight,
                    borderTopLeftRadius: borderRadius,
                    borderTopRightRadius: borderRadius,
                    marginBottom: headerImageBottomMargin,
                  },
                ]}
              >
                {topBannerUrl ? (
                  <OptimizedImage
                    source={{ uri: shopifyImageUrl(topBannerUrl, Math.round(cardWidth * 2)) }}
                    style={[
                      styles.topImage,
                      {
                        width: cardWidth,
                        height: headerImageHeight,
                        borderTopLeftRadius: borderRadius,
                        borderTopRightRadius: borderRadius,
                      },
                    ]}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <View style={[styles.topImagePlaceholder, { height: headerImageHeight }]} />
                )}
              </TouchableOpacity>

              {/* Vertical Row List */}
              <View
                style={[
                  styles.verticalRowContainer,
                  {
                    width: cardWidth,
                    height: bottomGridHeight,
                    padding: gridPadding,
                    borderBottomLeftRadius: borderRadius,
                  },
                ]}
              >
                {cardGridItems.map((cellItem, cellIdx) => {
                  const itemName = cellItem.name || cellItem.title || '';
                  return (
                    <TouchableOpacity
                      key={cellItem.id || `cell-${cellIdx}`}
                      activeOpacity={0.85}
                      onPress={() => handleCellPress(cellItem)}
                      style={[
                        styles.verticalRowItem,
                        {
                          height: rowHeight,
                        },
                      ]}
                    >
                      {/* Small square image */}
                      <View style={styles.verticalRowImageWrapper}>
                        {cellItem.imageUrl ? (
                          <OptimizedImage
                            source={{ uri: shopifyImageUrl(cellItem.imageUrl, 60) }}
                            style={styles.verticalRowImage}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={styles.verticalRowImagePlaceholder} />
                        )}
                      </View>

                      {/* Product name */}
                      <View style={styles.verticalRowInfo}>
                        <Text
                          style={[
                            styles.verticalRowName,
                            useRandomGradient ? styles.whiteText : null,
                          ]}
                          numberOfLines={2}
                        >
                          {itemName}
                        </Text>
                      </View>

                      {/* Add to cart button */}
                      <TouchableOpacity
                        style={[
                          styles.verticalRowAddButton,
                          useRandomGradient ? styles.verticalRowAddButtonGradient : null,
                        ]}
                        onPress={() => {
                          console.log('Add to cart:', cellItem.id);
                        }}
                      >
                        <Text style={styles.verticalRowAddText}>+</Text>
                      </TouchableOpacity>

                      {/* Price */}
                      <View style={styles.verticalRowPrice}>
                        <Text
                          style={[
                            styles.verticalRowPriceText,
                            useRandomGradient ? styles.whiteText : null,
                          ]}
                        >
                          ₹
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* See All Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleCellPress(cardGridItems[0])}
                style={[
                  styles.seeAllButtonAbsolute,
                  {
                    width: cardWidth,
                    borderBottomLeftRadius: borderRadius,
                    borderBottomRightRadius: borderRadius,
                  },
                ]}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.seeAllButtonGradient}
                >
                  <Text style={styles.seeAllButtonText}>See all</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        );
      }

      // Default Grid Layout
      return (
        <View
          style={[
            styles.cardWrapper,
            {
              width: cardWidth,
              height: cardHeight,
              marginRight: isLast ? 0 : cardGap,
              borderRadius,
            },
          ]}
        >
          <LinearGradient
            colors={useRandomGradient ? gradientColors : ['#FFFFFF', '#FFFFFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.cardContainer,
              {
                width: cardWidth,
                height: cardHeight,
                borderRadius,
              },
              blockStyles?.card,
            ]}
          >
            {/* Top Image expanding to full width with zero top spacing */}
            <TouchableOpacity
              activeOpacity={0.9}
              disabled={!cardGridItems[0]}
              onPress={() => cardGridItems[0] && handleCellPress(cardGridItems[0])}
              style={[
                styles.topImageContainer,
                {
                  width: cardWidth,
                  height: headerImageHeight,
                  borderTopLeftRadius: borderRadius,
                  borderTopRightRadius: borderRadius,
                  marginBottom: headerImageBottomMargin,
                },
              ]}
            >
              {topBannerUrl ? (
                <OptimizedImage
                  source={{ uri: shopifyImageUrl(topBannerUrl, Math.round(cardWidth * 2)) }}
                  style={[
                    styles.topImage,
                    {
                      width: cardWidth,
                      height: headerImageHeight,
                      borderTopLeftRadius: borderRadius,
                      borderTopRightRadius: borderRadius,
                    },
                  ]}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <View style={[styles.topImagePlaceholder, { height: headerImageHeight }]} />
              )}
            </TouchableOpacity>

            {/* Bottom 2x2 Grid Section */}
            <View
              style={[
                styles.bottomGridContainer,
                {
                  width: cardWidth,
                  height: bottomGridHeight,
                  padding: gridPadding,
                  borderBottomLeftRadius: borderRadius,
                  borderBottomRightRadius: borderRadius,
                },
              ]}
            >
              <View style={[styles.gridMatrix, { height: bottomGridHeight - gridPadding * 2 - 48, gap: gridGap }]}>
                {cardGridItems.map((cellItem, cellIdx) => {
                  const itemName = cellItem.name || cellItem.title || '';
                  return (
                    <TouchableOpacity
                      key={cellItem.id || `cell-${cellIdx}`}
                      activeOpacity={0.85}
                      onPress={() => handleCellPress(cellItem)}
                      style={[
                        styles.cellWrapper,
                        {
                          width: cellWidth,
                          height: cellTotalHeight,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.cellImageContainer,
                          {
                            width: cellWidth,
                            height: cellImageHeight,
                            borderRadius: cellBorderRadius,
                          },
                        ]}
                      >
                        {cellItem.imageUrl ? (
                          <OptimizedImage
                            source={{ uri: shopifyImageUrl(cellItem.imageUrl, Math.round(cellWidth * 2)) }}
                            style={[
                              styles.cellImage,
                              {
                                width: cellWidth,
                                height: cellImageHeight,
                                borderRadius: cellBorderRadius,
                              },
                            ]}
                            contentFit={imageContentFit}
                            transition={150}
                          />
                        ) : (
                          <View style={[styles.cellPlaceholder, { borderRadius: cellBorderRadius }]} />
                        )}
                      </View>
                      {showCellLabels && !!itemName && (
                        <Text
                          style={[
                            styles.cellLabel,
                            useRandomGradient ? styles.whiteText : null,
                            processFontStyle(blockStyles?.text, Fonts.Medium),
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {itemName}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* See All Button - Gradient Background - Outside container to span full width */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleCellPress(cardGridItems[0])}
              style={[
                styles.seeAllButtonAbsolute,
                {
                  width: cardWidth,
                  borderBottomLeftRadius: borderRadius,
                  borderBottomRightRadius: borderRadius,
                },
              ]}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.seeAllButtonGradient}
              >
                <Text style={styles.seeAllButtonText}>See all</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      );
    },
    [
      cardsData.length,
      useRandomGradient,
      carouselGridConfig.defaultHeaderImageUrl,
      cardWidth,
      cardHeight,
      cardGap,
      borderRadius,
      blockStyles,
      headerImageHeight,
      handleCellPress,
      bottomGridHeight,
      gridPadding,
      gridGap,
      cellWidth,
      cellTotalHeight,
      cellImageHeight,
      cellBorderRadius,
      imageContentFit,
      showCellLabels,
    ]
  );

  const keyExtractor = useCallback((_: any, index: number) => `card-${index}`, []);

  if (loading && !cardsData.length) {
    return (
      <BaseContentBlock block={block}>
        <View style={[styles.loadingContainer, { paddingHorizontal }]}>
          {!!title?.trim() && <Text style={titleStyle}>{title}</Text>}
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      </BaseContentBlock>
    );
  }

  if (!cardsData.length) {
    return null;
  }

  return (
    <BaseContentBlock block={block}>
      <View style={styles.container}>
        {!!title?.trim() && <Text style={titleStyle}>{title}</Text>}
        <FlatList
          data={cardsData}
          keyExtractor={keyExtractor}
          renderItem={renderCard}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + cardGap}
          decelerationRate="fast"
          bounces={true}
          contentContainerStyle={{
            paddingHorizontal,
            paddingVertical: 8,
          }}
        />
      </View>
    </BaseContentBlock>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    color: Colors.text,
    fontFamily: Fonts.LexendBold,
    marginBottom: 10,
  },
  cardWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  topImageContainer: {
    overflow: 'hidden',
    backgroundColor: '#EAEAEA',
  },
  topImage: {
    backgroundColor: 'transparent',
  },
  topImagePlaceholder: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  bottomGridContainer: {
    justifyContent: 'center',
  },
  gridMatrix: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'flex-start',
    width: '100%',
  },
  cellWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  cellImageContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cellImage: {
    backgroundColor: 'transparent',
  },
  cellPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  cellLabel: {
    fontSize: 11,
    color: Colors.text,
    fontFamily: Fonts.Medium,
    textAlign: 'center',
    marginTop: 2,
    width: '100%',
  },
  whiteText: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  seeAllButton: {
    width: '100%',
    marginTop: 8,
    marginBottom: -12, // Extend to touch bottom (matches gridPadding)
    overflow: 'hidden',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  seeAllButtonAbsolute: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    overflow: 'hidden',
  },
  seeAllButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllButtonText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.95)',
    fontFamily: Fonts.LexendBold,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  verticalRowContainer: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  verticalRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verticalRowImageWrapper: {
    width: 40,
    height: 40,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  verticalRowImage: {
    width: '100%',
    height: '100%',
  },
  verticalRowImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(200, 200, 200, 0.3)',
  },
  verticalRowInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  verticalRowName: {
    fontSize: 11,
    color: '#333333',
    fontFamily: Fonts.Medium,
  },
  verticalRowAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verticalRowAddButtonGradient: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  verticalRowAddText: {
    fontSize: 18,
    color: '#111111',
    fontFamily: Fonts.Bold,
    lineHeight: 18,
  },
  verticalRowPrice: {
    justifyContent: 'center',
  },
  verticalRowPriceText: {
    fontSize: 12,
    color: '#333333',
    fontFamily: Fonts.LexendBold,
    fontWeight: '700',
  },
});
