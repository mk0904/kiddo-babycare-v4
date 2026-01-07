import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { ImageCarouselBlock } from '@/types/content';
import { Carousel } from '@/components/ui/Carousel';

interface ImageCarouselProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: ImageCarouselBlock;
  onPress?: (link?: string) => void;
}

export function ImageCarousel({ block, onPress }: ImageCarouselProps) {
  const { data, carouselConfig = {}, styles: blockStyles } = block;

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

  const handleItemPress = (link?: string) => {
    if (link) {
      onPress?.(link);
    }
  };

  return (
    <BaseContentBlock block={block}>
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

