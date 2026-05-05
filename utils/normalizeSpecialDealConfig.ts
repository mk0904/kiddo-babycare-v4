import type { SpecialDealCondition, SpecialDealConfig, SpecialDealTab } from '@/types/appConfig';

function str(v: unknown): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
}

/** Map one backend tab row → {@link SpecialDealTab}; drops rows with no display label. */
export function normalizeSpecialDealTab(raw: unknown): SpecialDealTab | null {
    if (!raw || typeof raw !== 'object') return null;
    const t = raw as Record<string, unknown>;
    const label = str(t.label) ?? str(t.title) ?? str(t.name) ?? str(t.tab_label);
    if (!label) return null;

    const collectionRaw = t.collectionId ?? t.collection_id ?? t.collectionID ?? t.collection;
    const collectionId = collectionRaw != null ? String(collectionRaw).trim() : undefined;

    const value = str(t.value) ?? str(t.key) ?? str(t.id);
    const imageUrl = str(t.imageUrl) ?? str(t.image_url);

    const inactive =
        t.isActive === false ||
        t.is_active === false ||
        t.active === false ||
        t.enabled === false;

    return {
        label,
        ...(value ? { value } : {}),
        ...(collectionId ? { collectionId } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        isActive: !inactive,
    };
}

function pickStr(r: Record<string, unknown>, ...keys: string[]): string | undefined {
    for (const k of keys) {
        const v = str(r[k]);
        if (v != null) return v;
    }
    return undefined;
}

function pickNum(r: Record<string, unknown>, ...keys: string[]): number | undefined {
    for (const k of keys) {
        const v = r[k];
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string' && v.trim() !== '') {
            const n = parseFloat(v);
            if (Number.isFinite(n)) return n;
        }
    }
    return undefined;
}

/**
 * Normalizes `speacialDealConfig` / `specialDealConfig` payloads from kiddo-service:
 * snake_case keys, alternate tab keys, root vs cart nesting handled at call site.
 */
export function normalizeSpecialDealConfig(raw: unknown): SpecialDealConfig {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    const r = raw as Record<string, unknown>;
    const base = raw as SpecialDealConfig;

    const tabsSrc = r.tabs ?? r.Tabs ?? r.deal_tabs ?? r.collection_tabs;
    const normalizedTabs: SpecialDealTab[] | undefined = Array.isArray(tabsSrc)
        ? tabsSrc.map(normalizeSpecialDealTab).filter((x): x is SpecialDealTab => x != null)
        : undefined;

    const conditionsRaw = r.conditions ?? r.Conditions;
    const normalizedConditions: SpecialDealCondition[] | undefined = Array.isArray(conditionsRaw)
        ? conditionsRaw
              .map((c) => {
                  if (!c || typeof c !== 'object') return null;
                  const x = c as Record<string, unknown>;
                  const text = str(x.text) ?? str(x.label) ?? str(x.copy);
                  const iconUrl = str(x.iconUrl) ?? str(x.icon_url) ?? str(x.icon);
                  if (!text && !iconUrl) return null;
                  return {
                      ...(text ? { text } : {}),
                      ...(iconUrl ? { iconUrl } : {}),
                  };
              })
              .filter((x): x is SpecialDealCondition => x != null)
        : undefined;

    const isEnabled =
        r.isEnabled === false || r.is_enabled === false || r.enabled === false
            ? false
            : r.isEnabled === true || r.is_enabled === true || r.enabled === true
              ? true
              : base.isEnabled !== false;

    const sideTabsRaw = r.sideTabs ?? r.side_tabs;
    const sideTabs =
        Array.isArray(sideTabsRaw) && sideTabsRaw.length > 0
            ? (sideTabsRaw as SpecialDealConfig['sideTabs'])
            : base.sideTabs;

    return {
        ...base,
        ...(normalizedTabs != null ? { tabs: normalizedTabs } : {}),
        ...(normalizedConditions != null ? { conditions: normalizedConditions } : {}),
        ...(sideTabs != null ? { sideTabs } : {}),
        title: pickStr(r, 'title', 'headline') ?? base.title,
        bannerText: pickStr(r, 'bannerText', 'banner_text') ?? base.bannerText,
        firstLineText: pickStr(r, 'firstLineText', 'first_line_text') ?? base.firstLineText,
        secondLineText: pickStr(r, 'secondLineText', 'second_line_text') ?? base.secondLineText,
        thirdLineText: pickStr(r, 'thirdLineText', 'third_line_text') ?? base.thirdLineText,
        footerCta: pickStr(r, 'footerCta', 'footer_cta') ?? base.footerCta,
        successIconUrl: pickStr(r, 'successIconUrl', 'success_icon_url') ?? base.successIconUrl,
        actualPrice: pickNum(r, 'actualPrice', 'actual_price') ?? base.actualPrice,
        discountedPrice: pickNum(r, 'discountedPrice', 'discounted_price') ?? base.discountedPrice,
        discount: pickNum(r, 'discount') ?? base.discount,
        minCartValue: pickNum(r, 'minCartValue', 'min_cart_value') ?? base.minCartValue,
        offerTime: pickNum(r, 'offerTime', 'offer_time') ?? base.offerTime,
        dealCouponFixedAmount:
            pickNum(r, 'dealCouponFixedAmount', 'deal_coupon_fixed_amount') ?? base.dealCouponFixedAmount,
        videoUrl: pickStr(r, 'videoUrl', 'video_url') ?? base.videoUrl,
        allKits: Array.isArray(r.allKits ?? r.all_kits) ? (r.allKits ?? r.all_kits) as string[] : base.allKits,
        isEnabled,
    };
}
