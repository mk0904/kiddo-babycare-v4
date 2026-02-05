import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// import { FlashList } from '@shopify/flash-list';
import { Colors, Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { shopifyApi } from '@/services/shopifyApi';
import { ImageGridBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { useRouter } from 'expo-router';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageGridProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: ImageGridBlock;
  onPress?: (link?: string, item?: any) => void;
}

interface CollectionItem {
  id: string;
  name: string;
  imageUrl: string;
}

export function ImageGrid({ block, onPress }: ImageGridProps) {
  const { data = [], title, collectionIds, gridConfig = {}, styles: blockStyles } = block;
  const { width } = useDeviceDimensions();
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  // Load collections (Kiddo pattern with Promise.allSettled)
  const loadCollections = useCallback(async () => {
    if (!collectionIds || collectionIds.length === 0) {
      setCollections([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Use Promise.allSettled instead of Promise.all to handle individual failures
      const collectionPromises = collectionIds.map((collection) =>
        shopifyApi.getCollectionById(
          typeof collection === 'object' ? collection.id : collection
        ).catch((error) => {
          console.error(`Error loading collection:`, error);
          return null; // Return null for failed requests
        })
      );

      const results = await Promise.allSettled(collectionPromises);

      const validCollections = results
        .map((result, index) => {
          if (result.status === 'fulfilled' && result.value !== null) {
            const collectionDef = typeof collectionIds[index] === 'object'
              ? collectionIds[index]
              : { id: collectionIds[index], name: '' };
            return {
              id: result.value.id,
              name: collectionDef.name || result.value.title,
              imageUrl: collectionDef.imageUrl || result.value.image?.url || '',
            };
          }
          return null;
        })
        .filter((col): col is CollectionItem => col !== null);

      setCollections(validCollections);
    } catch (error) {
      console.error('Error fetching collections:', error);
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [collectionIds]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // If it has collectionIds, render collection images grid (Kiddo pattern)
  if (collectionIds && collectionIds.length > 0) {
    // Get gridConfig values (with defaults matching Kiddo)
    const numColumns = gridConfig.numColumns ?? 3;
    const colGap = gridConfig.colGap ?? 0;
    const rowGap = gridConfig.rowGap ?? 0;
    const limit = gridConfig.limit ?? 0;
    const resizeMode = gridConfig.resizeMode || 'contain';
    const aspectRatio = gridConfig.aspectRatio ?? 1; // Default to square

    // Get styles from config (Kiddo pattern) - all properties from JSON
    // Default: no padding (can be overridden by config)
    const containerStyle = {
      marginVertical: 0,
      paddingHorizontal: 0,
      ...blockStyles?.container,
    };
    // Title should use container padding if set, otherwise 0
    const titleStyle = {
      marginBottom: 15,
      fontSize: 18,
      letterSpacing: 0,
      fontWeight: '900',
      // Apply container padding to title if not explicitly set in blockStyles.title
      paddingHorizontal: blockStyles?.title?.paddingHorizontal !== undefined
        ? blockStyles.title.paddingHorizontal
        : (containerStyle.paddingHorizontal || 0),
      ...processFontStyle(blockStyles?.title, Fonts.Black),
    };
    const imageContainerStyle = {
      padding: 0,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
      overflow: 'hidden' as const, // Changed from 'visible' to 'hidden' to prevent shadow cropping
      // Shadow styles removed - can be added via blockStyles?.imageContainer if needed
      ...blockStyles?.imageContainer,
    };
    const imageStyle = {
      width: '100%',
      borderRadius: 20,
      ...blockStyles?.image,
    };
    const textStyle = {
      color: '#666666',
      textAlign: 'center' as const,
      ...processFontStyle(blockStyles?.text),
    };

    // Calculate available width accounting for container margins and padding (Kiddo pattern)
    const containerMarginHorizontal = containerStyle.marginHorizontal || 0;
    const containerPaddingHorizontal = containerStyle.paddingHorizontal || 0;

    // Memoize itemWidth calculation for performance
    const itemWidth = useMemo(() => {
      // Container width after margins
      const containerWidth = width - (containerMarginHorizontal * 2);

      // Available width for items (container width minus padding)
      const availableWidth = containerWidth - (containerPaddingHorizontal * 2);

      return (availableWidth - colGap * (numColumns - 1)) / numColumns;
    }, [containerMarginHorizontal, containerPaddingHorizontal, colGap, numColumns, width]);

    // Calculate dynamic item height based on aspect ratio
    const itemHeight = useMemo(() => {
      return itemWidth / aspectRatio;
    }, [itemWidth, aspectRatio]);

    // Calculate estimated item size for FlashList
    const estimatedItemSize = useMemo(() => {
      return itemHeight + rowGap; // Use height, not width
    }, [itemHeight, rowGap]);

    const handleCollectionPress = (collection: CollectionItem) => {
      // Extract numeric ID from GID format (gid://shopify/Collection/123456)
      const collectionId = collection.id.includes('/')
        ? collection.id.split('/').pop() || collection.id
        : collection.id;
      const collectionPath = `/collections/${collectionId}`;
      onPress?.(collectionPath, collection);
    };

    // Extract backgroundImage from container styles
    const {
      backgroundImage,
      marginHorizontal: _mh,
      marginVertical: _mv,
      marginBottom: _mb,
      marginTop: _mt,
      marginLeft: _ml,
      marginRight: _mr,
      margin: _m,
      ...containerStylesClean
    } = containerStyle;

    const finalContainerStyle = [
      defaultStyles.container,
      containerStylesClean,
      { paddingHorizontal: 0 } // Override horizontal padding on wrapper
    ];

    // Get list content style
    const listContentStyle = [
      defaultStyles.listContent,
      blockStyles?.listContent,
    ];

    const handleImageError = useCallback((itemId: string) => {
      setImageErrors((prev) => ({
        ...prev,
        [itemId]: true,
      }));
    }, []);

    // Optimized keyExtractor - use stable IDs to prevent unnecessary re-renders
    const keyExtractor = useCallback((item: CollectionItem) => {
      return item.id || `collection-${item.name}`;
    }, []);

    const renderItem = useCallback(({ item, index }: { item: CollectionItem; index: number }) => {
      const isLastInRow = (index + 1) % numColumns === 0;
      const marginRight = isLastInRow ? 0 : colGap;

      // Extract padding from imageContainerStyle (can be number or object)
      // imageContainerStyle is an array, so we need to check the merged style
      const mergedImageContainerStyle = StyleSheet.flatten(imageContainerStyle);
      const imageContainerPadding = typeof mergedImageContainerStyle.padding === 'number'
        ? mergedImageContainerStyle.padding
        : (mergedImageContainerStyle.padding as any)?.horizontal ||
        (mergedImageContainerStyle.padding as any)?.vertical ||
        defaultStyles.imageContainer.padding ||
        0;

      // Calculate image size: itemWidth minus padding on both sides
      const imageWidthAvailable = itemWidth - (imageContainerPadding * 2);
      const imageHeightAvailable = itemHeight - (imageContainerPadding * 2);

      const hasImageError = imageErrors[item.id];
      const imageUrl = item.imageUrl;

      // Get image style with custom overrides - ensure image fits within container
      const finalImageStyle = [
        defaultStyles.image,
        imageStyle,
        {
          width: Math.max(0, imageWidthAvailable), // Ensure non-negative
          height: Math.max(0, imageHeightAvailable), // Ensure non-negative
        },
      ];

      return (
        <View
          style={[
            defaultStyles.itemWrapper,
            blockStyles?.itemWrapper,
            { width: itemWidth, marginRight }, // Removed marginBottom
          ]}
        >
          <TouchableOpacity
            style={[
              imageContainerStyle,
              {
                width: itemWidth,
                height: itemHeight,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
            onPress={() => handleCollectionPress(item)}
            activeOpacity={0.8}
          >
            {imageUrl && !hasImageError ? (
              <Image
                source={{ uri: imageUrl }}
                style={finalImageStyle}
                resizeMode={resizeMode}
                onError={() => handleImageError(item.id)}
              />
            ) : (
              <View
                style={[
                  defaultStyles.placeholder,
                  blockStyles?.placeholder,
                  {
                    width: Math.max(0, imageWidthAvailable),
                    height: Math.max(0, imageHeightAvailable)
                  },
                ]}
              />
            )}
          </TouchableOpacity>
          {item.name && (
            <Text
              style={[textStyle, { maxWidth: itemWidth }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>
          )}
        </View>
      );
    }, [itemWidth, itemHeight, colGap, numColumns, resizeMode, imageErrors, handleCollectionPress, imageContainerStyle, imageStyle, textStyle, blockStyles]);

    if (loading) {
      return (
        <BaseContentBlock block={block}>
          <View style={[finalContainerStyle, defaultStyles.loadingContainer]}>
            {title && (
              <Text style={[defaultStyles.title, titleStyle]}>{title}</Text>
            )}
            <ActivityIndicator size="large" color="#000" />
          </View>
        </BaseContentBlock>
      );
    }

    const limitedCollections = limit > 0 ? collections.slice(0, limit) : collections;

    const ContainerWrapper: React.ComponentType<any> = backgroundImage ? ImageBackground : View;
    const containerWrapperProps = backgroundImage
      ? {
        source: { uri: backgroundImage },
        style: finalContainerStyle,
        imageStyle: blockStyles?.container?.backgroundImageStyle || {},
        resizeMode: blockStyles?.container?.backgroundResizeMode || 'cover',
      }
      : { style: finalContainerStyle };

    return (
      <BaseContentBlock
        block={block}
        style={{
          padding: 0,
          paddingHorizontal: 0,
          paddingVertical: 0,
          paddingTop: 0,
          paddingBottom: 0
        }}
      >
        <ContainerWrapper {...containerWrapperProps}>
          {title && (
            <Text style={[defaultStyles.title, titleStyle]}>{title}</Text>
          )}
          <FlatList
            key={`flatlist-${numColumns}`}
            data={limitedCollections}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={numColumns}
            scrollEnabled={false}
            nestedScrollEnabled={true}
            ItemSeparatorComponent={() => <View style={{ height: rowGap }} />}
            contentContainerStyle={[
              {
                paddingHorizontal: containerPaddingHorizontal > 0 ? containerPaddingHorizontal : 0,
                paddingTop: 8, // Add top padding to prevent shadow clipping
                paddingBottom: 8, // Add bottom padding to prevent shadow clipping
                backgroundColor: Colors.backgroundWhite,
              },
              listContentStyle,
            ]}
            // Android performance optimizations (Standard FlatList)
            initialNumToRender={6}
            maxToRenderPerBatch={3}
            windowSize={3}
            removeClippedSubviews={true}
            updateCellsBatchingPeriod={100}
            viewabilityConfig={{
              itemVisiblePercentThreshold: 50,
              minimumViewTime: 100,
            }}
          />
        </ContainerWrapper>
      </BaseContentBlock>
    );
  }

  // Otherwise, render as image grid (legacy behavior)

  const numColumns = gridConfig.numColumns ?? 3;
  const colGap = gridConfig.colGap ?? 0;
  const rowGap = gridConfig.rowGap ?? 0;
  const resizeMode = gridConfig.resizeMode ?? 'contain';

  // Calculate item width
  const paddingHorizontal = blockStyles?.container?.paddingHorizontal || 20;
  const availableWidth = SCREEN_WIDTH - paddingHorizontal * 2;
  const totalGap = colGap * (numColumns - 1);
  const itemWidth = (availableWidth - totalGap) / numColumns;

  const handlePress = (item: any) => {
    onPress?.(item.link, item);
  };

  return (
    <BaseContentBlock block={block}>
      {title && (
        <Text style={[defaultStyles.title, processFontStyle(blockStyles?.title, Fonts.Black)]}>{title}</Text>
      )}
      <View
        style={[
          {
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: paddingHorizontal,
            columnGap: colGap,
            rowGap: rowGap,
          },
        ]}
      >
        {data.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              defaultStyles.itemWrapper,
              blockStyles?.imageContainer,
              {
                width: itemWidth,
                // Removed manual margins
              },
            ]}
            onPress={() => handlePress(item)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: item.imageUrl }}
              style={[
                defaultStyles.image,
                blockStyles?.image,
                { width: itemWidth - 20, height: itemWidth - 20 },
              ]}
              resizeMode={resizeMode}
            />
            {item.title && (
              <Text style={[defaultStyles.text, processFontStyle(blockStyles?.text)]}>
                {item.title}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </BaseContentBlock>
  );
}

const defaultStyles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.backgroundWhite,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.Black,
    fontWeight: '900',
    marginBottom: 15,
    letterSpacing: 0,
    color: Colors.text,
  },
  listContent: {
  },
  itemWrapper: {
    alignItems: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundWhite,
    borderRadius: 20,
    padding: 0,
    marginBottom: 8,
  },
  image: {
    borderRadius: 20,
  },
  placeholder: {
    backgroundColor: Colors.grey,
    borderRadius: 10,
  },
  text: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    color: Colors.textSecondary,
    paddingHorizontal: 0,
  },
});

