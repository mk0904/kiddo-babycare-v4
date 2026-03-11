import OptimizedImage from '@/components/ui/OptimizedImage';
import OutOfStockOverlay from '@/components/ui/OutOfStockOverlay';
import TryAndBuyModal from '@/components/ui/TryAndBuyModal';
import UniversalAdd from '@/components/ui/UniversalAdd';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { configService } from '@/services/configService';
import { isProductOutOfStock } from '@/utils/availability';
import { processFontStyle } from '@/utils/fontUtils';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Calculate card width based on number of columns and padding
const calculateCardWidth = (
  numColumns = 2,
  horizontalPadding = 20,
  gap = 8,
) => {
  const totalPadding = horizontalPadding * 2;
  const totalGap = gap * (numColumns - 1);
  const availableWidth = SCREEN_WIDTH - totalPadding - totalGap;
  return availableWidth / numColumns;
};

interface ProductCardProps {
  product: any;
  onPress?: (product: any) => void;
  onAddToCart?: (product: any) => void;
  index?: number;
  containerStyle?: any;
  numColumns?: number;
  horizontalPadding?: number;
  gap?: number;
  width?: number; // Add explicit width support
  averageMarketPrice?: number | null; // Average market price for essentials
  collectionId?: string | string[] | null; // Collection ID for navigation context
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  onPress,
  onAddToCart,
  index,
  containerStyle,
  numColumns = 2,
  averageMarketPrice = null,
  horizontalPadding = 20,
  gap = 8,
  width,
  collectionId,
}) => {
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { isAuthenticated, user } = useAuth();
  const isGuest = !isAuthenticated || user?.isGuest === true;
  const [showTryAndBuyModal, setShowTryAndBuyModal] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [imageErrorCount, setImageErrorCount] = useState(0);
  const router = useRouter();

  // Product card text styles from config (fontSize, fontWeight, fontFamily, color)
  const cardTextStyles = useMemo(() => {
    const config = configService.getProductCardStyles();
    const merge = (baseStyle: object, key: string) => {
      const base = StyleSheet.flatten(baseStyle as any) || {};
      const fromConfig = config?.[key];
      if (!fromConfig) return base;
      return {
        ...base,
        ...processFontStyle(fromConfig),
        ...fromConfig,
      };
    };
    return {
      productName: merge(styles.productName, 'productName'),
      vendorBadgeText: merge(styles.vendorBadgeText, 'vendorBadgeText'),
      mainPrice: merge(styles.mainPrice, 'mainPrice'),
      comparePrice: merge(styles.comparePrice, 'comparePrice'),
      discountPercentage: merge(styles.discountPercentage, 'discountPercentage'),
    };
  }, []);

  // Get product handle
  const productHandle = useMemo(() => product.handle, [product]);
  const productId = useMemo(
    () => product.id || product._id || productHandle,
    [product.id, product._id, productHandle],
  );
  const inWishlist = useMemo(
    () => isInWishlist(productId),
    [isInWishlist, productId],
  );

  // Memoize images to avoid recalculation
  const images = useMemo(() => {
    return product.images?.edges || product.images || [];
  }, [product.images]);

  const firstImage = useMemo(() => {
    return images[0]?.node || images[0] || {};
  }, [images]);

  // Collect all possible image URLs with fallback order
  const allImageUrls = useMemo(() => {
    const urls: string[] = [];

    // 1. Product images (edges format or array)
    images.forEach((img: any) => {
      const url = img?.node?.url || img?.url;
      if (url && !urls.includes(url)) urls.push(url);
    });

    // 2. Variant images
    const variants = product.variants?.edges || product.variants || [];
    variants.forEach((variant: any) => {
      const v = variant?.node || variant || {};
      const variantImageUrl = v.image?.url || v.image;
      if (variantImageUrl && !urls.includes(variantImageUrl)) {
        urls.push(variantImageUrl);
      }
    });

    // 3. Direct product image
    const directImageUrl = product.image;
    if (directImageUrl && !urls.includes(directImageUrl)) {
      urls.push(directImageUrl);
    }

    // 3.5 Featured image
    if (product.featuredImage?.url && !urls.includes(product.featuredImage.url)) {
      urls.push(product.featuredImage.url);
    }

    // 4. Fallback placeholder
    if (urls.length === 0) {
      urls.push('https://via.placeholder.com/300');
    }

    return urls;
  }, [product, images]);

  // Calculate dynamic width based on numColumns (needed for image optimization)
  const cardWidth = useMemo(() =>
    width || containerStyle?.width || calculateCardWidth(numColumns, horizontalPadding, gap),
    [width, containerStyle?.width, numColumns, horizontalPadding, gap]
  );

  // Get optimized image URL
  const currentImageUrl = useMemo(() => {
    const url =
      allImageUrls[imageErrorCount] ||
      allImageUrls[0] ||
      'https://via.placeholder.com/300';

    // Simple return for now, image optimization service not present
    return url;
  }, [allImageUrls, imageErrorCount]);

  // Reset image error count when product changes
  useEffect(() => {
    setImageErrorCount(0);
  }, [product.id, product._id, productHandle]);

  // Handle image error - try next image in fallback list
  const handleImageError = useCallback(() => {
    const currentUrl = allImageUrls[imageErrorCount];
    if (
      allImageUrls.length <= 1 ||
      (currentUrl && currentUrl.includes('placeholder'))
    ) {
      return;
    }
    if (imageErrorCount < allImageUrls.length - 1) {
      setTimeout(() => {
        setImageErrorCount(prev => prev + 1);
      }, 200);
    }
  }, [imageErrorCount, allImageUrls]);

  // Memoize variants to avoid recalculation
  const variants = useMemo(() => {
    return product.variants?.edges || product.variants || [];
  }, [product.variants]);

  const firstVariant = useMemo(() => {
    return variants[0]?.node || variants[0] || {};
  }, [variants]);

  const outOfStock = useMemo(() => isProductOutOfStock(product), [product]);

  // Parse price to number - handle multiple formats
  const parsePrice = useCallback((priceValue: any) => {
    if (typeof priceValue === 'number') return priceValue;
    if (typeof priceValue === 'string') {
      const cleaned = priceValue.replace(/[₹,\s]/g, '').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }, []);

  // Memoize price calculation
  const price = useMemo(() => {
    if (firstVariant?.price?.amount) {
      return firstVariant.price.amount;
    }
    if (product.priceRange?.minVariantPrice?.amount) {
      return product.priceRange.minVariantPrice.amount;
    }
    if (product.price) { // Direct price
      if (typeof product.price === 'object') return product.price.amount;
      return product.price;
    }
    return '0';
  }, [firstVariant, product.priceRange, product.price]);

  const priceNumber = useMemo(() => parsePrice(price), [price, parsePrice]);

  const discountPrice = useMemo(() => {
    // Check multiple possible locations for compareAtPrice
    if (product.discountPrice) return product.discountPrice;

    // Check firstVariant compareAtPrice
    if (firstVariant?.compareAtPrice?.amount) {
      return firstVariant.compareAtPrice.amount;
    }
    if (typeof firstVariant?.compareAtPrice === 'string') return firstVariant.compareAtPrice;

    // Check product compareAtPrice directly
    if (product.compareAtPrice?.amount) {
      return product.compareAtPrice.amount;
    }
    if (product.compareAtPrice) return product.compareAtPrice;

    return null;
  }, [product, firstVariant]);

  // Calculate discount percentage
  const discountPercentage = useMemo(() => {
    if (!discountPrice) return null;
    const originalPrice = parsePrice(discountPrice);
    if (originalPrice > priceNumber && originalPrice > 0) {
      const percentage = Math.round(((originalPrice - priceNumber) / originalPrice) * 100);
      return percentage > 0 ? percentage : null;
    }
    return null;
  }, [discountPrice, priceNumber, parsePrice]);

  // Handle wishlist press
  const handleWishlistPress = useCallback(
    async (e: any) => {
      e.stopPropagation();

      if (wishlistLoading) return;

      setWishlistLoading(true);
      try {
        if (inWishlist) {
          removeFromWishlist(productId);
        } else {
          addToWishlist(product);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setWishlistLoading(false);
      }
    },
    [wishlistLoading, inWishlist, productId, removeFromWishlist, addToWishlist, product]
  );

  // Check if product has Fashion tag
  const tags = useMemo(() => product.tags || [], [product.tags]);
  const hasFashionTag = useMemo(
    () =>
      tags.some(
        (tag: any) => typeof tag === 'string' && tag.toLowerCase() === 'fashion',
      ),
    [tags],
  );

  // Check if product has Essentials tag
  const hasEssentialsTag = useMemo(
    () =>
      tags.some(
        (tag: any) => typeof tag === 'string' && tag.toLowerCase() === 'essentials',
      ),
    [tags],
  );

  // Check if product is a ticketing product (Events, Playhouses, Petting Farms)
  const isTicketingProduct = useMemo(() => {
    // Collection IDs that are ticketing products
    const TICKETING_COLLECTION_IDS = [
      'gid://shopify/Collection/509771120929', // Events
      'gid://shopify/Collection/509726458145', // Playhouses
      'gid://shopify/Collection/509771153697', // Petting Farms
    ];

    // Check if product came from a ticketing collection
    const collectionIdParam = Array.isArray(collectionId) ? collectionId[0] : collectionId;
    if (collectionIdParam) {
      const isFromTicketingCollection = TICKETING_COLLECTION_IDS.some(id => 
        collectionIdParam === id || collectionIdParam.includes(id.split('/').pop() || '')
      );
      if (isFromTicketingCollection) return true;
    }

    // Check if product has relevant tags
    const hasTicketingTag = tags.some((tag: any) => {
      const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
      return tagLower.includes('event') || 
             tagLower.includes('playhouse') || 
             tagLower.includes('petting') ||
             tagLower.includes('farm');
    });
    if (hasTicketingTag) return true;

    // Check if product belongs to any ticketing collection
    const productCollections = product.collections?.edges || product.collections || [];
    const belongsToTicketing = productCollections.some((col: any) => {
      const colId = col?.node?.id || col?.id || '';
      return TICKETING_COLLECTION_IDS.some(ticketingId => 
        colId === ticketingId || colId.includes(ticketingId.split('/').pop() || '')
      );
    });
    if (belongsToTicketing) return true;

    return false;
  }, [collectionId, tags, product.collections]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(product);
    } else {
      // Fallback navigation
      // Prefer ID if available (gid or clean ID), else handle
      const routeParam = product.id || productHandle;
      if (routeParam) {
        const collectionIdParam = Array.isArray(collectionId) ? collectionId[0] : collectionId;
        router.push({
          pathname: `/product/${encodeURIComponent(routeParam)}`,
          params: collectionIdParam ? { collectionId: collectionIdParam } : {}
        } as any);
      }
    }
  }, [onPress, product, router, productHandle, collectionId]);

  return (
    <View style={[styles.container, { width: cardWidth }, containerStyle]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        style={{ flex: 1 }}
        delayPressIn={0}
        delayPressOut={0}
      >
        <View style={styles.imageContainer} pointerEvents="box-none">
          <OptimizedImage
            source={{ uri: currentImageUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={handleImageError}
            key={`img-${productId}-${imageErrorCount}`}
          />
          {outOfStock ? <OutOfStockOverlay style={{ borderRadius: 12 }} /> : null}
          <TouchableOpacity
            style={styles.wishlistButton}
            onPress={handleWishlistPress}
            disabled={wishlistLoading}
            activeOpacity={0.7}
          >
            <Ionicons
              name={inWishlist ? 'heart' : 'heart-outline'}
              size={16}
              color={inWishlist ? '#ff4444' : Colors.text}
            />
          </TouchableOpacity>
          {/* Vendor Badge - bottom left */}
          {product.vendor && (
            <View style={styles.vendorBadge}>
              <Text style={cardTextStyles.vendorBadgeText} numberOfLines={1}>
                {product.vendor}
              </Text>
            </View>
          )}
          {/* T&B Tag - replaces timer */}
          {hasFashionTag && (
            <TouchableOpacity
              style={styles.tbTag}
              onPress={e => {
                e.stopPropagation();
                setShowTryAndBuyModal(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="shirt-outline"
                size={12}
                color="#fff"
                style={styles.hangerIcon}
              />
              <Text style={styles.tbTagText} numberOfLines={1}>
                Try & Buy
              </Text>
            </TouchableOpacity>
          )}
          {/* Add to Cart Button - CTA on image - Hide for ticketing products */}
          {!outOfStock && !isTicketingProduct && (
            <View
              style={styles.addButtonContainer}
              pointerEvents="auto"
              collapsable={false}
            >
              <UniversalAdd item={product} variant="prominent" />
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={cardTextStyles.productName} numberOfLines={2} ellipsizeMode="tail">
            {product.title || product.name || 'Product'}
          </Text>

          <View style={styles.priceContainer}>
            <View style={styles.priceColumn}>
              {hasEssentialsTag && averageMarketPrice && averageMarketPrice > 0 ? (
                <View style={styles.essentialsPriceContainer}>
                  <View style={styles.essentialsPriceRow}>
                    <Text style={styles.essentialsLabel}>Market Price:</Text>
                    <Text style={styles.essentialsMarketPrice}>
                      ₹{averageMarketPrice.toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.essentialsPriceRow}>
                    <Text style={styles.essentialsLabel}>Our Price:</Text>
                    <Text style={styles.essentialsOurPrice}>
                      ₹{priceNumber > 0 ? priceNumber.toFixed(0) : '0'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.priceRow}>
                  <View style={styles.priceInfo}>
                    <Text style={cardTextStyles.mainPrice}>
                      {priceNumber > 0 ? `₹${priceNumber.toFixed(0)}` : '₹0'}
                    </Text>
                    {discountPrice && parsePrice(discountPrice) > priceNumber && (
                      <Text style={cardTextStyles.comparePrice}>
                        ₹{parsePrice(discountPrice).toFixed(0)}
                      </Text>
                    )}
                  </View>
                  {discountPercentage !== null && (
                    <Text style={cardTextStyles.discountPercentage}>
                      {discountPercentage}% off
                    </Text>
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
        <TryAndBuyModal
          visible={showTryAndBuyModal}
          onClose={() => setShowTryAndBuyModal(false)}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    overflow: 'visible',
    borderRadius: 12,
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  content: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    justifyContent: 'space-between',
    minHeight: 45, // Fixed height to prevent alignment issues
  },
  productName: {
    fontSize: 13,
    fontFamily: Fonts.SemiBold,
    marginBottom: 2,
    color: Colors.text,
    lineHeight: 18,
  },
  tbTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    borderRadius: 6,
    gap: 4,
    height: 18,
    zIndex: 10,
    minWidth: 65,
  },
  hangerIcon: {
    marginRight: 0,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    marginTop: 'auto',
  },
  priceColumn: {
    flex: 1,
    minWidth: 0,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'nowrap',
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexWrap: 'nowrap',
  },
  mainPrice: {
    color: '#2c6975',
    fontSize: 12,
    fontFamily: Fonts.Bold,
    lineHeight: 16,
    flexShrink: 0,
  },
  comparePrice: {
    color: '#888888',
    textDecorationLine: 'line-through',
    fontSize: 11,
    fontFamily: Fonts.Medium,
    flexShrink: 0,
  },
  discountPercentage: {
    color: '#2c6975',
    fontSize: 11,
    fontFamily: Fonts.SemiBold,
    lineHeight: 16,
    flexShrink: 0,
  },
  essentialsPriceContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  essentialsPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  essentialsLabel: {
    color: '#666666',
    fontSize: 10,
    fontFamily: Fonts.Medium,
    lineHeight: 14,
  },
  essentialsMarketPrice: {
    color: '#888888',
    textDecorationLine: 'line-through',
    fontSize: 10,
    fontFamily: Fonts.Medium,
    lineHeight: 14,
  },
  essentialsOurPrice: {
    color: '#2c6975',
    fontSize: 12,
    fontFamily: Fonts.Bold,
    lineHeight: 16,
  },
  vendorBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 10,
  },
  vendorBadgeText: {
    color: '#000',
    fontSize: 10,
    fontFamily: Fonts.SemiBold,
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 6,
    zIndex: 10,
  },
  tbTagText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: Fonts.SemiBold,
    flexShrink: 0,
    lineHeight: 12,
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    zIndex: 6,
  },
  outOfStockBadge: {
    backgroundColor: 'rgba(107, 114, 128, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  outOfStockText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Fonts.SemiBold,
    letterSpacing: 0.5,
  },
  addButtonContainer: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    zIndex: 10,
  },
});

// Custom comparison function for React.memo
const areEqual = (prevProps: ProductCardProps, nextProps: ProductCardProps) => {
  const prevProductId = prevProps.product?.id || prevProps.product?._id || prevProps.product?.handle;
  const nextProductId = nextProps.product?.id || nextProps.product?._id || nextProps.product?.handle;
  if (prevProductId !== nextProductId) return false;

  if (prevProps.onPress !== nextProps.onPress) return false;

  if (prevProps.width !== nextProps.width) return false;
  if (prevProps.containerStyle !== nextProps.containerStyle) return false;

  return true;
};

export const ProductCard = memo(ProductCardComponent, areEqual);
export default ProductCard;
