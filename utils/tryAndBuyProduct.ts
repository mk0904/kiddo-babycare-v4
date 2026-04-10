/** First segment of Shopify variant title (e.g. "S / Default Title" → "S"). */
export function sizeLabelFromVariantTitle(title?: string | null): string {
    if (!title || title === 'Default Title') return '';
    const t = String(title).trim();
    if (!t) return '';
    return t.split('/')[0].trim();
}

/** Value for the main option (e.g. size) from a variant — stored on cart line for display/edit. */
export function tryBuyTrialOptionValueFromVariant(tryVariant: any): string {
    const opts = Array.isArray(tryVariant?.selectedOptions) ? tryVariant.selectedOptions : [];
    const nonTitle = opts.find((o: any) => o?.name && o.name !== 'Title');
    const raw = nonTitle?.value ?? tryVariant?.title ?? '';
    return sizeLabelFromVariantTitle(String(raw));
}

export function variantIdsEqual(a?: string | null, b?: string | null): boolean {
    if (!a || !b) return false;
    if (a === b) return true;
    const na = String(a).replace(/^gid:\/\/shopify\/ProductVariant\//, '');
    const nb = String(b).replace(/^gid:\/\/shopify\/ProductVariant\//, '');
    return na === nb;
}

/**
 * Whether a product should use Try & Buy variant flow (tags / Shopify tags string).
 * Keep in sync with cart badge logic in app/cart/index.tsx (`hasTryAndBuyTag`).
 */
export function hasTryAndBuyProduct(product: { tags?: string[] | string } | null | undefined): boolean {
    if (!product) return false;
    const raw = product.tags;
    const tags = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
          ? raw.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
    return tags.some((tag: string) => {
        const t = String(tag).trim().toLowerCase();
        if (t === 'fashion') return true;
        if (['try and buy', 'try & buy', 'try-and-buy', 'tryandbuy'].includes(t)) return true;
        if (t.includes('try') && t.includes('buy')) return true;
        return false;
    });
}
