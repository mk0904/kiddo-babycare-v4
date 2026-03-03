import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface CartItemProps {
    item: {
        id: string;
        productId: string;
        variantId: string;
        title: string;
        variantTitle?: string;
        price: number;
        currencyCode: string;
        image: string;
        quantity: number;
        tags?: string[];
        bookingDate?: string; // ISO date string for ticketing products
    };
    onUpdateQuantity: (itemId: string, quantity: number) => void;
    onRemove: (itemId: string) => void;
    onPress?: (item: any) => void;
}

export const CartItem: React.FC<CartItemProps> = ({
    item,
    onUpdateQuantity,
    onRemove,
    onPress,
}) => {
    // Check if item has fashion tag (for Try & Buy badge)
    const hasFashionTag = item.tags?.some(
        tag => typeof tag === 'string' && tag.toLowerCase() === 'fashion'
    );

    const formattedPrice = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: item.currencyCode || 'INR',
        minimumFractionDigits: 0,
    }).format(item.price);

    const formattedTotal = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: item.currencyCode || 'INR',
        minimumFractionDigits: 0,
    }).format(item.price * item.quantity);

    const handleQuantityChange = (delta: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onUpdateQuantity(item.id, item.quantity + delta);
    };

    const handleRemove = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onRemove(item.id);
    };

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={() => onPress?.(item)}
            activeOpacity={0.7}
        >
            {/* Product Image */}
            <View style={styles.imageContainer}>
                {hasFashionTag && (
                    <View style={styles.tbBadge}>
                        <Text style={styles.tbBadgeText}>T&B</Text>
                    </View>
                )}
                <Image
                    source={{ uri: item.image }}
                    style={styles.image}
                    contentFit="cover"
                    transition={200}
                />
            </View>

            {/* Product Info */}
            <View style={styles.infoContainer}>
                <View style={styles.topRow}>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title} numberOfLines={2}>
                            {item.title}
                        </Text>
                        {item.variantTitle && item.variantTitle !== 'Default Title' && (
                            <View style={styles.variantPill}>
                                <Text style={styles.variantText} numberOfLines={1}>
                                    {item.variantTitle}
                                </Text>
                            </View>
                        )}
                        {item.bookingDate && (
                            <View style={styles.bookingDateContainer}>
                                <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                                <Text style={styles.bookingDateText}>
                                    {new Date(item.bookingDate).toLocaleDateString('en-US', {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={handleRemove}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Ionicons name="trash-outline" size={18} color="#FF4444" />
                    </TouchableOpacity>
                </View>

                <View style={styles.bottomRow}>
                    <View style={styles.priceContainer}>
                        <Text style={styles.price}>{formattedPrice}</Text>
                        {item.quantity > 1 && (
                            <Text style={styles.totalPrice}>Total: {formattedTotal}</Text>
                        )}
                    </View>

                    {/* Quantity Controls */}
                    <View style={styles.quantityContainer}>
                        <TouchableOpacity
                            style={[
                                styles.quantityButton,
                                item.quantity <= 1 && styles.quantityButtonDisabled,
                            ]}
                            onPress={() => handleQuantityChange(-1)}
                            disabled={item.quantity <= 1}
                        >
                            <Ionicons
                                name="remove"
                                size={18}
                                color={item.quantity <= 1 ? '#CCC' : Colors.primary}
                            />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => handleQuantityChange(1)}
                        >
                            <Ionicons name="add" size={18} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    imageContainer: {
        position: 'relative',
        width: 100,
        height: 100,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F5F5F5',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    tbBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: Colors.primary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        zIndex: 1,
    },
    tbBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: Fonts.Bold,
    },
    infoContainer: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'space-between',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    titleContainer: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
        lineHeight: 20,
    },
    variantPill: {
        backgroundColor: '#F0F0F0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginTop: 6,
        alignSelf: 'flex-start',
    },
    variantText: {
        fontSize: 11,
        fontFamily: Fonts.Regular,
        color: '#666',
    },
    bookingDateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        backgroundColor: '#FFF5F5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    bookingDateText: {
        fontSize: 11,
        fontFamily: Fonts.Medium,
        color: Colors.primary,
        marginLeft: 4,
    },
    removeButton: {
        padding: 4,
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    priceContainer: {
        flex: 1,
    },
    price: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    totalPrice: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#666',
        marginTop: 2,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F8F8',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    quantityButton: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quantityButtonDisabled: {
        opacity: 0.5,
    },
    quantityText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#1A1A1A',
        minWidth: 24,
        textAlign: 'center',
    },
});

export default CartItem;
