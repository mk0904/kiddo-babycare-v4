import { Colors, Fonts } from '@/constants/theme';
import {
    valueAvailableForTryBuyOption,
} from '@/utils/tryBuyVariantSelection';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const ACCENT = Colors.variantSelection;
const TRY_BADGE_BG = '#FEF9C3';
const TRY_BADGE_BORDER = '#FDE047';

type OptionShape = { name: string; values: string[] };

interface TryBuyPdpVariantSectionProps {
    productVariants: any[];
    mainOption: OptionShape;
    /** Current primary option value (from PDP selectedOptions). */
    primaryValue: string | undefined;
    onSelectPrimary: (value: string) => void;
    tryValue: string | null;
    onTryValueChange: (value: string | null) => void;
}

export function TryBuyPdpVariantSection({
    productVariants,
    mainOption,
    primaryValue,
    onSelectPrimary,
    tryValue,
    onTryValueChange,
}: TryBuyPdpVariantSectionProps) {
    const { name: optionName, values } = mainOption;
    const showTryBlock = !!primaryValue;
    const tryRowSelection =
        primaryValue && tryValue && tryValue !== primaryValue ? tryValue : null;

    return (
        <View style={styles.wrap}>
            <View style={styles.cardBadge}>
                <Ionicons name="shirt-outline" size={14} color="#854D0E" />
                <Text style={[styles.cardBadgeText, { marginLeft: 4 }]}>Try & Buy</Text>
            </View>

            <Text style={styles.sectionLabel}>Select {optionName}</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
            >
                {values.map((val) => {
                    const unavailable = !valueAvailableForTryBuyOption(productVariants, optionName, val);
                    const isSelected = primaryValue === val;
                    const disabled = unavailable;
                    return (
                        <TouchableOpacity
                            key={val}
                            style={[
                                styles.chip,
                                isSelected && styles.chipSelected,
                                disabled && !isSelected && styles.chipDisabled,
                            ]}
                            onPress={() => !disabled && onSelectPrimary(val)}
                            disabled={disabled}
                            activeOpacity={disabled ? 1 : 0.7}
                        >
                            <Text
                                style={[
                                    styles.chipText,
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

            {showTryBlock ? (
                <View style={styles.trySection}>
                    <Text style={styles.tryHeading}>Want to try another size?</Text>
                    <Text style={styles.tryBody}>
                    Test different sizes at home for free and instantly return the products you don’t keep
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipRow}
                    >
                        {values.map((val) => {
                            const unavailable = !valueAvailableForTryBuyOption(productVariants, optionName, val);
                            const disabledByPrimary = primaryValue === val;
                            const disabled = unavailable || disabledByPrimary;
                            const isSelected = tryRowSelection === val;
                            return (
                                <TouchableOpacity
                                    key={`try-${val}`}
                                    style={[
                                        styles.chip,
                                        isSelected && styles.chipSelected,
                                        disabled && !isSelected && styles.chipDisabled,
                                    ]}
                                    onPress={() => {
                                        if (disabled) return;
                                        onTryValueChange(isSelected ? null : val);
                                    }}
                                    activeOpacity={disabled ? 1 : 0.7}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
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
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    cardBadge: {
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
        marginTop: 12,
    },
    cardBadgeText: {
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
        color: '#854D0E',
    },
    sectionLabel: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        marginBottom: 10,
    },
    chipRow: {
        flexDirection: 'row',
        gap: 10,
        paddingRight: 8,
    },
    chip: {
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
    chipText: {
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
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E7EB',
    },
    tryHeading: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        marginBottom: 8,
    },
    tryBody: {
        fontSize: 13,
        fontFamily: Fonts.LexendRegular,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 14,
    },
});
