// Nector Rewards Badge
// Displays user's available coins in a compact badge format

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNector } from '@/context/NectorContext';
import { Colors, Fonts } from '@/constants/theme';

interface RewardsBadgeProps {
    onPress?: () => void;
    variant?: 'compact' | 'full';
    showLabel?: boolean;
}

export const RewardsBadge: React.FC<RewardsBadgeProps> = ({
    onPress,
    variant = 'compact',
    showLabel = true,
}) => {
    const { availableCoins, coinName, isLoading } = useNector();

    if (variant === 'compact') {
        return (
            <TouchableOpacity
                style={styles.compactContainer}
                onPress={onPress}
                disabled={!onPress}
            >
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.compactText}>
                    {isLoading ? '...' : availableCoins.toLocaleString()}
                </Text>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            style={styles.fullContainer}
            onPress={onPress}
            disabled={!onPress}
        >
            <View style={styles.iconContainer}>
                <Ionicons name="star" size={20} color="#FFD700" />
            </View>
            <View style={styles.textContainer}>
                {showLabel && <Text style={styles.label}>{coinName}</Text>}
                <Text style={styles.coins}>
                    {isLoading ? '...' : availableCoins.toLocaleString()}
                </Text>
            </View>
            {onPress && (
                <Ionicons name="chevron-forward" size={16} color="#999" />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9E6',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 4,
    },
    compactText: {
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
        color: '#B8860B',
    },
    fullContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9E6',
        padding: 12,
        borderRadius: 12,
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
    textContainer: {
        flex: 1,
    },
    label: {
        fontSize: 11,
        fontFamily: Fonts.Regular,
        color: '#B8860B',
    },
    coins: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#8B7500',
    },
});

export default RewardsBadge;
