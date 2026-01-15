import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { AnnouncementCarouselBlock } from '@/types/content';
import { useRouter } from 'expo-router';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { processFontStyle } from '@/utils/fontUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnnouncementCarouselProps extends BaseContentBlockProps {
  block: AnnouncementCarouselBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function AnnouncementCarousel({
  block,
  onPress,
}: AnnouncementCarouselProps) {
  const router = useRouter();
  const { width } = useDeviceDimensions();
  const flatListRef = useRef<FlatList>(null);
  const scrollEndTimeout = useRef<NodeJS.Timeout | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data = [], announcementConfig = {}, styles: blockStyles } = block;
  const items = data.filter((item) => !item.hidden);
  const totalItems = items.length;

  // If only one item, render as strip (no carousel)
  if (totalItems === 1) {
    const item = items[0];
    const handlePress = () => {
      if (item.link) {
        onPress?.(item.link, item);
        router.push(item.link);
      }
    };

    return (
      <BaseContentBlock block={block}>
        <Pressable
          onPress={handlePress}
          style={[styles.stripContainer, blockStyles?.root]}
        >
          {announcementConfig.icon !== false && (
            <View style={styles.iconContainer}>
              <View style={[styles.icon, blockStyles?.icon]} />
            </View>
          )}
          <Text style={[styles.stripText, processFontStyle(blockStyles?.text)]}>
            {item.text}
          </Text>
        </Pressable>
      </BaseContentBlock>
    );
  }

  // Multiple items - render as infinite carousel
  const loopedItems = [...items, ...items, ...items];
  const autoPlay = announcementConfig.autoPlay ?? true;
  const autoPlayInterval = announcementConfig.autoPlayInterval ?? 3000;
  const contentWidth = width - (blockStyles?.root?.paddingLeft || 0) * 2;

  // Jump to the start of the middle set
  useEffect(() => {
    if (flatListRef.current && totalItems > 0) {
      flatListRef.current.scrollToIndex({ index: totalItems, animated: false });
      setCurrentIndex(totalItems);
    }
  }, [totalItems]);

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || totalItems <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= loopedItems.length - totalItems) {
          // Reset to middle set
          flatListRef.current?.scrollToIndex({
            index: totalItems,
            animated: false,
          });
          return totalItems;
        }
        flatListRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        return nextIndex;
      });
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, totalItems, loopedItems.length]);

  const handleScroll = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / contentWidth);
      setCurrentIndex(index);
    },
    [contentWidth]
  );

  const scrollToIndexFallback = useCallback(
    ({ index }: { index: number }) => {
      const fallbackIndex =
        index < totalItems
          ? index + totalItems
          : index >= totalItems * 2
          ? index - totalItems
          : totalItems;
      flatListRef.current?.scrollToOffset({
        offset: fallbackIndex * contentWidth,
        animated: false,
      });
    },
    [totalItems, contentWidth]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const handlePress = () => {
        if (item.link) {
          onPress?.(item.link, item);
          router.push(item.link);
        }
      };

      return (
        <Pressable
          onPress={handlePress}
          style={[
            styles.itemContainer,
            blockStyles?.item?.root,
            { width: contentWidth },
          ]}
        >
          {announcementConfig.icon !== false && (
            <View style={styles.iconContainer}>
              <View style={[styles.icon, blockStyles?.icon]} />
            </View>
          )}
          <Text style={[styles.itemText, blockStyles?.item?.text]}>
            {item.text}
          </Text>
        </Pressable>
      );
    },
    [contentWidth, announcementConfig.icon, blockStyles, onPress, router]
  );

  if (totalItems === 0) return null;

  return (
    <BaseContentBlock block={block}>
      <View style={[styles.container, blockStyles?.root]}>
        <FlatList
          ref={flatListRef}
          data={loopedItems}
          keyExtractor={(_, index) => index.toString()}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          scrollEnabled={totalItems > 1}
          snapToInterval={contentWidth}
          initialScrollIndex={totalItems}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollToIndexFailed={scrollToIndexFallback}
          showsHorizontalScrollIndicator={false}
          renderItem={renderItem}
          getItemLayout={(_, index) => ({
            length: contentWidth,
            offset: contentWidth * index,
            index,
          })}
        />
      </View>
    </BaseContentBlock>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  stripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  iconContainer: {
    marginRight: 8,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000',
  },
  stripText: {
    fontSize: 12,
    lineHeight: 14,
    textAlign: 'center',
    color: '#000',
  },
  itemText: {
    fontSize: 12,
    lineHeight: 14,
    textAlign: 'center',
    color: '#000',
    flex: 1,
  },
});

