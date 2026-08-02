import axios from 'axios';
import { SearchParams } from './searchaniseApi'; // re-use search params interface if needed

const SELF_SEARCH_API_KEY = 'PLACEHOLDER_SEARCH_API_KEY';
const SELF_SEARCH_BASE_URL = 'https://search-engine-api-144508817658.asia-south1.run.app';

const client = axios.create({
    baseURL: SELF_SEARCH_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': SELF_SEARCH_API_KEY,
    },
});

const APP_SESSION_ID = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

export const trackEvent = async (eventType: string, productId?: string, metadata?: any) => {
    try {
        await client.post('/api/events', {
            sessionId: APP_SESSION_ID,
            eventType,
            productId,
            metadata
        });
    } catch (error) {
        if (!axios.isCancel(error)) {
            console.error('Error tracking self search event:', error);
        }
    }
};

export const trackProductClick = (query: string, productId: string) => {
    trackEvent('view', productId, { query }).catch(() => {});
};

export const trackSearch = (query: string, totalItems: number) => {
    trackEvent('search', undefined, { query, resultCount: totalItems }).catch(() => {});
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
    trackEvent,
    trackProductClick,
    trackSearch,
};
