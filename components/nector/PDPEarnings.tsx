// PDP Earnings Display
// Shows how many coins user will earn for purchasing a product

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNector } from '@/context/NectorContext';
import { Fonts } from '@/constants/theme';

interface PDPEarningsProps {
    productPrice: number;
    style?: object;
}

export const PDPEarnings: React.FC<PDPEarningsProps> = ({ productPrice, style }) => {
    const { calculateEarnings, coinName, rules, isInitialized } = useNector();

    if (!isInitialized || !rules) return null;

    const earnings = calculateEarnings(productPrice);

    if (earnings <= 0) return null;

    return (
        <View style={[styles.container, style]}>
            <Ionicons name="gift-outline" size={14} color="#4CAF50" />
            <Text style={styles.text}>
                Earn <Text style={styles.coins}>{earnings}</Text> {coinName} on this purchase
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        gap: 6,
    },
    text: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#2E7D32',
    },
    coins: {
        fontFamily: Fonts.Bold,
        color: '#1B5E20',
    },
});

export default PDPEarnings;
