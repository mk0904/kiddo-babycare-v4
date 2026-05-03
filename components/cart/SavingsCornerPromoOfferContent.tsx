import { ProductCard } from '@/components/products/ProductCard';
import { Fonts } from '@/constants/theme';
import { shopifyApi } from '@/services/shopifyApi';
import { type CartItem, useCartStore } from '@/store/cartStore';
import type { SpecialDealConfig, SpecialDealTab } from '@/types/appConfig';
import { normalizeSpecialDealConfig } from '@/utils/normalizeSpecialDealConfig';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

const SUCCESS_GREEN = '#4CAF50';
const OFFER_RED = '#FF5252';

/** Storefront page size for promo collection grid; further pages load when user scrolls to the end. */
const PROMO_COLLECTION_PAGE_SIZE = 24;

/**
 * Storefront API filters for this modal only — excludes unavailable products on the server for every page/cursor.
 * See https://shopify.dev/docs/api/storefront/latest/input-objects/ProductFilter
 */
const PROMO_COLLECTION_STORE_FILTERS = [{ available: true }] as const;

/** Slightly smaller type across this modal only (header, tabs, footer, grid ProductCards). */
const PROMO_MODAL_TEXT_SCALE = 0.88;
const promoFs = (px: number) => Math.max(8, Math.round(px * PROMO_MODAL_TEXT_SCALE * 10) / 10);
const promoLh = (px: number) => Math.max(10, Math.round(px * PROMO_MODAL_TEXT_SCALE));

type PromoTabListingCacheEntry = {
    listingProducts: any[];
    productsEndCursor: string | null;
    hasMoreProducts: boolean;
};

type MeasureInWindowFn = (callback: (x: number, y: number, width: number, height: number) => void) => void;

function getMeasureInWindowHost(ref: ScrollView | View | null): { measureInWindow: MeasureInWindowFn } | null {
    const node = ref as unknown as { measureInWindow?: MeasureInWindowFn } | null;
    const measureInWindow = node?.measureInWindow;
    if (!node || typeof measureInWindow !== 'function') return null;
    return { measureInWindow };
}

/** Prefer `pageInfo.endCursor`; fall back to last edge `cursor` when Storefront omits endCursor (seen with some filter combinations). */
function resolveCollectionProductsPageCursor(products: {
    edges?: Array<{ cursor?: string }>;
    pageInfo?: { endCursor?: string | null };
} | null | undefined): string | null {
    const pi = products?.pageInfo;
    if (pi?.endCursor) return pi.endCursor;
    const edges = products?.edges ?? [];
    const last = edges[edges.length - 1];
    return last?.cursor ?? null;
}

