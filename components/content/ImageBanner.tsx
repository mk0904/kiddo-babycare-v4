import { Colors } from '@/constants/theme';
import { ImageBannerBlock } from '@/types/content';
import React from 'react';
import { Dimensions, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

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
  // If padding is specified, image should fill the content area (screen width minus padding)
  // Otherwise, image fills 100% of container
  const hasPadding = paddingHorizontal > 0 || marginHorizontal > 0;
  const availableWidth = hasPadding 
    ? SCREEN_WIDTH - (paddingHorizontal * 2) - (marginHorizontal * 2)
    : SCREEN_WIDTH;
  const calculatedHeight = height || (availableWidth * heightRatio);

  const containerStyle = [
    defaultStyles.container,
    blockStyles.container,
  ];

  const wrapperStyle = [
    defaultStyles.wrapper,
    paddingHorizontal > 0 && { paddingHorizontal },
    blockStyles.wrapper,
  ];

  // Image width: use calculated width if padding exists, otherwise use 100% to fill container
  const imageStyle = [
    defaultStyles.image,
    {
      height: calculatedHeight,
      borderRadius,
      alignSelf,
      ...(hasPadding ? { width: availableWidth } : { width: '100%' }),
      maxWidth: '100%', // Prevent overflow
    },
    blockStyles.image,
  ];

  if (!imageUrl) {
    return null;
  }

  // Helper function to resolve local asset paths
  const getImageSource = () => {
    // Check if it's a local asset path (starts with "assets/")
    if (typeof imageUrl === 'string' && imageUrl.startsWith('assets/')) {
      // Map asset paths to require statements
      const assetMap: Record<string, any> = {
        'assets/images/BabyGearBanner.png': require('@/assets/images/BabyGearBanner.png'),
        'assets/images/BabyGearLogo.png': require('@/assets/images/BabyGearLogo.png'),
      };
      return assetMap[imageUrl] || { uri: imageUrl };
    }
    // Remote URL
    return { uri: imageUrl };
  };

  // React Native's Image component automatically uses cached/prefetched images
  // The useImagePreloader hook ensures images are prefetched for instant display
  const content = (
    <Image
      source={getImageSource()}
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
    overflow: 'hidden', // Prevent cropping/overflow
  },
  wrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  image: {
    width: '100%',
    maxWidth: '100%', // Ensure image doesn't exceed container
  },
});

