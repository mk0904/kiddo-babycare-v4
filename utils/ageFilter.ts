/**
 * Age-filter helpers for collection listings.
 *
 * Non-toy products are matched by their Size/Age variant option first. Products that have no
 * such option (e.g. single-variant items whose only option is Shopify's "Title / Default Title")
 * fall back to their age tags, e.g. "Girl 2-3y", "Boy 0-3m", "Girl 5+ y", "All Ages".
 */

/** Filter value (AGE_OPTIONS in app/infinity/[collectionId].tsx) → normalized tag ages that satisfy it. */
const TAG_AGE_MATCHES: Record<string, string[]> = {
    '0-6m': ['0-6m', '0-3m', '3-6m'],
    '6-12m': ['6-12m', '6-9m', '9-12m'],
    '1-2y': ['1-2y'],
    '2-3y': ['2-3y'],
    '3-4y': ['3-4y'],
    '4-5y': ['4-5y'],
    '5-6y': ['5-6y', '5+y'],
    '6-7y': ['6-7y', '5+y'],
};

const TAG_PREFIXES = ['girls', 'girl', 'boys', 'boy', 'unisex', 'toysfor', 'booksfor'];

function normalizeAgeTag(tag: string): string {
    let t = String(tag || '').toLowerCase().replace(/\s+/g, '');
    for (const prefix of TAG_PREFIXES) {
        if (t.startsWith(prefix)) {
            t = t.slice(prefix.length);
            break;
        }
    }
    return t;
}

function isAgeOptionName(name: unknown): boolean {
    const n = String(name || '').toLowerCase();
    return n.includes('age') || n.includes('size');
}

/** True when any variant carries a Size/Age option (so variant-based age matching applies). */
export function hasAgeVariantOption(variants: any[]): boolean {
    return (variants || []).some((v: any) =>
        (v?.selectedOptions || []).some((opt: any) => isAgeOptionName(opt?.name)),
    );
}

/** Tag-based age match used when a product has no Size/Age variant option. */
export function matchesAgeByTags(tags: string[] | string | undefined, age: string): boolean {
    const list = Array.isArray(tags)
        ? tags
        : typeof tags === 'string'
          ? tags.split(',')
          : [];
    const wanted = TAG_AGE_MATCHES[String(age || '').toLowerCase()] || [String(age || '').toLowerCase()];
    return list.some((raw) => {
        const t = normalizeAgeTag(raw);
        if (t === 'allages') return true;
        return wanted.includes(t);
    });
}
