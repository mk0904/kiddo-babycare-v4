import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface BillDetailsProps {
    /** MRP / price before item-level discount (for strikethrough) */
    mrp: number;
    /** Subtotal after coupon (item total) */
    itemTotal: number;
    /** When true, hide Handling Fee and Delivery Fee (ticket-only cart). */
    isTicketingOnly?: boolean;
    /** Original handling fee shown struck + FREE (only when !isTicketingOnly). */
    handlingFeeOriginal?: number;
    /** Original delivery fee shown struck + FREE (only when !isTicketingOnly). */
    deliveryFeeOriginal?: number;
    /** Platform fee when cart has only ticket products (e.g. 20); 0 = hide row. Shown like handling fee. */
    platformFee?: number;
    /** Coupon discount amount (positive number; show as -₹X when > 0) */
    couponDiscount: number;
    /** Gift wrap fee (0 = hide row or show FREE) */
    giftWrappingFee: number;
    /** Gift wrapping applied (when set, show row with this price) */
    giftWrapping?: { price: number } | null;
    /** Whether Kiddo Cash is applied */
    kiddoCashEnabled: boolean;
    /** Kiddo Cash amount when enabled */
    kiddoCashApplied: number;
    /** Total before Kiddo Cash */
    total: number;
    /** Final amount to pay */
    toPay: number;
    /** "You saved" amount for banner */
    displaySavings: number;
    formatCurrency: (amount: number) => string;
}

