// Base content block - similar to gauntlet's base block system
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ContentBlock } from '@/types/content';

export interface BaseContentBlockProps {
  block: ContentBlock;
  style?: StyleProp<ViewStyle>;
  onPress?: (block: ContentBlock) => void;
}

export function BaseContentBlock({
  block,
  style,
  children,
}: BaseContentBlockProps & { children: React.ReactNode }) {
  if (block.visible === false) {
    return null;
  }

  const blockStyles = block.styles?.container || {};

  return (
    <View style={[styles.container, blockStyles, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // width: '100%', // Removed to allow margins to work correctly automatically (flex behavior)
  },
});

