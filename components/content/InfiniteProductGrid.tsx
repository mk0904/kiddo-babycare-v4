import { Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { InfiniteProductGridBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { StyleSheet } from 'react-native';
import { InfiniteProductGrid as InfiniteProductGridComponent } from '../products/InfiniteProductGrid';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

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
  // Priority: productGridConfig > blockStyles.container
  const pHorizontal = productGridConfig.paddingHorizontal ?? blockStyles?.container?.paddingHorizontal;
  const pLeft = blockStyles?.container?.paddingLeft;
  const pRight = blockStyles?.container?.paddingRight;

  // Calculate effective horizontal padding for the grid configuration
  // Priority: productGridConfig.paddingHorizontal > blockStyles.container.paddingHorizontal > average of left/right
  let effectivePadding = 16; // default
  if (pHorizontal !== undefined) {
    effectivePadding = pHorizontal;
  } else if (pLeft !== undefined || pRight !== undefined) {
    // If separate paddings, take the average
    const l = pLeft ?? 0;
    const r = pRight ?? 0;
    effectivePadding = (l + r) / 2;
  }

  // Build productOptions with all config values
  const productOptions = {
    ...productGridConfig,
    paddingHorizontal: effectivePadding,
    // Ensure gap values are passed through
    gap: productGridConfig.gap,
    rowGap: productGridConfig.rowGap,
    colGap: productGridConfig.colGap,
    // Keep backward compatibility with horizontalPadding
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
          title: processFontStyle(blockStyles?.title, Fonts.Black),
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
    fontSize: 18,
    fontFamily: Fonts.Black,
    fontWeight: '900',
    marginBottom: 8,
    paddingHorizontal: 20,
    letterSpacing: 0,
  },
  placeholder: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 16,
    fontFamily: Fonts.SemiBold,
    color: '#666666',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#999999',
  },
});

