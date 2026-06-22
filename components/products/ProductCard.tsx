import OptimizedImage from '@/components/ui/OptimizedImage';
import OutOfStockOverlay from '@/components/ui/OutOfStockOverlay';
import TryAndBuyModal from '@/components/ui/TryAndBuyModal';
import UniversalAdd from '@/components/ui/UniversalAdd';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useWishlist } from '@/context/WishlistContext';
import { analyticsService } from '@/services/analyticsService';
import { configService } from '@/services/configService';
import { isProductOutOfStock } from '@/utils/availability';
import { processFontStyle } from '@/utils/fontUtils';
import { shopifyImageUrl } from '@/utils/shopifyIds';
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

/**
 * Strikethrough MRP + `numberOfLines={1}` on very narrow tiles ellipsizes to “…” / horizontal rules
 * that read like “=”. Omit the MRP text when the card is narrower than this; sale + % off still show.
 */
const MIN_CARD_WIDTH_FOR_COMPARE_AT_LABEL = 132;

function scaleFontStyle(style: object, scale: number): object {
  const f = StyleSheet.flatten(style as any) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...f };
  if (typeof f.fontSize === 'number') {
    out.fontSize = Math.max(8, Math.round(f.fontSize * scale * 10) / 10);
  }
  if (typeof f.lineHeight === 'number') {
    let lh = Math.max(10, Math.round(f.lineHeight * scale));
    const fs = typeof out.fontSize === 'number' ? out.fontSize : null;
    /** iOS clips glyphs when lineHeight < font metrics; keep line box >= ~1.12× fontSize after scale. */
    if (fs != null && lh < Math.ceil(fs * 1.12)) {
      lh = Math.ceil(fs * 1.2);
    }
    out.lineHeight = lh;
  }
  return out;
}

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
  /**
   * When the product has no compare-at from Shopify, derive an “MRP” from the current price and
   * show this % off (e.g. special-deal promo grid aligned with `SpecialDealConfig.discount`).
   */
  promoPercentOff?: number;
  /** When true, show compare-at (MRP) before the selling price (e.g. compact promo grid). */
  priceCompareFirst?: boolean;
  /** When set, drives promo **display** (badge / strike / caption). */
  dealPromoPercentOff?: number;
  /**
   * When false, {@link dealPromoPercentOff} is UI-only — add-to-cart uses Shopify selling price (no special-deal line discount).
   * Default true for other promo grids that intentionally discount the line.
   */
  applyDealPromoToCart?: boolean;
  /** Special-offer modal only: green “Offer price” row + strike through list/sale prices above. */
  showPromoOfferPriceBadge?: boolean;
  /**
   * When set (e.g. Savings Corner promo grid), show this line directly under the price row and hide the outer green offer badge to avoid duplication.
   */
  promoOfferCaptionBelowPrice?: string;
  /** Special-offer modal: notify parent after an add succeeds (unlocks footer CTA). */
  onPromoDealAddSuccess?: () => void;
  /** When set (e.g. Savings Corner promo modal), scale down title / price / promo caption text only for this card. */
  compactTypographyScale?: number;
  /** Hide the “N% off” suffix next to prices (promo modal shows offer line instead). */
  hideDiscountPercentage?: boolean;
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
  promoPercentOff,
  priceCompareFirst = false,
  dealPromoPercentOff,
  applyDealPromoToCart = true,
  showPromoOfferPriceBadge = false,
  promoOfferCaptionBelowPrice,
  onPromoDealAddSuccess,
  compactTypographyScale,
  hideDiscountPercentage = false,
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
      // Do not spread raw fromConfig — it would overwrite resolved fontFamily (e.g. "semibold" string).
      return {
        ...base,
        ...processFontStyle(fromConfig),
      };
    };
    const merged = {
      productName: merge(styles.productName, 'productName'),
      vendorName: merge(styles.vendorName, 'vendorName'),
      vendorBadgeText: merge(styles.vendorBadgeText, 'vendorBadgeText'),
      mainPrice: merge(styles.mainPrice, 'mainPrice'),
      comparePrice: merge(styles.comparePrice, 'comparePrice'),
      discountPercentage: merge(styles.discountPercentage, 'discountPercentage'),
    };
    const scale = compactTypographyScale;
    if (scale != null && scale > 0 && scale < 1) {
      return {
        productName: scaleFontStyle(merged.productName, scale),
        vendorName: scaleFontStyle(merged.vendorName, scale),
        vendorBadgeText: scaleFontStyle(merged.vendorBadgeText, scale),
        mainPrice: scaleFontStyle(merged.mainPrice, scale),
        comparePrice: scaleFontStyle(merged.comparePrice, scale),
        discountPercentage: scaleFontStyle(merged.discountPercentage, scale),
      };
    }
    return merged;
  }, [compactTypographyScale]);

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

  // Get optimized image URL — request at 2× card width for retina screens
  const currentImageUrl = useMemo(() => {
    const url =
      allImageUrls[imageErrorCount] ||
      allImageUrls[0] ||
      'https://via.placeholder.com/300';

    // Request a Shopify CDN-resized image at 2× cardWidth for retina
    const targetWidth = Math.round(cardWidth * 2);
    return shopifyImageUrl(url, targetWidth);
  }, [allImageUrls, imageErrorCount, cardWidth]);

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

  /** Compare-at / list price from Shopify (several shapes + product-level range). */
  const discountPrice = useMemo(() => {
    if (product.discountPrice) return product.discountPrice;

    if (firstVariant?.compareAtPrice?.amount) {
      return firstVariant.compareAtPrice.amount;
    }
    if (typeof firstVariant?.compareAtPrice === 'string') return firstVariant.compareAtPrice;

    if (product.compareAtPrice?.amount) {
      return product.compareAtPrice.amount;
    }
    if (product.compareAtPrice) return product.compareAtPrice;

    const rangeMin = product.compareAtPriceRange?.minVariantPrice?.amount;
    if (rangeMin != null && String(rangeMin).trim() !== '') return rangeMin;

    return null;
  }, [product, firstVariant]);

  /** Synthetic MRP when promo config gives % off but variants lack compare-at. */
  const syntheticCompareAtAmount = useMemo(() => {
    if (discountPrice != null) return null;
    const p = promoPercentOff;
    if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0 || p >= 100) return null;
    if (priceNumber <= 0) return null;
    return priceNumber / (1 - p / 100);
  }, [discountPrice, promoPercentOff, priceNumber]);

  const displayCompareAtAmount = useMemo(() => {
    if (discountPrice != null) return discountPrice;
    if (syntheticCompareAtAmount != null) return String(syntheticCompareAtAmount);
    return null;
  }, [discountPrice, syntheticCompareAtAmount]);

  const compareAtNumber = useMemo(
    () => (displayCompareAtAmount != null ? parsePrice(displayCompareAtAmount) : 0),
    [displayCompareAtAmount, parsePrice],
  );

  // Calculate discount percentage
  const discountPercentage = useMemo(() => {
    if (displayCompareAtAmount == null) return null;
    const saleR = Math.round(priceNumber);
    const mrpR = Math.round(compareAtNumber);
    if (mrpR > saleR && compareAtNumber > 0) {
      const percentage = Math.round(((compareAtNumber - priceNumber) / compareAtNumber) * 100);
      return percentage > 0 ? percentage : null;
    }
    if (
      discountPrice == null &&
      syntheticCompareAtAmount != null &&
      typeof promoPercentOff === 'number' &&
      Number.isFinite(promoPercentOff) &&
      promoPercentOff > 0
    ) {
      return Math.round(promoPercentOff);
    }
    return null;
  }, [
    displayCompareAtAmount,
    compareAtNumber,
    priceNumber,
    discountPrice,
    syntheticCompareAtAmount,
    promoPercentOff,
  ]);

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

  // Check if product has Demo Available tag
  const hasGearFurnitureTag = useMemo(
    () =>
      tags.some(
        (tag: any) => typeof tag === 'string' && tag.toLowerCase() === 'demo available',
      ),
    [tags],
  );

  // Get metafield value (supports edges or array, key match case-insensitive)
  const getMetafieldValue = useCallback((key: string) => {
    const productMetafields = product?.metafields;
    if (!productMetafields) return null;
    const keyLower = key.toLowerCase();
    if (Array.isArray(productMetafields.edges)) {
      const edge = productMetafields.edges.find(
        (e: any) => e?.node?.key?.toLowerCase() === keyLower,
      );
      return edge?.node?.value ?? null;
    }
    if (Array.isArray(productMetafields)) {
      const m = productMetafields.find(
        (m: any) => (m?.key ?? m?.node?.key)?.toLowerCase() === keyLower,
      );
      return m?.value ?? m?.node?.value ?? null;
    }
    return null;
  }, [product?.metafields]);

  // Essentials-only: two separate boxes – Pack size (e.g. 72 pcs) and Size (e.g. XL, M)
  const essentialsMetaParts = useMemo(() => {
    if (!hasEssentialsTag) return { packSize: null, size: null };
    const variants = product?.variants?.edges ?? product?.variants ?? [];
    const firstVariant = variants[0]?.node ?? variants[0];
    const options = firstVariant?.selectedOptions ?? [];

    // Pack size: count/number of pieces (metafields or variant option "Pack Size" / "Count")
    const packSizeRaw =
      getMetafieldValue('number_of_pieces') ??
      getMetafieldValue('quantity') ??
      getMetafieldValue('pack_size') ??
      getMetafieldValue('number') ??
      (product as any).number_of_pieces ??
      (product as any).numberOfPieces ??
      (product as any).pack_size;
    const packSizeFromVariant = options.find((o: any) => {
      const name = (o?.name ?? '').toLowerCase().replace(/\s+/g, ' ');
      return ['pack size', 'pack_size', 'count', 'pieces', 'quantity'].some(
        (key) => name === key || name === key.replace('_', ' '),
      );
    })?.value;
    const packSizeStr = (packSizeRaw != null ? String(packSizeRaw).trim() : '') || (packSizeFromVariant ? String(packSizeFromVariant).trim() : '');
    const packSizeLabel = packSizeStr ? `${packSizeStr}${/^\d+$/.test(packSizeStr) ? ' pcs' : ''}` : null;

    // Size: product size only (metafield "size" or variant option "Size" / "Sizes" – not pack size)
    const sizeRaw = getMetafieldValue('size') ?? getMetafieldValue('sizes') ?? (product as any).size ?? (product as any).sizes;
    const sizeFromVariant = options.find(
      (o: any) => ['size', 'sizes'].includes((o?.name ?? '').toLowerCase()),
    )?.value;
    const sizeLabel = (sizeRaw != null ? String(sizeRaw).trim() : '') || (sizeFromVariant ? String(sizeFromVariant).trim() : '') || null;

    if (!packSizeLabel && !sizeLabel) return { packSize: null, size: null };
    return { packSize: packSizeLabel || null, size: sizeLabel || null };
  }, [hasEssentialsTag, getMetafieldValue, product]);

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
    // Firebase Ecommerce Tracking - Select Item
    analyticsService.logSelectItem({
      item_list_id: typeof collectionId === 'string' ? collectionId : undefined,
      item_list_name: typeof collectionId === 'string' ? collectionId : 'Collection',
      items: [{
        item_id: productId,
        item_name: product.title || product.name || 'Product',
        item_category: product.tags?.[0],
        price: priceNumber,
      }],
    });

    if (onPress) {
      onPress(product);
    } else {
      // Fallback navigation
      // Prefer ID if available (gid or clean ID), else handle
      const routeParam = product.id || productHandle;
      if (routeParam) {
        const collectionIdParam = Array.isArray(collectionId) ? collectionId[0] : collectionId;
        router.push({
          pathname: `/products/${encodeURIComponent(routeParam)}`,
          params: collectionIdParam ? { collectionId: collectionIdParam } : {}
        } as any);
      }
    }
  }, [onPress, product, router, productHandle, collectionId, productId, priceNumber]);

  const showCompareAtRow =
    displayCompareAtAmount != null &&
    Math.round(compareAtNumber) > Math.round(priceNumber);

  /** Promo modal tiles are often narrower than {@link MIN_CARD_WIDTH_FOR_COMPARE_AT_LABEL}px — still show MRP when caption row is used. */
  const showCompareAtLabel =
    showCompareAtRow &&
    cardWidth >= MIN_CARD_WIDTH_FOR_COMPARE_AT_LABEL &&
    promoOfferCaptionBelowPrice == null;

  /** Promo modal: always use the standard price row + green badge (never essentials “Market / Our” block). */
  const forcePromoStandardPriceLayout = showPromoOfferPriceBadge === true;

  const effectiveDealPromoPct =
    dealPromoPercentOff != null &&
      Number.isFinite(dealPromoPercentOff) &&
      dealPromoPercentOff >= 0 &&
      dealPromoPercentOff < 100
      ? dealPromoPercentOff
      : forcePromoStandardPriceLayout
        ? 0
        : null;

  const promoOfferBadgeActive =
    forcePromoStandardPriceLayout &&
    effectiveDealPromoPct != null &&
    effectiveDealPromoPct > 0 &&
    priceNumber > 0;

  const offerPriceDisplay = promoOfferBadgeActive
    ? Math.max(0, Math.round(priceNumber * (1 - effectiveDealPromoPct / 100)))
    : null;

  const compareAtStrikethrough =
    showCompareAtLabel &&
    (promoOfferBadgeActive || promoOfferCaptionBelowPrice != null);

  const compareAtPriceLabel = showCompareAtLabel ? (
    <Text
      style={[
        cardTextStyles.comparePrice,
        compareAtStrikethrough && styles.promoOfferStrikeThrough,
        promoOfferCaptionBelowPrice != null && styles.reducedPrice,
      ]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      ₹{compareAtNumber.toFixed(0)}
    </Text>
  ) : null;

  /** When an offer caption is present (green pill), we strike through the original selling price as well. */
  const salePriceStrikethrough =
    promoOfferBadgeActive || promoOfferCaptionBelowPrice != null;

  const salePriceLabel = (
    <Text
      style={[
        cardTextStyles.mainPrice,
        salePriceStrikethrough && styles.promoOfferStrikeThrough,
        promoOfferCaptionBelowPrice != null && styles.reducedPrice,
      ]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {priceNumber > 0 ? `₹${priceNumber.toFixed(0)}` : '='}
    </Text>
  );

  const compactScaledCaptionStyle = useMemo(() => {
    const s = compactTypographyScale;
    if (s == null || s <= 0 || s >= 1) return undefined;
    return scaleFontStyle(styles.promoOfferCaptionBelowPriceRow, s);
  }, [compactTypographyScale]);

  const compactTbTagTextStyle = useMemo(() => {
    const s = compactTypographyScale;
    if (s == null || s <= 0 || s >= 1) return undefined;
    return scaleFontStyle(styles.tbTagText, s);
  }, [compactTypographyScale]);

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
            showSkeleton={true}
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
              <Text style={[styles.tbTagText, compactTbTagTextStyle]} numberOfLines={1}>
                Try & Buy
              </Text>
            </TouchableOpacity>
          )}
          {/* Demo Available Tag for Gear & Furniture */}
          {hasGearFurnitureTag && (
            <View style={styles.demoBadge}>
              <Text style={[styles.demoBadgeText, compactTbTagTextStyle]} numberOfLines={1}>
                Demo Available
              </Text>
            </View>
          )}
          {/* Add to Cart Button - CTA on image - Hide for ticketing products */}
          {!outOfStock && !isTicketingProduct && (
            <View
              style={styles.addButtonContainer}
              pointerEvents="auto"
              collapsable={false}
            >
              <UniversalAdd
                item={product}
                variant="prominent"
                dealPromoPercentOff={
                  applyDealPromoToCart === false
                    ? undefined
                    : effectiveDealPromoPct != null
                      ? effectiveDealPromoPct
                      : dealPromoPercentOff
                }
                onSuccessfulAdd={onPromoDealAddSuccess}
              />
            </View>
          )}
        </View>

        <View style={styles.content}>
          {/* Brand Name */}
          {product.vendor && (
            <Text style={cardTextStyles.vendorName} numberOfLines={1} ellipsizeMode="tail">
              {product.vendor}
            </Text>
          )}
          {(essentialsMetaParts.packSize || essentialsMetaParts.size) ? (
            <View style={styles.essentialsMetaRow}>
              {essentialsMetaParts.packSize ? (
                <View style={styles.essentialsMetaBox}>
                  <Text style={styles.essentialsMetaText} numberOfLines={1}>
                    {essentialsMetaParts.packSize}
                  </Text>
                </View>
              ) : null}
              {essentialsMetaParts.size ? (
                <View style={styles.essentialsMetaBox}>
                  <Text style={styles.essentialsMetaText} numberOfLines={1}>
                    {essentialsMetaParts.size}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={cardTextStyles.productName} numberOfLines={2} ellipsizeMode="tail">
            {product.title || product.name || 'Product'}
          </Text>

          <View style={styles.priceContainer}>
            <View style={styles.priceColumn}>
              {hasEssentialsTag &&
                averageMarketPrice &&
                averageMarketPrice > 0 &&
                !forcePromoStandardPriceLayout ? (
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
                <>
                  <View style={styles.priceRow}>
                    {promoOfferCaptionBelowPrice ? (
                      <View style={[styles.promoOfferCaptionBelowWrap, { marginTop: 0, marginRight: 8 }]}>
                        <Text
                          style={[styles.promoOfferCaptionBelowPriceRow, compactScaledCaptionStyle]}
                          numberOfLines={1}
                        >
                          {promoOfferCaptionBelowPrice}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.priceTokens}>
                      {priceCompareFirst ? (
                        <>
                          {compareAtPriceLabel}
                          {salePriceLabel}
                        </>
                      ) : (
                        <>
                          {salePriceLabel}
                          {compareAtPriceLabel}
                        </>
                      )}
                    </View>
                    {!hideDiscountPercentage && discountPercentage !== null && promoOfferCaptionBelowPrice == null ? (
                      <Text
                        style={[
                          cardTextStyles.discountPercentage,
                          forcePromoStandardPriceLayout && styles.promoDiscountNoLeadingSpace,
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {forcePromoStandardPriceLayout ? '' : ' '}
                        {discountPercentage}% off
                      </Text>
                    ) : null}
                  </View>
                </>
              )}
            </View>
          </View>
          {/* Promo offer caption now shown in priceRow above */}
        </View>
        <TryAndBuyModal
          visible={showTryAndBuyModal}
          onClose={() => setShowTryAndBuyModal(false)}
        />
      </TouchableOpacity>
      {promoOfferBadgeActive && offerPriceDisplay != null && !promoOfferCaptionBelowPrice ? (
        <View style={[styles.promoOfferPriceBadge, styles.promoOfferPriceBadgeOuter]}>
          <Text style={styles.promoOfferPriceText} numberOfLines={1}>
            ₹{offerPriceDisplay}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 0.85,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    overflow: 'visible',
    borderRadius: 14,
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
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
    fontFamily: Fonts.LexendSemiBold,
    marginBottom: 2,
    color: Colors.text,
    lineHeight: 18,
  },
  vendorName: {
    fontSize: 11,
    fontFamily: Fonts.LexendMedium,
    marginBottom: 4,
    color: Colors.textSecondary,
    lineHeight: 14,
  },
  essentialsMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  essentialsMetaBox: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  essentialsMetaText: {
    fontSize: 10,
    fontFamily: Fonts.LexendSemiBold,
    color: '#1565C0',
    lineHeight: 14,
  },
  tbTag: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    paddingHorizontal: 6,
    borderRadius: 6,
    gap: 4,
    height: 18,
    zIndex: 10,
    minWidth: 65,
    borderColor: '#FDE047',
  },
  hangerIcon: {
    marginRight: 0,
    color: '#854D0E'
  },
  demoBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FEF7C3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 10,
  },
  demoBadgeText: {
    color: '#CA8504',
    fontSize: 11,
    fontFamily: Fonts.Bold,
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
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 0,
    flexWrap: 'nowrap',
    minWidth: 0,
  },
  /** MRP + sale only; `% off` sits flush after sale (no spacer pushing it to the row end). */
  priceTokens: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'nowrap',
    flexShrink: 1,
    minWidth: 0,
  },
  mainPrice: {
    color: '#2c6975',
    fontSize: 10,
    fontFamily: Fonts.LexendRegular,
    lineHeight: 16,
    flexShrink: 0,
  },
  comparePrice: {
    color: '#888888',
    textDecorationLine: 'line-through',
    fontSize: 12,
    fontFamily: Fonts.LexendRegular,
    flexShrink: 1,
    minWidth: 0,
  },
  discountPercentage: {
    color: '#2c6975',
    fontSize: 10,
    fontFamily: Fonts.LexendRegular,
    lineHeight: 16,
    flexShrink: 0,
    marginLeft: 0,
  },
  promoOfferStrikeThrough: {
    textDecorationLine: 'line-through',
  },
  promoDiscountNoLeadingSpace: {
    marginLeft: 4,
  },
  reducedPrice: {
    fontSize: 10,
    color: '#888888',
  },
  promoOfferPriceBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    backgroundColor: '#cef4da',
    padding: 4,
  },
  promoOfferPriceBadgeOuter: {
    marginHorizontal: 8,
    marginTop: 2,
    marginBottom: 2,
    backgroundColor: '#cef4da',
    padding: 4,
    borderRadius: 6,
  },
  promoOfferPriceText: {
    fontSize: 10,
    fontFamily: Fonts.LexendRegular,
    color: '#2E7D32',
    textAlign: 'left',
    lineHeight: 12,
  },
  promoOfferCaptionBelowWrap: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: '#cef4da',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  promoOfferCaptionBelowPriceRow: {
    fontSize: 16,
    fontFamily: Fonts.LexendBold,
    color: '#2E7D32',
    /** Must be ≥ fontSize — smaller lineHeight clips ₹ / ascenders on iOS. */
    lineHeight: 22,
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
    fontFamily: Fonts.LexendMedium,
    lineHeight: 14,
  },
  essentialsMarketPrice: {
    color: '#888888',
    textDecorationLine: 'line-through',
    fontSize: 10,
    fontFamily: Fonts.LexendMedium,
    lineHeight: 14,
  },
  essentialsOurPrice: {
    color: '#2c6975',
    fontSize: 12,
    fontFamily: Fonts.LexendBold,
    lineHeight: 16,
  },
  vendorBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 10,
  },
  vendorBadgeText: {
    color: '#000',
    fontSize: 10,
    fontFamily: Fonts.LexendSemiBold,
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
    color: '#854D0E',
    fontSize: 10,
    fontFamily: Fonts.LexendSemiBold,
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
    borderRadius: 14,
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
    fontFamily: Fonts.LexendSemiBold,
    letterSpacing: 0.5,
  },
  addButtonContainer: {
    position: 'absolute',
    right: -6,
    bottom: -6,
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
  if (prevProps.promoPercentOff !== nextProps.promoPercentOff) return false;
  if (prevProps.dealPromoPercentOff !== nextProps.dealPromoPercentOff) return false;
  if (prevProps.applyDealPromoToCart !== nextProps.applyDealPromoToCart) return false;
  if (prevProps.showPromoOfferPriceBadge !== nextProps.showPromoOfferPriceBadge) return false;
  if (prevProps.promoOfferCaptionBelowPrice !== nextProps.promoOfferCaptionBelowPrice) return false;
  if (prevProps.compactTypographyScale !== nextProps.compactTypographyScale) return false;
  if (prevProps.hideDiscountPercentage !== nextProps.hideDiscountPercentage) return false;
  if (prevProps.onPromoDealAddSuccess !== nextProps.onPromoDealAddSuccess) return false;
  if (prevProps.priceCompareFirst !== nextProps.priceCompareFirst) return false;
  if (prevProps.collectionId !== nextProps.collectionId) return false;

  return true;
};

export const ProductCard = memo(ProductCardComponent, areEqual);
export default ProductCard;
