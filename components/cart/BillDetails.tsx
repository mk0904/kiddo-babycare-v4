import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export interface BillDetailsProps {
    /** MRP / price before item-level discount (for strikethrough) */
    mrp: number;
    /** Item total (subtotal before coupon discount); shown as "Item Total" in bill. */
    itemTotal: number;
    /** When true, hide Handling Fee and Delivery Fee (ticket-only cart). */
    isTicketingOnly?: boolean;
    /** Original handling fee shown struck + FREE (only when !isTicketingOnly). */
    handlingFeeOriginal?: number;
    /** Original delivery fee shown struck (only when !isTicketingOnly). */
    deliveryFeeOriginal?: number;
    /** Actual delivery fee to charge (e.g. 50 from HotWheels). If 0 or omitted, shows FREE. */
    deliveryFee?: number;
    /** Platform fee when cart has only ticket products (e.g. 20); 0 = hide row. Shown like handling fee. */
    platformFee?: number;
    /** Coupon discount amount (positive number; total of all coupon discounts) */
    couponDiscount: number;
    /** When true, show a "Free Shoes" row with FREE SHOES instead of amount (milestone 3 / free-shoes gift code) */
    hasFreeShoesGift?: boolean;
    /** Original price for the free-shoes row (shown struck when present) */
    freeShoesGiftOriginalPrice?: number;
    /** From coupons API for the shoes gift code (e.g. `title` / `description` on "Free Shoes") */
    freeShoesTitle?: string;
    freeShoesDescription?: string;
    /** Exact coupon code text to show for the shoes milestone row. */
    freeShoesCouponCode?: string;
    /** Free puzzle (KIDPUZZLE) — milestone 2 */
    hasKidPuzzle?: boolean;
    kidPuzzleOriginalPrice?: number;
    /** From coupons API for the puzzle gift code (e.g. `title` / `description` on "Free puzzle") */
    freePuzzleTitle?: string;
    freePuzzleDescription?: string;
    /** Exact coupon code text to show for the puzzle milestone row. */
    freePuzzleCouponCode?: string;
    /** 1st/4th `isGift` — mystery gift code applied (hidden coupon); show like free puzzle */
    hasMysteryGift?: boolean;
    mysteryGiftOriginalPrice?: number;
    /** From coupons API `title` (e.g. "Mystery gift") */
    mysteryGiftTitle?: string;
    /** From coupons API `description` (e.g. "Mystery gift above ₹999") */
    mysteryGiftDescription?: string;
    /** Exact coupon code text to show for the mystery-gift milestone row. */
    mysteryGiftCouponCode?: string;
    /** When API title is absent — milestone slot copy */
    milestoneMysteryGiftLabel?: string;
    /** Discount from other coupons (excludes free-shoes / puzzle / mystery gift codes); show as "Coupon Discount" -₹X when > 0 */
    otherCouponDiscount?: number;
    /** When set (milestone `isGift: true`), use instead of "Free Shoes" for that row */
    milestoneFreeShoesLabel?: string;
    /** When set (milestone `isGift: true`), use instead of "Free puzzle" for that row */
    milestoneFreePuzzleLabel?: string;
    /** Extra milestone discount (non-gift, `isGift: false` + %/fixed in config) */
    milestoneConfigDiscount?: number;
    /** Bill row title (e.g. "1st order reward - 25% off"); falls back to "Milestone discount" */
    milestoneConfigDiscountLabel?: string;
    /**
     * `isGift` on 1st/4th steps: when set (non-empty), show a row with "Unlocked" and this string as the **line label**
     * (e.g. slot title: "Mystery gift"), not a generic "Milestone discount" title.
     */
    milestoneIsGiftBillDiscountTitle?: string;
    /** Gift wrap fee (0 = hide row or show FREE) */
    giftWrappingFee: number;
    /** Gift wrapping applied (when set, show row with this price; may include productIds to detect "applied") */
    giftWrapping?: { price: number; productIds?: string[] } | null;
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
    deliveryFee = 0,
    platformFee = 0,
    couponDiscount,
    hasFreeShoesGift = false,
    freeShoesGiftOriginalPrice,
    freeShoesTitle,
    freeShoesDescription,
    freeShoesCouponCode,
    hasKidPuzzle = false,
    kidPuzzleOriginalPrice,
    freePuzzleTitle,
    freePuzzleDescription,
    freePuzzleCouponCode,
    hasMysteryGift = false,
    mysteryGiftOriginalPrice,
    mysteryGiftTitle,
    mysteryGiftDescription,
    mysteryGiftCouponCode,
    milestoneMysteryGiftLabel,
    otherCouponDiscount = 0,
    milestoneFreeShoesLabel,
    milestoneFreePuzzleLabel,
    milestoneConfigDiscount = 0,
    milestoneConfigDiscountLabel,
    milestoneIsGiftBillDiscountTitle,
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

    const splitMilestoneCouponCode = (
        code: string | undefined,
        fallbackLeft: string,
        fallbackRight: string
    ): { left: string; right: string } => {
        const raw = (code ?? '').trim();
        if (!raw) return { left: fallbackLeft, right: fallbackRight };
        const parts = raw.split('-').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
            return {
                left: parts.slice(0, -1).join(' - '),
                right: parts[parts.length - 1],
            };
        }
        return { left: raw, right: fallbackRight };
    };

    const freeShoesRow = splitMilestoneCouponCode(
        freeShoesCouponCode,
        (freeShoesTitle ?? milestoneFreeShoesLabel)?.trim() || 'Free Shoes',
        'FREE SHOES'
    );
    const freePuzzleRow = splitMilestoneCouponCode(
        freePuzzleCouponCode,
        (freePuzzleTitle ?? milestoneFreePuzzleLabel)?.trim() || 'Free puzzle',
        'FREE PUZZLE'
    );
    const mysteryGiftRow = splitMilestoneCouponCode(
        mysteryGiftCouponCode,
        (mysteryGiftTitle ?? milestoneMysteryGiftLabel)?.trim() || 'Mystery gift',
        'SURPRISE GIFT'
    );

    return (
        <View style={styles.wrapper}>
            <View style={styles.section} collapsable={false}>
                <View style={[styles.sectionBg, !expanded && styles.sectionBgCollapsed]} pointerEvents="none" />
                <TouchableOpacity
                    style={styles.headerRow}
                    onPress={() => setExpanded((e) => !e)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.title}>Bill details</Text>
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#717680"
                    />
                </TouchableOpacity>
                {expanded && (
                    <>
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
                                {deliveryFee > 0 ? (
                                    <Text style={styles.value}>{formatCurrency(deliveryFee)}</Text>
                                ) : (
                                    <>
                                        <Text style={styles.valueStruck}>{formatCurrency(deliveryFeeOriginal)}</Text>
                                        <Text style={[styles.value, styles.freeText]}>FREE</Text>
                                    </>
                                )}
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

                    {/* Free Shoes — API title/description when present, else milestone label */}
                    {hasFreeShoesGift && (
                        <View style={[styles.row, styles.mysteryGiftRow]}>
                            <View style={styles.mysteryLabelCol}>
                                <Text style={styles.label} numberOfLines={2}>
                                    {freeShoesRow.left}
                                </Text>
                               
                            </View>
                            <View style={styles.valueRow}>
                                {freeShoesGiftOriginalPrice != null && freeShoesGiftOriginalPrice > 0 && (
                                    <Text style={styles.valueStruck}>{formatCurrency(freeShoesGiftOriginalPrice)}</Text>
                                )}
                                <Text style={[styles.value, styles.freeShoesText]}>{freeShoesRow.right}</Text>
                            </View>
                        </View>
                    )}

                    {hasKidPuzzle && (
                        <View style={[styles.row, styles.mysteryGiftRow]}>
                            <View style={styles.mysteryLabelCol}>
                                <Text style={styles.label} numberOfLines={2}>
                                    {freePuzzleRow.left}
                                </Text>
                                
                            </View>
                            <View style={styles.valueRow}>
                                {kidPuzzleOriginalPrice != null && kidPuzzleOriginalPrice > 0 && (
                                    <Text style={styles.valueStruck}>{formatCurrency(kidPuzzleOriginalPrice)}</Text>
                                )}
                                <Text style={[styles.value, styles.freeShoesText]}>{freePuzzleRow.right}</Text>
                            </View>
                        </View>
                    )}

                    {hasMysteryGift && (
                        <View style={[styles.row, styles.mysteryGiftRow]}>
                            <View style={styles.mysteryLabelCol}>
                                <Text style={styles.label} numberOfLines={2}>
                                    {mysteryGiftRow.left}
                                </Text>
                               
                            </View>
                            <View style={styles.valueRow}>
                                {mysteryGiftOriginalPrice != null && mysteryGiftOriginalPrice > 0 && (
                                    <Text style={styles.valueStruck}>{formatCurrency(mysteryGiftOriginalPrice)}</Text>
                                )}
                                <Text style={[styles.value, styles.freeShoesText]}>{mysteryGiftRow.right}</Text>
                            </View>
                        </View>
                    )}

                    {!hasMysteryGift && milestoneIsGiftBillDiscountTitle && milestoneIsGiftBillDiscountTitle.trim() !== '' && (
                        <View style={styles.row}>
                            <Text style={[styles.label, styles.labelFlex]} numberOfLines={2}>
                                {milestoneIsGiftBillDiscountTitle.trim()}
                            </Text>
                            <Text style={[styles.value, styles.freeShoesText]}>Unlocked</Text>
                        </View>
                    )}

                    {milestoneConfigDiscount > 0 && (
                        <View style={styles.row}>
                            <Text style={[styles.label, styles.labelFlex]} numberOfLines={2}>
                                {((milestoneConfigDiscountLabel ?? '').trim() || 'Milestone discount').toLowerCase()}
                            </Text>
                            <Text style={[styles.value, styles.discountText]}>
                                -{formatCurrency(milestoneConfigDiscount)}
                            </Text>
                        </View>
                    )}

                    {/* Coupon Discount (other coupons; when only free-shoes gift is applied, otherCouponDiscount is 0) */}
                    {otherCouponDiscount > 0 && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Coupon Discount</Text>
                            <Text style={[styles.value, styles.discountText]}>
                                -{formatCurrency(otherCouponDiscount)}
                            </Text>
                        </View>
                    )}

                    {/* Gift Wrap - only show when there is an actual fee (hide after user removes gift-wrapped items) */}
                    {giftWrappingFee > 0 && (
                        <View style={styles.row}>
                            <Text style={styles.label}>Gift Wrap</Text>
                            <View style={styles.valueRow}>
                                <Text style={styles.value}>
                                    {(() => {
                                        const price = Number(giftWrapping?.price) || giftWrappingFee || 0;
                                        return price > 0 ? formatCurrency(price) : 'FREE';
                                    })()}
                                </Text>
                            </View>
                        </View>
                    )}

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
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 28,
        position: 'relative',
    },
    section: {
        backgroundColor: 'transparent',
        borderRadius: 12,
        padding: 15,
        
        overflow: 'visible',
        position: 'relative',
        marginTop: 0,
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
    sectionBgCollapsed: {
        bottom: 0,
        borderBottomLeftRadius: 12,
        borderBottomRightRadius: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
        marginBottom: 4,
    },
    title: {
        fontSize: Fonts.SmallFontSize,
        color: '#717680',
        fontFamily: Fonts.LexendBold,
        marginBottom: 10,
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
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.LexendMedium,
    },
    labelFlex: {
        flex: 1,
        marginRight: 12,
    },
    mysteryGiftRow: {
        alignItems: 'flex-start',
    },
    mysteryLabelCol: {
        flex: 1,
        marginRight: 12,
        paddingTop: 1,
    },
    couponDescriptionSub: {
        marginTop: 2,
        fontSize: Fonts.ExtraSmallFontSize,
        color: '#717680',
        fontFamily: Fonts.LexendRegular,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 8,
        alignSelf: 'center',
    },
    value: {
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.LexendMedium,
    },
    valueStruck: {
        fontSize: Fonts.SmallFontSize,
        color: '#878F9E',
        fontFamily: Fonts.LexendMedium,
        textDecorationLine: 'line-through',
    },
    freeText: {
        fontSize: Fonts.SmallFontSize,
        color: '#16a34a',
        fontFamily: Fonts.SemiBold,
    },
    freeShoesText: {
        fontSize: Fonts.SmallFontSize,
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
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.LexendMedium,
    },
    valueToPay: {
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.LexendMedium,
    },
    savingsBannerWrap: {
        marginTop: 0,
        paddingVertical: 14,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    savingsBanner: {
        fontSize: Fonts.SmallFontSize,
        color: '#099250',
        fontFamily: Fonts.LexendBold,
        textAlign: 'center',
    },
});
