import OptimizedImage from '@/components/ui/OptimizedImage';
import { Colors, Fonts } from '@/constants/theme';
import { CollectionImageCarouselBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import React, { useCallback } from 'react';
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
      ({ item }) => (
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
          <OptimizedImage
            source={{ uri: item.imageUrl }}
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
            transition={200}
          />
        </TouchableOpacity>
      ),
      [
        blockStyles?.image,
        blockStyles?.item,
        borderRadius,
        gap,
        handlePress,
        imageContentFit,
        itemHeight,
        itemWidth,
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
});
