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
  const styleObj = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style as ViewStyle) || {};
  const mergedStyle: ViewStyle = {
    ...styles.container,
    ...blockStyles,
    ...styleObj,
    // Ensure backgroundColor from config is applied (merged style can drop it if overridden by undefined)
    ...(blockStyles.backgroundColor != null && { backgroundColor: blockStyles.backgroundColor }),
  };

  return (
    <View style={mergedStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // width: '100%', // Removed to allow margins to work correctly automatically (flex behavior)
  },
});

