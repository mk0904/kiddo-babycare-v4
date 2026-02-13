import { Colors, Fonts } from '@/constants/theme';
import { useCartItems, useCartStore } from '@/store/cartStore';
import { isVariantAvailable } from '@/utils/availability';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface UniversalAddProps {
    item: any;
    selectedVariant?: any;
    variant?: 'default' | 'prominent' | 'pdp';
    addText?: string;
    bookingDate?: Date | null; // For ticketing products
    onValidationError?: () => void; // Callback when validation fails
}

const UniversalAdd: React.FC<UniversalAddProps> = ({
    item,
    selectedVariant,
    variant = 'default',
    addText = 'ADD',
    bookingDate,
    onValidationError
}) => {
    // Use Zustand store instead of context
    const cartItems = useCartItems();
    const addItem = useCartStore(state => state.addItem);
    const removeItem = useCartStore(state => state.removeItem);
    const updateQuantity = useCartStore(state => state.updateQuantity);

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

    const handleAdd = async () => {
        if (!activeVariant) return;
        
        // Validate date selection for ticketing products
        // If bookingDate prop is passed (even if null), it means date selection is required
        if (bookingDate !== undefined && !bookingDate) {
            // Call validation error callback if provided
            if (onValidationError) {
                onValidationError();
            }
            Alert.alert(
                'Date Selection Required',
                'Please select a date before adding this item to cart.',
                [{ text: 'OK' }]
            );
            return;
        }
        
        // Check if variant ID looks like it's from search results (constructed from product_id)
        // Search results use: gid://shopify/ProductVariant/{product_id}
        // Real variant IDs are different. Extract numeric IDs to compare
        const variantIdStr = String(variantId || '');
        const productIdStr = String(productId || '');
        
        // Extract numeric IDs from GID format
        const productIdMatch = productIdStr.match(/Product\/(\d+)/);
        const variantIdMatch = variantIdStr.match(/ProductVariant\/(\d+)/);
        
        // If variant ID numeric part matches product ID numeric part, it's likely from search
        // Also check if product doesn't have proper variant structure (search results have simplified variants)
        const isSearchResultVariant = (productIdMatch && variantIdMatch && 
                                      productIdMatch[1] === variantIdMatch[1] &&
                                      variantIdStr.startsWith('gid://shopify/ProductVariant/')) ||
                                     (!item.variants?.edges || item.variants.edges.length === 0) ||
                                     (item.variants.edges.length === 1 && item.variants.edges[0]?.node?.title === 'Default');
        
        let finalVariant = activeVariant;
        let finalProduct = item;
        
        // If this looks like a search result, ALWAYS fetch the real product data from Shopify
        if (isSearchResultVariant && productId) {
            try {
                console.log('[UniversalAdd] Detected search result product, fetching real data for:', productId);
                const { shopifyApi } = await import('@/services/shopifyApi');
                const fullProduct = await shopifyApi.getProductById(productId);
                
                if (fullProduct && fullProduct.variants?.edges && fullProduct.variants.edges.length > 0) {
                    // Use the first available variant, or first variant if none available
                    const realVariant = fullProduct.variants.edges.find((e: any) => {
                        const v = e.node;
                        return isVariantAvailable(v) === true;
                    })?.node || fullProduct.variants.edges[0]?.node;
                    
                    if (realVariant) {
                        console.log('[UniversalAdd] Using real variant ID:', realVariant.id, 'instead of search variant:', variantId);
                        finalVariant = realVariant;
                        finalProduct = fullProduct;
                    } else {
                        console.warn('[UniversalAdd] No valid variant found in fetched product');
                    }
                } else {
                    console.warn('[UniversalAdd] Fetched product has no variants');
                }
            } catch (error) {
                console.error('[UniversalAdd] Error fetching real product data:', error);
                // Don't add to cart if we can't get real variant ID - this prevents checkout errors
                throw new Error('Unable to verify product availability. Please try again.');
            }
        }
        
        // Get image URL
        const imageUrl = finalVariant.image?.url || 
                        finalProduct.images?.[0]?.url || 
                        finalProduct.featuredImage?.url || 
                        finalProduct.images?.edges?.[0]?.node?.url || 
                        '';

        // Get price
        const price = parseFloat(
            finalVariant.price?.amount || 
            finalProduct.priceRange?.minVariantPrice?.amount || 
            finalProduct.price?.amount || 
            '0'
        );

        // Create cart item with real variant ID
        const cartItem = {
            productId: productId || '',
            variantId: finalVariant.id || variantId || '',
            title: finalProduct.title || finalProduct.name || 'Product',
            variantTitle: finalVariant.title,
            price,
            compareAtPrice: finalVariant.compareAtPrice?.amount 
                ? parseFloat(finalVariant.compareAtPrice.amount) 
                : undefined,
            currencyCode: finalVariant.price?.currencyCode || finalProduct.priceRange?.minVariantPrice?.currencyCode || 'INR',
            image: imageUrl,
            quantity: 1,
            availableForSale: isVariantAvailable(finalVariant) !== false,
            tags: finalProduct.tags || [],
            bookingDate: bookingDate ? bookingDate.toISOString() : undefined,
        };

        await addItem(cartItem);
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
                    iconColor: Colors.secondary
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
                    iconColor: Colors.secondary
                };
        }
    };

    const currentStyles = getStyles();

    return (
        <View>
            {count === 0 ? (
                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation();
                        handleAdd();
                    }}
                    activeOpacity={0.7}
                    style={currentStyles.container}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <View style={currentStyles.add}>
                        <Text style={currentStyles.addText}>
                            {addText}
                        </Text>
                    </View>
                </TouchableOpacity>
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
    );
};

const styles = StyleSheet.create({
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
        borderColor: Colors.secondary,
        backgroundColor: '#FFFFFF',
    },
    counterText: {
        color: Colors.secondary,
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
        maxWidth: 90,
        paddingHorizontal: 6,
        paddingVertical: 4,
        justifyContent: 'space-between',
        gap: 4,
        minWidth: 70,
        height: 38,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
    },
    prominentCounterText: {
        color: Colors.secondary,
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
