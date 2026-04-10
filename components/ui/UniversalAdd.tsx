import { StockLimitModal } from '@/components/modals/StockLimitModal';
import type { TryAndBuyVariantSelectionResult } from '@/components/modals/VariantSelectionModal';
import { VariantSelectionModal } from '@/components/modals/VariantSelectionModal';
import { Colors, Fonts } from '@/constants/theme';
import { useCartItems, useCartStore } from '@/store/cartStore';
import { isVariantAvailable } from '@/utils/availability';
import { hasTryAndBuyProduct, tryBuyTrialOptionValueFromVariant } from '@/utils/tryAndBuyProduct';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UniversalAddProps {
    item: any;
    selectedVariant?: any;
    variant?: 'default' | 'prominent' | 'pdp';
    addText?: string;
    bookingDate?: Date | null; // For ticketing products
    /** When true and count is 0, show "Add to cart" instead of + icon */
    isTicketing?: boolean;
    onValidationError?: () => void; // Callback when validation fails
    /**
     * PDP inline Try & Buy: optional second variant from page (no modal).
     * Ignored when not on PDP / not try-and-buy.
     */
    tryBuyTrialVariant?: any;
    /** PDP: when true, block add until shopper picks required options (e.g. Try & Buy size row). */
    pdpAddBlocked?: boolean;
    pdpAddBlockedMessage?: string;
}

/** Format date as YYYY-MM-DD in local time so the calendar date is preserved (no UTC shift). */
function bookingDateToYYYYMMDD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

