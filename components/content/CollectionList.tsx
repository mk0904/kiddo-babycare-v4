import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { CollectionListBlock } from '@/types/content';
import { useRouter } from 'expo-router';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CollectionListProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: CollectionListBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function CollectionList({ block, onPress }: CollectionListProps) {
  const router = useRouter();
  const { width } = useDeviceDimensions();
  const {
    data = [],
    title,
    collectionListConfig = {},
    styles: blockStyles,
  } = block;

  const itemsPerRow = collectionListConfig.itemsPerRow ?? 2;
  const roundness = collectionListConfig.roundness ?? 0;
  const paddingHorizontal = blockStyles?.container?.paddingHorizontal || 16;
  const itemGap = blockStyles?.list?.itemGap || 16;

  // Calculate item width
  const availableWidth = width - paddingHorizontal * 2;
  const totalGap = itemGap * (itemsPerRow - 1);
  const itemWidth = (availableWidth - totalGap) / itemsPerRow;

  const handlePress = (item: any) => {
    if (item.link) {
      onPress?.(item.link, item);
    } else if (item.collectionId) {
      onPress?.(`/collections/${item.collectionId}`, item);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isLastInRow = (index + 1) % itemsPerRow === 0;
    const isFirstInRow = index % itemsPerRow === 0;

    return (
      <TouchableOpacity
        onPress={() => handlePress(item)}
        style={[
          styles.itemContainer,
          {
            width: itemWidth,
            marginRight: isLastInRow ? 0 : itemGap,
            marginBottom: itemGap,
          },
          blockStyles?.item?.root,
        ]}
        activeOpacity={0.8}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image }}
            style={[
              styles.image,
              { borderRadius: roundness },
              blockStyles?.item?.image,
            ]}
            resizeMode="cover"
          />
        </View>
        {item.collectionName && (
          <View style={[styles.nameContainer, blockStyles?.item?.nameContainer]}>
            <Text
              style={[styles.nameText, blockStyles?.item?.nameText]}
              numberOfLines={1}
            >
              {item.collectionName}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (data.length === 0) return null;

  return (
    <BaseContentBlock block={block}>
      <View style={[styles.container, blockStyles?.container]}>
        {title && (
          <Text style={[styles.title, blockStyles?.title]}>{title}</Text>
        )}
        <FlatList
          data={data}
          numColumns={itemsPerRow}
          keyExtractor={(item, index) =>
            `${item.collectionId || item.collectionName || index}`
          }
          renderItem={renderItem}
          scrollEnabled={false}
          nestedScrollEnabled={false}
          contentContainerStyle={[
            styles.listContainer,
            {
              paddingHorizontal: paddingHorizontal,
            },
            blockStyles?.list?.contentContainer,
          ]}
          columnWrapperStyle={
            itemsPerRow > 1
              ? {
                justifyContent: 'space-between',
                marginBottom: itemGap,
              }
              : undefined
          }
        />
      </View>
    </BaseContentBlock>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  listContainer: {
    paddingVertical: 8,
  },
  itemContainer: {
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  nameContainer: {
    width: '100%',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
});

