import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { PromoCarouselBlock } from '@/types/content';
import { ImageCarousel } from './ImageCarousel';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';

interface PromoCarouselProps extends BaseContentBlockProps {
  block: PromoCarouselBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function PromoCarousel({ block, onPress }: PromoCarouselProps) {
  const { width } = useDeviceDimensions();
  const {
    data = [],
    heading,
    subHeading,
    promoCarouselConfig = {},
    styles: blockStyles,
  } = block;

  const filteredItems = data.filter((item) => !item.hidden);

  if (filteredItems.length === 0) return null;

  // Convert PromoCarousel data format to ImageCarousel format
  const carouselData = filteredItems.map((item) => ({
    imageUrl: item.imageUrl,
    link: item.link,
    title: item.title,
    subtitle: item.subtitle,
  }));

  // Create a carousel block config
  const carouselBlock = {
    ...block,
    type: 'carousel' as const,
    data: carouselData,
    carouselConfig: {
      autoPlay: promoCarouselConfig.autoPlay ?? true,
      autoPlayInterval: promoCarouselConfig.autoPlayInterval ?? 3000,
      loop: true,
      ...promoCarouselConfig,
    },
  };

  return (
    <BaseContentBlock block={block}>
      <View style={[styles.container, blockStyles?.root]}>
        {heading && (
          <Text style={[styles.heading, blockStyles?.heading]}>
            {heading}
          </Text>
        )}
        {subHeading && (
          <Text style={[styles.subHeading, blockStyles?.subHeading]}>
            {subHeading}
          </Text>
        )}
        <ImageCarousel
          block={carouselBlock}
          onPress={onPress}
        />
      </View>
    </BaseContentBlock>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  subHeading: {
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
});

