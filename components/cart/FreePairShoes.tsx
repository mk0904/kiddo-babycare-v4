import { Colors, Fonts } from '@/constants/theme';
import { appConfigService } from '@/services/appConfigService';
import type { FreeShoesOfferConfig, SizeOption } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';
const OFFER_BLUE = '#2563EB';
const FREE_GREEN = '#16A34A';
const ORIGINAL_PRICE_DEFAULT = 4999;

/** Default shoe size options (baby/kids) when backend config does not provide sizes. */
const DEFAULT_SHOE_SIZES: SizeOption[] = [
    { size: '0 - 3M', isAvailable: true },
    { size: '3 - 6M', isAvailable: true },
    { size: '6 - 9M', isAvailable: true },
    { size: '9 - 12M', isAvailable: true },
    { size: '1 - 2Y', isAvailable: true },
    { size: '2 - 3Y', isAvailable: true },
    { size: '3 - 4Y', isAvailable: true },
    { size: '4 - 5Y', isAvailable: true },
    { size: '5 - 6Y', isAvailable: true },
    { size: '6 - 7Y', isAvailable: true },
];

export interface FreePairShoesProps {
    visible?: boolean;
    /** When this changes (e.g. cart appConfigRefresh), config is re-read so backend updates (e.g. shoe name) show up */
    configRefreshKey?: number;
    selectedShoe?: string | null;
    /** When provided (e.g. from cart store), used as the displayed/confirmed size so it can be sent to Shopify */
    selectedShoeSize?: string | null;
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
    configRefreshKey,
    selectedShoe,
    selectedShoeSize: selectedShoeSizeProp,
    onAddPress,
    onConfirmSize,
    onRemoveOffer,
    originalPrice = ORIGINAL_PRICE_DEFAULT,
}: FreePairShoesProps) {
    const [shoeOptions, setShoeOptions] = useState<ShoeOption[]>([]);
    const [sizeOptions, setSizeOptions] = useState<SizeOption[]>([]);
    const [offerEnabled, setOfferEnabled] = useState(false);
    const [showSizeModal, setShowSizeModal] = useState(false);
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [sizeModalSelection, setSizeModalSelection] = useState<string | null>(null);
    /** Shoe selected inside the size modal (for "Select Shoe" grid) */
    const [sizeModalShoeSelection, setSizeModalShoeSelection] = useState<string | null>(null);
    const [offerCopy, setOfferCopy] = useState<FreeShoesOfferConfig['copy'] | undefined>(undefined);
    const [configOriginalPrice, setConfigOriginalPrice] = useState(ORIGINAL_PRICE_DEFAULT);

    useEffect(() => {
        try {
            const config = appConfigService.getFreeShoesOfferConfig();
            if (config && config.enabled && config.shoes && config.shoes.length > 0) {
                setShoeOptions(config.shoes);
                setSizeOptions(config.sizes?.length ? config.sizes : DEFAULT_SHOE_SIZES);
                setOfferEnabled(true);
                setOfferCopy(config.copy ?? undefined);
                setConfigOriginalPrice(config.originalPrice ?? ORIGINAL_PRICE_DEFAULT);
            } else {
                setShoeOptions([]);
                setSizeOptions([]);
                setOfferEnabled(false);
            }
        } catch (error) {
            console.error('[FreePairShoes] Error loading config:', error);
            setShoeOptions([]);
            setSizeOptions([]);
            setOfferEnabled(false);
        }
    }, [visible, configRefreshKey]);

    useEffect(() => {
        if (!selectedShoe) setSelectedSize(null);
        else if (selectedShoeSizeProp != null && selectedShoeSizeProp !== '') setSelectedSize(selectedShoeSizeProp);
    }, [selectedShoe, selectedShoeSizeProp]);

    if (!visible || !offerEnabled || shoeOptions.length === 0) return null;

    const displayShoe = selectedShoe
        ? shoeOptions.find((s) => s.id === selectedShoe) ?? shoeOptions[0]
        : shoeOptions[0];
    const isApplied = !!selectedShoe;
    const firstAvailableSize = sizeOptions.find((s) => s.isAvailable)?.size ?? DEFAULT_SHOE_SIZES[0]?.size ?? '0 - 3M';
    const displaySize = selectedSize || firstAvailableSize;
    const effectiveOriginalPrice = originalPrice ?? configOriginalPrice;

    const openSizeModal = () => {
        const currentSelection = selectedSize && sizeOptions.some((s) => s.size === selectedSize && s.isAvailable)
            ? selectedSize
            : firstAvailableSize;
        setSizeModalSelection(currentSelection);
        setSizeModalShoeSelection(selectedShoe ?? shoeOptions[0]?.id ?? null);
        setShowSizeModal(true);
    };
    const closeSizeModal = () => {
        setShowSizeModal(false);
        setSizeModalSelection(null);
        setSizeModalShoeSelection(null);
    };
    const confirmSize = () => {
        const shoeId = sizeModalShoeSelection ?? displayShoe.id;
        if (sizeModalSelection && shoeId) {
            setSelectedSize(sizeModalSelection);
            setShowSizeModal(false);
            setSizeModalSelection(null);
            setSizeModalShoeSelection(null);
            if (onConfirmSize) {
                onConfirmSize(shoeId, sizeModalSelection);
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
                    <Image source={require('@/assets/icons/unlock.png')} style={styles.padlockIcon} contentFit="contain" />
                </View>
                <View style={styles.offerTextBlock}>
                    <Text style={styles.offerTitle}>{offerCopy?.title ?? 'Introductory Offer!'}</Text>
                    <Text style={styles.offerSubtitle}>
                        {offerCopy?.subtitle ?? 'FREE Shoes on 1st apparel order worth ₹500'}
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
                    <Text style={styles.productName} numberOfLines={2}>
                        {isApplied
                            ? (displayShoe.name || (displayShoe as { title?: string }).title || 'Free pair')
                            : 'Select from shoe options & sizes'}
                    </Text>
                    
                    <Text style={styles.sizeText}>
                        {isApplied ? (offerCopy?.selectedLabel?.replace('{size}', displaySize) ?? `Size: ${displaySize}`) : 'Sizes 1-4 available'}
                    </Text>
                    {isApplied && (
                        <View style={styles.editRemoveRow}>
                            <TouchableOpacity onPress={openSizeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={styles.editLink}>Edit</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
                <View style={styles.actionBlock}>
                    {isApplied ? (
                        <View style={styles.selectedStateWrap}>
                            <TouchableOpacity
                                style={styles.appliedButton}
                                onPress={onRemoveOffer}
                                activeOpacity={0.8}
                                accessibilityLabel="Remove offer"
                            >
                                <Text style={[styles.appliedButtonText, { color: Colors.primary }]}>Remove</Text>
                            </TouchableOpacity>
                            <View style={styles.priceRow}>
                                <Text style={styles.originalPrice}>{formatPrice(effectiveOriginalPrice)}</Text>
                                <Text style={styles.freeText}>{offerCopy?.freeLabel ?? 'FREE'}</Text>
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
                                <Text style={styles.originalPrice}>{formatPrice(effectiveOriginalPrice)}</Text>
                                <Text style={styles.freeText}>{offerCopy?.freeLabel ?? 'FREE'}</Text>
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
                    <View style={styles.sizeModalTitleRow}>
                        <Text style={styles.sizeModalTitle}>Select Shoe</Text>
                        <TouchableOpacity onPress={closeSizeModal} style={styles.sizeModalClose} hitSlop={12}>
                            <Ionicons name="close" size={24} color="#717680" />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.sizeModalDivider} />
                    <ScrollView
                        style={styles.sizeModalScroll}
                        contentContainerStyle={styles.sizeModalScrollContent}
                        showsVerticalScrollIndicator={true}
                    >
                        {/* Shoe selection grid - all 4 from backend config */}
                        <View style={styles.shoeGrid}>
                            {shoeOptions.map((shoe) => {
                                const isSelected = sizeModalShoeSelection === shoe.id;
                                return (
                                    <TouchableOpacity
                                        key={shoe.id}
                                        style={[styles.shoeOption, isSelected && styles.shoeOptionSelected]}
                                        onPress={() => setSizeModalShoeSelection(shoe.id)}
                                        activeOpacity={0.8}
                                    >
                                        <Image
                                            source={{ uri: shoe.imageUrl }}
                                            style={styles.shoeOptionImage}
                                            contentFit="cover"
                                            placeholder={{ blurhash: BLURHASH }}
                                            placeholderContentFit="cover"
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={styles.sizeModalSubtitle}>{offerCopy?.sizeModalTitle ?? 'Select Size'}</Text>
                        <View style={styles.sizeGrid}>
                            {sizeOptions.map((sizeOption) => {
                                const disabled = !sizeOption.isAvailable;
                                const isSelected = sizeModalSelection === sizeOption.size;
                                return (
                                    <TouchableOpacity
                                        key={sizeOption.size}
                                        style={[
                                            styles.sizeButton,
                                            disabled && styles.sizeButtonDisabled,
                                            isSelected && styles.sizeButtonSelected,
                                        ]}
                                        onPress={() => !disabled && setSizeModalSelection(sizeOption.size)}
                                        disabled={disabled}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.sizeButtonText, disabled && styles.sizeButtonTextDisabled, isSelected && styles.sizeButtonTextSelected]}>
                                            {sizeOption.size}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.sizeConfirmButton,
                                (!sizeModalShoeSelection || !sizeModalSelection) && styles.sizeConfirmButtonDisabled,
                            ]}
                            onPress={confirmSize}
                            disabled={!sizeModalShoeSelection || !sizeModalSelection}
                            activeOpacity={0.8}
                        >
                            <Text
                                style={[
                                    styles.sizeConfirmText,
                                    (!sizeModalShoeSelection || !sizeModalSelection) && styles.sizeConfirmTextDisabled,
                                ]}
                            >
                                {offerCopy?.confirmLabel ?? 'Confirm'}
                            </Text>
                        </TouchableOpacity>
                    </ScrollView>
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
        padding: 8,
        paddingVertical: 16,
        marginBottom: 24,
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
       
        alignItems: 'center',
        justifyContent: 'center',
    },
    padlockIcon: {
        width: 22,
        height: 22,
    },
    offerTextBlock: {
        flex: 1,
        marginLeft: 8,
    },
    offerTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        fontWeight: Fonts.BoldWeight,
        marginBottom: 2,
    },
    offerSubtitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.RegularWeight,
        color: '#535862',
        opacity: 0.9,
    },
    productCard: {
        flexDirection: 'row',
        backgroundColor: '#EFF8FF',
        borderRadius: 12,
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
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.MediumWeight,
        color: '#181D27',
        marginBottom: 6,
        lineHeight: 18,
    },
    productSubtext: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#374151',
        marginBottom: 2,
    },
    sizeText: {
        fontSize: 10,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.RegularWeight,
        color: '#717680',
    },
    editRemoveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    editLink: {
        fontSize: 10,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.BoldWeight,
        color: '#F15E5E',
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
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    addButtonText: {
        fontFamily: Fonts.SemiBold,
        color: Colors.backgroundWhite,
    },
    selectedStateWrap: {
        alignItems: 'flex-end',
    },
    appliedButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    appliedButtonText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
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
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.BoldWeight,
        color: '#16B364',
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
        padding: 12,
        paddingBottom: 8,
        marginHorizontal: 20,
        marginBottom: 28,
        width: '90%',
        alignSelf: 'stretch',
        maxHeight: '85%',
    },
    sizeModalScroll: {
        flexGrow: 0,
        flexShrink: 1,
        maxHeight: '100%',
    },
    sizeModalScrollContent: {
        paddingBottom: 4,
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
    sizeModalRulerIcon: {
        width: 22,
        height: 22,
    },
    sizeModalClose: {
        padding: 4,
    },
    sizeModalTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sizeModalTitle: {
        fontSize: Fonts.MediumFontSize,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.BoldWeight,
        color: '#181D27',
    },
    sizeModalDivider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginBottom: 14,
        marginHorizontal: -20,
    },
    shoeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 20,
    },
    shoeOption: {
        width: 72,
        height: 72,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'transparent',
        backgroundColor: '#F0F0F0',
    },
    shoeOptionSelected: {
        borderColor: Colors.primary,
        ...Platform.select({
            ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
            android: { elevation: 4 },
        }),
    },
    shoeOptionImage: {
        width: 72,
        height: 72,
    },
    sizeModalSubtitle: {
        fontSize: Fonts.MediumFontSize,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.BoldWeight,
        color: '#181D27',
        marginBottom: 12,
    },
    sizeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 24,
    },
    sizeButton: {
        width: '18.5%',
        paddingVertical: 12,
        paddingHorizontal: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D5D7DA',
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
        borderColor: '#F15E5E',
        borderWidth: 2,
        backgroundColor: '#F15E5E',
    },
    sizeButtonText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.BoldWeight,
        color: '#414651',
    },
    sizeButtonTextDisabled: {
        color: '#9CA3AF',
    },
    sizeButtonTextSelected: {
        color: '#FFFFFF',
        opacity: 1,
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
