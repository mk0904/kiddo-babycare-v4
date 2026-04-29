import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface MilestoneDiscountBlockProps {
    visible?: boolean;
    /** Code to apply (e.g. FIRSTMILESTONE) */
    code: string;
    /** Discount title (e.g. 25% OFF) */
    title: string;
    /** Description (e.g. Get 25% off on your first order) */
    description: string;
    /** Icon URL from milestone config */
    iconUrl?: string;
    /** When false, the Add control is disabled until the milestone min cart is met. */
    milestoneMinCartUnlocked?: boolean;
    /** Whether this specific coupon is applied */
    isApplied: boolean;
    /** Callback to apply the coupon */
    onAddPress: () => void;
    /** Callback to remove the coupon */
    onRemoveOffer: () => void;
    /** Color from milestone config */
    accentColor?: string;
    /** Background color for the card (usually a lighter version of accentColor) */
    backgroundColor?: string;
}

export function MilestoneDiscountBlock({
    visible = true,
    code,
    title,
    description,
    iconUrl,
    milestoneMinCartUnlocked = true,
    isApplied,
    onAddPress,
    onRemoveOffer,
    accentColor = '#4F9CD5',
    backgroundColor = '#FEEFEF',
}: MilestoneDiscountBlockProps) {
    if (!visible) return null;

    const displayColor = accentColor;
    const displayBg = backgroundColor;

    return (
        <View style={styles.container}>
            <View style={[styles.productCard, { backgroundColor: displayBg }]}>
                <View style={styles.frostOverlay} />
                <View style={[styles.rewardIcon, styles.iconPlaceholder]}>
                    <Ionicons name="cash-outline" size={32} color={displayColor} />
                </View>
                <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                        {title}
                    </Text>
                    <Text style={styles.metaText} numberOfLines={2}>
                        {description}
                    </Text>

                </View>
                <View style={styles.actionBlock}>
                    {isApplied ? (
                        <TouchableOpacity
                            style={[styles.appliedButton, { backgroundColor: displayColor }]}
                            onPress={onRemoveOffer}
                            activeOpacity={0.8}
                            accessibilityLabel="Remove milestone discount"
                        >
                            <Ionicons name="close" size={22} color="#FFFFFF" />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[
                                styles.addButton,
                                !milestoneMinCartUnlocked && styles.addButtonDisabled,
                                { borderColor: displayColor }
                            ]}
                            onPress={onAddPress}
                            activeOpacity={0.8}
                            disabled={!milestoneMinCartUnlocked}
                        >
                            <Text style={[
                                styles.addButtonText,
                                !milestoneMinCartUnlocked && styles.addButtonTextDisabled,
                                { color: displayColor }
                            ]}>
                                Add
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 8,
        paddingVertical: 12,
        marginBottom: 16,
    },
    productCard: {
        flexDirection: 'row',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    frostOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    rewardIcon: {
        width: 64,
        height: 64,
        borderRadius: 8,
    },
    iconPlaceholder: {
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    productInfo: {
        flex: 1,
        marginLeft: 12,
    },
    productName: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#181D27',
        marginBottom: 4,
    },
    metaText: {
        fontSize: 10,
        fontFamily: Fonts.LexendBold,
        color: '#717680',
        lineHeight: 14,
    },
    appliedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4,
    },
    appliedBadgeText: {
        fontSize: 10,
        fontFamily: Fonts.LexendMedium,
        color: '#16B364',
    },
    actionBlock: {
        alignItems: 'flex-end',
        marginLeft: 8,
    },
    addButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
    },
    addButtonText: {
        fontFamily: Fonts.LexendBold,
        fontSize: 14,
    },
    addButtonDisabled: {
        backgroundColor: '#F9FAFB',
        borderColor: '#D5D7DA',
        opacity: 0.5,
    },
    addButtonTextDisabled: {
        color: '#717680',
    },
    appliedButton: {
        minWidth: 48,
        height: 40,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
});
