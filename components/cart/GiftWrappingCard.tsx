import { Fonts } from '@/constants/theme';
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
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginBottom: 24,
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
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.BoldWeight,
        marginBottom: 4,
    },
    appliedSubtitle: {
        fontSize: Fonts.ExtraSmallFontSize,
        color: '#535862',
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.MediumWeight,
    },
    title: {
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.BoldWeight,
        marginBottom: 2,
    },
    description: {
        fontSize: Fonts.SmallFontSize,
        color: '#535862',
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.MediumWeight,
        textDecorationLine: 'underline',
    },
    select: {
        fontSize: Fonts.SmallFontSize,
        color: '#F15E5E',
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.BoldWeight,
        marginRight: 12,
    },
    removeText: {
        fontSize: 14,
        color: REMOVE_RED,
        fontFamily: Fonts.SemiBold,
        marginRight: 12,
    },
});
