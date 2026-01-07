import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { useCartStore, useCartItems } from '@/store/cartStore';

interface UniversalAddProps {
    item: any;
    selectedVariant?: any;
    variant?: 'default' | 'prominent' | 'pdp';
    addText?: string;
}

const UniversalAdd: React.FC<UniversalAddProps> = ({
    item,
    selectedVariant,
    variant = 'default',
    addText = 'ADD'
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

    // Get count for this specific item by matching variantId
    const getItemCount = () => {
        const cartItem = cartItems.find(
            (ci) => ci.variantId === variantId
        );
        return cartItem ? cartItem.quantity : 0;
    };

    const count = getItemCount();

    const handleAdd = async () => {
        if (!activeVariant) return;
        
        // Get image URL
        const imageUrl = activeVariant.image?.url || 
                        item.images?.[0]?.url || 
                        item.featuredImage?.url || 
                        item.images?.edges?.[0]?.node?.url || 
                        '';

        // Get price
        const price = parseFloat(
            activeVariant.price?.amount || 
            item.priceRange?.minVariantPrice?.amount || 
            item.price?.amount || 
            '0'
        );

        // Create cart item
        const cartItem = {
            productId: productId || '',
            variantId: variantId || '',
            title: item.title || item.name || 'Product',
            variantTitle: activeVariant.title,
            price,
            compareAtPrice: activeVariant.compareAtPrice?.amount 
                ? parseFloat(activeVariant.compareAtPrice.amount) 
                : undefined,
            currencyCode: activeVariant.price?.currencyCode || item.priceRange?.minVariantPrice?.currencyCode || 'INR',
            image: imageUrl,
            quantity: 1,
            availableForSale: activeVariant.availableForSale !== false,
            tags: item.tags || [],
        };

        await addItem(cartItem);
    };

    const handleRemove = async () => {
        const cartItem = cartItems.find(ci => ci.variantId === variantId);
        if (cartItem) {
            await removeItem(cartItem.id);
        }
    };

    const handleIncrement = async () => {
        if (count === 0) {
            await handleAdd();
        } else {
            const cartItem = cartItems.find(ci => ci.variantId === variantId);
            if (cartItem) {
                await updateQuantity(cartItem.id, count + 1);
            }
        }
    };

    const handleDecrement = async () => {
        if (count > 1) {
            const cartItem = cartItems.find(ci => ci.variantId === variantId);
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