function mergeUniqueByProductId(existing: any[], incoming: any[]): any[] {
    if (incoming.length === 0) return existing;
    const seen = new Set<string>();
    for (const p of existing) {
        const id = p?.id;
        if (id != null && id !== '') seen.add(String(id));
    }
    const extra = incoming.filter((p) => {
        const id = p?.id;
        if (id == null || id === '') return true;
        const s = String(id);
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
    });
    return extra.length === 0 ? existing : [...existing, ...extra];
}

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
    const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
    const [productsEndCursor, setProductsEndCursor] = useState<string | null>(null);
    const [hasMoreProducts, setHasMoreProducts] = useState(false);

    const collectionGidRef = useRef<string | null>(null);
    const loadingMoreRef = useRef(false);
    /** Keyed by collection GID so each tab keeps its own pages + cursor when switching away. */
    const promoTabListingCacheRef = useRef<Map<string, PromoTabListingCacheEntry>>(new Map());
    const promoListingStateRef = useRef<PromoTabListingCacheEntry>({
        listingProducts: [],
        productsEndCursor: null,
        hasMoreProducts: false,
    });
    /** Last collection whose `listingProducts` / cursors in state are for (used when persisting to cache on tab change). */
    const displayedPromoCollectionGidRef = useRef<string | null>(null);

    promoListingStateRef.current = {
        listingProducts,
        productsEndCursor,
        hasMoreProducts,
    };
    /** All variant ids ever shown in this modal’s grids (tabs accumulate) — updated synchronously so CTA isn’t one frame behind. */
    const accumulatedPromoGridVariantKeysRef = useRef<Set<string>>(new Set());
    const promoScrollRef = useRef<ScrollView | null>(null);
    const lastGridRowRef = useRef<View | null>(null);
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

    collectionGidRef.current = collectionGid;

    useEffect(() => {
        loadingMoreRef.current = false;

        const prevDisplayedGid = displayedPromoCollectionGidRef.current;
        if (prevDisplayedGid && collectionGid && prevDisplayedGid !== collectionGid) {
            const snap = promoListingStateRef.current;
            promoTabListingCacheRef.current.set(prevDisplayedGid, {
                listingProducts: [...snap.listingProducts],
                productsEndCursor: snap.productsEndCursor,
                hasMoreProducts: snap.hasMoreProducts,
            });
        }

        if (!collectionGid) {
            if (prevDisplayedGid) {
                const snap = promoListingStateRef.current;
                promoTabListingCacheRef.current.set(prevDisplayedGid, {
                    listingProducts: [...snap.listingProducts],
                    productsEndCursor: snap.productsEndCursor,
                    hasMoreProducts: snap.hasMoreProducts,
                });
            }
            setListingProducts([]);
            setLoadingProducts(false);
            setLoadingMoreProducts(false);
            setProductsEndCursor(null);
            setHasMoreProducts(false);
            displayedPromoCollectionGidRef.current = null;
            return;
        }

        const cached = promoTabListingCacheRef.current.get(collectionGid);
        if (cached) {
            setListingProducts([...cached.listingProducts]);
            setProductsEndCursor(cached.productsEndCursor);
            setHasMoreProducts(cached.hasMoreProducts);
            setLoadingProducts(false);
            setLoadingMoreProducts(false);
            displayedPromoCollectionGidRef.current = collectionGid;
            return;
        }

        let cancelled = false;
        setLoadingProducts(true);
        setLoadingMoreProducts(false);
        setProductsEndCursor(null);
        setHasMoreProducts(false);
        setListingProducts([]);
        shopifyApi
            .getProductsByCollection(
                collectionGid,
                PROMO_COLLECTION_PAGE_SIZE,
                null,
                undefined,
                false,
                [...PROMO_COLLECTION_STORE_FILTERS],
            )
            .then((col) => {
                if (cancelled || collectionGidRef.current !== collectionGid) return;
                const edges = col?.products?.edges ?? [];
                const nodes = edges.map((e: any) => e?.node).filter(Boolean);
                const pi = col?.products?.pageInfo;
                setListingProducts(nodes);
                setProductsEndCursor(resolveCollectionProductsPageCursor(col?.products));
                setHasMoreProducts(Boolean(pi?.hasNextPage));
                displayedPromoCollectionGidRef.current = collectionGid;
            })
            .catch(() => {
                if (!cancelled && collectionGidRef.current === collectionGid) {
                    setListingProducts([]);
                    setProductsEndCursor(null);
                    setHasMoreProducts(false);
                    displayedPromoCollectionGidRef.current = collectionGid;
                }
            })
            .finally(() => {
                if (!cancelled && collectionGidRef.current === collectionGid) {
                    setLoadingProducts(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [collectionGid]);

    const loadMoreProducts = useCallback(() => {
        if (!collectionGid || !hasMoreProducts || loadingProducts) return;
        if (loadingMoreRef.current) return;
        const gid = collectionGid;
        const after = productsEndCursor;
        if (after == null) return;

        loadingMoreRef.current = true;
        setLoadingMoreProducts(true);
        shopifyApi
            .getProductsByCollection(
                gid,
                PROMO_COLLECTION_PAGE_SIZE,
                after,
                undefined,
                false,
                [...PROMO_COLLECTION_STORE_FILTERS],
            )
            .then((col) => {
                if (collectionGidRef.current !== gid) return;
                const edges = col?.products?.edges ?? [];
                const nodes = edges.map((e: any) => e?.node).filter(Boolean);
                const pi = col?.products?.pageInfo;
                setListingProducts((prev) => mergeUniqueByProductId(prev, nodes));
                setProductsEndCursor(resolveCollectionProductsPageCursor(col?.products));
                setHasMoreProducts(Boolean(pi?.hasNextPage));
            })
            .catch(() => {
                /* keep hasMoreProducts so user can retry by scrolling again */
            })
            .finally(() => {
                loadingMoreRef.current = false;
                setLoadingMoreProducts(false);
            });
    }, [collectionGid, hasMoreProducts, loadingProducts, productsEndCursor]);

    /** When the last loaded grid row intersects the ScrollView viewport, fetch the next page. */
    const tryLoadMoreWhenLastRowVisible = useCallback(() => {
        if (!hasMoreProducts || loadingProducts || loadingMoreProducts) return;
        if (loadingMoreRef.current) return;

        const scrollMeasurable = getMeasureInWindowHost(promoScrollRef.current);
        const rowMeasurable = getMeasureInWindowHost(lastGridRowRef.current);
        if (!scrollMeasurable || !rowMeasurable) return;

        rowMeasurable.measureInWindow((_rx: number, rowY: number, _rw: number, rowH: number) => {
            scrollMeasurable.measureInWindow((_sx: number, sy: number, _sw: number, sh: number) => {
                const rowBottom = rowY + rowH;
                const viewBottom = sy + sh;
                const intersectsVertically = rowBottom > sy && rowY < viewBottom;
                if (intersectsVertically) {
                    loadMoreProducts();
                }
            });
        });
    }, [hasMoreProducts, loadMoreProducts, loadingMoreProducts, loadingProducts]);

    /** Reliable when sticky headers / layout make `measureInWindow` mismatch the visible viewport. */
    const tryLoadMoreWhenNearScrollBottom = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!hasMoreProducts || loadingProducts || loadingMoreProducts) return;
            if (loadingMoreRef.current) return;
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            const threshold = 220;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold) {
                loadMoreProducts();
            }
        },
        [hasMoreProducts, loadMoreProducts, loadingMoreProducts, loadingProducts],
    );

    const handlePromoScroll = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            tryLoadMoreWhenNearScrollBottom(e);
            tryLoadMoreWhenLastRowVisible();
        },
        [tryLoadMoreWhenNearScrollBottom, tryLoadMoreWhenLastRowVisible],
    );

    useEffect(() => {
        if (loadingProducts || listingProducts.length === 0 || !hasMoreProducts) return;
        const id = requestAnimationFrame(() => tryLoadMoreWhenLastRowVisible());
        return () => cancelAnimationFrame(id);
    }, [listingProducts.length, loadingProducts, hasMoreProducts, tryLoadMoreWhenLastRowVisible]);

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
    const primaryCtaLabel = hasAddedFromPromoGrid ? 'Go to checkout' : footerCta;
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
                ref={promoScrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEventThrottle={100}
                onScroll={handlePromoScroll}
                onContentSizeChange={() => {
                    requestAnimationFrame(() => tryLoadMoreWhenLastRowVisible());
                }}
                stickyHeaderIndices={tabItems.length > 0 ? [1] : undefined}
            >
                <View style={styles.promoScrollHeader}>
                    <View style={styles.successRow}>

                        <View style={styles.checkCircle}>
                            <Ionicons name="checkmark-sharp" size={16} color="#fff" />
                        </View>
                        <View style={styles.successTextWrap}>
                            <Text style={styles.congrats}>
                                <Text style={styles.congratsBold}>Congratulations!</Text>

                            </Text>
                        </View>
                    </View>

                    <View style={styles.dottedRule} />

                     <View style={styles.unlockBanner}>
                    <Text style={styles.unlockBannerText}>{bannerText}</Text>
                </View> 
                    <View style={styles.titleContainer}>
                        <Text style={styles.flatOff}>{titleText}</Text>
                    </View>

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
                </View>

                <View
                    style={[
                        styles.stickyTabsHost,
                        tabItems.length === 0 && styles.stickyTabsHostCollapsed,
                    ]}
                >
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
                                            <Text style={[styles.tabText, active && styles.tabTextActive]}>
                                                {tabLabel}
                                            </Text>
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
                </View>

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
                                ref={rowIdx === productRows.length - 1 ? lastGridRowRef : undefined}
                                collapsable={rowIdx === productRows.length - 1 ? false : undefined}
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
                                            compactTypographyScale={PROMO_MODAL_TEXT_SCALE}
                                            hideDiscountPercentage
                                            promoPercentOff={displayDealPercentOff}
                                            dealPromoPercentOff={displayDealPercentOff}
                                            applyDealPromoToCart={false}
                                            showPromoOfferPriceBadge
                                            promoOfferCaptionBelowPrice={`${formatCurrency(
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
                    {loadingMoreProducts && listingProducts.length > 0 ? (
                        <View style={styles.gridLoadingMore}>
                            <ActivityIndicator size="small" color={OFFER_RED} />
                        </View>
                    ) : null}
                </View>

                {/* <TouchableOpacity onPress={onSeeAllCoupons} style={styles.seeCouponsLink}>
                    <Text style={styles.seeCouponsText}>See all coupons</Text>
                </TouchableOpacity> */}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.cta, hasAddedFromPromoGrid ? styles.ctaActive : styles.ctaInactive]}
                    onPress={handleUnlock}
                    activeOpacity={0.85}
                    disabled={!hasAddedFromPromoGrid}
                >
                    <Text style={[styles.ctaText, hasAddedFromPromoGrid ? styles.ctaTextActive : styles.ctaTextInactive]}>
                        {primaryCtaLabel}
                    </Text>
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
    promoScrollHeader: {
        backgroundColor: '#FFFFFF',
    },
    /** Direct child of ScrollView at index 1 — sticks to top of scroll viewport when `stickyHeaderIndices` is set. */
    stickyTabsHost: {
        backgroundColor: '#FFFFFF',
        marginTop: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E7EB',
        zIndex: 1,
        elevation: 2,
    },
    stickyTabsHostCollapsed: {
        height: 0,
        marginTop: 0,
        borderBottomWidth: 0,
        overflow: 'hidden',
        opacity: 0,
        elevation: 0,
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
        width: 22,
        height: 22,
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
        fontSize: Fonts.MediumFontSize,
        fontFamily: Fonts.LexendRegular,
        color: '#374151',
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
        fontSize: promoFs(Fonts.ExtraSmallFontSize),
        letterSpacing: 0.3,
    },
    flatOff: {
        marginTop: 4,
        textAlign: 'center',
        fontSize: 36,
        fontFamily: Fonts.LexendBold,
        color: OFFER_RED,
        letterSpacing: -0.5,
    },
    metaRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        marginTop: 4,
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
        fontSize: promoFs(12),
        fontFamily: Fonts.LexendSemiBold,
        color: '#6B7280',
        marginBottom: 4,
    },
    metaSub: {
        fontSize: promoFs(10),
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
        fontSize: promoFs(14),
        fontFamily: Fonts.LexendBold,
        color: OFFER_RED,
    },
    tabsScroll: {
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
        fontSize: promoFs(12),
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
    gridLoadingMore: {
        width: '100%',
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyGridText: {
        fontSize: promoFs(13),
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
        fontSize: promoFs(13),
        fontFamily: Fonts.LexendSemiBold,
        color: '#6B7280',
        textDecorationLine: 'underline',
    },
    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E7EB',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cta: {
        backgroundColor: '#D1D5DB',
        borderRadius: 8,
        paddingVertical: 8,
        alignItems: 'center',
        width: '80%',
        justifyContent: 'center',
    },
    ctaActive: {
        backgroundColor: '#FC5D5B',
    },
    ctaText: {
        fontSize: promoFs(15),
        fontFamily: Fonts.LexendBold,
        color: '#F9FAFB',
    },
    ctaTextActive: {
        color: '#FFFFFF',
    },
    ctaInactive: {
        backgroundColor: '#D1D5DB',
    },
    ctaTextInactive: {
        color: '#F9FAFB',
    },
    skipWrap: {
        alignItems: 'center',
        marginTop: 6,
    },
    skipText: {
        fontSize: promoFs(13),
        fontFamily: Fonts.LexendMedium,
        color: '#9CA3AF',
        textDecorationLine: 'underline',
    },
    titleContainer: {
        backgroundColor: '#fbf2e8',
        marginHorizontal: 12,
        marginVertical: 8,
        borderRadius: 8,
        paddingVertical: 4,
        paddingBottom: 10,
    }
});
