import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import BaseModal from '@/components/ui/BaseModal';
import { PriceSlider } from '@/components/ui/PriceSlider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FilterPanelProps {
    visible: boolean;
    onClose: () => void;
    facets: any[];
    selectedFilters: any;
    onApplyFilters: (filters: any) => void;
    totalResults?: number;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
    visible,
    onClose,
    facets,
    selectedFilters,
    onApplyFilters,
    totalResults,
}) => {
    const [localFilters, setLocalFilters] = useState<any>(selectedFilters || {});
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Update local filters when selectedFilters prop changes
    useEffect(() => {
        setLocalFilters(selectedFilters || {});
    }, [selectedFilters]);

    // Set first category as selected when facets load
    useEffect(() => {
        if (facets && Array.isArray(facets) && facets.length > 0 && !selectedCategory) {
            setSelectedCategory(facets[0].attribute);
        }
    }, [facets, selectedCategory]);

    const handleFilterToggle = (attribute: string, value: string) => {
        setLocalFilters((prev: any) => {
            const current = prev[attribute] || [];
            const isSelected = current.includes(value);

            if (isSelected) {
                const updated = current.filter((v: string) => v !== value);
                if (updated.length === 0) {
                    const { [attribute]: _, ...rest } = prev;
                    return rest;
                }
                return { ...prev, [attribute]: updated };
            } else {
                return { ...prev, [attribute]: [...current, value] };
            }
        });
    };

    const handleApply = () => {
        onApplyFilters(localFilters);
        onClose();
    };

    const handleClear = () => {
        setLocalFilters({});
        onApplyFilters({});
        onClose();
    };

    const activeFacet = useMemo(() => {
        return facets.find(f => f.attribute === selectedCategory);
    }, [facets, selectedCategory]);

    const filteredBuckets = useMemo(() => {
        if (!activeFacet || !activeFacet.buckets) return [];
        if (!searchQuery) return activeFacet.buckets;
        return activeFacet.buckets.filter((b: any) => 
            (b.label || b.value || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [activeFacet, searchQuery]);

    const renderFilterOptions = () => {
        if (!activeFacet) return null;

        const { attribute, type, title } = activeFacet;
        const selectedValues = localFilters[attribute] || [];

        // Special UI for Price
        if (type === 'range' || type === 'slider' || attribute === 'price' || attribute === 'price_range' || type === 'PRICE_RANGE') {
            let priceMin = 0;
            let priceMax = 10000;
            
            const buckets = activeFacet.buckets || [];
            if (buckets.length > 0) {
                const firstBucket = buckets[0];
                // Try to get from first bucket's from/to
                if (firstBucket.from !== undefined && firstBucket.to !== undefined && firstBucket.from !== "" && firstBucket.to !== "") {
                    const parsedFrom = parseFloat(firstBucket.from);
                    const parsedTo = parseFloat(firstBucket.to);
                    if (!isNaN(parsedFrom) && parsedFrom >= 0) priceMin = parsedFrom;
                    if (!isNaN(parsedTo) && parsedTo > priceMin) priceMax = parsedTo;
                } else {
                    // Extract all min and max values from buckets
                    const allMins = buckets
                        .map((b: any) => {
                            const val = parseFloat(b.from || b.min || b.value || 0);
                            return isNaN(val) ? null : val;
                        })
                        .filter((v: number | null): v is number => v !== null && v >= 0);
                    
                    const allMaxs = buckets
                        .map((b: any) => {
                            const val = parseFloat(b.to || b.max || b.value || 0);
                            return isNaN(val) ? null : val;
                        })
                        .filter((v: number | null): v is number => v !== null && v > 0);
                    
                    if (allMins.length > 0) {
                        const calculatedMin = Math.min(...allMins);
                        if (calculatedMin >= 0) priceMin = calculatedMin;
                    }
                    if (allMaxs.length > 0) {
                        const calculatedMax = Math.max(...allMaxs);
                        if (calculatedMax > priceMin) priceMax = calculatedMax;
                    }
                }
            }
            
            // Round to nearest 10
            priceMin = Math.floor(priceMin / 10) * 10;
            priceMax = Math.ceil(priceMax / 10) * 10;
            
            // Ensure we have valid min/max values - if max is 0 or <= min, set reasonable defaults
            if (priceMin < 0) priceMin = 0;
            if (priceMax <= priceMin || priceMax === 0) {
                // If max is invalid, set it to at least 1000 or min + 1000, whichever is larger
                priceMax = Math.max(priceMin + 1000, 10000);
            }
            
            let currentValue: { min: number; max: number } | undefined;
            if (selectedValues.length > 0) {
                const valueStr = selectedValues[0];
                const parts = valueStr.split(/[,\-]/);
                if (parts.length === 2) {
                    const parsedMin = parseFloat(parts[0]);
                    const parsedMax = parseFloat(parts[1]);
                    if (!isNaN(parsedMin) && !isNaN(parsedMax)) {
                        currentValue = { min: parsedMin, max: parsedMax };
                    }
                }
            }
            // When no value is selected, show the full range (not just min to max, but actual min to actual max)
            if (!currentValue) {
                currentValue = { min: priceMin, max: priceMax };
            }

            return (
                <View style={styles.priceContainer}>
                    <Text style={styles.rightPaneTitle}>{title}</Text>
                    <PriceSlider
                        min={priceMin}
                        max={priceMax}
                        value={currentValue}
                        onValueChange={(val) => {
                            setLocalFilters((prev: any) => ({
                                ...prev,
                                [attribute]: [`${Math.round(val.min)},${Math.round(val.max)}`]
                            }));
                        }}
                    />
                </View>
            );
        }

        // Standard List UI for Brands, Tags, Categories
        return (
            <View style={styles.optionsWrapper}>
                <View style={styles.rightHeader}>
                    <Text style={styles.rightPaneTitle}>{title}</Text>
                    {activeFacet.buckets.length > 8 && (
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={16} color={Colors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={`Search ${title}...`}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                placeholderTextColor={Colors.textSecondary}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.optionsList}>
                    {filteredBuckets.map((bucket: any, index: number) => {
                        const val = bucket.value || bucket.label;
                        const isSelected = selectedValues.includes(val);
                        
                        return (
                            <TouchableOpacity
                                key={`${attribute}-${val}-${index}`}
                                style={styles.optionRow}
                                onPress={() => handleFilterToggle(attribute, val)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                                </View>
                                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                                    {bucket.label || bucket.value}
                                </Text>
                                <Text style={styles.optionCount}>{bucket.count}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>
        );
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            title="Filters"
            type="bottomSheet"
            containerStyle={styles.modalContainer}
            contentStyle={styles.modalContent}
        >
            <GestureHandlerRootView style={{ flex: 1 }}>
                <View style={styles.main}>
                    {/* Left Pane: Categories */}
                    <View style={styles.leftPane}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {facets.map((facet) => {
                                const isSelected = selectedCategory === facet.attribute;
                                const count = localFilters[facet.attribute]?.length || 0;
                                return (
                                    <TouchableOpacity
                                        key={facet.attribute}
                                        style={[styles.catItem, isSelected && styles.catItemSelected]}
                                        onPress={() => {
                                            setSelectedCategory(facet.attribute);
                                            setSearchQuery('');
                                        }}
                                    >
                                        <Text style={[styles.catText, isSelected && styles.catTextSelected]}>
                                            {facet.title}
                                        </Text>
                                        {count > 0 && (
                                            <View style={styles.dot} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Right Pane: Options */}
                    <View style={styles.rightPane}>
                        {renderFilterOptions()}
                    </View>
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                        <Text style={styles.clearBtnText}>Clear All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
                        <Text style={styles.applyBtnText}>
                            {totalResults ? `Show ${totalResults} Results` : 'Apply Filters'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </GestureHandlerRootView>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    modalContainer: { height: '85%', maxHeight: '85%' },
    modalContent: { flex: 1 },
    main: { flex: 1, flexDirection: 'row' },
    
    // Left Pane
    leftPane: {
        width: 130,
        backgroundColor: '#F8F9FA',
        borderRightWidth: 1,
        borderRightColor: '#E9ECEF',
    },
    catItem: {
        paddingVertical: 18,
        paddingHorizontal: 16,
        borderLeftWidth: 4,
        borderLeftColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    catItemSelected: {
        backgroundColor: '#FFF',
        borderLeftColor: Colors.primary,
    },
    catText: {
        fontSize: 13,
        fontFamily: Fonts.Medium,
        color: Colors.textSecondary,
        flex: 1,
    },
    catTextSelected: {
        color: Colors.primary,
        fontFamily: Fonts.Bold,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.primary,
        marginLeft: 4,
    },

    // Right Pane
    rightPane: { flex: 1, backgroundColor: '#FFF' },
    optionsWrapper: { flex: 1 },
    rightHeader: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F3F5',
    },
    rightPaneTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        marginBottom: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F3F5',
        borderRadius: 10,
        paddingHorizontal: 12,
        height: 40,
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.text,
        padding: 0,
    },
    optionsList: { paddingHorizontal: 20, paddingBottom: 30 },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F8F9FA',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#CED4DA',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    checkboxSelected: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    optionLabel: {
        flex: 1,
        fontSize: 15,
        fontFamily: Fonts.Medium,
        color: Colors.textSecondary,
    },
    optionLabelSelected: {
        color: Colors.text,
        fontFamily: Fonts.SemiBold,
    },
    optionCount: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#ADB5BD',
    },
    priceContainer: { padding: 20 },

    // Footer
    footer: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E9ECEF',
        gap: 12,
        backgroundColor: '#FFF',
    },
    clearBtn: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E9ECEF',
    },
    clearBtnText: {
        fontSize: 15,
        fontFamily: Fonts.Bold,
        color: Colors.textSecondary,
    },
    applyBtn: {
        flex: 1,
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    applyBtnText: {
        fontSize: 15,
        fontFamily: Fonts.Bold,
        color: '#FFF',
    },
});
