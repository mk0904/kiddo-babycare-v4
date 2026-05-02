import { ProductCard } from '@/components/products/ProductCard';
import { Fonts } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import { type CartItem, useCartStore } from '@/store/cartStore';
import type { SpecialDealConfig, SpecialDealTab } from '@/types/appConfig';
import { sortInStockFirst } from '@/utils/availability';
import { normalizeSpecialDealConfig } from '@/utils/normalizeSpecialDealConfig';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** Match cart `variantId` / product id (GID, numeric string, or hydrated number) to grid ids. */
function variantCanonicalKey(id: string | number | undefined | null): string | null {
    if (id == null) return null;
    const s =
        typeof id === 'number' && Number.isFinite(id)
            ? String(Math.trunc(id))
            : String(id).trim();
    if (!s) return null;
    return s.includes('/') ? (s.split('/').pop() ?? s) : s;
}

/** True if this cart line’s variant is one of the variants ever shown in the promo grid. */
function cartLineMatchesPromoGridVariant(li: CartItem, gridKeys: Set<string>): boolean {
    const idRaw = li.variantId as string | number | undefined;
    const idStr =
        typeof idRaw === 'number' && Number.isFinite(idRaw)
            ? String(Math.trunc(idRaw))
            : String(idRaw ?? '').trim();
    if (!idStr) return false;
    const canonical = idStr.includes('/') ? (idStr.split('/').pop() ?? idStr) : idStr;
    if (gridKeys.has(canonical)) return true;
    for (const gk of gridKeys) {
        if (
            idStr === gk ||
            idStr.endsWith(gk) ||
            idStr === `gid://shopify/ProductVariant/${gk}`
        ) {
            return true;
        }
    }
    return false;
}

/** True if this variant id appears on any product row in the current grid (does not depend on accumulated Sets). */
function variantBelongsToListingProducts(
    products: any[],
    variantId: CartItem['variantId'],
): boolean {
    const target = variantCanonicalKey(variantId);
    if (!target) return false;
    for (const p of products) {
        const edges = p?.variants?.edges ?? [];
        for (const e of edges) {
            if (variantCanonicalKey(e?.node?.id) === target) return true;
        }
        if (edges.length === 0 && Array.isArray(p?.variants)) {
            for (const v of p.variants) {
                const id = v?.id ?? v?.node?.id;
                if (variantCanonicalKey(id) === target) return true;
            }
        }
    }
    return false;
}

/** Same idea as {@link UniversalAdd} `getItemCount` fallback: cart line matches grid product row by id. */
function productBelongsToListingProducts(products: any[], productId: CartItem['productId']): boolean {
    if (productId == null || productId === '') return false;
    const pidStr =
        typeof productId === 'number' && Number.isFinite(productId)
            ? String(Math.trunc(productId))
            : String(productId).trim();
    if (!pidStr) return false;
    const pk = variantCanonicalKey(productId);
    for (const p of products) {
        const nid = p?.id;
        if (nid == null) continue;
        const ns =
            typeof nid === 'number' && Number.isFinite(nid) ? String(Math.trunc(nid)) : String(nid).trim();
        if (ns === pidStr) return true;
        if (pk != null && variantCanonicalKey(nid) === pk) return true;
    }
    return false;
}

/**
 * Listed selling unit — mirrors {@link ProductCard} price sources for “Offer price” caption (display only).
 */
