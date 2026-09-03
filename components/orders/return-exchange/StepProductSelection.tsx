import { Button } from '@/components/ui/Button';
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StepProductSelectionProps {
    order: any;
    selectedItems: string[];
    onNext: (items: string[]) => void;
}

export const StepProductSelection: React.FC<StepProductSelectionProps> = ({
    order,
    selectedItems: initialSelected,
    onNext,
}) => {
    const [selected, setSelected] = useState<string[]>(initialSelected);

    const toggleItem = (id: string) => {
        if (selected.includes(id)) {
            setSelected(selected.filter(i => i !== id));
        } else {
            setSelected([...selected, id]);
        }
    };

    const edges = order?.lineItems?.edges || [];
    const totalSelected = selected.length;
    const totalItems = edges.length;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Select Products</Text>
                <Text style={styles.countText}>{totalSelected}/{totalItems} selected</Text>
            </View>

            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {edges.map((edge: any) => {
                    const item = edge.node;
                    const isSelected = selected.includes(item.id || item.variant?.id);
                    const id = item.id || item.variant?.id;
                    const price = parseFloat(item.originalTotalPrice?.amount || item.price?.amount || '0');
                    const imgUrl = item.variant?.image?.url;
                    const sizeLabel = item.variant?.title && item.variant.title !== 'Default Title' ? item.variant.title : '';

                    return (
                        <TouchableOpacity
                            key={id}
                            style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                            activeOpacity={0.7}
                            onPress={() => toggleItem(id)}
                        >
                            {imgUrl ? (
                                <Image source={{ uri: imgUrl }} style={styles.itemImage} />
                            ) : (
                                <View style={[styles.itemImage, styles.placeholderImg]}>
                                    <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                                </View>
                            )}
                            <View style={styles.itemInfo}>
                                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                                <View style={styles.metaRow}>
                                    <Text style={styles.priceText}>
                                        ₹{price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </Text>
                                    {!!sizeLabel && <Text style={styles.sizeText}>{sizeLabel}</Text>}
                                </View>
                            </View>
                            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                                {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
            <Text style={styles.disclaimerText}>
                This page only shows products eligible for return or exchange.
            </Text>
            <View style={styles.footer}>

                <Button
                    title="Proceed to return/exchange"
                    onPress={() => onNext(selected)}
                    disabled={selected.length === 0}
                    style={[styles.proceedBtn, selected.length === 0 && styles.proceedBtnDisabled]}
                    textStyle={styles.proceedBtnText}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        backgroundColor: '#F5F5F5',
    },
    title: {
        fontSize: 14,
        fontFamily: Fonts.LexendBold,
        color: '#6B7280',
    },
    countText: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
    },
    list: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    itemCardSelected: {
        borderColor: '#F05A5D',
        backgroundColor: '#FFF5F5',
    },
    itemImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        marginRight: 12,
    },
    placeholderImg: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
        minWidth: 0,
        marginRight: 12,
    },
    itemTitle: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#1F2937',
        lineHeight: 18,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 8,
    },
    priceText: {
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
        color: '#111827',
    },
    sizeText: {
        fontSize: 12,
        fontFamily: Fonts.LexendRegular,
        color: '#6B7280',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkboxSelected: {
        backgroundColor: '#F05A5D',
        borderColor: '#F05A5D',
    },
    footer: {
        padding: 24,
        paddingBottom: 0,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    disclaimerText: {
        textAlign: 'center',
        fontSize: 12,
        fontFamily: Fonts.LexendRegular,
        color: '#9CA3AF',
        marginBottom: 16,
        paddingHorizontal: 16,
    },
    proceedBtn: {
        backgroundColor: '#F05A5D',
        borderRadius: 16,
        height: 52,
    },
    proceedBtnDisabled: {
        backgroundColor: '#E5E7EB',
    },
    proceedBtnText: {
        fontFamily: Fonts.LexendSemiBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
});
