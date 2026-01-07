// Block Renderer - Renders blocks from config (similar to gauntlet's ConfigRenderer)
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ContentBlock } from '@/types/content';
import { ImageBanner } from './ImageBanner';
import { ImageCarousel } from './ImageCarousel';
import { ImageGrid } from './ImageGrid';
import { ImageList } from './ImageList';
import { InfiniteProductGrid } from './InfiniteProductGrid';
import { BaseModal } from './BaseModal';
import { AnnouncementCarousel } from './AnnouncementCarousel';
import { PromoCarousel } from './PromoCarousel';
import { SearchProductList } from './SearchProductList';
import { CollectionList } from './CollectionList';
import { NoInternet } from './NoInternet';
import { VisualCategoryRail } from './VisualCategoryRail';
import { FlashSaleTimer } from './FlashSaleTimer';
import { FeatureStrip } from './FeatureStrip';
import { VideoBanner } from './VideoBanner';

interface BlockRendererProps {
  blocks: ContentBlock[];
  onBlockPress?: (block: ContentBlock, link?: string, item?: any) => void;
  searchQuery?: string;
}

// Component map - similar to gauntlet's component registry
const blockComponentMap: Record<
  string,
  React.ComponentType<any>
> = {
  banner: ImageBanner,
  imageBanner: ImageBanner,
  carousel: ImageCarousel,
  grid: ImageGrid,
  list: ImageList,
  horizontalProductList: ImageList,
  collectionList: CollectionList,
  infiniteProductGrid: InfiniteProductGrid,
  modal: BaseModal,
  announcementCarousel: AnnouncementCarousel,
  announcementStrip: AnnouncementCarousel,
  promoCarousel: PromoCarousel,
  searchProductList: SearchProductList,
  noInternet: NoInternet,
  categoryRail: VisualCategoryRail,
  flashSale: FlashSaleTimer,
  featureStrip: FeatureStrip,
  videoBanner: VideoBanner,
};

export function BlockRenderer({ blocks, onBlockPress, searchQuery }: BlockRendererProps) {
  const handlePress = (block: ContentBlock, link?: string, item?: any) => {
    onBlockPress?.(block, link, item);
  };

  // Filter visible blocks and sort by order
  const visibleBlocks = React.useMemo(() => {
    return blocks
      .filter((block) => block.visible !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [blocks]);

  return (
    <View style={styles.container}>
      {visibleBlocks.map((block) => {
        const Component = blockComponentMap[block.type];

        if (!Component) {
          console.warn(`[BlockRenderer] Unknown block type: ${block.type}`);
          return null;
        }

        // Pass searchQuery to SearchProductList
        const props: any = {
          block,
          onPress: (link?: string, item?: any) => handlePress(block, link, item),
        };

        if (block.type === 'searchProductList') {
          props.searchQuery = searchQuery;
        }

        // Key must be passed directly, not through spread
        return <Component key={block.id} {...props} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});