const UniversalAdd: React.FC<UniversalAddProps> = ({
    item,
    selectedVariant,
    variant = 'default',
    addText = 'ADD',
    bookingDate,
    isTicketing = false,
    onValidationError,
    tryBuyTrialVariant,
    pdpAddBlocked = false,
    pdpAddBlockedMessage = 'Please choose your size above before adding to cart.',
}) => {
    // Use Zustand store instead of context
    const cartItems = useCartItems();
    const addItem = useCartStore(state => state.addItem);
    const removeItem = useCartStore(state => state.removeItem);
    const updateQuantity = useCartStore(state => state.updateQuantity);
    const [stockLimitModal, setStockLimitModal] = useState<{ visible: boolean; maxQty: number }>({ visible: false, maxQty: 0 });
    const [variantModalVisible, setVariantModalVisible] = useState(false);
    const [fullProductData, setFullProductData] = useState<any>(null);
    const [isFetchingFullProduct, setIsFetchingFullProduct] = useState(false);

    // Get variant to create the correct cart item ID
    const variants = item.variants?.edges || item.variants || [];
    // Prioritize selectedVariant if passed
    const activeVariant = selectedVariant || variants[0]?.node || variants[0] || item;
    const productId = item.id || item._id;
    const variantId = activeVariant.id || activeVariant._id;

    // Get count for this specific item by matching variantId or productId
    // This handles cases where search results have different variant IDs than what's in the cart
    const getItemCount = () => {
        // First, try to match by variantId
        let cartItem = cartItems.find(
            (ci) => ci.variantId === variantId
        );

        // If not found and we have a productId, try matching by productId
        // This handles search results where variant IDs might not match exactly
        if (!cartItem && productId) {
            cartItem = cartItems.find(
                (ci) => ci.productId === productId
            );
        }

        return cartItem ? cartItem.quantity : 0;
    };

    const count = getItemCount();

    const completeAddToCart = async (currentItem: any, finalVariant: any, tryVariant?: any) => {
        const pid = currentItem.id || currentItem._id || productId;

        // Validate date selection for ticketing products
        if (bookingDate !== undefined && !bookingDate) {
            if (onValidationError) onValidationError();
            Alert.alert(
                'Date Selection Required',
                'Please select a date before adding this item to cart.',
                [{ text: 'OK' }],
            );
            return;
        }

        // Get tags
        let tagsToUse = currentItem.tags || [];
        if (pid && (!tagsToUse || tagsToUse.length === 0)) {
            try {
                const { shopifyApi } = await import('@/services/shopifyApi');
                const fullProduct = await shopifyApi.getProductById(pid);
                if (fullProduct?.tags?.length) tagsToUse = fullProduct.tags;
            } catch {
                /* ignore */
            }
        }

        const imageUrl =
            finalVariant.image?.url ||
            currentItem.images?.[0]?.url ||
            currentItem.featuredImage?.url ||
            currentItem.images?.edges?.[0]?.node?.url ||
            '';

        const price = parseFloat(
            finalVariant.price?.amount ||
                currentItem.priceRange?.minVariantPrice?.amount ||
                currentItem.price?.amount ||
                '0',
        );

        const quantityAvailable =
            finalVariant.quantityAvailable != null ? Number(finalVariant.quantityAvailable) : undefined;
        if (typeof quantityAvailable === 'number' && quantityAvailable < 1) {
            setStockLimitModal({ visible: true, maxQty: 0 });
            return;
        }

        const cartItem = {
            productId: pid || '',
            variantId: finalVariant.id || variantId || '',
            title: currentItem.title || currentItem.name || 'Product',
            variantTitle: finalVariant.title,
            price,
            compareAtPrice: finalVariant.compareAtPrice?.amount
                ? parseFloat(finalVariant.compareAtPrice.amount)
                : undefined,
            currencyCode:
                finalVariant.price?.currencyCode ||
                currentItem.priceRange?.minVariantPrice?.currencyCode ||
                'INR',
            image: imageUrl,
            quantity: 1,
            availableForSale: isVariantAvailable(finalVariant) !== false,
            quantityAvailable: Number.isFinite(quantityAvailable) ? quantityAvailable : undefined,
            tags: tagsToUse,
            bookingDate: bookingDate ? bookingDateToYYYYMMDD(bookingDate) : undefined,
            ...(tryVariant
                ? {
                      customAttributes: {
                          try_buy_trial_variant_id: String(tryVariant.id || ''),
                          try_buy_trial_variant_title: String(tryVariant.title || ''),
                          try_buy_trial_option_value: tryBuyTrialOptionValueFromVariant(tryVariant),
                      },
                  }
                : {}),
        };

        try {
            await addItem(cartItem);
        } catch (err: any) {
            Alert.alert('Cannot add to cart', err?.message || 'This item is not available in the requested quantity.');
        }
    };

    const handleAdd = async (variantToUse?: any) => {
        if (variant === 'pdp' && pdpAddBlocked) {
            Alert.alert('Select size', pdpAddBlockedMessage, [{ text: 'OK' }]);
            return;
        }
        let currentItem = item;
        let finalVariant = variantToUse || activeVariant;

        const productIdStr = String(productId || '');
        const variantIdStr = String(variantId || '');
        const productIdMatch = productIdStr.match(/Product\/(\d+)/);
        const variantIdMatch = variantIdStr.match(/ProductVariant\/(\d+)/);

        // Check if this looks like a search result variant (constructed from product ID)
        // or a product with incomplete variant data
        const isSearchResultVariant =
            (productIdMatch &&
                variantIdMatch &&
                productIdMatch[1] === variantIdMatch[1] &&
                variantIdStr.startsWith('gid://shopify/ProductVariant/')) ||
            (!item.variants?.edges || (Array.isArray(item.variants) && item.variants.length === 0)) ||
            (item.variants?.edges?.length === 1 && item.variants.edges[0]?.node?.title === 'Default');

        // If it's a search result, we MUST fetch full product data to check for variants and availability
        if (isSearchResultVariant && productId && !variantToUse && !fullProductData) {
            try {
                setIsFetchingFullProduct(true);
                const { shopifyApi } = await import('@/services/shopifyApi');
                const fullProduct = await shopifyApi.getProductById(productId);
                if (fullProduct) {
                    setFullProductData(fullProduct);
                    currentItem = fullProduct;

                    const fullVariants = Array.isArray(fullProduct.variants?.edges)
                        ? fullProduct.variants.edges
                        : Array.isArray(fullProduct.variants)
                          ? fullProduct.variants
                          : [];

                    const tryBuy = hasTryAndBuyProduct(fullProduct);

                    if (fullVariants.length > 1 && variant !== 'pdp') {
                        if (tryBuy) {
                            setVariantModalVisible(true);
                            setIsFetchingFullProduct(false);
                            return;
                        }
                        const nodes = fullVariants.map((e: any) => e?.node ?? e);
                        const firstAvail =
                            nodes.find((v: any) => isVariantAvailable(v) !== false) || nodes[0];
                        if (!variantToUse && firstAvail) {
                            finalVariant = firstAvail;
                        }
                    } else if (!variantToUse && fullVariants.length > 0) {
                        const first = fullVariants[0];
                        finalVariant = first?.node || first;
                    }
                }
            } catch (error) {
                console.error('[UniversalAdd] Error fetching full product:', error);
            } finally {
                setIsFetchingFullProduct(false);
            }
        } else if (fullProductData) {
            currentItem = fullProductData;
        }

        const variantsArr = currentItem.variants?.edges || currentItem.variants || [];
        const hasMultipleVariants = variantsArr.length > 1;
        const tryBuy = hasTryAndBuyProduct(currentItem);

        if (hasMultipleVariants && !variantToUse) {
            if (tryBuy) {
                /** PDP uses inline Try & Buy picker; modal only for cards/search. */
                if (variant !== 'pdp') {
                    setVariantModalVisible(true);
                    return;
                }
            } else if (variant !== 'pdp') {
                const nodes = variantsArr.map((e: any) => e?.node ?? e);
                const firstAvail = nodes.find((v: any) => isVariantAvailable(v) !== false) || nodes[0];
                if (firstAvail) {
                    finalVariant = firstAvail;
                }
            }
        }

        if (!finalVariant) return;

        // Final check for out of stock - if adding first variant and it's OOS, find first available
        if (!variantToUse) {
            const currentQty =
                finalVariant.quantityAvailable != null ? Number(finalVariant.quantityAvailable) : undefined;
            if (
                (typeof currentQty === 'number' && currentQty < 1) ||
                isVariantAvailable(finalVariant) === false
            ) {
                const nodes = variantsArr.map((e: any) => e?.node ?? e);
                const firstAvailable = nodes.find((v: any) => isVariantAvailable(v) === true);
                if (firstAvailable) {
                    finalVariant = firstAvailable;
                }
            }
        }

        const trialExtra =
            variant === 'pdp' && tryBuy && tryBuyTrialVariant ? tryBuyTrialVariant : undefined;
        await completeAddToCart(currentItem, finalVariant, trialExtra);
    };

    const handleTryBuyModalConfirm = async (result: TryAndBuyVariantSelectionResult) => {
        const currentItem = fullProductData || item;
        await completeAddToCart(currentItem, result.keepVariant, result.tryVariant);
    };

    const getCartItem = () => {
        // First try by variantId
        let cartItem = cartItems.find(ci => ci.variantId === variantId);
        // If not found and we have productId, try by productId
        // This handles search results where variant IDs might not match exactly
        if (!cartItem && productId) {
            cartItem = cartItems.find(ci => ci.productId === productId);
        }
        return cartItem;
    };

    const handleRemove = async () => {
        const cartItem = getCartItem();
        if (cartItem) {
            await removeItem(cartItem.id);
        }
    };

    const handleIncrement = async () => {
        if (count === 0) {
            await handleAdd();
        } else {
            const cartItem = getCartItem();
            if (cartItem) {
                const maxQty = cartItem.quantityAvailable;
                if (typeof maxQty === 'number' && count >= maxQty) {
                    setStockLimitModal({ visible: true, maxQty });
                    return;
                }
                await updateQuantity(cartItem.id, count + 1);
            }
        }
    };

    const handleDecrement = async () => {
        if (count > 1) {
            const cartItem = getCartItem();
            if (cartItem) {
                await updateQuantity(cartItem.id, count - 1);
            }
        } else {
            await handleRemove();
        }
    };

    const getStyles = () => {
        switch (variant) {
            case 'prominent':
                return {
                    container: styles.prominentContainer,
                    add: styles.prominentAdd,
                    addText: styles.prominentAddText,
                    counterContainer: styles.prominentCounterContainer,
                    counterText: styles.prominentCounterText,
                    iconSize: 16,
                    iconColor: '#FFFFFF'
                };
            case 'pdp':
                return {
                    container: styles.pdpContainer,
                    add: styles.pdpAdd,
                    addText: styles.pdpAddText,
                    counterContainer: styles.pdpCounterContainer,
                    counterText: styles.pdpCounterText,
                    iconSize: 20,
                    iconColor: '#fff'
                };
            default:
                return {
                    container: styles.container,
                    add: styles.add,
                    addText: styles.addText,
                    counterContainer: styles.counterContainer,
                    counterText: styles.counterText,
                    iconSize: 15,
                    iconColor: '#FFFFFF'
                };
        }
    };

    const currentStyles = getStyles();

    return (
        <>
            <View>
                {count === 0 ? (
                    (variant === 'pdp' || isTicketing) ? (
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                handleAdd();
                            }}
                            activeOpacity={0.7}
                            style={variant === 'pdp' ? [styles.pdpContainer, styles.pdpAdd] : styles.addToCartButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Text style={variant === 'pdp' ? styles.pdpAddText : styles.addToCartButtonText}>
                                {variant === 'pdp' ? (addText || 'Add to Cart') : 'Add to cart'}
                            </Text>
                        </TouchableOpacity>
                    ) : variant === 'prominent' ? (
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                handleAdd();
                            }}
                            activeOpacity={0.85}
                            style={styles.prominentAddButton}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                            {isFetchingFullProduct ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.addPlusGlyph}>+</Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                handleAdd();
                            }}
                            activeOpacity={0.7}
                            style={styles.addCircleButton}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            {isFetchingFullProduct ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.addPlusGlyph}>+</Text>
                            )}
                        </TouchableOpacity>
                    )
                ) : (
                    <View style={currentStyles.counterContainer}>
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                handleDecrement();
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.buttonWrapper}
                        >
                            <Ionicons name="remove" color={currentStyles.iconColor} size={currentStyles.iconSize} />
                        </TouchableOpacity>
                        <Text style={currentStyles.counterText}>
                            {count}
                        </Text>
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                handleIncrement();
                            }}
                            activeOpacity={0.7}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.buttonWrapper}
                        >
                            <Ionicons name="add" color={currentStyles.iconColor} size={currentStyles.iconSize} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
            <StockLimitModal
                visible={stockLimitModal.visible}
                maxQuantity={stockLimitModal.maxQty}
                onClose={() => setStockLimitModal((s) => ({ ...s, visible: false }))}
            />
            <VariantSelectionModal
                visible={variantModalVisible}
                product={fullProductData || item}
                layout="sheet"
                onClose={() => setVariantModalVisible(false)}
                onAddToCart={handleTryBuyModalConfirm}
            />
        </>
    );
};

