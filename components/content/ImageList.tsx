import { Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { ImageListBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity
} from 'react-native';
import { ProductList } from '../product/ProductList';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageListProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: ImageListBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function ImageList({ block, onPress }: ImageListProps) {
  const { data = [], title, collectionIds, listConfig = {}, productListConfig = {}, styles: blockStyles } = block;
  const { width } = useDeviceDimensions();
  const router = useRouter();

  // Check if data items have collectionId/collectionName (CollectionList format)
  const isCollectionList = React.useMemo(() => {
    return data.length > 0 && data.some(
      (item: any) => item.collectionId || item.collectionName
    );
  }, [data]);

  // If it's a collection list, render as CollectionList
  if (isCollectionList) {
    const collectionListBlock = {
      ...block,
      type: 'collectionList' as const,
      data: data.map((item: any) => ({
        collectionId: item.collectionId || item.id,
        collectionName: item.collectionName || item.title,
        image: item.imageUrl || item.image,
        link: item.link,
      })),
      collectionListConfig: {
        itemsPerRow: listConfig.itemsPerView || 2,
        ...listConfig,
      },
    };

    // Import and use CollectionList component
    const { CollectionList } = require('./CollectionList');
    return <CollectionList block={collectionListBlock} onPress={onPress} />;
  }

  // If it has collectionIds, it's a product list - use ProductList component
  if (collectionIds && collectionIds.length > 0) {
    // Extract collection IDs (support both string and object formats)
    const ids = collectionIds.map((id) =>
      typeof id === 'object' ? id?.id : id
    ).filter(Boolean) as string[];

    // Extract container styles to separate padding/margins
    const containerStyle = blockStyles?.container || {};
    const {
      paddingHorizontal: _ph,
      padding: _p,
      paddingLeft: _pl,
      paddingRight: _pr,
      ...containerStylesNoPadding
    } = containerStyle;

    const sidePadding = containerStyle.paddingHorizontal ?? 20;

    // marginTop/paddingTop on `title` only shifted the label, not "View All" — move to the whole header row
    const rawTitle = blockStyles?.title || {};
    const {
      marginTop: titleMarginTop,
      paddingTop: titlePaddingTop,
      ...titleRest
    } = rawTitle;
    const titleStyle = processFontStyle(titleRest, Fonts.Black);
    const headerFromTitle: Record<string, unknown> = {
      ...(titleMarginTop !== undefined && { marginTop: titleMarginTop }),
      ...(titlePaddingTop !== undefined && { paddingTop: titlePaddingTop }),
      ...(blockStyles?.titleContainer as object),
    };

    // Config often sets titleContainer.marginBottom: 0 — restore gap below title + View All (matches category grid ~16px)
    const hasViewAllRow = !!title && !!productListConfig.showSeeAll;
    if (hasViewAllRow) {
      const mb = headerFromTitle.marginBottom as number | undefined;
      const MIN_BELOW_TITLE = 16;
      if (mb === undefined || mb === 0) {
        headerFromTitle.marginBottom = MIN_BELOW_TITLE;
      } else if (typeof mb === 'number' && mb > 0 && mb < MIN_BELOW_TITLE) {
        headerFromTitle.marginBottom = MIN_BELOW_TITLE;
      }
    }

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
        <ProductList
          collectionId={ids.length === 1 ? ids[0] : ids}
          title={title}
          showHeading={!!title}
          showViewAll={productListConfig.showSeeAll || false}
          viewAllText={productListConfig.seeAllText || 'See All'}
          onViewAll={ids.length > 0 ? () => {
            // Navigate to collection screen when "See All" is clicked
            const firstCollectionId = ids[0];
            if (firstCollectionId) {
              router.push({
                pathname: '/infinity/[collectionId]',
                params: { 
                  collectionId: firstCollectionId,
                  title: title || ''
                }
              } as any);
            }
          } : undefined}
          style={{
            root: containerStylesNoPadding, // Pass margins but no padding
            header: headerFromTitle,
            title: titleStyle,
            list: blockStyles?.list,
          }}
          contentWidth={width - (sidePadding * 2)}
          productOptions={{
            horizontal: true,
            itemsPerView: productListConfig.itemsPerView || listConfig.itemsPerView || 2,
            sidePadding: sidePadding,
            ...productListConfig,
          }}
          limit={productListConfig.limit || listConfig.limit}
        />
      </BaseContentBlock>
    );
  }

  // Otherwise, render as image list (legacy behavior)
  const config = productListConfig.limit !== undefined ? productListConfig : listConfig;
  const itemsPerView = config.itemsPerView ?? 1.5;
  const resizeMode = listConfig.resizeMode ?? 'cover';
  const limit = config.limit;

  // Calculate item width
  const paddingHorizontal = blockStyles?.container?.paddingHorizontal ?? 20;
  const availableWidth = SCREEN_WIDTH - paddingHorizontal * 2;
  const itemWidth = availableWidth / itemsPerView - 10;

  const displayData = limit ? data.slice(0, limit) : data;

  const handlePress = (item: any) => {
    onPress?.(item.link, item);
  };

  return (
    <BaseContentBlock block={block} style={{ paddingHorizontal: 0 }}>
      {title && (
        <Text style={[styles.title, processFontStyle(blockStyles?.title, Fonts.Black)]}>{title}</Text>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContainer,
          { paddingHorizontal: paddingHorizontal },
        ]}
      >
        {displayData.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.listItem,
              blockStyles?.imageContainer,
              {
                width: itemWidth,
                marginRight: index < displayData.length - 1 ? 10 : 0,
              },
            ]}
            onPress={() => handlePress(item)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: item.imageUrl }}
              style={[
                styles.image,
                blockStyles?.image,
                { width: itemWidth, height: itemWidth * 1.2 },
              ]}
              resizeMode={resizeMode}
            />
            {item.title && (
              <Text style={[styles.itemTitle, processFontStyle(blockStyles?.text)]} numberOfLines={2}>
                {item.title}
              </Text>
            )}
            {item.subtitle && (
              <Text style={[styles.itemSubtitle, blockStyles?.subtitle]} numberOfLines={1}>
                {item.subtitle}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </BaseContentBlock>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontFamily: Fonts.Black,
    fontWeight: '900',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingVertical: 4,
  },
  listItem: {
    marginRight: 10,
  },
  image: {
    borderRadius: 12,
  },
  itemTitle: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: Fonts.SemiBold,
    color: '#363636', // Colors.text
  },
  itemSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#9197a6', // Colors.textSecondary
  },
});

