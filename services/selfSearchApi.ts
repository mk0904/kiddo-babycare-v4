import axios from 'axios';
import { SearchParams } from './searchaniseApi'; // re-use search params interface if needed

const SELF_SEARCH_API_KEY = 'PLACEHOLDER_SEARCH_API_KEY';
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
        const customerId = rawId ? extractNumericId(rawId) : 'guest';

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

export const trackEvent = async (eventType: string, productId?: string, metadata?: any) => {
    try {
        const payload = {
            sessionId: APP_SESSION_ID,
            eventType,
            productId,
            metadata
        };
        console.log('[selfSearchApi] req:', {
            url: client.defaults.baseURL + '/api/events',
            headers: client.defaults.headers,
            payload
        });

        await client.post('/api/events', payload);
    } catch (error) {
        if (!axios.isCancel(error)) {
            console.error('Error tracking self search event:', error);
        }
    }
};

export const trackProductClick = (query: string, productId: string) => {
    trackEvent('view', productId, { query }).catch(() => { });
    trackAnalyticsEvent('view', productId, { query }).catch(() => { });
};

export const trackSearch = (query: string, totalItems: number) => {
    trackEvent('search', undefined, { query, resultCount: totalItems }).catch(() => { });
    trackAnalyticsEvent('search', undefined, { query, resultCount: totalItems }).catch(() => { });
};

export const trackAddToCart = (query: string, productId: string) => {
    trackEvent('add_to_cart', productId, { query }).catch(() => { });
    trackAnalyticsEvent('add_to_cart', productId, { query }).catch(() => { });
};

export const trackOrderPlaced = (orderId: string, metadata?: any) => {
    trackEvent('order_placed', undefined, { orderId, ...metadata }).catch(() => { });
    trackAnalyticsEvent('order_placed', undefined, { orderId, ...metadata }).catch(() => { });
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

export const searchProducts = async ({
    q,
    startIndex = 0,
    maxResults = 24,
}: SearchParams, signal?: AbortSignal) => {
    try {
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

        const transformedProducts = (responseData.results || []).map((item: any) => ({
            id: item.productId,
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
                            id: item.productId ? item.productId.replace('Product', 'ProductVariant') : `gid://shopify/ProductVariant/${item.id}`,
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
        }));

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
    trackEvent,
    trackAnalyticsEvent,
    trackProductClick,
    trackSearch,
    trackAddToCart,
    trackOrderPlaced,
};
