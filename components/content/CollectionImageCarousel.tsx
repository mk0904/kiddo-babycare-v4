import OptimizedImage from '@/components/ui/OptimizedImage';
import { Colors, Fonts } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import { CollectionImageCarouselBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { shopifyImageUrl } from '@/utils/shopifyIds';
import { ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  ListRenderItem,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface Props extends Omit<BaseContentBlockProps, 'onPress'> {
  block: CollectionImageCarouselBlock;
  onPress?: (link?: string, item?: any) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function CollectionImageCarousel({ block, onPress }: Props) {
  const { data = [], title, carouselConfig = {}, styles: blockStyles } = block;
  const itemWidth = carouselConfig.itemWidth ?? 148;
  const aspectRatio = carouselConfig.aspectRatio ?? 1.25;
  const imageContentFit = carouselConfig.imageContentFit ?? 'cover';
  const gap = carouselConfig.gap ?? 12;
  const borderRadius = carouselConfig.borderRadius ?? 14;
  const paddingHorizontal = carouselConfig.paddingHorizontal ?? 16;
  const contentPaddingHorizontal =
    carouselConfig.contentPaddingHorizontal ?? paddingHorizontal;

  const itemHeight =
    carouselConfig.itemHeight ?? itemWidth / aspectRatio;

  const [productsData, setProductsData] = useState<Map<string, any>>(new Map());

  // Fetch product data for items with productId
  useEffect(() => {
    const productIds = data
      .filter(item => item.productId)
      .map(item => item.productId);

    if (productIds.length === 0) return;

    const fetchProducts = async () => {
      const productsMap = new Map();
      
      for (const productId of productIds) {
        try {
          const product = await shopifyApi.getProductById(productId);
          if (product) {
            productsMap.set(productId, product);
          }
        } catch (error) {
          console.error('Error fetching product:', productId, error);
        }
      }
      
      setProductsData(productsMap);
    };

    fetchProducts();
  }, [data]);

  const titleStyle = React.useMemo(
    () => ({
      ...styles.title,
      ...processFontStyle(blockStyles?.title, Fonts.LexendBold),
    }),
    [blockStyles?.title],
  );

  const handlePress = useCallback(
    (item: CollectionImageCarouselBlock['data'][0]) => {
      if (!onPress) return;
      const payload = {
        collectionId: item.collectionId,
        productId: item.productId,
        title: item.title ?? '',
        collectionName: item.title,
        label: item.title,
      };
      if (item.link) {
        onPress(item.link, payload);
      } else {
        onPress(undefined, payload);
      }
    },
    [onPress],
  );

  const renderItem: ListRenderItem<CollectionImageCarouselBlock['data'][0]> =
    useCallback(
      ({ item }) => {
        const product = item.productId ? productsData.get(item.productId) : null;
        const isProduct = !!product;
        const isVideo = item.imageUrl?.includes('.mp4') || item.imageUrl?.includes('.mov');

        return (
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handlePress(item)}
            style={[
              styles.slide,
              {
                width: itemWidth,
                marginRight: gap,
                borderRadius,
              },
              blockStyles?.item,
            ]}
          >
            {isVideo ? (
              <Video
                source={{ uri: item.imageUrl }}
                style={[
                  {
                    width: itemWidth,
                    height: itemHeight,
                    borderRadius,
                    backgroundColor: '#000',
                  },
                  blockStyles?.image,
                ]}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted
                useNativeControls={false}
              />
            ) : (
              <OptimizedImage
                source={{ uri: shopifyImageUrl(item.imageUrl, Math.round(itemWidth * 2)) }}
                style={[
                  {
                    width: itemWidth,
                    height: itemHeight,
                    borderRadius,
                    backgroundColor: 'transparent',
                  },
                  blockStyles?.image,
                ]}
                contentFit={imageContentFit}
                transition={0}
              />
            )}
            {isProduct && (
              <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {product.title}
                </Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.productPrice}>
                    {product.priceRange?.minVariantPrice?.amount 
                      ? `₹${Math.round(product.priceRange.minVariantPrice.amount)}`
                      : ''}
                  </Text>
                  {product.variants?.edges?.[0]?.node?.compareAtPrice?.amount && (
                    <Text style={styles.compareAtPrice}>
                      ₹{Math.round(product.variants.edges[0].node.compareAtPrice.amount)}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </TouchableOpacity>
        );
      },
      [
        blockStyles?.image,
        blockStyles?.item,
        borderRadius,
        gap,
        handlePress,
        imageContentFit,
        itemHeight,
        itemWidth,
        productsData,
      ],
    );

  const keyExtractor = useCallback(
    (item: CollectionImageCarouselBlock['data'][0]) => item.id,
    [],
  );

  if (!data.length) {
    return null;
  }

  return (
    <BaseContentBlock block={block}>
      <View style={styles.inner}>
        {!!title?.trim() && (
          <Text style={titleStyle}>{title}</Text>
        )}
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{
            paddingHorizontal: contentPaddingHorizontal,
            paddingVertical: 4,
          }}
        />
      </View>
    </BaseContentBlock>
  );
}

const styles = StyleSheet.create({
  inner: {
    width: SCREEN_WIDTH,
  },
  title: {
    fontSize: 15,
    color: Colors.text,
    fontFamily: Fonts.LexendBold,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  slide: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  productInfo: {
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  productTitle: {
    fontSize: 12,
    color: Colors.text,
    fontFamily: Fonts.LexendMedium,
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productPrice: {
    fontSize: 13,
    color: Colors.text,
    fontFamily: Fonts.LexendBold,
  },
  compareAtPrice: {
    fontSize: 11,
    color: '#999',
    fontFamily: Fonts.LexendRegular,
    textDecorationLine: 'line-through',
  },
});
