import { Button } from '@/components/ui/Button';
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ItemDetails } from './types';

interface StepSummaryProps {
    order: any;
    selectedItems: string[];
    itemDetails: Record<string, ItemDetails>;
    schedule: { date: string; time: string };
    onSubmit: () => void;
    isSubmitting?: boolean;
}

export const StepSummary: React.FC<StepSummaryProps> = ({
    order,
    selectedItems,
    itemDetails,
    schedule,
    onSubmit,
    isSubmitting,
}) => {
    const returningItems = selectedItems.filter(id => itemDetails[id]?.type === 'Return');
    const exchangingItems = selectedItems.filter(id => itemDetails[id]?.type === 'Exchange');

    const renderItemRow = (id: string, isExchange: boolean) => {
        const edge = order?.lineItems?.edges?.find((e: any) =>
            (e.node.id || e.node.variant?.id) === id
        );
        if (!edge) return null;
        const item = edge.node;
        const details = itemDetails[id];

        const imgUrl = isExchange && details.variant?.image?.url
            ? details.variant.image.url
            : item.variant?.image?.url;

        const price = parseFloat(item.originalTotalPrice?.amount || item.price?.amount || '0');

        return (
            <View key={id} style={styles.itemRow}>
                {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={styles.itemImage} />
                ) : (
                    <View style={[styles.itemImage, styles.placeholderImg]}>
                        <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                    </View>
                )}
                <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.priceText}>
                        ₹{price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </Text>
                    {isExchange && details.variant?.title && (
                        <View style={styles.exchangeMeta}>
                            <Text style={styles.metaText}>Variant: {details.variant.title}</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

                {/* Banner */}
                <View style={styles.banner}>
                    <View style={styles.bannerIcon}>
                        <Ionicons name="calendar" size={24} color="#F05A5D" />
                    </View>
                    <View style={styles.bannerTextContainer}>
                        <Text style={styles.bannerTitle}>Return/Exchange scheduled!</Text>
                        <Text style={styles.bannerSubtitle}>
                            For {schedule.time} - {schedule.date}
                        </Text>
                        <TouchableOpacity>
                            <Text style={styles.bannerLink}>Changed your mind? Update now</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Returning List */}
                {returningItems.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Returning</Text>
                        {returningItems.map(id => renderItemRow(id, false))}
                    </View>
                )}

                {/* Exchanging List */}
                {exchangingItems.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Exchanging</Text>
                        {exchangingItems.map(id => renderItemRow(id, true))}
                    </View>
                )}

            </ScrollView>

            <View style={styles.footer}>
                <Button
                    title="Confirm"
                    onPress={onSubmit}
                    style={styles.confirmBtn}
                    textStyle={styles.confirmBtnText}
                    loading={isSubmitting}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    banner: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        marginBottom: 24,

    },
    bannerIcon: {
        marginRight: 16,
        marginTop: 2,
    },
    bannerTextContainer: {
        flex: 1,
    },
    bannerTitle: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        marginBottom: 4,
    },
    bannerSubtitle: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        color: '#414651',
        marginBottom: 6,
    },
    bannerLink: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        color: '#F15E5E',
        textDecorationLine: 'underline',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontFamily: Fonts.LexendSemiBold,
        color: '#717680',
        marginBottom: 16,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    itemImage: {
        width: 56,
        height: 56,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        marginRight: 16,
    },
    placeholderImg: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#1F2937',
        lineHeight: 18,
    },
    priceText: {
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
        color: '#111827',
        marginTop: 4,
    },
    exchangeMeta: {
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    metaText: {
        fontSize: 11,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    confirmBtn: {
        backgroundColor: '#F05A5D',
        borderRadius: 16,
        height: 52,
    },
    confirmBtnText: {
        fontFamily: Fonts.LexendSemiBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
});
