import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface GiftWrappingCardProps {
    onSelectPress: () => void;
}

export function GiftWrappingCard({ onSelectPress }: GiftWrappingCardProps) {
    return (
        <View style={styles.section}>
            <TouchableOpacity style={styles.button} onPress={onSelectPress} activeOpacity={0.7}>
                <View style={styles.left}>
                    <Ionicons name="gift-outline" size={24} color={Colors.primary} />
                    <View style={styles.info}>
                        <Text style={styles.title}>Make this a gift?</Text>
                        <Text style={styles.description}>Get items gift wrapped for FREE</Text>
                    </View>
                </View>
                <Text style={styles.select}>Select</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 0,
        marginBottom: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    button: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    info: {
        marginLeft: 12,
        flex: 1,
    },
    title: {
        fontSize: 15,
        color: '#2D2D2D',
        fontFamily: Fonts.Bold,
        marginBottom: 4,
    },
    description: {
        fontSize: 12,
        color: '#888',
        fontFamily: Fonts.Regular,
        textDecorationLine: 'underline',
    },
    select: {
        fontSize: 14,
        color: Colors.primary,
        fontFamily: Fonts.SemiBold,
    },
});
