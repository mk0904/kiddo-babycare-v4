import { Fonts } from '@/constants/theme';
import { useDeviceDimensions } from '@/hooks/useDeviceDimensions';
import { SearchProductListBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import React from 'react';
import { ProductList } from '../product/ProductList';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface SearchProductListProps extends BaseContentBlockProps {
  block: SearchProductListBlock;
  onPress?: (link?: string, item?: any) => void;
  searchQuery?: string;
}

export function SearchProductList({
  block,
  onPress,
  searchQuery = '',
}: SearchProductListProps) {
  const { width } = useDeviceDimensions();
  const {
    collectionId,
    title,
    searchListConfig = {},
    styles: blockStyles,
  } = block;

  // If disappearOnSearch is true and there's a search query, don't render
  if (searchListConfig.disappearOnSearch && searchQuery.length > 0) {
    return null;
  }

  return (
    <BaseContentBlock block={block}>
      <ProductList
        collectionId={collectionId || 'search_collection'}
        searchQuery={searchQuery}
        title={title}
        showHeading={!!title}
        style={{
          root: blockStyles?.container,
          title: processFontStyle(blockStyles?.title, Fonts.Black),
          list: blockStyles?.list,
        }}
        contentWidth={width - (blockStyles?.container?.paddingHorizontal || 0) * 2}
        productOptions={{
          horizontal: true,
          itemsPerView: searchListConfig.itemsPerView || 2,
          sidePadding: blockStyles?.container?.paddingHorizontal || 20,
        }}
        limit={searchListConfig.limit}
      />
    </BaseContentBlock>
  );
}

