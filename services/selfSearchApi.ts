import axios from 'axios';
import { SearchParams } from './searchaniseApi'; // re-use search params interface if needed

const SELF_SEARCH_API_KEY = process.env.EXPO_PUBLIC_SELF_SEARCH_API_KEY ?? '';
const SELF_SEARCH_BASE_URL = 'https://search-engine-api-144508817658.asia-south1.run.app';

const client = axios.create({
    baseURL: SELF_SEARCH_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': SELF_SEARCH_API_KEY,
        'x-tenant-id': '0e87eda2-3758-4d5c-aed1-97d75ddff33a',
    },
});

const APP_SESSION_ID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

let currentSearchId: string | undefined = undefined;

export const trackAnalyticsEvent = async (eventType: string, productId?: string, metadata?: any) => {
    try {
        const typeMap: Record<string, string> = {
            'view': 'PRODUCT_VIEW',
            'search': 'SEARCH',
            'add_to_cart': 'ADD_TO_CART',
            'order_placed': 'ORDER_PLACED'
        };
        const mappedEventType = typeMap[eventType] || eventType.toUpperCase();

        const { useUserStore } = require('@/store/userStore');
        const { extractNumericId } = require('@/utils/shopifyIds');
        const user = useUserStore.getState().user;
        
        const rawId = user?.customerId || user?.id;
        const numericPart = rawId ? rawId.replace(/\D/g, '') : '';
        const customerId = numericPart || 'guest';

        const payload = {
            user_id: customerId,
            session_id: APP_SESSION_ID,
            event_type: mappedEventType,
            search_id: currentSearchId,
            product_id: productId,
            metadata
        };

        await client.post('/api/analytics/events', payload);
    } catch (error) {
        if (!axios.isCancel(error)) {
            console.error('Error tracking analytics event:', error);
        }
    }
};

export const getCurrentSearchId = () => currentSearchId;
export const getCurrentSessionId = () => APP_SESSION_ID;

export const trackProductClick = (query: string, productId: string) => {
    trackAnalyticsEvent('view', productId, { query }).catch(() => { });
};

export const trackSearch = (query: string, totalItems: number) => {
    trackAnalyticsEvent('search', undefined, { query, resultCount: totalItems }).catch(() => { });
};

export const trackAddToCart = (query: string, productId: string) => {
    trackAnalyticsEvent('add_to_cart', productId, { query }).catch(() => { });
};

export const getSuggestions = async (query: string, signal?: AbortSignal) => {
    try {
        const response = await client.post('/api/suggest', { query }, { signal });
        if (response.data && response.data.status === 'success') {
            return response.data.data;
        }
        return null;
    } catch (error) {
        if (!axios.isCancel(error)) {
            console.error('Error fetching suggestions:', error);
        }
        return null;
    }
};

const searchCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const searchProducts = async ({
    q,
    startIndex = 0,
    maxResults = 24,
}: SearchParams, signal?: AbortSignal) => {
    try {
        const cacheKey = `${q || ''}-${startIndex}-${maxResults}`;
        const cached = searchCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }

        const page = Math.floor(startIndex / maxResults) + 1;

        const response = await client.post('/api/search', {
            query: q || '',
            page,
            limit: maxResults,
        }, {
            signal,
        });

        const responseData = response.data;

        if (responseData.searchId) {
            currentSearchId = responseData.searchId;
        }

        if (responseData.status !== 'success') {
            throw new Error('Search failed');
        }

        const transformedProducts = (responseData.results || []).map((item: any) => {
            const rawId = item.productId || item.id || '';
            const globalProductId = rawId.includes('gid://') ? rawId : `gid://shopify/Product/${rawId}`;

            return {
                id: globalProductId,
                title: item.title,
                description: '',
                handle: '',
                tags: [],
                vendor: null,
                images: item.image
                    ? {
                        edges: [
                            {
                                node: {
                                    url: item.image,
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
                                id: globalProductId.replace('Product', 'ProductVariant'),
                                title: 'Default',
                                price: String(item.price || '0.00'),
                                compareAtPrice: null,
                                availableForSale: true,
                                quantityAvailable: 1,
                            },
                        },
                    ],
                },
                priceRange: {
                    minVariantPrice: {
                        amount: String(item.price || '0.00'),
                        currencyCode: 'INR',
                    },
                },
            };
        });

        const result = {
            products: {
                edges: transformedProducts.map((product: any) => ({ node: product })),
                pageInfo: {
                    hasNextPage: responseData.pagination?.hasMore || false,
                    endCursor: String(startIndex + transformedProducts.length),
                },
            },
            totalItems: responseData.pagination?.totalResults || 0,
            facets: [],
        };

        if (startIndex === 0 && q && q.trim()) {
            trackSearch(q.trim(), result.totalItems);
        }

        searchCache.set(cacheKey, { data: result, timestamp: Date.now() });

        return result;
    } catch (error) {
        if (axios.isCancel(error)) {
            console.log('Self search request canceled', error.message);
        } else {
            console.error('Error fetching self search results:', error);
        }
        return null;
    }
};

export const selfSearchApi = {
    searchProducts,
    getSuggestions,
    trackAnalyticsEvent,
    trackProductClick,
    trackSearch,
    trackAddToCart,
    getCurrentSearchId,
    getCurrentSessionId,
};
