import { Carousel } from '@/components/ui/Carousel';
import { analyticsService } from '@/services/analyticsService';
import { ImageCarouselBlock } from '@/types/content';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface ImageCarouselProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: ImageCarouselBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function ImageCarousel({ block, onPress }: ImageCarouselProps) {
  const { data, carouselConfig = {}, styles: blockStyles } = block;
  const insets = useSafeAreaInsets();

  // Prevent overlap: adjust negative marginTop based on safe area to ensure minimum 2px gap
  const originalMarginTop = blockStyles?.container?.marginTop ?? 0;
  let adjustedMarginTop = originalMarginTop;
  
  if (originalMarginTop < 0) {
    // Base safe area is ~20px, larger devices (notch) have ~44px+
    // Adjust negative margin to prevent overlap while maintaining 2px gap
    const baseSafeArea = 20;
    const safeAreaDiff = Math.max(0, insets.top - baseSafeArea);
    // Reduce negative margin for larger safe areas to prevent overlap
    adjustedMarginTop = originalMarginTop + (safeAreaDiff * 0.3);
    // Ensure we maintain at least 2px gap (don't make it too negative)
    const maxNegativeMargin = -(insets.top + 60) + 2; // Header height + 2px gap
    adjustedMarginTop = Math.max(adjustedMarginTop, maxNegativeMargin);
  }

  // Handle both string array and object array formats
  const carouselData = data.map((item, index) => {
    if (typeof item === 'string') {
      return {
        imageUrl: item,
        title: undefined,
        subtitle: undefined,
        link: undefined,
        id: `carousel-item-${index}`,
      };
    }
    return {
      imageUrl: item.imageUrl,
      title: item.title,
      subtitle: item.subtitle,
      link: item.link,
      id: item.imageUrl || `carousel-item-${index}`,
    };
  });

  // Firebase Ecommerce Tracking - View Promotion
  useEffect(() => {
    if (carouselData.length > 0) {
      analyticsService.track('view_promotion', {
        promotion_id: block.id || 'image_carousel',
        promotion_name: block.id || 'Image Carousel',
        items: [],
      });
    }
  }, [carouselData.length, block.id]);

  // Horizontal padding on `styles.container` is consumed by Carousel for slide insets.
  // BaseContentBlock also applies `styles.container`, which would double the inset — strip
  // horizontal padding from the outer wrapper only.
  const container = blockStyles?.container || {};
  const {
    paddingHorizontal: _outerPh,
    paddingLeft: _outerPl,
    paddingRight: _outerPr,
    ...containerForOuter
  } = container;

  const outerBlock: ImageCarouselBlock = {
    ...block,
    styles: {
      ...block.styles,
      container: containerForOuter,
    },
  };

  const handleItemPress = (link?: string | any) => {
    if (link) {
      // Handle object format links (e.g., { type: "collection", collection: { id: "..." } })
      if (typeof link === 'object' && link !== null && link.type === 'collection' && link.collection?.id) {
        // Convert object format to string format for collection navigation
        const collectionId = link.collection.id;
        const collectionLink = `/collections/${collectionId}`;
        onPress?.(collectionLink, {
          collectionId: collectionId,
          collectionName: link.collection.name,
          name: link.collection.name,
        });
      } else if (typeof link === 'string') {
        // Handle string format links
        onPress?.(link);
      } else {
        // Fallback: pass link as-is
        onPress?.(link as any);
      }
    }

    // Firebase Ecommerce Tracking - Select Promotion
    analyticsService.track('select_promotion', {
      promotion_id: block.id || 'image_carousel',
      promotion_name: block.id || 'Image Carousel',
      items: [],
    });
  };

  return (
    <BaseContentBlock 
      block={outerBlock}
      style={adjustedMarginTop !== originalMarginTop ? { marginTop: adjustedMarginTop } : undefined}
    >
      <Carousel
        data={carouselData}
        config={{
          autoPlay: carouselConfig.autoPlay ?? true,
          autoPlayInterval: carouselConfig.autoPlayInterval ?? 3000,
          loop: carouselConfig.loop ?? true,
          height: carouselConfig.height ?? 0.6,
          resizeMode: carouselConfig.resizeMode ?? 'cover',
          showTextOverlay: true,
          showPagination: carouselConfig.showPagination ?? false,
        }}
        styles={{
          container: blockStyles?.container,
          imageContainer: blockStyles?.imageContainer,
          img: blockStyles?.image,
        }}
        onItemPress={handleItemPress}
      />
    </BaseContentBlock>
  );
}

