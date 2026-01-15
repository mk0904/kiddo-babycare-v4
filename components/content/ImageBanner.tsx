import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { ImageBannerBlock } from '@/types/content';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ImageBannerProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: ImageBannerBlock;
  onPress?: (link?: string | any) => void;
}

export function ImageBanner({ block, onPress }: ImageBannerProps) {
  const { data, imageBannerConfig, styles: blockStyles = {} } = block;

  // Support both data and imageBannerConfig formats (Kiddo pattern)
  const config = imageBannerConfig || ({} as any);
  const imageUrl = config.imageUrl || data?.imageUrl;
  const height = config.height; // If not provided, will use responsive 16:9 aspect ratio
  const heightRatio = config.heightRatio ?? 0.5625; // 16:9 aspect ratio (9/16 = 0.5625) - best for mobile banners
  const borderRadius = config.borderRadius ?? 0;
  const resizeMode = config.resizeMode || 'contain';
  const alignSelf = config.alignSelf || 'stretch';
  const link = config.link || data?.link; // Optional link for redirection

  // Calculate responsive height if not provided
  // Get marginHorizontal and paddingHorizontal from styles (defaults to 0)
  const marginHorizontal = blockStyles.container?.marginHorizontal ?? 0;
  const paddingHorizontal = blockStyles.wrapper?.paddingHorizontal ?? 0;

  // Calculate available width for the image
  const availableWidth = SCREEN_WIDTH - (paddingHorizontal * 2) - (marginHorizontal * 2);
  const calculatedHeight = height || (availableWidth * heightRatio);

  const containerStyle = [
    defaultStyles.container,
    blockStyles.container,
  ];

  const wrapperStyle = [
    defaultStyles.wrapper,
    blockStyles.wrapper,
  ];

  const imageStyle = [
    defaultStyles.image,
    {
      height: calculatedHeight,
      borderRadius,
      alignSelf,
      width: availableWidth, // Use calculated width instead of '100%'
    },
    blockStyles.image,
  ];

  if (!imageUrl) {
    return null;
  }

  // React Native's Image component automatically uses cached/prefetched images
  // The useImagePreloader hook ensures images are prefetched for instant display
  const content = (
    <Image
      source={{ uri: imageUrl }}
      style={imageStyle}
      resizeMode={resizeMode}
    />
  );

  // Priority: onPress > link > nothing (Kiddo pattern)
  const handlePress = () => {
    if (onPress) {
      onPress(link);
    }
  };

  const hasPressHandler = onPress || link;

  return (
    <BaseContentBlock block={block}>
      <View style={containerStyle}>
        {hasPressHandler ? (
          <TouchableOpacity style={wrapperStyle} onPress={handlePress} activeOpacity={0.8}>
            {content}
          </TouchableOpacity>
        ) : (
          <View style={wrapperStyle}>
            {content}
          </View>
        )}
      </View>
    </BaseContentBlock>
  );
}

const defaultStyles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: Colors.backgroundWhite,
  },
  wrapper: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  image: {
    width: '100%',
  },
});

