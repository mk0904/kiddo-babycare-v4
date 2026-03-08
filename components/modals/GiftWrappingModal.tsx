import { Colors, Fonts } from '@/constants/theme';
import { useCartItems, useCartStore, useGiftWrapping } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WRAP_OPTION_SIZE = (SCREEN_WIDTH - 32 - 24) / 3;

function isTicketingItem(item: { bookingDate?: string; tags?: string[] }): boolean {
    if (item.bookingDate) return true;
    const hasTicketingTag = item.tags?.some((tag: any) => {
        const tagLower = typeof tag === 'string' ? tag.toLowerCase() : '';
        return tagLower.includes('event') || tagLower.includes('playhouse') || tagLower.includes('petting') ||
            tagLower.includes('farm') || tagLower.includes('ticket') || tagLower.includes('pass');
    });
    return !!hasTicketingTag;
}

interface GiftWrappingModalProps {
    visible: boolean;
    onClose: () => void;
}

const GIFT_WRAP_OPTIONS = [
    {
        id: 'standard',
        name: 'Wrap-1',
        description: 'Beautiful paper wrapping with a ribbon.',
        price: 30,
        image: require('@/assets/images/giftwrap1.jpeg'),
        color: '#FF6B6B',
    },
    {
        id: 'premium',
        name: 'Wrap-2',
        description: 'Hardcase premium box with satin ribbon.',
        price: 30,
        image: require('@/assets/images/giftwrap2.jpeg'),
        color: '#FFD700',
    },
    {
        id: 'deluxe',
        name: 'Wrap-3',
        price: 30,
        description: 'Luxury velvet box with personalized note.',
        image: require('@/assets/images/giftwrap3.jpeg'),
        color: '#9C27B0',
    },
];