const styles = StyleSheet.create({
    /** Heavier than Ionicons “add” — typographic + with max Metropolis weight */
    addPlusGlyph: {
        color: '#FFFFFF',
        fontSize: 26,
        fontFamily: Fonts.Black,
        lineHeight: 28,
        textAlign: 'center',
        includeFontPadding: false,
        ...Platform.select({
            android: { marginTop: -2 },
            default: { marginTop: -1 },
        }),
    },
    /** Product cards: rounded square + control, bottom-right on image (see reference) */
    prominentAddButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.18,
                shadowRadius: 2.5,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    addCircleButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    addToCartButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 42,
    },
    addToCartButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
    },
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.secondary,
        minWidth: 110,
        maxWidth: 140,
        height: 42,
        borderRadius: 8,
        flexShrink: 0,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    add: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addText: {
        color: Colors.secondary,
        fontSize: 13,
        fontWeight: '600',
    },
    counterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        maxWidth: 140,
        paddingHorizontal: 10,
        paddingVertical: 6,
        justifyContent: 'space-between',
        gap: 8,
        minWidth: 110,
        height: 42,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    counterText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    prominentContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        minWidth: 70,
        maxWidth: 90,
        height: 38,
        borderRadius: 8,
        flexShrink: 0,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    prominentAdd: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    prominentAddText: {
        color: Colors.secondary,
        fontSize: 11,
        letterSpacing: 0.5,
        fontWeight: '600',
    },
    prominentCounterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        maxWidth: 96,
        paddingHorizontal: 6,
        paddingVertical: 4,
        justifyContent: 'space-between',
        gap: 4,
        minWidth: 72,
        height: 36,
        borderRadius: 10,
        borderWidth: 0,
        backgroundColor: Colors.primary,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.12,
                shadowRadius: 2,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    prominentCounterText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    buttonWrapper: {
        padding: 6,
        minWidth: 32,
        minHeight: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pdpContainer: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 12,
        minWidth: 160,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pdpAdd: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pdpAddText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
    },
    pdpCounterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        borderWidth: 1,
        borderColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 6,
        borderRadius: 12,
        minWidth: 160,
        height: 48,
        justifyContent: 'space-between',
    },
    pdpCounterText: {
        color: '#fff',
        fontSize: 18,
        fontFamily: Fonts.Bold,
    },
});

export default UniversalAdd;
