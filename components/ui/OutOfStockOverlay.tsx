import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface OutOfStockOverlayProps {
    /** Optional style for the overlay container (e.g. borderRadius) */
    style?: object;
}

/**
 * Shared out-of-stock UI: dark overlay with centered grey badge and "Out of Stock" text.
 * Use on product cards, PDP, and anywhere we show an unavailable product.
 */
export function OutOfStockOverlay({ style }: OutOfStockOverlayProps) {
    return (
        <View style={[styles.overlay, style]} pointerEvents="none">
            <View style={styles.badge}>
                <Text style={styles.text} allowFontScaling={true}>Out of Stock</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        zIndex: 8,
    },
    badge: {
        backgroundColor: 'rgba(107, 114, 128, 0.95)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        minHeight: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});

export default OutOfStockOverlay;
