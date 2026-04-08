import { isVariantAvailable } from '@/utils/availability';
import { hasTryAndBuyProduct } from '@/utils/tryAndBuyProduct';

export function normalizeTryBuyVariants(product: any): any[] {
    if (!product?.variants) return [];
    if (Array.isArray(product.variants.edges)) {
        return product.variants.edges.map((e: any) => e?.node || e).filter(Boolean);
    }
    if (Array.isArray(product.variants)) return product.variants.filter(Boolean);
    return [];
}

export function buildTryBuyOptionsFromVariants(variants: any[]) {
    if (variants.length === 0) return [];
    const first = variants[0];
    const firstOpts = Array.isArray(first?.selectedOptions) ? first.selectedOptions : [];
    if (firstOpts.length === 0) return [];
    const derived: Record<string, Set<string>> = {};
    variants.forEach((v: any) => {
        const options = Array.isArray(v.selectedOptions) ? v.selectedOptions : [];
        options.forEach((opt: any) => {
            if (!derived[opt.name]) derived[opt.name] = new Set();
            derived[opt.name].add(opt.value);
        });
    });
    return Object.keys(derived)
        .map((name) => ({
            name,
            values: Array.from(derived[name]),
        }))
        .filter((opt) => !(opt.name === 'Title' && opt.values.includes('Default Title')));
}

export function optionMapFromVariant(variant: any): Record<string, string> {
    const opts = Array.isArray(variant?.selectedOptions) ? variant.selectedOptions : [];
    const m: Record<string, string> = {};
    opts.forEach((o: any) => {
        if (o?.name) m[o.name] = o.value;
    });
    return m;
}

export function valueAvailableForTryBuyOption(variants: any[], optionName: string, value: string): boolean {
    return variants.some((v) => {
        const opts = Array.isArray(v.selectedOptions) ? v.selectedOptions : [];
        const matches = opts.some((o: any) => o.name === optionName && o.value === value);
        return matches && isVariantAvailable(v) !== false;
    });
}

export function findVariantForPrimaryOption(
    variants: any[],
    optionName: string,
    value: string,
    baseMap: Record<string, string> | null,
): any | null {
    const candidates = variants.filter((v) => {
        const opts = Array.isArray(v.selectedOptions) ? v.selectedOptions : [];
        return opts.some((o: any) => o.name === optionName && o.value === value);
    });
    if (baseMap) {
        const merged = candidates.find((v) => {
            const m = optionMapFromVariant(v);
            for (const [k, val] of Object.entries(baseMap)) {
                if (k === optionName) continue;
                if (m[k] !== val) return false;
            }
            return m[optionName] === value;
        });
        if (merged) return merged;
    }
    return (
        candidates.find((v) => isVariantAvailable(v) !== false) ||
        candidates[0] ||
        null
    );
}

export function findTryVariantForPrimary(
    variants: any[],
    primaryVariant: any,
    optionName: string,
    tryValue: string,
): any | null {
    const base = optionMapFromVariant(primaryVariant);
    return (
        variants.find((v) => {
            const m = optionMapFromVariant(v);
            if (m[optionName] !== tryValue) return false;
            for (const [k, val] of Object.entries(base)) {
                if (k === optionName) continue;
                if (m[k] !== val) return false;
            }
            return isVariantAvailable(v) !== false;
        }) || null
    );
}

/**
 * First PDP "main" option (size) to omit from initial selectedOptions for Try & Buy products,
 * so the try-another-size row stays hidden until the shopper picks a size.
 * Aligns with `tryBuyPdpEligible` / `productOptions[0]` on the product screen.
 */
export function getTryBuyPdpMainOptionNameForDefer(
    product: any,
    variantCount: number,
    isTicketingProduct: boolean,
): string | null {
    if (!product || !hasTryAndBuyProduct(product) || isTicketingProduct || variantCount <= 1) {
        return null;
    }
    const options = Array.isArray(product.options) ? product.options : [];
    const filtered = options.filter((option: any) => (option.values || []).length > 1);
    if (filtered.length === 0) return null;
    return String(filtered[0].name);
}
