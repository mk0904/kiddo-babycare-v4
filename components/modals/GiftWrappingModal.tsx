import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Pressable,
    FlatList,
    Platform,
    Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { useCartStore, useCartItems, useGiftWrapping } from '@/store/cartStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLUMNS = 3;
const ITEM_SPACING = 8;
const ITEM_WIDTH = (SCREEN_WIDTH - 40 - (ITEM_SPACING * (GRID_COLUMNS - 1))) / GRID_COLUMNS;

interface GiftWrappingModalProps {
    visible: boolean;
    onClose: () => void;
}

const GIFT_WRAP_OPTIONS = [
    {
        id: 'standard',
        name: 'Standard',
        description: 'Beautiful paper wrapping with a ribbon.',
        price: 30,
        image: 'https://cdn.shopify.com/s/files/1/0661/2765/9253/files/gift-wrap-standard.jpg?v=1704354321', // Placeholder or real URL
        color: '#FF6B6B',
    },
    {
        id: 'premium',
        name: 'Premium',
        description: 'Hardcase premium box with satin ribbon.',
        price: 99,
        image: 'https://cdn.shopify.com/s/files/1/0661/2765/9253/files/gift-wrap-premium.jpg?v=1704354321', // Placeholder or real URL
        color: '#FFD700',
    },
    {
        id: 'deluxe',
        name: 'Deluxe',
        price: 150,
        description: 'Luxury velvet box with personalized note.',
        image: 'https://cdn.shopify.com/s/files/1/0661/2765/9253/files/gift-wrap-deluxe.jpg?v=1704354321',
        color: '#9C27B0'
    },
];

