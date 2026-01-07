import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';
import { InfiniteProductGridBlock } from '@/types/content';
import { InfiniteProductGrid as InfiniteProductGridComponent } from '../product/InfiniteProductGrid';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';

interface InfiniteProductGridProps extends Omit<BaseContentBlockProps, 'onPress'> {
  block: InfiniteProductGridBlock;
  onPress?: (link?: string, item?: any) => void;
}

export function InfiniteProductGrid({ block, onPress }: InfiniteProductGridProps) {
  const { title, collectionIds, productGridConfig = {}, styles: blockStyles } = block;
  const { width } = useDeviceDimensions();

  if (!collectionIds || collectionIds.length === 0) {
    return null;
  }

  const collectionId = collectionIds[0];

  // Extract padding from styles (Horizontal or Left+Right)
  const pHorizontal = blockStyles?.container?.paddingHorizontal;
  const pLeft = blockStyles?.container?.paddingLeft;
  const pRight = blockStyles?.container?.paddingRight;

  // Calculate effective horizontal padding for the grid configuration
  // If distinct left/right are provided, we'll try to approximate or use specific logic
  // But since the grid component assumes symmetric 'horizontalPadding', let's derive a safe value.
  // If left/right are specific, we might default to 0 for internal calculations and let the container handle it,
  // but we need to ensure card calculation is aware of the lost width.

  let effectivePadding = 16; // default
  if (pHorizontal !== undefined) {
    effectivePadding = pHorizontal;
  } else if (pLeft !== undefined || pRight !== undefined) {
    // If separate paddings, take the average or sum/2? 
    // The grid logic uses `horizontalPadding * 2`. 
    // So if Left=0, Right=0, effective=0.
    const l = pLeft ?? 0;
    const r = pRight ?? 0;
    effectivePadding = (l + r) / 2;
  } else if (productGridConfig.horizontalPadding !== undefined) {
    effectivePadding = productGridConfig.horizontalPadding;
  }

  const productOptions = {
    ...productGridConfig,
    horizontalPadding: effectivePadding,
  };

  return (
    <BaseContentBlock block={block}>
      <InfiniteProductGridComponent
        collectionId={collectionId}
        title={title}
        showHeading={!!title}
        // BaseContentBlock handles the container styles (padding etc)
        // We just pass it through so BaseContentBlock renders it.
        // Wait, BaseContentBlock style override was `paddingHorizontal: 0` in previous step.
        // We should PROBABLY apply the padding to the BaseContentBlock to ensure visual spacing,
        // BUT tell the grid component about it so it shrinks cards.
        style={{
          root: blockStyles?.container,
          title: blockStyles?.title,
          list: blockStyles?.list,
        }}
        // Pass the effective available width if the component supports it, 
        // OR rely on productOptions.horizontalPadding to shrink cards.
        // We'll trust productOptions.horizontalPadding + the existing logic for now.
        contentWidth={width}
        productOptions={productOptions}
      />
    </BaseContentBlock>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
    paddingHorizontal: 20,
    letterSpacing: 0.3,
  },
  placeholder: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#999999',
  },
});

