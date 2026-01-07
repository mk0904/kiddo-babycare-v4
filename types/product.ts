// Product types - simplified for quick commerce app
// In production, this would match Shopify product structure
import { ShopifyProduct } from '@/services/shopifyApi';

export interface ProductImage {
  url: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface ProductVariant {
  id: string;
  title: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  compareAtPrice?: {
    amount: string;
    currencyCode: string;
  };
  available: boolean;
  image?: ProductImage;
  sku?: string;
}

export interface Product {
  id: string;
  handle: string;
  title: string;
  description?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  images: ProductImage[];
  featuredImage?: ProductImage;
  variants: {
    items: Record<string, ProductVariant>;
  };
  defaultVariantId?: string;
  selectedVariantId?: string;
  displayVariantId?: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  compareAtPrice?: {
    amount: string;
    currencyCode: string;
  };
  availableForSale?: boolean;
  // For simplified display
  imageUrl?: string;
  priceText?: string;
  compareAtPriceText?: string;
}

// Import ShopifyProduct type for ProductCard props
import { ShopifyProduct } from '@/services/shopifyApi';

export interface ProductCardProps {
  product: Product | string | ShopifyProduct; // Can be product object, Shopify product, or handle string
  style?: {
    root?: any;
    image?: any;
    title?: any;
    price?: any;
    compareAtPrice?: any;
  };
  options?: {
    showTitle?: boolean;
    showPrice?: boolean;
    showCompareAtPrice?: boolean;
    imageAspectRatio?: number;
    numberOfLines?: number;
  };
  onPress?: (product: Product | ShopifyProduct) => void;
  width?: number;
}

