// Block Renderer - Renders blocks from config (similar to gauntlet's ConfigRenderer)
import { ContentBlock } from '@/types/content';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AnnouncementCarousel } from './AnnouncementCarousel';
import { BaseModal } from './BaseModal';
import { CategoryGrid } from './CategoryGrid';
import { CollectionImageCarousel } from './CollectionImageCarousel';
import { CollectionList } from './CollectionList';
import { FeatureStrip } from './FeatureStrip';
import { FlashSaleTimer } from './FlashSaleTimer';
import { ImageBanner } from './ImageBanner';
import { ImageCarousel } from './ImageCarousel';
import { ImageGrid } from './ImageGrid';
import { ImageList } from './ImageList';
import { InfiniteProductGrid } from './InfiniteProductGrid';
import { NoInternet } from './NoInternet';
import { PromoCarousel } from './PromoCarousel';
import { SearchProductList } from './SearchProductList';
import { VideoBanner } from './VideoBanner';
import { VisualCategoryRail } from './VisualCategoryRail';

import { CardCarouselGrid } from './CardCarouselGrid';

interface BlockRendererProps {
  blocks: ContentBlock[];
  onBlockPress?: (block: ContentBlock, link?: string, item?: any) => void;
  searchQuery?: string;
  /** Spacing between blocks (default 4). Use 0 for tighter layout (e.g. ticketing). */
  blockSpacing?: number;
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
  categoryGrid: CategoryGrid,
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
  rail: VisualCategoryRail,
  collectionImageCarousel: CollectionImageCarousel,
  cardCarouselGrid: CardCarouselGrid,
  flashSale: FlashSaleTimer,
  featureStrip: FeatureStrip,
  videoBanner: VideoBanner,
};

export function BlockRenderer({ blocks, onBlockPress, searchQuery, blockSpacing = 4 }: BlockRendererProps) {
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
      {visibleBlocks.map((block, index) => {
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

        // Add consistent spacing between blocks (except for the last one)
        const isLastBlock = index === visibleBlocks.length - 1;
        const blockWrapperStyle = !isLastBlock ? { marginBottom: blockSpacing } : undefined;

        // Keys must be unique; config sometimes repeats block.id — index disambiguates.
        const blockKey = block.id != null && String(block.id) !== '' ? `${block.id}-${index}` : `block-${index}`;
        return (
          <View key={blockKey} style={blockWrapperStyle}>
            <Component {...props} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  blockSpacing: {
    marginBottom: 0,
  },
});

