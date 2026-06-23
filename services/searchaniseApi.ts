import axios from 'axios';
import { SEARCHANISE_API_KEY } from '../config/searchanise';

const SEARCHANISE_BASE_URL = 'https://searchserverapi1.com';

const client = axios.create({
    baseURL: SEARCHANISE_BASE_URL,
    timeout: 10000,
});

const generateSearchUuid = () => {
    let u = '', i = 0;
    while (i++ < 36) {
        const c = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'[i - 1];
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        u += (c === '-' || c === '4') ? c : v.toString(16);
    }
    return u;
};

const makeAnalyticsRequest = async (url: string, method: string, data: any) => {
    try {
        await axios({
            method,
            url: `https://athena.searchserverapi1.com/api/v1/${url}`,
            headers: {
                'Authorization': `Bearer ${SEARCHANISE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            data,
        });
    } catch (error) {
        console.error('Searchanise analytics error:', error);
    }
};

// Simple in-memory cache
const requestCache = new Map<string, { data: any; expiresAt: number }>();
const activeRequests = new Map<string, Promise<any>>();

const generateCacheKey = (params: any) => {
    return JSON.stringify(params);
};

export interface SearchParams {
    q?: string;
    collection?: string | null;
    filters?: Record<string, any>;
    sortBy?: string;
    sortOrder?: string;
    startIndex?: number;
    maxResults?: number;
    facets?: boolean;
}

export const searchProducts = async ({
    q = '',
    collection = null,
    filters = {},
    sortBy = 'relevance',
    sortOrder = 'asc',
    startIndex = 0,
    maxResults = 20,
    facets = true,
}: SearchParams, signal?: AbortSignal) => {
    const cacheKey = generateCacheKey({ q, collection, filters, sortBy, sortOrder, startIndex, maxResults, facets });

    // Never cache when facets are requested - always fetch fresh filter data
    if (startIndex === 0 && facets !== true) {
        const cached = requestCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
    }

    // Deduplication
    if (activeRequests.has(cacheKey)) {
        return activeRequests.get(cacheKey);
    }

    const requestPromise = (async () => {
        try {
            const params: any = {
                apiKey: SEARCHANISE_API_KEY,
                output: 'json',
                items: 'true',
                facets: facets ? 'true' : 'false',
                q: q || '',
                sortBy,
                sortOrder,
                startIndex,
                maxResults: Math.min(maxResults, 250),
            };

            // Add cache-busting parameter when facets are requested to ensure fresh filter data
            if (facets === true) {
                params._t = Date.now();
            }

            if (collection) {
                params['restrictBy[collections]'] = collection;
            }

            Object.keys(filters).forEach((attribute) => {
                const value = filters[attribute];
                if (value !== null && value !== undefined && value !== '') {
                    if (Array.isArray(value)) {
                        params[`restrictBy[${attribute}]`] = value.join('|');
                    } else {
                        params[`restrictBy[${attribute}]`] = value;
                    }
                }
            });

            const response = await client.get('/getresults', { 
                params,
                signal, // Support request cancellation
            });

            if (response.data.error) {
                throw new Error(response.data.error);
            }

            const responseData = response.data;

            // Transform to Shopify format
            const transformedProducts = (responseData.items || []).map((item: any) => ({
                id: `gid://shopify/Product/${item.product_id}`,
                title: item.title,
                description: item.description || '',
                handle: item.link?.split('/products/')[1]?.split('?')[0] || '',
                tags: item.tags ? (Array.isArray(item.tags) ? item.tags : item.tags.split(',').map((t: string) => t.trim())) : [],
                vendor: item.vendor || item.brand || null,
                images: item.image_link
                    ? {
                        edges: [
                            {
                                node: {
                                    url: item.image_link,
                                    altText: item.title,
                                },
                            },
                        ],
                    }
                    : { edges: [] },
                variants: {
                    edges: [
                        {
                            node: {
                                id: `gid://shopify/ProductVariant/${item.product_id}`,
                                title: 'Default',
                                price: item.price || '0.00',
                                compareAtPrice: item.list_price || null,
                                availableForSale: item.quantity !== '0' && item.quantity !== 0 && item.quantity !== '0.0' && item.quantity !== null,
                                quantityAvailable: item.quantity !== undefined && item.quantity !== null
                                    ? (typeof item.quantity === 'string' ? parseInt(item.quantity, 10) : item.quantity)
                                    : 0,
                            },
                        },
                    ],
                },
                priceRange: {
                    minVariantPrice: {
                        amount: item.price || '0.00',
                        currencyCode: 'INR',
                    },
                },
                _searchanise: {
                    product_id: item.product_id,
                    product_code: item.product_code,
                    link: item.link,
                },
            }));

            const result = {
                products: {
                    edges: transformedProducts.map((product: any) => ({ node: product })),
                    pageInfo: {
                        hasNextPage: startIndex + transformedProducts.length < (responseData.totalItems || 0),
                        endCursor: String(startIndex + transformedProducts.length),
                    },
                },
                facets: responseData.facets || [],
                totalItems: responseData.totalItems || 0,
                correctedQuery: responseData.correctedQuery,
            };

            // Send analytics for the search query
            if (q && startIndex === 0) {
                const searchQueryData = {
                    timestamp: Math.floor(Date.now() / 1000),
                    search_query: q,
                    has_result: result.totalItems > 0,
                    uuid: generateSearchUuid(),
                };
                // Fire and forget analytics request
                makeAnalyticsRequest('search-queries', 'POST', searchQueryData).catch(() => {});
            }

            // Never cache when facets are requested - always fetch fresh filter data
            if (startIndex === 0 && facets !== true) {
                requestCache.set(cacheKey, { data: result, expiresAt: Date.now() + 5000 });
            }

            return result;
        } finally {
            activeRequests.delete(cacheKey);
        }
    })();

    activeRequests.set(cacheKey, requestPromise);
    return requestPromise;
};

export const searchaniseApi = {
    searchProducts,
};
