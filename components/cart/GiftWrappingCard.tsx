import { Colors, Fonts } from '@/constants/theme';
import type { GiftWrapping } from '@/store/cartStore';
import React from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const REMOVE_RED = '#E85D5B';
const CARD_BG_APPLIED = '#FFFBF7';

export interface GiftWrappingCardProps {
    onSelectPress: () => void;
    giftWrapping?: GiftWrapping | null;
    onRemovePress?: () => void;
}

export function GiftWrappingCard({ onSelectPress, giftWrapping, onRemovePress }: GiftWrappingCardProps) {
    const isApplied = giftWrapping != null && (giftWrapping.productIds?.length ?? 0) > 0;

    if (isApplied) {
        return (
            <View style={[styles.section, styles.sectionApplied]}>
                <View style={styles.appliedLeft}>
                    <View style={styles.giftIconWrap}>
                    <Image source={require('@/assets/icons/gift.png')} style={styles.giftIcon} resizeMode="contain" />
                    </View>
                    <View style={styles.info}>
                        <Text style={styles.appliedTitle}>Gift wrap applied!</Text>
                        <Text style={styles.appliedSubtitle}>Your order will be gift wrapped</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={onRemovePress} activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <TouchableOpacity style={styles.button} onPress={onSelectPress} activeOpacity={0.7}>
                <View style={styles.left}>
                    <Image source={require('@/assets/icons/gift.png')} style={styles.giftIcon} resizeMode="contain" />
                    <View style={styles.info}>
                        <Text style={styles.title}>Make this a gift?</Text>
                        <Text style={styles.description}>Get items gift wrapped</Text>
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
    sectionApplied: {
        backgroundColor: CARD_BG_APPLIED,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    button: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    appliedLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    giftIconWrap: {
        width: 44,
        height: 44,
        
        alignItems: 'center',
        justifyContent: 'center',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    giftIcon: {
        width: 32,
        height: 32,
    },
    info: {
        marginLeft: 12,
        flex: 1,
    },
    appliedTitle: {
        fontSize: 16,
        color: '#212121',
        fontFamily: Fonts.Bold,
        marginBottom: 4,
    },
    appliedSubtitle: {
        fontSize: 13,
        color: '#414651',
        fontFamily: Fonts.Regular,
    },
    title: {
        fontSize: 15,
        color: '#2D2D2D',
        fontFamily: Fonts.Bold,
        marginBottom: 0,
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
    removeText: {
        fontSize: 14,
        color: REMOVE_RED,
        fontFamily: Fonts.SemiBold,
    },
});
