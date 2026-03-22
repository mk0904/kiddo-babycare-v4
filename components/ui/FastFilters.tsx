import React, { useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';
import { Colors, Fonts } from '@/constants/theme';

interface FastFilter {
    id: string;
    label: string;
    value: any;
    attribute: string;
}

interface FastFiltersProps {
    facets: any[];
    selectedFilters: any;
    onFilterToggle: (attribute: string, value: any) => void;
    onScrollChange?: (scrollOffset: number) => void;
}

const SCROLL_THRESHOLD = 20; // Pixels scrolled before collapsing

export const FastFilters: React.FC<FastFiltersProps> = ({
    facets,
    selectedFilters,
    onFilterToggle,
    onScrollChange,
}) => {
    const scrollViewRef = useRef<ScrollView>(null);
    // Generate fast filter options from facets
    const fastFilters = useMemo(() => {
        const filters: FastFilter[] = [];

        // Price range filters
        const priceFacet = facets.find(f => 
            f.attribute === 'price' || 
            f.attribute === 'price_range' || 
            f.type === 'slider' || 
            f.type === 'range'
        );

        // Check both buckets and values (Shopify uses different structures)
        const priceBuckets = priceFacet?.buckets || priceFacet?.values || [];
        if (priceFacet && priceBuckets.length > 0) {
            const firstBucket = priceBuckets[0];
            let maxPrice = 10000;
            
            if (firstBucket.to) {
                maxPrice = parseFloat(firstBucket.to) || 10000;
            }

            // Generate common price ranges
            const priceRanges = [
                { label: 'Under ₹500', min: 0, max: 500 },
                { label: '₹500 - ₹1K', min: 500, max: 1000 },
                { label: '₹1K - ₹2K', min: 1000, max: 2000 },
                { label: '₹2K - ₹5K', min: 2000, max: 5000 },
                { label: '₹5K+', min: 5000, max: maxPrice },
            ].filter(range => range.max <= maxPrice || range.min >= 5000);

            priceRanges.forEach(range => {
                filters.push({
                    id: `price-${range.min}-${range.max}`,
                    label: range.label,
                    value: `${range.min},${range.max}`,
                    attribute: priceFacet.attribute,
                });
            });
        }

        // Top brands (limit to 3-4 most popular)
        const brandFacet = facets.find(f => 
            f.attribute?.toLowerCase().includes('brand') ||
            f.title?.toLowerCase().includes('brand')
        );

        // Check both buckets and values (Shopify uses different structures)
        const brandBuckets = brandFacet?.buckets || brandFacet?.values || [];
        if (brandFacet && brandBuckets.length > 0) {
            const topBrands = brandBuckets
                .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
                .slice(0, 3)
                .map((bucket: any) => ({
                    id: `brand-${bucket.value || bucket.label}`,
                    label: bucket.label || bucket.value,
                    value: bucket.value || bucket.label,
                    attribute: brandFacet.attribute || brandFacet.id,
                }));
            filters.push(...topBrands);
        }

        return filters;
    }, [facets]);

    if (fastFilters.length === 0) return null;

    const isFilterActive = (filter: FastFilter) => {
        const selected = selectedFilters[filter.attribute];
        if (!selected || !Array.isArray(selected)) return false;
        return selected.includes(filter.value);
    };

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        onScrollChange?.(offsetX);
    };

    return (
        <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.container}
            style={styles.scrollView}
            onScroll={handleScroll}
            scrollEventThrottle={16}
        >
            {fastFilters.map((filter) => {
                const isActive = isFilterActive(filter);
                return (
                    <TouchableOpacity
                        key={filter.id}
                        style={[styles.filterChip, isActive && styles.filterChipActive]}
                        onPress={() => onFilterToggle(filter.attribute, filter.value)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                            {filter.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    scrollView: {
        height: 32,
    },
    container: {
        paddingRight: 4,
        paddingVertical: 0,
        gap: 8,
        alignItems: 'center',
        height: 32,
    },
    /** Match PDP variant chips */
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        height: 28,
        justifyContent: 'center',
    },
    filterChipActive: {
        backgroundColor: '#FEEFEF',
        borderWidth: 1.5,
        borderColor: Colors.variantSelection,
    },
    filterText: {
        fontSize: 13,
        fontFamily: Fonts.LexendSemiBold,
        color: Colors.text,
    },
    filterTextActive: {
        color: Colors.variantSelection,
        fontFamily: Fonts.LexendSemiBold,
    },
});