export function BillDetails({
    mrp,
    itemTotal,
    isTicketingOnly = false,
    handlingFeeOriginal = 0,
    deliveryFeeOriginal = 0,
    platformFee = 0,
    couponDiscount,
    giftWrappingFee,
    giftWrapping = null,
    kiddoCashEnabled,
    kiddoCashApplied,
    total,
    toPay,
    displaySavings,
    formatCurrency,
}: BillDetailsProps) {
    const [expanded, setExpanded] = useState(true);
    const screenWidth = Dimensions.get('window').width;
    const waveWidth = screenWidth - 32;

    return (
        <View style={styles.wrapper}>
            <TouchableOpacity
                style={styles.headerRow}
                onPress={() => setExpanded((e) => !e)}
                activeOpacity={0.7}
            >
                <Text style={styles.title}>Bill details</Text>
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
                    color="#6B7280"
                />
            </TouchableOpacity>
            {expanded && (
                <View style={styles.section} collapsable={false}>
                    <View style={styles.sectionBg} pointerEvents="none" />
                    <View style={styles.content}>
                    {/* Item Total */}
                    <View style={styles.row}>
                        <Text style={styles.label}>Item Total</Text>
                        <View style={styles.valueRow}>
                            {mrp > itemTotal && (
                                <Text style={styles.valueStruck}>{formatCurrency(mrp)}</Text>
                            )}
                            <Text style={styles.value}>{formatCurrency(itemTotal)}</Text>
                        </View>
                    </View>

                    {/* Handling Fee - only when not ticket-only */}
                    {!isTicketingOnly && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Handling Fee</Text>
                            <View style={styles.valueRow}>
                                <Text style={styles.valueStruck}>{formatCurrency(handlingFeeOriginal)}</Text>
                                <Text style={[styles.value, styles.freeText]}>FREE</Text>
                            </View>
                        </View>
                    )}

                    {/* Delivery Fee - only when not ticket-only */}
                    {!isTicketingOnly && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Delivery Fee</Text>
                            <View style={styles.valueRow}>
                                <Text style={styles.valueStruck}>{formatCurrency(deliveryFeeOriginal)}</Text>
                                <Text style={[styles.value, styles.freeText]}>FREE</Text>
                            </View>
                        </View>
                    )}

                    {/* Platform Fee (ticket-only, display only: struck + FREE, not added to bill) */}
                    {platformFee > 0 && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Platform Fee</Text>
                            <View style={styles.valueRow}>
                                <Text style={styles.valueStruck}>{formatCurrency(platformFee)}</Text>
                                <Text style={[styles.value, styles.freeText]}>FREE</Text>
                            </View>
                        </View>
                    )}

                    {/* Coupon Discount */}
                    {couponDiscount > 0 && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Coupon Discount</Text>
                            <Text style={[styles.value, styles.discountText]}>
                                -{formatCurrency(couponDiscount)}
                            </Text>
                        </View>
                    )}

                    {/* Gift Wrap - show only when gift wrap is actually applied (fee charged) */}
                    {giftWrappingFee > 0 ? (
                        <View style={styles.row}>
                            <Text style={styles.label}>Gift Wrap</Text>
                            <View style={styles.valueRow}>
                                <Text style={styles.value}>
                                    {formatCurrency(Number(giftWrapping?.price) || giftWrappingFee)}
                                </Text>
                            </View>
                        </View>
                    ) : null}

                    {/* Kiddo Cash */}
                    {kiddoCashEnabled && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Kiddo Cash</Text>
                            <Text style={[styles.value, styles.kiddoCashDeduction]}>
                                -{formatCurrency(kiddoCashApplied)}
                            </Text>
                        </View>
                    )}

                    <View style={styles.separator} />
                    <View style={styles.row}>
                        <Text style={styles.labelToPay}>To Pay</Text>
                        <View style={styles.valueRow}>
                            {total !== toPay && (
                                <Text style={styles.valueStruck}>{formatCurrency(total)}</Text>
                            )}
                            <Text style={styles.valueToPay}>{formatCurrency(toPay)}</Text>
                        </View>
                    </View>
                    <View style={styles.savingsBannerWrap}>
                        <Text style={styles.savingsBanner}>
                            You saved {formatCurrency(displaySavings)}!
                        </Text>
                    </View>
                    </View>
                    <View style={[styles.waveOuter, { width: waveWidth }]} pointerEvents="none">
                        <Svg
                            viewBox="0 0 100 38"
                            preserveAspectRatio="none"
                            width={waveWidth}
                            height={32}
                        >
                            <Path
                                d="M0,0 L100,0 L100,14 L96.67,25 L93.33,14 L90,25 L86.67,14 L83.33,25 L80,14 L76.67,25 L73.33,14 L70,25 L66.67,14 L63.33,25 L60,14 L56.67,25 L53.33,14 L50,25 L46.67,14 L43.33,25 L40,14 L36.67,25 L33.33,14 L30,25 L26.67,14 L23.33,25 L20,14 L16.67,25 L13.33,14 L10,25 L6.67,14 L3.33,25 L0,14 L0,0 Z"
                                fill="#fff"
                            />
                        </Svg>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 15,
        position: 'relative',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingVertical: 4,
        marginTop: 12,
    },
    section: {
        backgroundColor: 'transparent',
        borderRadius: 12,
        padding: 15,
        paddingBottom: 40,
        overflow: 'visible',
        position: 'relative',
    },
    sectionBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 32,
        backgroundColor: '#fff',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
    },
    title: {
        fontSize: 16,
        color: '#6B7280',
        fontFamily: Fonts.Bold,
    },
    waveOuter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 32,
        backgroundColor: 'transparent',
        zIndex: 10,
    },
    content: {
        paddingTop: 0,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        color: '#1A1A1A',
        fontFamily: Fonts.Regular,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    value: {
        fontSize: 14,
        color: '#2D2D2D',
        fontFamily: Fonts.SemiBold,
    },
    valueStruck: {
        fontSize: 14,
        color: '#9CA3AF',
        fontFamily: Fonts.Regular,
        textDecorationLine: 'line-through',
    },
    freeText: {
        color: '#16a34a',
        fontFamily: Fonts.SemiBold,
    },
    discountText: {
        color: '#16a34a',
        fontFamily: Fonts.SemiBold,
    },
    kiddoCashDeduction: {
        color: '#16a34a',
    },
    separator: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 12,
    },
    labelToPay: {
        fontSize: 14,
        color: '#2D2D2D',
        fontFamily: Fonts.SemiBold,
    },
    valueToPay: {
        fontSize: 14,
        color: '#1A1A1A',
        fontFamily: Fonts.Bold,
    },
    savingsBannerWrap: {
        marginTop: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    savingsBanner: {
        fontSize: 14,
        color: '#16a34a',
        fontFamily: Fonts.SemiBold,
        textAlign: 'center',
    },
});
