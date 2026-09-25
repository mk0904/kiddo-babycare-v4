/**
 * Product taxonomy props for CleverTap / Mixpanel enrichment.
 * Source: Shopify metafields (custom.l1/l2/l3_collection, age_group, gender_collection).
 */

export type ProductTaxonomy = {
  l1_collection?: string;
  l2_collection?: string;
  l3_collection?: string;
  age_group?: string;
  gender?: string;
};

/** Multi-item events: arrays of values (same key names as single-product events). */
export type ProductTaxonomyArrays = {
  l1_collection?: string[];
  l2_collection?: string[];
  l3_collection?: string[];
  age_group?: string[];
  gender?: string[];
};

const cache = new Map<string, ProductTaxonomy>();

function clean(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

function metafieldsList(product: any): any[] {
  const raw = product?.metafields;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (Array.isArray(raw.edges)) return raw.edges.map((e: any) => e?.node).filter(Boolean);
  return [];
}

function findMetafield(product: any, key: string, namespace = 'custom'): string | undefined {
  const fromDedicated =
    key === 'age_group'
      ? clean(product?.ageGroup?.value ?? product?.ageGroup)
      : undefined;
  if (fromDedicated) return fromDedicated;

  const list = metafieldsList(product);
  const hit = list.find(
    (m: any) =>
      m &&
      String(m.key) === key &&
      (namespace == null || !m.namespace || String(m.namespace) === namespace),
  );
  return clean(hit?.value);
}

/**
 * Resolve gender from product metafields. Prefer custom.gender_collection, then Google Shopping gender.
 */
function resolveGender(product: any): string | undefined {
  return (
    findMetafield(product, 'gender_collection') ||
    findMetafield(product, 'gender', 'mm-google-shopping') ||
    clean(product?.gender)
  );
}

/** Extract taxonomy from a product object that already has metafields loaded. */
export function getProductTaxonomyProps(product: any | null | undefined): ProductTaxonomy {
  if (!product) return {};
  return {
    l1_collection: findMetafield(product, 'l1_collection'),
    l2_collection: findMetafield(product, 'l2_collection'),
    l3_collection: findMetafield(product, 'l3_collection'),
    age_group: findMetafield(product, 'age_group'),
    gender: resolveGender(product),
  };
}

/** Drop empty keys so CleverTap does not get blank strings. */
export function taxonomyToEventProps(
  taxonomy?: ProductTaxonomy | ProductTaxonomyArrays | null,
): Record<string, string | string[]> {
  if (!taxonomy) return {};
  const out: Record<string, string | string[]> = {};
  (['l1_collection', 'l2_collection', 'l3_collection', 'age_group', 'gender'] as const).forEach(
    (key) => {
      const val = taxonomy[key];
      if (val == null) return;
      if (Array.isArray(val)) {
        const cleaned = val.map((v) => clean(v)).filter((v): v is string => Boolean(v));
        if (cleaned.length > 0) out[key] = cleaned;
      } else {
        const c = clean(val);
        if (c) out[key] = c;
      }
    },
  );
  return out;
}

export function aggregateTaxonomies(list: ProductTaxonomy[]): ProductTaxonomyArrays {
  const pick = (key: keyof ProductTaxonomy): string[] | undefined => {
    const vals = list.map((t) => clean(t[key])).filter((v): v is string => Boolean(v));
    return vals.length > 0 ? vals : undefined;
  };
  return {
    l1_collection: pick('l1_collection'),
    l2_collection: pick('l2_collection'),
    l3_collection: pick('l3_collection'),
    age_group: pick('age_group'),
    gender: pick('gender'),
  };
}

export function cacheProductTaxonomy(productId: string, taxonomy: ProductTaxonomy): void {
  if (!productId) return;
  cache.set(productId, taxonomy);
}

export function getCachedProductTaxonomy(productId: string): ProductTaxonomy | undefined {
  return cache.get(productId);
}

/** Fetch + cache taxonomy for one product (uses getProductById). */
export async function fetchProductTaxonomy(productId: string): Promise<ProductTaxonomy> {
  if (!productId) return {};
  const cached = cache.get(productId);
  if (cached) return cached;
  try {
    const { shopifyApi } = await import('@/services/shopifyApi');
    const product = await shopifyApi.getProductById(productId);
    const taxonomy = getProductTaxonomyProps(product);
    cache.set(productId, taxonomy);
    return taxonomy;
  } catch {
    return {};
  }
}

/** Aggregate taxonomy for cart / checkout / abandon events. Dedupes by productId. */
export async function fetchCartTaxonomy(productIds: string[]): Promise<ProductTaxonomyArrays> {
  const unique = [...new Set(productIds.filter(Boolean))];
  if (unique.length === 0) return {};
  const taxonomies = await Promise.all(unique.map((id) => fetchProductTaxonomy(id)));
  return aggregateTaxonomies(taxonomies);
}
