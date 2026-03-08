import { Colors, Fonts } from '@/constants/theme';
import { configService } from '@/services/configService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';
const OFFER_BLUE = '#2563EB';
const FREE_GREEN = '#16A34A';
const ORIGINAL_PRICE = 4999;
const SIZES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'];
const SIZES_DISABLED_START = 8; // S8, S9, S10 disabled (indices 7, 8, 9)

export interface FreePairShoesProps {
    visible?: boolean;
    selectedShoe?: string | null;
    onAddPress: () => void;
    /** When set, size confirm applies the offer with this shoe/size and does not open the shoe selection modal */
    onConfirmSize?: (shoeId: string, size: string) => void;
    /** Called when user taps "Remove offer" in selected state */
    onRemoveOffer?: () => void;
    /** Optional original price for display (strikethrough); defaults to 4999 */
    originalPrice?: number;
}

interface ShoeOption {
    id: string;
    name: string;
    imageUrl: string;
}

export function FreePairShoes({
    visible = true,
    selectedShoe,
    onAddPress,
    onConfirmSize,
    onRemoveOffer,
    originalPrice = ORIGINAL_PRICE,
}: FreePairShoesProps) {
    const [shoeOptions, setShoeOptions] = useState<ShoeOption[]>([]);
    const [offerEnabled, setOfferEnabled] = useState(false);
    const [showSizeModal, setShowSizeModal] = useState(false);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [sizeModalSelection, setSizeModalSelection] = useState<string | null>(null);

    useEffect(() => {
        try {
            const config = configService.getFreeShoesOfferConfig();
            if (config && config.enabled && config.shoes && config.shoes.length > 0) {
                setShoeOptions(config.shoes);
                setOfferEnabled(true);
            } else {
                setShoeOptions([]);
                setOfferEnabled(false);
            }
        } catch (error) {
            console.error('[FreePairShoes] Error loading config:', error);
            setShoeOptions([]);
            setOfferEnabled(false);
        }
    }, [visible]);

    useEffect(() => {
        if (!selectedShoe) setSelectedSize(null);
    }, [selectedShoe]);

    if (!visible || !offerEnabled || shoeOptions.length === 0) return null;

    const displayShoe = selectedShoe
        ? shoeOptions.find((s) => s.id === selectedShoe) ?? shoeOptions[0]
        : shoeOptions[0];
    const isApplied = !!selectedShoe;
    const displaySize = selectedSize || 'S1';

    const openSizeModal = () => {
        setSizeModalSelection(selectedSize || null);
        setShowSizeModal(true);
    };
    const closeSizeModal = () => {
        setShowSizeModal(false);
        setSizeModalSelection(null);
    };
    const confirmSize = () => {
        if (sizeModalSelection) {
            setSelectedSize(sizeModalSelection);
            setShowSizeModal(false);
            setSizeModalSelection(null);
            if (onConfirmSize) {
                onConfirmSize(displayShoe.id, sizeModalSelection);
            } else {
                onAddPress();
            }
        }
    };

    const formatPrice = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

    return (
        <View style={styles.container}>
            {/* Offer header with padlock */}
            <View style={styles.offerHeader}>
                <View style={styles.padlockWrap}>
                    <Ionicons name="lock-open-outline" size={22} color={OFFER_BLUE} />
                </View>
                <View style={styles.offerTextBlock}>
                    <Text style={styles.offerTitle}>Introductory Offer!</Text>
                    <Text style={styles.offerSubtitle}>
                        FREE Shoes on 1st apparel order worth &lt;₹500
                    </Text>
                </View>
            </View>

            {/* Nested product card */}
            <View style={styles.productCard}>
                <Image
                    source={{ uri: displayShoe.imageUrl }}
                    style={styles.shoeImage}
                    contentFit="cover"
                    placeholder={{ blurhash: BLURHASH }}
                    placeholderContentFit="cover"
                />
                <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={1}>
                        {/* {displayShoe.name} */}
                        Adidas Comfy Cloud
                    </Text>
                    <Text style={styles.productSubtext}>baby shoes</Text>
                    <Text style={styles.sizeText}>
                        {isApplied ? `Size: ${displaySize}` : 'Sizes 1-4 available'}
                    </Text>
                    {isApplied && (
                        <View style={styles.editRemoveRow}>
                            <TouchableOpacity onPress={openSizeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={styles.editLink}>Edit</Text>
                            </TouchableOpacity>
                            {onRemoveOffer && (
                                <>
                                    <Text style={styles.editRemoveSeparator}> · </Text>
                                    <TouchableOpacity onPress={onRemoveOffer} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <Text style={styles.removeOfferLink}>Remove offer</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    )}
                </View>
                <View style={styles.actionBlock}>
                    {isApplied ? (
                        <View style={styles.selectedStateWrap}>
                            <View style={styles.appliedButton}>
                                <Ionicons name="checkmark" size={20} color="#fff" />
                            </View>
                            <View style={styles.priceRow}>
                                <Text style={styles.originalPrice}>{formatPrice(originalPrice)}</Text>
                                <Text style={styles.freeText}>FREE</Text>
                            </View>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={openSizeModal}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.addButtonText}>Add</Text>
                            </TouchableOpacity>
                            <View style={styles.priceRow}>
                                <Text style={styles.originalPrice}>{formatPrice(originalPrice)}</Text>
                                <Text style={styles.freeText}>FREE</Text>
                            </View>
                        </>
                    )}
                </View>
            </View>

            {/* Select Size modal - opens from bottom */}
            <Modal
                visible={showSizeModal}
                transparent
                animationType="fade"
                onRequestClose={closeSizeModal}
            >
                <View style={styles.sizeModalContainer}>
                    <Pressable style={styles.sizeModalBackdrop} onPress={closeSizeModal} />
                    <View style={styles.sizeModalCard}>
                    <View style={styles.sizeModalHeader}>
                        <View style={styles.sizeModalRulerWrap}>
                            <Ionicons name="resize-outline" size={22} color="#374151" />
                        </View>
                        <TouchableOpacity onPress={closeSizeModal} style={styles.sizeModalClose} hitSlop={12}>
                            <Ionicons name="close" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.sizeModalTitle}>Select Size</Text>
                    <Text style={styles.sizeModalSubtitle}>Choose the shoe size</Text>
                    <View style={styles.sizeGrid}>
                        {SIZES.map((size, index) => {
                            const disabled = index >= SIZES_DISABLED_START;
                            const isSelected = sizeModalSelection === size;
                            return (
                                <TouchableOpacity
                                    key={size}
                                    style={[
                                        styles.sizeButton,
                                        disabled && styles.sizeButtonDisabled,
                                        isSelected && styles.sizeButtonSelected,
                                    ]}
                                    onPress={() => !disabled && setSizeModalSelection(size)}
                                    disabled={disabled}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.sizeButtonText, disabled && styles.sizeButtonTextDisabled]}>
                                        {size}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <TouchableOpacity
                        style={[styles.sizeConfirmButton, !sizeModalSelection && styles.sizeConfirmButtonDisabled]}
                        onPress={confirmSize}
                        disabled={!sizeModalSelection}
                        activeOpacity={0.8}
                    >
                        <Text style={[styles.sizeConfirmText, !sizeModalSelection && styles.sizeConfirmTextDisabled]}>
                            Confirm
                        </Text>
                    </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    offerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    padlockWrap: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: `${OFFER_BLUE}18`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    offerTextBlock: {
        flex: 1,
    },
    offerTitle: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#2E90FA',
        marginBottom: 2,
    },
    offerSubtitle: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#2E90FA',
        opacity: 0.9,
    },
    productCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 12,
        alignItems: 'center',
    },
    shoeImage: {
        width: 72,
        height: 72,
        borderRadius: 8,
        backgroundColor: '#F0F0F0',
    },
    productInfo: {
        flex: 1,
        marginLeft: 12,
    },
    productName: {
        fontSize: 15,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
        marginBottom: 2,
    },
    productSubtext: {
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
        color: '#374151',
        marginBottom: 2,
    },
    sizeText: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
    },
    editRemoveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    editLink: {
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
        color: '#DC2626',
    },
    editRemoveSeparator: {
        fontSize: 13,
        color: '#9CA3AF',
        fontFamily: Fonts.Regular,
    },
    removeOfferLink: {
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
        color: '#DC2626',
    },
    actionBlock: {
        alignItems: 'flex-end',
    },
    addButton: {
        backgroundColor: '#D1E9FF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#2E90FA',
    },
    addButtonText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#2E90FA',
    },
    selectedStateWrap: {
        alignItems: 'flex-end',
    },
    appliedButton: {
        backgroundColor: '#2E90FA',
        paddingHorizontal: 32,
        paddingVertical: 6,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
       
        
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    originalPrice: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    freeText: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: FREE_GREEN,
    },
    sizeModalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sizeModalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sizeModalCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        paddingBottom: 32,
        marginHorizontal: 20,
        marginBottom: 28,
        width: undefined,
        alignSelf: 'stretch',
    },
    sizeModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sizeModalRulerWrap: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sizeModalClose: {
        padding: 4,
    },
    sizeModalTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#111',
        marginBottom: 6,
    },
    sizeModalSubtitle: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
        marginBottom: 20,
    },
    sizeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 24,
    },
    sizeButton: {
        width: '17%',
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    sizeButtonDisabled: {
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        opacity: 0.7,
    },
    sizeButtonSelected: {
        borderColor: Colors.primary,
        borderWidth: 2,
        backgroundColor: `${Colors.primary}10`,
    },
    sizeButtonText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#374151',
    },
    sizeButtonTextDisabled: {
        color: '#9CA3AF',
    },
    sizeConfirmButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sizeConfirmButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    sizeConfirmText: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#fff',
    },
    sizeConfirmTextDisabled: {
        color: '#9CA3AF',
    },
});
