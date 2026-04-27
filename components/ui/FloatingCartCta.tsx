import { Fonts } from '@/constants/theme';
import { useCartItemCount } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import { MILESTONE_CART_ROW_PILL_HEIGHT } from '@/utils/homeMilestoneRowLayout';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type FloatingCartCtaProps = {
    /** Sits in the 30% column next to `MilestoneTracker` (tighter padding, can shrink). */
    inMilestoneRow?: boolean;
    onPress?: () => void;
    testID?: string;
};

/** Solid coral; matches the floating “Cart” pill. */
const CART_PILL_BG = '#DB5656';

/**
 * Shared floating “Cart” control. Used by `FloatingCartButton` and `MilestoneCartRow`.
 * Layout: [count in white disc] — “Cart” — [outlined white arrow]
 */
export function FloatingCartCta({ inMilestoneRow = false, onPress, testID }: FloatingCartCtaProps) {
    const router = useRouter();
    const itemCount = useCartItemCount();

    const countLabel = useMemo(() => {
        if (itemCount > 99) return '99+';
        return String(Math.max(0, itemCount));
    }, [itemCount]);

    const handlePress = useCallback(() => {
        if (onPress) {
            onPress();
            return;
        }
        router.push('/cart' as any);
    }, [onPress, router]);

    return (
        <TouchableOpacity
            testID={testID}
            style={[
                styles.button,
                inMilestoneRow ? styles.buttonInMilestoneRow : styles.buttonFloating,
            ]}
            onPress={handlePress}
            activeOpacity={0.92}
        >
            <View style={[styles.content, inMilestoneRow && styles.contentInMilestoneRow]}>
                <View style={styles.startSlot}>
                    <View
                        style={styles.countBadge}
                        accessibilityLabel={`${itemCount} items in cart`}
                    >
                        <Text style={styles.countText} numberOfLines={1} allowFontScaling>
                            {countLabel}
                        </Text>
                    </View>
                    <View style={styles.labelSlot}>
                        <Text style={styles.cartLabel} numberOfLines={1}>
                            Cart
                        </Text>
                    </View>
                </View>

                <View style={styles.endSlot} pointerEvents="none">
                    <View style={styles.arrowRing}>
                        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        minWidth: 140,
        height: MILESTONE_CART_ROW_PILL_HEIGHT,
        borderRadius: 24,
        backgroundColor: CART_PILL_BG,
        justifyContent: 'center',
        overflow: 'hidden',
        paddingHorizontal: 10,
    },
    /** Space above the tab bar when the pill is `FloatingCartButton` (not in `MilestoneCartRow`). */
    buttonFloating: {
        marginBottom: 10,
    },
    buttonInMilestoneRow: {
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        height: MILESTONE_CART_ROW_PILL_HEIGHT,
        minHeight: MILESTONE_CART_ROW_PILL_HEIGHT,
        maxHeight: MILESTONE_CART_ROW_PILL_HEIGHT,
        alignSelf: 'stretch',
        marginBottom: 0,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        height: '100%',
    },
    contentInMilestoneRow: {
        paddingHorizontal: 4,
        minWidth: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    startSlot: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    labelSlot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    endSlot: {
        width: 34,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    countBadge: {
        width: 20,
        height: 20,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countText: {
        fontSize: 14,
        fontFamily: Fonts.LexendBold,
        color: CART_PILL_BG,
    },
    cartLabel: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#FFFFFF',
    },
    arrowRing: {
        width: 20,
        height: 20,
        borderRadius: 15,
        borderWidth: 2,
        borderColor: '#FFFFFF',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
