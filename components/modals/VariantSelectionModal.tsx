import { Colors, Fonts } from '@/constants/theme';
import { isVariantAvailable } from '@/utils/availability';
import { hasTryAndBuyProduct } from '@/utils/tryAndBuyProduct';
import {
    buildTryBuyOptionsFromVariants,
    findTryVariantForPrimary,
    findVariantForPrimaryOption,
    normalizeTryBuyVariants,
    optionMapFromVariant,
    valueAvailableForTryBuyOption,
} from '@/utils/tryBuyVariantSelection';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = Colors.variantSelection;
const TRY_BADGE_BG = '#FEF9C3';
const TRY_BADGE_BORDER = '#FDE047';

export type VariantSelectionModalLayout = 'sheet' | 'pdp';

export interface TryAndBuyVariantSelectionResult {
    /** Variant the customer is purchasing (keep). */
    keepVariant: any;
    /** Optional second size for try-at-home; omitted when user skips Try & Buy row. */
    tryVariant?: any;
}

interface VariantSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    product: any;
    onAddToCart: (result: TryAndBuyVariantSelectionResult) => void | Promise<void>;
    /** Listing / search vs product detail presentation. */
    layout?: VariantSelectionModalLayout;
    /**
     * PDP: primary size already chosen on page — show try row immediately.
     * Sheet: omit so user picks primary first.
     */
    lockedPrimaryVariant?: any;
    /** Cart edit: pre-select try row from stored line attribute. */
    initialTryOptionValue?: string | null;
    /** Cart edit: pre-select primary row when it is not locked (user can change size). */
    initialPrimaryOptionValue?: string | null;
    /** Cart edit: show Remove to clear trial size from the line. */
    mode?: 'add' | 'edit';
    onRemoveTryBuy?: () => void;
}

