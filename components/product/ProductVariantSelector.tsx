import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

interface VariantOption {
    name: string;
    values: string[];
}

interface ProductVariantSelectorProps {
    options: VariantOption[];
    selectedOptions: Record<string, string>;
    onSelectOption: (name: string, value: string) => void;
    availableOptions?: Record<string, string[]>; // Map of option name -> valid values given current selection (optional advanced logic)
}

export const ProductVariantSelector = ({
    options,
    selectedOptions,
    onSelectOption,
}: ProductVariantSelectorProps) => {
    if (!options || options.length === 0) return null;

    return (
        <View style={styles.container}>
            {options.map((option, index) => {
                // Skip Title option if it's "Default Title" (Shopify default for single variant)
                if (option.name === 'Title' && option.values.includes('Default Title')) return null;

                return (
                    <View key={`${option.name}-${index}`} style={styles.optionContainer}>
                        <Text style={styles.optionLabel}>
                            <Text style={styles.optionName}>{option.name}</Text>
                            <Text style={styles.selectedValue}>: {selectedOptions[option.name]}</Text>
                        </Text>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.valuesContainer}>
                            {option.values.map((value) => {
                                const isSelected = selectedOptions[option.name] === value;

                                return (
                                    <TouchableOpacity
                                        key={value}
                                        style={[
                                            styles.valueChip,
                                            isSelected && styles.valueChipSelected,
                                            // Add disabled style if needed based on inventory
                                        ]}
                                        onPress={() => onSelectOption(option.name, value)}
                                        activeOpacity={0.7}
                                    >
                                        <Text
                                            style={[
                                                styles.valueText,
                                                isSelected && styles.valueTextSelected,
                                            ]}
                                        >
                                            {value}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 10,
    },
    optionContainer: {
        marginBottom: 16,
    },
    optionLabel: {
        marginBottom: 10,
        fontSize: 14,
    },
    optionName: {
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
    },
    selectedValue: {
        color: Colors.textSecondary,
    },
    valuesContainer: {
        flexDirection: 'row',
        gap: 10,
        paddingRight: 20, // Add padding for horizontal scroll
    },
    valueChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#fff',
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    valueChipSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary,
    },
    valueText: {
        fontSize: 14,
        color: Colors.text,
        fontFamily: Fonts.Medium,
    },
    valueTextSelected: {
        color: '#fff',
    },
});
