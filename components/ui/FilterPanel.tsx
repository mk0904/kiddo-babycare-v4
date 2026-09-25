import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Fonts } from '@/constants/theme';
import BaseModal from '@/components/ui/BaseModal';
import { PriceSlider } from '@/components/ui/PriceSlider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

interface FilterPanelProps {
    visible: boolean;
    onClose: () => void;
    facets: any[];
    selectedFilters: any;
    onApplyFilters: (filters: any) => void;
    totalResults?: number;
}

const SLIDER_MAX_RANGE = 5000;

export const FilterPanel: React.FC<FilterPanelProps> = ({
    visible,
    onClose,
    facets,
    selectedFilters,
    onApplyFilters,
    totalResults,
}) => {
    const [localFilters, setLocalFilters] = useState<any>(selectedFilters || {});

    // Sync local state when parent filters change
    useEffect(() => {
        setLocalFilters(selectedFilters || {});
    }, [selectedFilters]);

    // Find the price facet from whatever the API returns
    const priceFacet = facets.find((f: any) =>
        f.type === 'PRICE_RANGE' ||
        f.type === 'range' ||
        f.type === 'slider' ||
        (f.attribute || f.id || '').toLowerCase().includes('price')
    );

    const priceAttribute = priceFacet?.attribute || 'price';

    // Derive slider bounds from facet buckets
    const { priceMin, priceMax } = React.useMemo(() => {
        let min = 0;
        let max = SLIDER_MAX_RANGE;
        const buckets = priceFacet?.buckets || [];
        if (buckets.length > 0) {
            const allMaxs = buckets
                .map((b: any) => parseFloat(b.to || b.max || b.value || 0))
                .filter((v: number) => !isNaN(v) && v > 0);
            if (allMaxs.length > 0) {
                const calculated = Math.max(...allMaxs);
                if (calculated > min) max = Math.min(calculated, SLIDER_MAX_RANGE);
            }
        }
        max = Math.min(Math.ceil(max / 10) * 10, SLIDER_MAX_RANGE);
        if (max <= min) max = SLIDER_MAX_RANGE;
        return { priceMin: min, priceMax: max };
    }, [priceFacet]);

    // Parse current slider value from localFilters
    const currentPriceValue = React.useMemo(() => {
        const raw = (localFilters[priceAttribute] || [])[0];
        if (raw) {
            const parts = String(raw).split(/[,\-]/);
            if (parts.length === 2) {
                const lo = parseFloat(parts[0]);
                const hi = parseFloat(parts[1]);
                if (!isNaN(lo) && !isNaN(hi)) return { min: lo, max: hi };
            }
        }
        return { min: priceMin, max: priceMax };
    }, [localFilters, priceAttribute, priceMin, priceMax]);

    const handleApply = () => {
        onApplyFilters(localFilters);
        onClose();
    };

    const handleClear = () => {
        setLocalFilters({});
        onApplyFilters({});
        onClose();
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="Filters"
            type="bottomSheet"
            closeButtonPosition="above"
            containerStyle={styles.modalContainer}
            contentStyle={styles.modalContent}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.body}>
                    <Text style={styles.sectionTitle}>Price Range</Text>
                    <PriceSlider
                        min={priceMin}
                        max={priceMax}
                        minRange={50}
                        step={10}
                        value={currentPriceValue}
                        onValueChange={(val) => {
                            setLocalFilters((prev: any) => ({
                                ...prev,
                                [priceAttribute]: [`${Math.round(val.min)},${Math.round(val.max)}`],
                            }));
                        }}
                    />
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.8}>
                        <Text style={styles.clearBtnText}>Clear All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.8}>
                        <Text style={styles.applyBtnText} numberOfLines={1}>
                            {totalResults ? `Show ${totalResults} Results` : 'Apply Filters'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </GestureHandlerRootView>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        height: '45%',
        maxHeight: '55%',
        minHeight: 320,
    },
    modalContent: {
        flex: 1,
        paddingBottom: 20,
    },
    body: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: Fonts.LexendBold,
        color: Colors.text,
        marginBottom: 24,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'stretch',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E9ECEF',
        gap: 12,
        backgroundColor: '#FFF',
    },
    clearBtn: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    clearBtnText: {
        fontSize: 15,
        fontFamily: Fonts.LexendBold,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    applyBtn: {
        flex: 1,
        minHeight: 48,
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyBtnText: {
        fontSize: 15,
        fontFamily: Fonts.LexendBold,
        color: '#FFF',
        textAlign: 'center',
    },
});
