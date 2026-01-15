import React from 'react';
import { ViewStyle } from 'react-native';
import { SvgUri } from 'react-native-svg';

interface SearchIconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

const SEARCH_ICON_URL = 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/search.svg?v=1767953144';

export function SearchIcon({ size = 20, color = '#666666', style }: SearchIconProps) {
  return (
    <SvgUri
      uri={SEARCH_ICON_URL}
      width={size}
      height={size}
      color={color}
      style={style}
    />
  );
}
