import { Carousel } from '@/components/ui/Carousel';
import { ImageCarouselBlock } from '@/types/content';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface ImageCarouselProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: ImageCarouselBlock;
  onPress?: (link?: string | any) => void;
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

  const handleItemPress = (link?: string | any) => {
    if (link) {
      // Pass the link as-is (can be string or object)
      onPress?.(link);
    }
  };

  return (
    <BaseContentBlock 
      block={block}
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

