import { ProductCard } from '@/components/products/ProductCard';
import { Fonts } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import type { SpecialDealConfig, SpecialDealTab } from '@/types/appConfig';
import { sortInStockFirst } from '@/utils/availability';
import { normalizeSpecialDealConfig } from '@/utils/normalizeSpecialDealConfig';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

const SUCCESS_GREEN = '#4CAF50';
const OFFER_RED = '#FF5252';

/** Admin URL, numeric id, or Shopify Collection GID → Storefront API id. */
export function parseShopifyCollectionGid(raw: string | undefined | null): string | null {
    if (raw == null || typeof raw !== 'string') return null;
    const s = raw.trim();
    if (!s) return null;
    if (s.startsWith('gid://shopify/Collection/')) return s;
    const adminMatch = s.match(/\/collections\/(\d+)/);
    if (adminMatch) return `gid://shopify/Collection/${adminMatch[1]}`;
    if (/^\d+$/.test(s)) return `gid://shopify/Collection/${s}`;
    return null;
}

/** Resolve collection id from config tab (`collectionId` or `collection_id`). */
function getTabCollectionId(tab: SpecialDealTab | undefined): string | undefined {
    if (!tab) return undefined;
    const raw = tab.collectionId ?? tab.collection_id;
    if (raw == null || typeof raw !== 'string') return undefined;
    const s = raw.trim();
    return s === '' ? undefined : s;
}

export interface SavingsCornerPromoOfferContentProps {
    dealConfig: SpecialDealConfig;
    formatCurrency: (amount: number) => string;
    onClose: () => void;
    onSkip: () => void;
    onSeeAllCoupons: () => void;
    onUnlockPress?: (selectedVariantIds: string[]) => void;
}