function gridProductSellingUnit(product: any): number {
    const variants = product?.variants?.edges || product?.variants || [];
    const firstVariant = variants[0]?.node || variants[0] || {};

    let raw: unknown =
        firstVariant?.price?.amount ??
        product?.priceRange?.minVariantPrice?.amount;

    if (raw == null || raw === '') {
        const p = product?.price;
        if (p != null && p !== '') {
            raw = typeof p === 'object' && p !== null && 'amount' in (p as object)
                ? (p as { amount?: string }).amount
                : p;
        }
    }

    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
        const cleaned = raw.replace(/[₹,\s]/g, '').trim();
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function mergeProductGridVariantKeys(prev: Set<string>, products: any[]): Set<string> {
    const next = new Set(prev);
    for (const node of products) {
        const edges = node?.variants?.edges ?? [];
        for (const e of edges) {
            const vid = e?.node?.id;
            const k = variantCanonicalKey(vid);
            if (k) next.add(k);
        }
        if (edges.length === 0) {
            const flat = node?.variants;
            if (Array.isArray(flat)) {
                for (const v of flat) {
                    const vid = v?.id ?? v?.node?.id;
                    const k = variantCanonicalKey(vid);
                    if (k) next.add(k);
                }
            }
        }
    }
    return next;
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
    /** All variant ids ever shown in this modal’s grids (tabs accumulate) — updated synchronously so CTA isn’t one frame behind. */
    const accumulatedPromoGridVariantKeysRef = useRef<Set<string>>(new Set());
    const lineItems = useCartStore((s) => s.lineItems);

    /** `UniversalAdd` fired after a successful add — source-of-truth for footer if cart snapshot lags. */
    const [dealPromoAddConfirmed, setDealPromoAddConfirmed] = useState(false);
    const onPromoDealAddSuccess = useCallback(() => {
        setDealPromoAddConfirmed(true);
    }, []);

    /** % off for promo row UI only (config); add-to-cart uses list price — see `applyDealPromoToCart={false}`. */
    const promoDealPercentOff = useMemo(() => {
        const d = cfg.discount as number | string | undefined;
        if (typeof d === 'number' && Number.isFinite(d) && d > 0 && d <= 100) return d;
        if (typeof d === 'string' && d.trim() !== '') {
            const n = parseFloat(d);
            if (Number.isFinite(n) && n > 0 && n <= 100) return n;
        }
        return 0;
    }, [cfg.discount]);

    /**
     * % off shown on tiles; default 50 when unset. Clamp &lt; 100 for display math only.
     */
    const displayDealPercentOff = useMemo(() => {
        let pct = promoDealPercentOff > 0 ? promoDealPercentOff : 50;
        if (pct >= 100) pct = 50;
        return pct;
    }, [promoDealPercentOff]);

    const promoGridVariantKeys = useMemo(() => {
        mergeProductGridVariantKeys(accumulatedPromoGridVariantKeysRef.current, listingProducts);
        return new Set(accumulatedPromoGridVariantKeysRef.current);
    }, [listingProducts]);

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

    const promoGridMatchingLineItems = useMemo(() => {
        return lineItems.filter((li: CartItem) => {
            if (listingProducts.length === 0) return false;
            const variantOnGrid = variantBelongsToListingProducts(listingProducts, li.variantId);
            const productOnGrid = productBelongsToListingProducts(listingProducts, li.productId);
            const inAccumulatedGrid =
                promoGridVariantKeys.size > 0 &&
                cartLineMatchesPromoGridVariant(li, promoGridVariantKeys);
            return variantOnGrid || productOnGrid || inAccumulatedGrid;
        });
    }, [lineItems, promoGridVariantKeys, listingProducts]);

    const hasAddedFromPromoGrid =
        promoGridMatchingLineItems.length > 0 || dealPromoAddConfirmed;

    const handleUnlock = () => {
        if (hasAddedFromPromoGrid) {
            const lines =
                promoGridMatchingLineItems.length > 0
                    ? promoGridMatchingLineItems
                    : dealPromoAddConfirmed
                      ? lineItems.filter((li: CartItem) => {
                            if (listingProducts.length === 0) return false;
                            const variantOnGrid = variantBelongsToListingProducts(
                                listingProducts,
                                li.variantId,
                            );
                            const productOnGrid = productBelongsToListingProducts(
                                listingProducts,
                                li.productId,
                            );
                            const inAccumulatedGrid =
                                promoGridVariantKeys.size > 0 &&
                                cartLineMatchesPromoGridVariant(li, promoGridVariantKeys);
                            return variantOnGrid || productOnGrid || inAccumulatedGrid;
                        })
                      : [];
            if (lines.length > 0) {
                onUnlockPress?.(lines.map((li) => li.variantId));
            }
        }
        onClose();
    };

    const actualPrice = Number(cfg.actualPrice ?? 0);
    const discountedPrice = Number(cfg.discountedPrice ?? 0);
    const bannerText = cfg.bannerText?.trim() || 'One time offer Unlocked!';
    const titleText = cfg.title?.trim() || 'Special offer';
    const footerCta = cfg.footerCta?.trim() || 'Add products to unlock offer';
    /** Primary button always dismisses; label reflects optional browse-and-add vs done. */
    const primaryCtaLabel = hasAddedFromPromoGrid ? footerCta : 'Continue';
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
                            <Ionicons name="checkmark-sharp" size={22} color="#fff" />
                        </View>
                    )} */}
                    <View style={styles.checkCircle}>
                            <Ionicons name="checkmark-sharp" size={22} color="#fff" />
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
                            {/* {cfg.thirdLineText != null && cfg.thirdLineText !== ''
                                ? ` ${cfg.thirdLineText}`
                                : ''} */}
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
                            <Ionicons name="time-outline" size={18} color="#9CA3AF" />
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
                                            promoPercentOff={displayDealPercentOff}
                                            dealPromoPercentOff={displayDealPercentOff}
                                            applyDealPromoToCart={false}
                                            showPromoOfferPriceBadge
                                            priceCompareFirst
                                            promoOfferCaptionBelowPrice={`Offer price: ${formatCurrency(
                                                Math.max(
                                                    0,
                                                    Math.round(
                                                        gridProductSellingUnit(product) *
                                                            (1 - displayDealPercentOff / 100),
                                                    ),
                                                ),
                                            )}`}
                                            onPromoDealAddSuccess={onPromoDealAddSuccess}
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

                {/* <TouchableOpacity onPress={onSeeAllCoupons} style={styles.seeCouponsLink}>
                    <Text style={styles.seeCouponsText}>See all coupons</Text>
                </TouchableOpacity> */}
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
        maxHeight: '95%',
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
        paddingTop: 28,
        paddingBottom: 16,
    },
    successRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        justifyContent: 'center',
        alignItems: 'center',
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
        fontSize: 14,
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
        marginTop: 24,
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
        fontSize: 12,
        fontFamily: Fonts.LexendSemiBold,
        color: '#6B7280',
        marginBottom: 4,
    },
    metaSub: {
        fontSize: 10,
        fontFamily: Fonts.LexendRegular,
        color: '#9CA3AF',
        flex: 1,
    },
    timerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    timerValue: {
        fontSize: 14,
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
        fontSize: 12,
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