export const VariantSelectionModal: React.FC<VariantSelectionModalProps> = ({
    visible,
    onClose,
    product,
    onAddToCart,
    layout = 'sheet',
    lockedPrimaryVariant,
    initialTryOptionValue = null,
    initialPrimaryOptionValue = null,
    mode = 'add',
    onRemoveTryBuy,
}) => {
    const insets = useSafeAreaInsets();
    const [primaryValue, setPrimaryValue] = useState<string | null>(null);
    const [tryValue, setTryValue] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const variants = useMemo(() => normalizeTryBuyVariants(product), [product]);
    const options = useMemo(() => {
        if (product?.options && Array.isArray(product.options) && product.options.length > 0) {
            return product.options.filter(
                (o: any) => !(o?.name === 'Title' && Array.isArray(o.values) && o.values.includes('Default Title')),
            );
        }
        return buildTryBuyOptionsFromVariants(variants);
    }, [product, variants]);

    const mainOption = options[0];
    const mainOptionName = mainOption?.name ?? '';
    const mainValues: string[] = Array.isArray(mainOption?.values) ? mainOption.values : [];

    const sortedMainValues = useMemo(() => {
        if (!mainOptionName || !variants || mainValues.length === 0) return mainValues;
        const available: string[] = [];
        const unavailable: string[] = [];
        mainValues.forEach((val) => {
            const isAvail = valueAvailableForTryBuyOption(variants, mainOptionName, val);
            if (isAvail) {
                available.push(val);
            } else {
                unavailable.push(val);
            }
        });
        return [...available, ...unavailable];
    }, [mainValues, mainOptionName, variants]);

    const isTryAndBuy = hasTryAndBuyProduct(product);

    const lockedPrimaryValue = useMemo(() => {
        if (!lockedPrimaryVariant || !mainOptionName) return null;
        const m = optionMapFromVariant(lockedPrimaryVariant);
        return m[mainOptionName] ?? null;
    }, [lockedPrimaryVariant, mainOptionName]);

    useEffect(() => {
        if (!visible) {
            setPrimaryValue(null);
            setTryValue(null);
            setLoading(false);
            return;
        }
        if (lockedPrimaryValue) {
            setPrimaryValue(lockedPrimaryValue);
            setTryValue(mode === 'edit' && initialTryOptionValue ? initialTryOptionValue : null);
        } else if (mode === 'edit' && initialPrimaryOptionValue) {
            setPrimaryValue(initialPrimaryOptionValue);
            setTryValue(initialTryOptionValue ?? null);
        } else {
            setPrimaryValue(null);
            setTryValue(null);
        }
    }, [visible, lockedPrimaryValue, mode, initialTryOptionValue, initialPrimaryOptionValue]);

    /** Changing primary to the same value as try must clear try (cannot try the size you’re buying). */
    useEffect(() => {
        if (!visible || primaryValue == null) return;
        setTryValue((prev) => (prev === primaryValue ? null : prev));
    }, [visible, primaryValue]);

    const showTrySection = !!primaryValue;
    /** Never show primary size as selected in the try row (disabled + avoids stale highlight). */
    const tryRowSelected =
        tryValue && primaryValue && tryValue !== primaryValue ? tryValue : null;
    const primaryVariantResolved = useMemo(() => {
        if (!primaryValue || !mainOptionName) return null;
        return findVariantForPrimaryOption(variants, mainOptionName, primaryValue, null);
    }, [variants, mainOptionName, primaryValue]);

    const tryVariantResolved = useMemo(() => {
        if (!tryValue || !primaryVariantResolved || !mainOptionName) return null;
        return findTryVariantForPrimary(variants, primaryVariantResolved, mainOptionName, tryValue);
    }, [variants, primaryVariantResolved, mainOptionName, tryValue]);

    /** Try & Buy second size is optional; confirm with primary only once a purchasable variant is chosen. */
    const canConfirm =
        !!primaryVariantResolved && isVariantAvailable(primaryVariantResolved) !== false;

    const tryVariantToSubmit =
        tryValue &&
        primaryValue &&
        tryValue !== primaryValue &&
        tryVariantResolved
            ? tryVariantResolved
            : undefined;

    const onConfirm = async () => {
        if (!canConfirm || !primaryVariantResolved) return;
        setLoading(true);
        try {
            await onAddToCart({
                keepVariant: primaryVariantResolved,
                ...(tryVariantToSubmit ? { tryVariant: tryVariantToSubmit } : {}),
            });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const chipSize = layout === 'pdp' ? styles.chipPdp : styles.chipSheet;
    const chipTextSize = layout === 'pdp' ? styles.chipTextPdp : styles.chipTextSheet;

    const renderChipRow = useCallback(
        (params: {
            values: string[];
            selected: string | null;
            onSelect: (v: string) => void;
            disabledValues: Set<string>;
            locked: boolean;
        }) => {
            const { values, selected, onSelect, disabledValues, locked } = params;
            return (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipRow}
                >
                    {values.map((val) => {
                        const unavailable = !valueAvailableForTryBuyOption(variants, mainOptionName, val);
                        const disabledByRule = disabledValues.has(val);
                        const disabled = locked || unavailable || disabledByRule;
                        const isSelected = selected === val;
                        return (
                            <TouchableOpacity
                                key={val}
                                style={[
                                    chipSize,
                                    isSelected && styles.chipSelected,
                                    disabled && !isSelected && styles.chipDisabled,
                                ]}
                                onPress={() => !disabled && onSelect(val)}
                                activeOpacity={disabled ? 1 : 0.7}
                                disabled={disabled}
                            >
                                <Text
                                    style={[
                                        chipTextSize,
                                        isSelected && styles.chipTextSelected,
                                        disabled && !isSelected && styles.chipTextDisabled,
                                    ]}
                                >
                                    {val}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            );
        },
        [variants, mainOptionName, chipSize, chipTextSize],
    );

    if (!product || !isTryAndBuy) return null;

    const title = mainOptionName ? `Select ${mainOptionName}` : 'Select option';
    const isPdp = layout === 'pdp';

    return (
        <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
            <View style={[styles.modalOverlay, isPdp && styles.modalOverlayPdp]}>
                <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
                <View
                    style={[
                        styles.modalContent,
                        isPdp && styles.modalContentPdp,
                        { paddingBottom: Math.max(insets.bottom, 16) },
                    ]}
                >
                    <View style={styles.header}>
                        <Text style={[styles.headerTitle, isPdp && styles.headerTitlePdp]}>{title}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={12}>
                            <Ionicons name="close" size={22} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        {renderChipRow({
                            values: sortedMainValues,
                            selected: primaryValue,
                            onSelect: setPrimaryValue,
                            disabledValues: new Set(),
                            locked: !!lockedPrimaryValue,
                        })}

                        {showTrySection ? (
                            <View style={styles.trySection}>
                                <View style={styles.tryBadge}>
                                    <Ionicons name="shirt-outline" size={14} color="#854D0E" />
                                    <Text style={[styles.tryBadgeText, { marginLeft: 4 }]}>Try & Buy</Text>
                                </View>
                                <View style={styles.tryHeadingRow}>
                                    <Text style={styles.tryHeading}>Want to try another size?</Text>
                                    {mode === 'edit' && onRemoveTryBuy ? (
                                        <TouchableOpacity
                                            onPress={() => {
                                                onRemoveTryBuy();
                                                onClose();
                                            }}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Text style={styles.tryRemove}>Remove</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                                <Text style={styles.tryBody}>
                                Test different sizes at home for free and instantly return the products you don’t keep
                                </Text>
                                {renderChipRow({
                                    values: sortedMainValues,
                                    selected: tryRowSelected,
                                    onSelect: (v) => setTryValue((prev) => (prev === v ? null : v)),
                                    disabledValues: new Set(primaryValue ? [primaryValue] : []),
                                    locked: false,
                                })}
                            </View>
                        ) : null}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
                            onPress={onConfirm}
                            disabled={!canConfirm || loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.confirmBtnText}>Confirm</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalOverlayPdp: {
        justifyContent: 'flex-end',
        paddingHorizontal: 12,
    },
    dismissArea: {
        flex: 1,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '82%',
    },
    modalContentPdp: {
        borderRadius: 20,
        marginBottom: Platform.OS === 'ios' ? 8 : 12,
        maxHeight: '88%',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
            },
            android: { elevation: 16 },
        }),
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 17,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        flex: 1,
    },
    headerTitlePdp: {
        fontSize: 19,
    },
    closeButton: {
        padding: 4,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 12,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 10,
        paddingRight: 8,
    },
    chipSheet: {
        minWidth: 44,
        height: 44,
        paddingHorizontal: 14,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipPdp: {
        minWidth: 48,
        height: 48,
        paddingHorizontal: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipSelected: {
        backgroundColor: ACCENT,
        borderColor: ACCENT,
    },
    chipDisabled: {
        opacity: 0.35,
    },
    chipTextSheet: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: '#111827',
    },
    chipTextPdp: {
        fontSize: 15,
        fontFamily: Fonts.LexendSemiBold,
        color: '#111827',
    },
    chipTextSelected: {
        color: '#fff',
    },
    chipTextDisabled: {
        color: '#9CA3AF',
    },
    trySection: {
        marginTop: 24,
        paddingTop: 20,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E7EB',
    },
    tryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: TRY_BADGE_BG,
        borderWidth: 1,
        borderColor: TRY_BADGE_BORDER,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        marginBottom: 12,
    },
    tryBadgeText: {
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
        color: '#854D0E',
    },
    tryHeadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 8,
    },
    tryHeading: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#181D27',
        flex: 1,
    },
    tryRemove: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: ACCENT,
        textDecorationLine: 'underline',
    },
    tryBody: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 16,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E7EB',
    },
    confirmBtn: {
        height: 52,
        borderRadius: 14,
        backgroundColor: ACCENT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmBtnDisabled: {
        backgroundColor: '#D1D5DB',
    },
    confirmBtnText: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#fff',
    },
});
