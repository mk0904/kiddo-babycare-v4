/**
 * Shopify variant-specific image is often null; fall back to product media (Storefront / Admin shapes).
 */
export function storefrontVariantImageUrl(variant: any): string | null {
    if (!variant) return null;
    const v = variant.image?.url;
    if (v != null && String(v).trim() !== '') return String(v).trim();
    const p = variant.product;
    if (!p) return null;
    const feat = p.featuredImage?.url;
    if (feat != null && String(feat).trim() !== '') return String(feat).trim();
    const first =
        p.images?.edges?.[0]?.node?.url ??
        (Array.isArray(p.images) ? p.images[0]?.url : null);
    if (first != null && String(first).trim() !== '') return String(first).trim();
    return null;
}
