/**
 * Free puzzle rail for milestone 2 (2nd order) — same UX as {@link FreePairShoes} (age + item grid, KIDPUZZLE coupon).
 */
import { Colors, Fonts } from '@/constants/theme';
import { appConfigService } from '@/services/appConfigService';
import type { FreePuzzleItem, FreePuzzleOfferConfig, FreePuzzlePickerAge, FreePuzzlePickerConfig } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';
const ORIGINAL_PRICE_DEFAULT = 4999;

const DEFAULT_AGES: FreePuzzlePickerAge[] = [
    { age: '2-3 Years', isAvailable: true, itemIds: [] },
    { age: '4-5 Years', isAvailable: true, itemIds: [] },
];

export interface FreePuzzleBlockProps {
    visible?: boolean;
    configRefreshKey?: number;
    /** When `false`, the Add control is disabled until the milestone min cart is met. */
    milestoneMinCartUnlocked?: boolean;
    selectedPuzzleId?: string | null;
    selectedPuzzleAge?: string | null;
    onAddPress: () => void;
    onConfirmAgeItem?: (itemId: string, age: string) => void;
    onRemoveOffer?: () => void;
    originalPrice?: number;
    appliedCouponOriginalPrice?: number;
}

type AgeOptionsRow = { age: string; isAvailable: boolean; itemIds: string[] };

function normalizeAgeOptions(items: FreePuzzleItem[], fromPicker: FreePuzzlePickerAge[] | undefined): AgeOptionsRow[] {
    const allIds = items.map((i) => i.id);
    if (fromPicker?.length) {
        return fromPicker.map((a) => ({
            age: a.age,
            isAvailable: a.isAvailable,
            itemIds: a.itemIds?.length ? a.itemIds : allIds,
        }));
    }
    return DEFAULT_AGES.map((a) => ({ ...a, itemIds: a.itemIds?.length ? a.itemIds : allIds }));
}

