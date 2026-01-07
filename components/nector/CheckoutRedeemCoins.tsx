// Checkout Coin Redemption
// Allows users to redeem coins at checkout

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNector } from '@/context/NectorContext';
import { Colors } from '@/constants/theme';

interface CheckoutRedeemCoinsProps {
    cartAmount: number;
    onCouponApplied?: (code: string) => void;
    onCouponRemoved?: () => void;
}

export const CheckoutRedeemCoins: React.FC<CheckoutRedeemCoinsProps> = ({
    cartAmount,
    onCouponApplied,
    onCouponRemoved,
}) => {
    const {
        availableCoins,
        coinName,
        coinValue,
        applyCoinsAtCheckout,
        revertCheckoutCoins,
        user,
        rules,
    } = useNector();

    const [isApplied, setIsApplied] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    // Check minimum cart value
    const minimumCartValue = rules?.minimum_cart_value || 0;
    const isEligible = cartAmount >= minimumCartValue && availableCoins > 0;

    const handleToggle = async () => {
        setIsLoading(true);
        setError(null);

        try {
            if (isApplied) {
                // Revert coins
                await revertCheckoutCoins(cartAmount);
                setIsApplied(false);
                setAppliedDiscount(0);
                onCouponRemoved?.();
            } else {
                // Apply coins
                const result = await applyCoinsAtCheckout(cartAmount);
                if (result.success && result.discountCode) {
                    setIsApplied(true);
                    setAppliedDiscount(coinValue(availableCoins));
                    onCouponApplied?.(result.discountCode);
                } else {
                    setError(result.error || 'Failed to apply coins');
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!user || availableCoins <= 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Ionicons name="star" size={18} color="#FFD700" />
                </View>
                <View style={styles.info}>
                    <Text style={styles.title}>Use {coinName}</Text>
                    <Text style={styles.subtitle}>
                        {availableCoins.toLocaleString()} available (₹{coinValue(availableCoins).toFixed(0)} value)
                    </Text>
                </View>
            </View>

            {!isEligible && (
                <Text style={styles.ineligible}>
                    Add ₹{(minimumCartValue - cartAmount).toFixed(0)} more to use {coinName}
                </Text>
            )}

            {isEligible && (
                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        isApplied && styles.toggleButtonActive,
                        isLoading && styles.toggleButtonLoading,
                    ]}
                    onPress={handleToggle}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color={isApplied ? '#fff' : Colors.primary} />
                    ) : (
                        <>
                            <Text style={[styles.toggleText, isApplied && styles.toggleTextActive]}>
                                {isApplied ? `Applied: -₹${appliedDiscount.toFixed(0)}` : 'Redeem'}
                            </Text>
                            {isApplied && (
                                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                            )}
                        </>
                    )}
                </TouchableOpacity>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFF9E6',
        borderRadius: 12,
        padding: 14,
        gap: 10,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFE4B5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontFamily: 'Metropolis-SemiBold',
        color: '#8B7500',
    },
    subtitle: {
        fontSize: 12,
        fontFamily: 'Metropolis-Regular',
        color: '#B8860B',
    },
    ineligible: {
        fontSize: 11,
        fontFamily: 'Metropolis-Regular',
        color: '#999',
        fontStyle: 'italic',
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Colors.primary,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    toggleButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    toggleButtonLoading: {
        opacity: 0.7,
    },
    toggleText: {
        fontSize: 14,
        fontFamily: 'Metropolis-SemiBold',
        color: Colors.primary,
    },
    toggleTextActive: {
        color: '#fff',
    },
    error: {
        fontSize: 11,
        fontFamily: 'Metropolis-Regular',
        color: '#F44336',
    },
});

export default CheckoutRedeemCoins;