export const GiftWrappingModal = ({ visible, onClose }: GiftWrappingModalProps) => {
    const insets = useSafeAreaInsets();
    const cartItems = useCartItems();
    const giftWrapping = useGiftWrapping();
    const setGiftWrapping = useCartStore(state => state.setGiftWrapping);
    const [selectedWrap, setSelectedWrap] = useState<typeof GIFT_WRAP_OPTIONS[0] | null>(null);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

    const eligibleItems = React.useMemo(
        () => cartItems.filter(item => !isTicketingItem(item)),
        [cartItems]
    );
    const eligibleIds = React.useMemo(() => eligibleItems.map(item => item.id), [eligibleItems]);

    useEffect(() => {
        if (visible) {
            const match = giftWrapping
                ? GIFT_WRAP_OPTIONS.find(w => w.name === giftWrapping.name)
                : null;
            setSelectedWrap(match ?? GIFT_WRAP_OPTIONS[0]);
            const existingIds = giftWrapping?.productIds ?? [];
            const defaultIds = existingIds.length > 0
                ? existingIds.filter(id => eligibleIds.includes(id))
                : eligibleIds;
            setSelectedProducts(defaultIds);
        }
    }, [visible, giftWrapping, eligibleIds]);

    const handleWrapSelect = (wrap: typeof GIFT_WRAP_OPTIONS[0]) => {
        setSelectedWrap(wrap);
    };

    const toggleProductSelection = (productId: string) => {
        setSelectedProducts(prev =>
            prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
        );
    };

    const handleConfirm = () => {
        if (selectedWrap && selectedProducts.length > 0) {
            const totalPrice = selectedProducts.length * selectedWrap.price;
            setGiftWrapping({
                name: selectedWrap.name,
                description: selectedWrap.description ?? '',
                price: totalPrice,
                productIds: selectedProducts,
            });
        } else if (selectedWrap) {
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

    const perItemPrice = selectedWrap?.price ?? GIFT_WRAP_OPTIONS[0]?.price ?? 30;
    const giftWrapTotal = selectedProducts.length * perItemPrice;

    return (
        <Modal
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <View style={styles.content}>
                    {/* Header with gift wrapper image (red + ribbon) - extends under status bar */}
                    <View style={[styles.header, { paddingTop: 12 + insets.top }]}>
                        <Image
                            source={require('@/assets/images/giftWrapperHeader.png')}
                            style={styles.headerImage}
                            contentFit="fill"
                        />
                        <TouchableOpacity onPress={onClose} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                            <Ionicons name="chevron-back" size={28} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.headerTitle}>Make this a gift</Text>
                            <Text style={styles.headerSubtitle}>
                                Get items gift wrapped for ₹{perItemPrice} per item
                                {selectedProducts.length > 0 ? ` · ₹${giftWrapTotal} total` : ''}
                            </Text>
                        </View>
                    </View>

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Eligible items - first */}
                        <Text style={styles.sectionTitle}>Eligible items</Text>
                        {eligibleItems.length === 0 ? (
                            <View style={styles.ineligibleNotice}>
                                <Text style={styles.ineligibleNoticeText}>No items in your cart are eligible for gift wrap.</Text>
                            </View>
                        ) : (
                            <>
                                <View style={styles.productCardsContainer}>
                                    {eligibleItems.map((item, index) => {
                                        const isSelected = selectedProducts.includes(item.id);
                                        const isLast = index === eligibleItems.length - 1;
                                        return (
                                            <TouchableOpacity
                                                key={item.id}
                                                style={[styles.productRow ]}
                                                onPress={() => toggleProductSelection(item.id)}
                                                activeOpacity={0.8}
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
                                    })}
                                </View>
                                <View style={styles.footnoteContainer}>
                                    <Text style={styles.footnote}>Certain items are not eligible for gift wrap</Text>
                                </View>
                            </>
                        )}

                        {/* Choose gift wrap - second */}
                        <Text style={[styles.sectionTitle, styles.sectionTitleSecond]}>Choose gift wrap</Text>
                        <View style={styles.wrapRow}>
                            {GIFT_WRAP_OPTIONS.map((wrap) => {
                                const isSelected = selectedWrap?.id === wrap.id;
                                return (
                                    <TouchableOpacity
                                        key={wrap.id}
                                        style={styles.wrapOptionWrap}
                                        onPress={() => handleWrapSelect(wrap)}
                                        activeOpacity={0.9}
                                    >
                                        <View style={styles.wrapCard}>
                                            <Image source={wrap.image} style={styles.wrapCardImage} contentFit="cover" />
                                        </View>
                                        <View style={[styles.radio, isSelected && styles.radioSelected]}>
                                            {isSelected && <View style={styles.radioInner} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <View style={styles.footnoteContainer}>
                            <Text style={styles.footnote}>All items selected are wrapped separately</Text>
                        </View>
                    </ScrollView>

                    {/* Sticky footer - Add for ₹20 */}
                    <View style={styles.footer}>
                        {giftWrapping != null && (
                            <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
                                <Ionicons name="trash-outline" size={18} color="#FF4444" />
                                <Text style={styles.removeButtonText}>Remove</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.addButton,
                                (!selectedWrap || selectedProducts.length === 0) && styles.addButtonDisabled,
                            ]}
                            onPress={handleConfirm}
                            disabled={!selectedWrap || selectedProducts.length === 0}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.addButtonText}>Add for ₹{giftWrapTotal}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.grey,
    },
    content: {
        flex: 1,
        backgroundColor: Colors.grey,
        width: '100%',
        overflow: 'hidden',
    },
    header: {
        position: 'relative',
        minHeight: 200,
        paddingBottom: 20,
        paddingHorizontal: 16,
        overflow: 'hidden',
        backgroundColor: Colors.primary,
    },
    headerImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: SCREEN_WIDTH,
        height: 290,
    },
    backButton: {
        marginBottom: 8,
        zIndex: 1,
    },
    headerTextWrap: {
        marginTop: 48,
        zIndex: 1,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: Fonts.SemiBold,
        color: '#fff',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#fff',
        opacity: 0.95,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#000',
        marginBottom: 12,
    },
    sectionTitleSecond: {
        marginTop: 24,
    },
    productCardsContainer: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    productRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    productRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    productImage: {
        width: 56,
        height: 56,
        borderRadius: 10,
        marginRight: 14,
        backgroundColor: Colors.grey,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    productInfo: {
        flex: 1,
        marginRight: 14,
        minWidth: 0,
    },
    productTitle: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#2D2D2D',
        marginBottom: 4,
    },
    variantText: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#666',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    footnoteContainer: {
        width: '100%',
        marginTop: 8,
    },
    footnote: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#999',
        textAlign: 'center',
    },
    ineligibleNotice: {
        padding: 14,
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    ineligibleNoticeText: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#666',
    },
    wrapRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    wrapOptionWrap: {
        alignItems: 'center',
        flex: 1,
    },
    wrapCard: {
        width: WRAP_OPTION_SIZE,
        height: WRAP_OPTION_SIZE,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: Colors.backgroundWhite,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
            android: { elevation: 2 },
        }),
    },
    wrapCardImage: {
        width: '100%',
        height: '100%',
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    radioSelected: {
        borderColor: Colors.primary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
    },
    footer: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
        backgroundColor: Colors.backgroundWhite,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        gap: 10,
    },
    removeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
    },
    removeButtonText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#FF4444',
    },
    addButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
            android: { elevation: 3 },
        }),
    },
    addButtonDisabled: {
        backgroundColor: Colors.disabled,
        ...Platform.select({ ios: { shadowOpacity: 0 }, android: { elevation: 0 } }),
    },
    addButtonText: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#fff',
    },
});
