import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { Colors } from '@/constants/theme';

interface PriceInputFilterProps {
    min: number;
    max: number;
    value?: { min: number; max: number };
    onValueChange?: (value: { min: number; max: number }) => void;
}

export const PriceInputFilter: React.FC<PriceInputFilterProps> = ({
    min,
    max,
    value,
    onValueChange
}) => {
    const [localMin, setLocalMin] = useState(value?.min?.toString() || min?.toString() || '');
    const [localMax, setLocalMax] = useState(value?.max?.toString() || max?.toString() || '');

    useEffect(() => {
        if (value) {
            setLocalMin(value.min?.toString() || '');
            setLocalMax(value.max?.toString() || '');
        } else {
            setLocalMin(min?.toString() || '');
            setLocalMax(max?.toString() || '');
        }
    }, [value, min, max]);

    const handleMinChange = (text: string) => {
        // Allow only numbers and decimal point
        const cleaned = text.replace(/[^0-9.]/g, '');
        setLocalMin(cleaned);
    };

    const handleMaxChange = (text: string) => {
        // Allow only numbers and decimal point
        const cleaned = text.replace(/[^0-9.]/g, '');
        setLocalMax(cleaned);
    };

    const handleApply = () => {
        const minVal = parseFloat(localMin) || min;
        const maxVal = parseFloat(localMax) || max;

        // Ensure min <= max
        const finalMin = Math.min(minVal, maxVal);
        const finalMax = Math.max(minVal, maxVal);

        // Ensure within bounds
        const constrainedMin = Math.max(min, Math.min(finalMin, max));
        const constrainedMax = Math.max(min, Math.min(finalMax, max));

        onValueChange?.({ min: constrainedMin, max: constrainedMax });
    };

    const handleClear = () => {
        setLocalMin(min?.toString() || '');
        setLocalMax(max?.toString() || '');
        onValueChange?.({ min, max });
    };

    return (
        <View style={styles.container}>
            <View style={styles.inputsContainer}>
                <View style={styles.inputWrapper}>
                    <Text style={styles.label}>Min Price</Text>
                    <View style={styles.inputContainer}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <TextInput
                            style={styles.input}
                            value={localMin}
                            onChangeText={handleMinChange}
                            placeholder={min?.toString() || '0'}
                            keyboardType="numeric"
                            placeholderTextColor={Colors.textSecondary}
                        />
                    </View>
                </View>

                <View style={styles.separator} />

                <View style={styles.inputWrapper}>
                    <Text style={styles.label}>Max Price</Text>
                    <View style={styles.inputContainer}>
                        <Text style={styles.currencySymbol}>₹</Text>
                        <TextInput
                            style={styles.input}
                            value={localMax}
                            onChangeText={handleMaxChange}
                            placeholder={max?.toString() || '1000'}
                            keyboardType="numeric"
                            placeholderTextColor={Colors.textSecondary}
                        />
                    </View>
                </View>
            </View>

            <View style={styles.buttonsContainer}>
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={handleClear}
                    activeOpacity={0.7}
                >
                    <Text style={styles.clearButtonText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.applyButton}
                    onPress={handleApply}
                    activeOpacity={0.7}
                >
                    <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 20,
        width: '100%',
    },
    inputsContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 20,
    },
    inputWrapper: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '400',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#fff',
    },
    currencySymbol: {
        fontSize: 16,
        color: Colors.text,
        fontWeight: '600',
        marginRight: 4,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
        fontWeight: '400',
        padding: 0,
    },
    separator: {
        width: 16,
    },
    buttonsContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    clearButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    clearButtonText: {
        fontSize: 16,
        color: Colors.text,
        fontWeight: '600',
    },
    applyButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: Colors.primary,
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
});