export const GiftWrappingModal = ({ visible, onClose }: GiftWrappingModalProps) => {
    // Use Zustand store
    const cartItems = useCartItems();
    const giftWrapping = useGiftWrapping();
    const setGiftWrapping = useCartStore(state => state.setGiftWrapping);
    const [selectedWrap, setSelectedWrap] = useState(giftWrapping);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

    useEffect(() => {
        if (visible) {
            setSelectedWrap(giftWrapping);
            setSelectedProducts(giftWrapping?.productIds || cartItems.map(item => item.id)); // Default select all if new
        }
    }, [visible, giftWrapping, cartItems]);

    const handleWrapSelect = (wrap: any) => {
        setSelectedWrap(wrap);
    };

    const toggleProductSelection = (productId: string) => {
        setSelectedProducts(prev => {
            if (prev.includes(productId)) {
                return prev.filter(id => id !== productId);
            } else {
                return [...prev, productId];
            }
        });
    };

    const handleSelectAll = () => {
        if (selectedProducts.length === cartItems.length) {
            setSelectedProducts([]);
        } else {
            setSelectedProducts(cartItems.map(item => item.id));
        }
    };

    const handleConfirm = () => {
        if (selectedWrap && selectedProducts.length > 0) {
            setGiftWrapping({
                ...selectedWrap,
                productIds: selectedProducts,
            });
        } else if (selectedWrap) {
            // If wrap selected but no products, warn or just clear?
            // Kiddo logic: if no products, remove wrapping.
            setGiftWrapping(null);
        }
        onClose();
    };

    const handleRemove = () => {
        setGiftWrapping(null);
        setSelectedWrap(null);
        setSelectedProducts([]);
        onClose();
    };

    const renderWrapOption = ({ item }: { item: any }) => {
        const isSelected = selectedWrap?.id === item.id;
        return (
            <TouchableOpacity
                style={[
                    styles.wrapCard,
                    isSelected && styles.wrapCardSelected,
                ]}
                onPress={() => handleWrapSelect(item)}
            >
                <Image
                    source={item.image} // In real app use configured images
                    style={styles.wrapImage}
                    contentFit="cover"
                    placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                    transition={200}
                />
                <View style={[styles.wrapOverlay, isSelected && styles.wrapOverlaySelected]}>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </View>
                <View style={styles.wrapInfo}>
                    <Text style={styles.wrapName}>{item.name}</Text>
                    <Text style={styles.wrapPrice}>₹{item.price}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const renderProductItem = ({ item }: { item: any }) => {
        const isSelected = selectedProducts.includes(item.id);

        return (
            <TouchableOpacity
                style={[
                    styles.productCard,
                    isSelected && styles.productCardSelected,
                ]}
                onPress={() => toggleProductSelection(item.id)}
            >
                <Image
                    source={item.image}
                    style={styles.productImage}
                    contentFit="cover"
                />
                <View style={styles.productInfo}>
                    <Text style={styles.productTitle} numberOfLines={2}>
                        {item.title}
                    </Text>
                    {item.variantTitle && item.variantTitle !== 'Default Title' && (
                        <Text style={styles.variantText}>{item.variantTitle}</Text>
                    )}
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Gift Wrapping</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Wrapping Options */}
                        <Text style={styles.sectionTitle}>Choose Wrapping Style</Text>
                        <FlatList
                            data={GIFT_WRAP_OPTIONS}
                            renderItem={renderWrapOption}
                            keyExtractor={(item) => item.id}
                            numColumns={GRID_COLUMNS}
                            columnWrapperStyle={styles.gridRow}
                            scrollEnabled={false}
                        />

                        {/* Product Selection */}
                        {selectedWrap && (
                            <View style={styles.productSection}>
                                <View style={styles.productSectionHeader}>
                                    <View>
                                        <Text style={styles.sectionTitle}>Select Products</Text>
                                        <Text style={styles.sectionSubtitle}>Select items to be wrapped</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.selectAllBtn}
                                        onPress={handleSelectAll}
                                    >
                                        <Text style={styles.selectAllText}>
                                            {selectedProducts.length === cartItems.length ? 'Deselect All' : 'Select All'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <FlatList
                                    data={cartItems}
                                    renderItem={renderProductItem}
                                    keyExtractor={(item) => item.id}
                                    scrollEnabled={false}
                                    scrollEventThrottle={16}
                                />
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        {giftWrapping && (
                            <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
                                <Ionicons name="trash-outline" size={18} color="#FF4444" />
                                <Text style={styles.removeButtonText}>Remove</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.confirmButton,
                                (!selectedWrap || selectedProducts.length === 0) && styles.confirmButtonDisabled
                            ]}
                            onPress={handleConfirm}
                            disabled={!selectedWrap || selectedProducts.length === 0}
                        >
                            <Text style={styles.confirmButtonText}>
                                {selectedWrap ? `Confirm (₹${selectedWrap.price})` : 'Confirm'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '90%',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#000',
    },
    closeButton: {
        padding: 4,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#000',
        marginBottom: 12,
    },
    sectionSubtitle: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#666',
    },
    gridRow: {
        gap: ITEM_SPACING,
        marginBottom: 15,
    },
    wrapCard: {
        width: ITEM_WIDTH,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#eee',
        overflow: 'hidden',
    },
    wrapCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: '#fff5f5',
    },
    wrapImage: {
        width: '100%',
        height: ITEM_WIDTH, // Square image
        backgroundColor: '#f9f9f9',
    },
    wrapOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.8)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    wrapOverlaySelected: {
        backgroundColor: '#fff',
    },
    wrapInfo: {
        padding: 8,
    },
    wrapName: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        color: '#000',
        marginBottom: 2,
    },
    wrapPrice: {
        fontSize: 12,
        fontFamily: Fonts.Bold,
        color: Colors.primary,
    },
    productSection: {
        marginTop: 20,
        marginBottom: 40,
    },
    productSectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    selectAllBtn: {
        backgroundColor: '#f5f5f5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    selectAllText: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    productCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#eee',
        marginBottom: 10,
    },
    productCardSelected: {
        borderColor: Colors.primary,
        backgroundColor: '#fdfdfd',
    },
    productImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#f5f5f5',
    },
    productInfo: {
        flex: 1,
        marginRight: 12,
    },
    productTitle: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#000',
        marginBottom: 4,
    },
    variantText: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#777',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#ddd',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        flexDirection: 'row',
        gap: 15,
    },
    removeButton: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ff4444',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    removeButtonText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#ff4444',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    confirmButtonDisabled: {
        backgroundColor: '#ccc',
        shadowOpacity: 0,
        elevation: 0,
    },
    confirmButtonText: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#fff',
    },
});