export function SavingsCornerPromoOfferContent({
    dealConfig,
    formatCurrency,
    onClose,
    onSkip,
    onSeeAllCoupons,
    onUnlockPress,
}: SavingsCornerPromoOfferContentProps) {
    const { width: windowWidth } = useWindowDimensions();
    const cardMaxWidth = Math.min(windowWidth - 32, 400);

    /** Merges snake_case / alternate API keys so `tabs[].label` + `collectionId` always line up. */
    const cfg = useMemo(() => normalizeSpecialDealConfig(dealConfig), [dealConfig]);

    /** Tabs with a visible `label`; products load from `collectionId` / `collection_id` only. */
    const tabItems: SpecialDealTab[] = useMemo(() => {
        return (cfg.tabs ?? []).filter((t) => {
            if (!t || t.isActive === false) return false;
            return String(t.label ?? '').trim() !== '';
        });
    }, [cfg.tabs]);

    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const initialTimerSec = Math.max(0, Math.floor((cfg.offerTime ?? 30) * 60));
    const [remainingSec, setRemainingSec] = useState(initialTimerSec);
    const [listingProducts, setListingProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);

    useEffect(() => {
        setRemainingSec(Math.max(0, Math.floor((cfg.offerTime ?? 30) * 60)));
    }, [cfg.offerTime]);

    useEffect(() => {
        setActiveTabIndex((i) => {
            if (!tabItems.length) return 0;
            return Math.min(Math.max(0, i), tabItems.length - 1);
        });
    }, [tabItems.length]);

    useEffect(() => {
        const t = setInterval(() => {
            setRemainingSec((s) => (s <= 0 ? 0 : s - 1));
        }, 1000);
        return () => clearInterval(t);
    }, []);

    const activeTab = tabItems[activeTabIndex] ?? tabItems[0];
    const activeCollectionRaw = getTabCollectionId(activeTab);
    const collectionGid = useMemo(
        () => parseShopifyCollectionGid(activeCollectionRaw),
        [activeCollectionRaw]
    );

    useEffect(() => {
        if (!collectionGid) {
            setListingProducts([]);
            setLoadingProducts(false);
            return;
        }
        let cancelled = false;
        setLoadingProducts(true);
        shopifyApi
            .getProductsByCollection(collectionGid, 24, null)
            .then((col) => {
                if (cancelled) return;
                const edges = col?.products?.edges ?? [];
                const nodes = edges.map((e: any) => e?.node).filter(Boolean);
                setListingProducts(sortInStockFirst(nodes));
            })
            .catch(() => {
                if (!cancelled) setListingProducts([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingProducts(false);
            });
        return () => {
            cancelled = true;
        };
    }, [collectionGid]);

    const timerLabel = useMemo(() => {
        const m = Math.floor(remainingSec / 60);
        const sec = remainingSec % 60;
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }, [remainingSec]);

    /** Three-column grid inside modal (card width accounts for two gutters between three tiles). */
    const GRID_COLUMNS = 3;
    const gridGap = 8;
    const gridPad = 12;
    const productCardWidth = Math.floor(
        (cardMaxWidth - gridPad * 2 - gridGap * (GRID_COLUMNS - 1)) / GRID_COLUMNS
    );

    const productRows = useMemo(() => {
        const rows: any[][] = [];
        for (let i = 0; i < listingProducts.length; i += GRID_COLUMNS) {
            rows.push(listingProducts.slice(i, i + GRID_COLUMNS));
        }
        return rows;
    }, [listingProducts]);

    const handleUnlock = () => {
        onUnlockPress?.([]);
        onSkip();
    };

    const actualPrice = Number(cfg.actualPrice ?? 0);
    const discountedPrice = Number(cfg.discountedPrice ?? 0);
    const bannerText = cfg.bannerText?.trim() || 'One time offer Unlocked!';
    const titleText = cfg.title?.trim() || 'Special offer';
    const footerCta = cfg.footerCta?.trim() || 'Add products to unlock offer';
    const conditionsSummaryLine = useMemo(() => {
        return (cfg.conditions ?? [])
            .map((c) => (c.text ?? '').trim())
            .filter(Boolean)
            .join(' | ');
    }, [cfg.conditions]);

    const gridEmptyMessage =
        tabItems.length === 0
            ? 'No collections in offer config yet'
            : !collectionGid
              ? 'Missing collection for this tab — check collectionId in app config'
              : 'No products found';

    const tabKey = (t: SpecialDealTab, i: number) =>
        String(t.value ?? '').trim() !== ''
            ? `deal-tab-${String(t.value).trim()}`
            : `deal-tab-${i}-${getTabCollectionId(t) ?? String(t.label ?? '').slice(0, 24)}`;

    return (
        <View style={[styles.card, { width: cardMaxWidth, maxWidth: cardMaxWidth }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={14}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
            </TouchableOpacity>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.successRow}>
                    {/* {cfg.successIconUrl ? (
                        <Image
                            source={{ uri: cfg.successIconUrl }}
                            style={styles.successIconImage}
                            resizeMode="contain"
                        />
                    ) : (
                        <View style={styles.checkCircle}>
                            <Ionicons name="checkmark" size={18} color="#fff" />
                        </View>
                    )} */}
                    <View style={styles.checkCircle}>
                            <Ionicons name="checkmark" size={18} color="#fff" />
                        </View>
                    <View style={styles.successTextWrap}>
                        <Text style={styles.congrats}>
                            <Text style={styles.congratsBold}>Congratulations!</Text>
                            {'\n'}
                            {cfg.firstLineText != null && cfg.firstLineText !== ''
                                ? `${cfg.firstLineText} `
                                : null}
                            <Text style={styles.strike}>{formatCurrency(actualPrice)}</Text>{' '}
                            <Text style={styles.priceZero}>{formatCurrency(discountedPrice)}</Text>
                            {cfg.secondLineText != null && cfg.secondLineText !== ''
                                ? ` ${cfg.secondLineText}`
                                : ''}
                            {cfg.thirdLineText != null && cfg.thirdLineText !== ''
                                ? ` ${cfg.thirdLineText}`
                                : ''}
                        </Text>
                    </View>
                </View>

                <View style={styles.dottedRule} />

                <View style={styles.unlockBanner}>
                    <Text style={styles.unlockBannerText}>{bannerText}</Text>
                </View>
                <Text style={styles.flatOff}>{titleText}</Text>

                <View style={styles.metaRow}>
                    <View style={[styles.metaBox, styles.metaBoxConditions]}>
                        <Text style={styles.metaLabel}>Conditions:</Text>
                        {conditionsSummaryLine !== '' ? (
                            <Text style={styles.metaSub} numberOfLines={1} ellipsizeMode="tail">
                                {conditionsSummaryLine}
                            </Text>
                        ) : (
                            <Text style={styles.metaSub}>
                                {cfg.minCartValue != null && cfg.minCartValue > 0
                                    ? `Min cart ${formatCurrency(Number(cfg.minCartValue))}`
                                    : 'See offer details'}
                            </Text>
                        )}
                    </View>
                    <View style={[styles.metaBox, styles.metaBoxTimer]}>
                        <Text style={styles.metaLabel}>Offer valid for</Text>
                        <View style={styles.timerRow}>
                            <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                            <Text style={styles.timerValue}>{timerLabel}</Text>
                        </View>
                    </View>
                </View>

                {tabItems.length > 0 ? (
                    <ScrollView
                        horizontal
                        nestedScrollEnabled
                        showsHorizontalScrollIndicator={false}
                        style={styles.tabsScroll}
                        contentContainerStyle={styles.tabsRow}
                    >
                        {tabItems.map((tab, idx) => {
                            const active = idx === activeTabIndex;
                            const tabLabel = String(tab.label ?? '').trim();
                            return (
                                <TouchableOpacity
                                    key={tabKey(tab, idx)}
                                    onPress={() => setActiveTabIndex(idx)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.tabItem}>
                                        <Text style={[styles.tabText, active && styles.tabTextActive]}>{tabLabel}</Text>
                                        {active ? (
                                            <View style={styles.tabUnderline} />
                                        ) : (
                                            <View style={styles.tabUnderlinePlaceholder} />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                ) : null}

                <View style={styles.grid}>
                    {loadingProducts ? (
                        <View style={styles.gridLoading}>
                            <ActivityIndicator size="small" color={OFFER_RED} />
                        </View>
                    ) : listingProducts.length === 0 ? (
                        <View style={styles.gridLoading}>
                            <Text style={styles.emptyGridText}>{gridEmptyMessage}</Text>
                        </View>
                    ) : (
                        productRows.map((row, rowIdx) => (
                            <View
                                key={`promo-grid-row-${rowIdx}`}
                                style={[
                                    styles.productGridRow,
                                    { paddingHorizontal: gridPad, marginBottom: gridGap },
                                ]}
                            >
                                {row.map((product, colIdx) => (
                                    <View
                                        key={product?.id ?? product?.handle ?? `p-${rowIdx}-${colIdx}`}
                                        style={{ width: productCardWidth }}
                                    >
                                        <ProductCard
                                            product={product}
                                            width={productCardWidth}
                                            collectionId={collectionGid}
                                        />
                                    </View>
                                ))}
                                {Array.from({ length: GRID_COLUMNS - row.length }).map((_, spacerIdx) => (
                                    <View
                                        key={`spacer-${rowIdx}-${spacerIdx}`}
                                        style={{ width: productCardWidth }}
                                    />
                                ))}
                            </View>
                        ))
                    )}
                </View>

                <TouchableOpacity onPress={onSeeAllCoupons} style={styles.seeCouponsLink}>
                    <Text style={styles.seeCouponsText}>See all coupons</Text>
                </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.cta, styles.ctaActive]}
                    onPress={handleUnlock}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.ctaText, styles.ctaTextActive]}>{footerCta}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onSkip} style={styles.skipWrap}>
                    <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        maxHeight: '88%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
    },
    closeBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 2,
        padding: 4,
    },
    scroll: {
        flex: 1,
        minHeight: 0,
    },
    scrollContent: {
        paddingTop: 44,
        paddingBottom: 16,
    },
    successRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
    },
    successIconImage: {
        width: 36,
        height: 36,
        marginRight: 10,
        borderRadius: 18,
    },
    checkCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: SUCCESS_GREEN,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    successTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    congrats: {
        fontSize: 13,
        fontFamily: Fonts.LexendRegular,
        color: '#374151',
        lineHeight: 19,
    },
    congratsBold: {
        fontFamily: Fonts.LexendBold,
        color: '#111827',
    },
    strike: {
        textDecorationLine: 'line-through',
        color: '#9CA3AF',
        fontFamily: Fonts.LexendMedium,
    },
    priceZero: {
        fontFamily: Fonts.LexendBold,
        color: SUCCESS_GREEN,
    },
    dottedRule: {
        marginHorizontal: 16,
        marginTop: 14,
        borderStyle: 'dotted',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    unlockBanner: {
        marginHorizontal: 8,
        marginTop: 14,
        backgroundColor: OFFER_RED,
        borderRadius: 6,
        paddingVertical: 4,
        alignItems: 'center',
    },
    unlockBannerText: {
        color: '#fff',
        fontFamily: Fonts.LexendRegular,
        fontSize: Fonts.ExtraSmallFontSize,
        letterSpacing: 0.3,
    },
    flatOff: {
        marginTop: 4,
        textAlign: 'center',
        fontSize: 32,
        fontFamily: Fonts.LexendBold,
        color: OFFER_RED,
        letterSpacing: -0.5,
    },
    metaRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        marginTop: 16,
        gap: 8,
    },
    metaBox: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 10,
        minWidth: 0,
    },
    metaBoxConditions: {
        flex: 7,
    },
    metaBoxTimer: {
        flex: 3,
    },
    metaLabel: {
        fontSize: 11,
        fontFamily: Fonts.LexendSemiBold,
        color: '#6B7280',
        marginBottom: 4,
    },
    metaSub: {
        fontSize: 10,
        fontFamily: Fonts.LexendRegular,
        color: '#9CA3AF',
        lineHeight: 14,
        flex: 1,
    },
    timerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    timerValue: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: OFFER_RED,
    },
    tabsScroll: {
        marginTop: 16,
        minHeight: 44,
        flexGrow: 0,
    },
    tabsRow: {
        paddingHorizontal: 12,
        gap: 16,
        alignItems: 'flex-end',
        paddingBottom: 4,
    },
    tabItem: {
        alignItems: 'center',
    },
    tabText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#9CA3AF',
        paddingBottom: 6,
    },
    tabTextActive: {
        color: '#111827',
        fontFamily: Fonts.LexendBold,
    },
    tabUnderline: {
        height: 3,
        width: '100%',
        backgroundColor: '#111827',
        borderRadius: 2,
    },
    tabUnderlinePlaceholder: {
        height: 3,
    },
    grid: {
        marginTop: 12,
        width: '100%',
    },
    productGridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    gridLoading: {
        width: '100%',
        paddingVertical: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyGridText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#9CA3AF',
        textAlign: 'center',
    },
    seeCouponsLink: {
        alignItems: 'center',
        marginTop: 8,
        paddingVertical: 8,
    },
    seeCouponsText: {
        fontSize: 13,
        fontFamily: Fonts.LexendSemiBold,
        color: '#6B7280',
        textDecorationLine: 'underline',
    },
    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
        backgroundColor: '#fff',
    },
    cta: {
        backgroundColor: '#D1D5DB',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    ctaActive: {
        backgroundColor: '#FC5D5B',
    },
    ctaText: {
        fontSize: 15,
        fontFamily: Fonts.LexendBold,
        color: '#F9FAFB',
    },
    ctaTextActive: {
        color: '#FFFFFF',
    },
    skipWrap: {
        alignItems: 'center',
        marginTop: 12,
    },
    skipText: {
        fontSize: 13,
        fontFamily: Fonts.LexendMedium,
        color: '#9CA3AF',
        textDecorationLine: 'underline',
    },
});