export function FreePuzzleBlock({
    visible = true,
    configRefreshKey,
    milestoneMinCartUnlocked = true,
    selectedPuzzleId,
    selectedPuzzleAge: selectedPuzzleAgeProp,
    onAddPress,
    onConfirmAgeItem,
    onRemoveOffer,
    originalPrice,
    appliedCouponOriginalPrice,
}: FreePuzzleBlockProps) {
    const [itemOptions, setItemOptions] = useState<FreePuzzleItem[]>([]);
    const [ageOptions, setAgeOptions] = useState<AgeOptionsRow[]>([]);
    const [offerEnabled, setOfferEnabled] = useState(false);
    const [showPickerModal, setShowPickerModal] = useState(false);
    const [selectedAge, setSelectedAge] = useState<string | null>(null);
    const [modalAge, setModalAge] = useState<string | null>(null);
    const [modalItemId, setModalItemId] = useState<string | null>(null);
    const [pickerCopy, setPickerCopy] = useState<NonNullable<FreePuzzlePickerConfig['copy']> | undefined>(undefined);
    const [offerCopy, setOfferCopy] = useState<FreePuzzleOfferConfig['copy'] | undefined>(undefined);
    const [configOriginalPrice, setConfigOriginalPrice] = useState(ORIGINAL_PRICE_DEFAULT);

    useEffect(() => {
        try {
            const config = appConfigService.getFreePuzzleOfferConfig();
            const pcfg = appConfigService.getFreePuzzlePickerConfig();
            const fromPicker = pcfg?.enabled && pcfg.items?.length ? pcfg.items : (config?.items ?? []);
            const ageRows = normalizeAgeOptions(fromPicker, pcfg?.ages);
            if (config && config.enabled && fromPicker.length) {
                setItemOptions(fromPicker);
                setAgeOptions(ageRows);
                setOfferEnabled(true);
                setOfferCopy(config.copy ?? undefined);
                setPickerCopy(pcfg?.copy);
                const raw = (config as { originalPrice?: number; original_price?: number }).originalPrice
                    ?? (config as { original_price?: number }).original_price;
                const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
                setConfigOriginalPrice(Number.isFinite(num) && num > 0 ? num : ORIGINAL_PRICE_DEFAULT);
            } else {
                setItemOptions([]);
                setAgeOptions([]);
                setOfferEnabled(false);
            }
        } catch (e) {
            console.error('[FreePuzzleBlock] config', e);
            setItemOptions([]);
            setAgeOptions([]);
            setOfferEnabled(false);
        }
    }, [visible, configRefreshKey]);

    useEffect(() => {
        if (!selectedPuzzleId) setSelectedAge(null);
        else if (selectedPuzzleAgeProp) setSelectedAge(selectedPuzzleAgeProp);
    }, [selectedPuzzleId, selectedPuzzleAgeProp]);

    if (!visible || !offerEnabled || itemOptions.length === 0) return null;

    const displayItem = selectedPuzzleId
        ? itemOptions.find((s) => s.id === selectedPuzzleId) ?? itemOptions[0]
        : itemOptions[0];
    const isApplied = !!selectedPuzzleId;
    const firstAvailableAge = ageOptions.find((s) => s.isAvailable)?.age ?? ageOptions[0]?.age ?? DEFAULT_AGES[0]!.age;
    const displayAge = selectedAge || firstAvailableAge;
    const effectiveOriginalPrice =
        appliedCouponOriginalPrice != null
            ? appliedCouponOriginalPrice
            : originalPrice != null
              ? originalPrice
              : configOriginalPrice;

    const getItemsForAge = (age: string | null) => {
        if (!age) return itemOptions;
        const row = ageOptions.find((o) => o.age === age);
        const allow = row?.itemIds?.length ? row.itemIds : itemOptions.map((i) => i.id);
        return itemOptions.filter((i) => allow.includes(i.id));
    };

    const getPreferredItemForAge = (age: string | null, preferredId?: string | null) => {
        const list = getItemsForAge(age);
        if (!list.length) return null;
        if (preferredId && list.some((i) => i.id === preferredId)) return preferredId;
        return list[0]?.id ?? null;
    };

    const modalItems = getItemsForAge(modalAge);
    const ageTitle = pickerCopy?.ageTitle;
    const itemTitle = pickerCopy?.itemTitle;

    const openPicker = () => {
        if (!isApplied && !milestoneMinCartUnlocked) {
            return;
        }
        const current =
            selectedAge && ageOptions.some((o) => o.age === selectedAge && o.isAvailable) ? selectedAge : firstAvailableAge;
        setModalAge(current);
        setModalItemId(getPreferredItemForAge(current, selectedPuzzleId ?? itemOptions[0]?.id));
        setShowPickerModal(true);
    };
    const closePicker = () => {
        setShowPickerModal(false);
        setModalAge(null);
        setModalItemId(null);
    };
    const confirmPicker = () => {
        const id = modalItemId ?? getPreferredItemForAge(modalAge, displayItem.id);
        if (modalAge && id) {
            setSelectedAge(modalAge);
            setShowPickerModal(false);
            setModalAge(null);
            setModalItemId(null);
            if (onConfirmAgeItem) onConfirmAgeItem(id, modalAge);
            else onAddPress();
        }
    };

    const formatPrice = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

    const selectedSubLabel =
        (offerCopy?.selectedLabel
            && offerCopy.selectedLabel
                .replace(/\{age\}/gi, displayAge)
                .replace(/\{size\}/gi, displayAge))
        || `Age: ${displayAge}`;

    return (
        <View style={styles.container}>
            <View style={styles.offerHeader}>
                <View style={styles.padlockWrap}>
                    <Image source={require('@/assets/icons/unlock.png')} style={styles.padlockIcon} contentFit="contain" />
                </View>
                <View style={styles.offerTextBlock}>
                    <Text style={styles.offerTitle}>{offerCopy?.title ?? 'Special offer'}</Text>
                    <Text style={styles.offerSubtitle}>
                        {offerCopy?.subtitle ?? 'Choose a free puzzle for your order.'}
                    </Text>
                </View>
            </View>

            <View style={styles.productCard}>
                <Image
                    source={{ uri: displayItem.imageUrl }}
                    style={styles.itemImage}
                    contentFit="cover"
                    placeholder={{ blurhash: BLURHASH }}
                    placeholderContentFit="cover"
                />
                <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                        {isApplied
                            ? displayItem.name
                            : 'Select your free puzzle'}
                    </Text>
                    <Text style={styles.metaText}>
                        {isApplied
                            && selectedSubLabel
                           }
                    </Text>
                    {isApplied && (
                        <View style={styles.editRemoveRow}>
                            <TouchableOpacity onPress={openPicker} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
                                accessibilityLabel="Free puzzle added. Double tap to remove"
                                accessibilityHint="Removes the free puzzle from your order"
                            >
                                <Ionicons name="checkmark" size={22} color="#FFFFFF" />
                            </TouchableOpacity>
                            <View style={styles.priceRow}>
                                <Text style={styles.originalPrice}>{formatPrice(effectiveOriginalPrice)}</Text>
                                <Text style={styles.freeText}>{offerCopy?.freeLabel ?? 'FREE'}</Text>
                            </View>
                        </View>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.addButton, !milestoneMinCartUnlocked && styles.addButtonDisabled]}
                                onPress={openPicker}
                                activeOpacity={0.8}
                                disabled={!milestoneMinCartUnlocked}
                            >
                                <Text style={[styles.addButtonText, !milestoneMinCartUnlocked && styles.addButtonTextDisabled]}>Add</Text>
                            </TouchableOpacity>
                            <View style={styles.priceRow}>
                                <Text style={styles.originalPrice}>{formatPrice(effectiveOriginalPrice)}</Text>
                                <Text style={styles.freeText}>{offerCopy?.freeLabel ?? 'FREE'}</Text>
                            </View>
                        </>
                    )}
                </View>
            </View>

            <Modal visible={showPickerModal} transparent animationType="fade" onRequestClose={closePicker}>
                <View style={styles.sizeModalContainer}>
                    <Pressable style={styles.sizeModalBackdrop} onPress={closePicker} />
                    <View style={styles.sizeModalCard}>
                        <View style={styles.sizeModalTitleRow}>
                            <Text style={styles.sizeModalTitle}>
                                {offerCopy?.itemModalTitle ?? 'Choose puzzle'}
                            </Text>
                            <TouchableOpacity onPress={closePicker} style={styles.sizeModalClose} hitSlop={12}>
                                <Ionicons name="close" size={24} color="#717680" />
                            </TouchableOpacity>
                        </View>
                        {/* {!!offerCopy?.itemModalSubtitle && (
                            <Text style={styles.modalSubtitleHint}>{offerCopy.itemModalSubtitle}</Text>
                        )} */}
                        <View style={styles.sizeModalDivider} />
                        <ScrollView
                            style={styles.sizeModalScroll}
                            contentContainerStyle={styles.sizeModalScrollContent}
                            showsVerticalScrollIndicator
                        >
                            {!!ageTitle && <Text style={styles.sizeModalSectionTitle}>{ageTitle}</Text>}
                            <View style={styles.sizeGrid}>
                                {ageOptions.map((o) => {
                                    const disabled = !o.isAvailable;
                                    const sel = modalAge === o.age;
                                    return (
                                        <TouchableOpacity
                                            key={o.age}
                                            style={[
                                                styles.sizeButton,
                                                disabled && styles.sizeButtonDisabled,
                                                sel && styles.sizeButtonSelected,
                                            ]}
                                            onPress={() => {
                                                if (disabled) return;
                                                setModalAge(o.age);
                                                setModalItemId((prev) => getPreferredItemForAge(o.age, prev));
                                            }}
                                            disabled={disabled}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.sizeButtonText,
                                                    disabled && styles.sizeButtonTextDisabled,
                                                    sel && styles.sizeButtonTextSelected,
                                                ]}
                                            >
                                                {o.age}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            {!!itemTitle && <Text style={styles.sizeModalSubtitle}>{itemTitle}</Text>}
                            {modalItems.length > 0 ? (
                                <View style={styles.itemGrid}>
                                    {modalItems.map((it) => {
                                        const sel = modalItemId === it.id;
                                        return (
                                            <TouchableOpacity
                                                key={it.id}
                                                style={[styles.itemThumb, sel && styles.itemThumbSelected]}
                                                onPress={() => setModalItemId(it.id)}
                                                activeOpacity={0.8}
                                            >
                                                <Image
                                                    source={{ uri: it.imageUrl }}
                                                    style={styles.itemThumbImage}
                                                    contentFit="cover"
                                                    placeholder={{ blurhash: BLURHASH }}
                                                />
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Text style={styles.noItemText}>No puzzle is available for this age right now.</Text>
                            )}
                            <TouchableOpacity
                                style={[
                                    styles.sizeConfirmButton,
                                    (!modalItemId || !modalAge || modalItems.length === 0) && styles.sizeConfirmButtonDisabled,
                                ]}
                                onPress={confirmPicker}
                                disabled={!modalItemId || !modalAge || modalItems.length === 0}
                            >
                                <Text
                                    style={[
                                        styles.sizeConfirmText,
                                        (!modalItemId || !modalAge || modalItems.length === 0) && styles.sizeConfirmTextDisabled,
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
        borderRadius: 16,
        padding: 8,
        paddingVertical: 12,
        marginBottom: 16,
    },
    offerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    padlockWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    padlockIcon: { width: 22, height: 22 },
    offerTextBlock: { flex: 1, marginLeft: 8 },
    offerTitle: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendBold, marginBottom: 2 },
    offerSubtitle: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendRegular, color: '#535862', opacity: 0.9 },
    productCard: {
        flexDirection: 'row',
        backgroundColor: '#FEFBE8',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    itemImage: { width: 72, height: 72, borderRadius: 8, backgroundColor: '#F0F0F0' },
    productInfo: { flex: 1, marginLeft: 12 },
    productName: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendMedium, color: '#181D27', marginBottom: 6, lineHeight: 18 },
    metaText: { fontSize: 10, fontFamily: Fonts.LexendRegular, color: '#717680' },
    editRemoveRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    editLink: { fontSize: 10, fontFamily: Fonts.LexendBold, color: '#EAAA08' },
    actionBlock: { alignItems: 'flex-end' },
    addButton: {
        backgroundColor: '#FEF7C3',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#FDE272',
    },
    addButtonText: { fontFamily: Fonts.SemiBold, color: '#FDE272' },
    addButtonDisabled: {
        backgroundColor: '#D1D5DB',
        borderColor: '#D1D5DB',
    },
    addButtonTextDisabled: { color: '#6B7280' },
    selectedStateWrap: { alignItems: 'flex-end' },
    appliedButton: {
        minWidth: 48,
        height: 36,
        paddingHorizontal: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#DCAC43',
        borderRadius: 12,
        marginBottom: 6,
       
    },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    originalPrice: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendRegular, color: '#717680', textDecorationLine: 'line-through' },
    freeText: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendBold, color: '#16B364' },
    sizeModalContainer: { flex: 1, justifyContent: 'flex-end' },
    sizeModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
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
    modalSubtitleHint: { fontSize: Fonts.ExtraSmallFontSize, color: '#717680', marginBottom: 6 },
    sizeModalScroll: { flexGrow: 0, flexShrink: 1, maxHeight: '100%' },
    sizeModalScrollContent: { paddingBottom: 4 },
    sizeModalClose: { padding: 4 },
    sizeModalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sizeModalTitle: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendBold, color: '#181D27', flex: 1 },
    sizeModalDivider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 14 },
    sizeModalSectionTitle: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendBold, color: '#00000080', marginBottom: 10 },
    itemGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 20 },
    itemThumb: {
        width: 72,
        height: 72,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'transparent',
        backgroundColor: '#F0F0F0',
    },
    itemThumbSelected: {
        borderColor: Colors.primary,
        ...Platform.select({
            ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
            android: { elevation: 4 },
        }),
    },
    itemThumbImage: { width: 72, height: 72 },
    sizeModalSubtitle: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendBold, color: '#00000080', marginBottom: 12 },
    noItemText: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendRegular, color: '#717680', marginBottom: 20 },
    sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
    sizeButton: {
        minWidth: '30%',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D5D7DA',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    sizeButtonDisabled: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', opacity: 0.7 },
    sizeButtonSelected: { borderColor: '#F15E5E', borderWidth: 2, backgroundColor: '#F15E5E' },
    sizeButtonText: { fontSize: Fonts.SmallFontSize, fontFamily: Fonts.LexendBold, color: '#414651', textAlign: 'center' },
    sizeButtonTextDisabled: { color: '#9CA3AF' },
    sizeButtonTextSelected: { color: '#FFFFFF' },
    sizeConfirmButton: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
    sizeConfirmButtonDisabled: { backgroundColor: '#D1D5DB' },
    sizeConfirmText: { fontSize: 16, fontFamily: Fonts.SemiBold, color: '#fff' },
    sizeConfirmTextDisabled: { color: '#9CA3AF' },
});
