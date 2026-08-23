// Product Cache Service
// Provides local caching for products to reduce API calls and improve performance

import AsyncStorage from '@react-native-async-storage/async-storage';
import { shopifyApi } from '@/services/shopifyApi';

// Cache configuration
const CACHE_CONFIG = {
    productPrefix: 'product_cache_v2_',
    collectionPrefix: 'collection_cache_v2_',
    maxAge: 30 * 60 * 1000, // 30 minutes
    maxItems: 100, // Max items to cache
};

// Types
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    expiresAt: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    size: number;
}

class ProductCacheService {
    private static instance: ProductCacheService;
    private memoryCache: Map<string, CacheEntry<any>> = new Map();
    private stats: CacheStats = { hits: 0, misses: 0, size: 0 };

    private constructor() {
        this.loadFromStorage();
    }

    static getInstance(): ProductCacheService {
        if (!ProductCacheService.instance) {
            ProductCacheService.instance = new ProductCacheService();
        }
        return ProductCacheService.instance;
    }

    /**
     * Get a product by handle with caching
     */
    async getProductByHandle(handle: string): Promise<any | null> {
        const cacheKey = `${CACHE_CONFIG.productPrefix}handle_${handle}`;

        // Check memory cache first
        const memoryHit = this.getFromMemory(cacheKey);
        if (memoryHit) {
            this.stats.hits++;
            return memoryHit;
        }

        // Check AsyncStorage
        const storageHit = await this.getFromStorage(cacheKey);
        if (storageHit) {
            // Populate memory cache
            this.setInMemory(cacheKey, storageHit);
            this.stats.hits++;
            return storageHit;
        }

        // Fetch from API
        this.stats.misses++;
        try {
            const product = await shopifyApi.getProductByHandle(handle);
            if (product) {
                await this.set(cacheKey, product);
            }
            return product;
        } catch (error) {
            console.error('[ProductCache] Error fetching product:', error);
            return null;
        }
    }

    /**
     * Get a product by ID with caching
     */
    async getProductById(id: string): Promise<any | null> {
        const cacheKey = `${CACHE_CONFIG.productPrefix}id_${id}`;

        const memoryHit = this.getFromMemory(cacheKey);
        if (memoryHit) {
            this.stats.hits++;
            return memoryHit;
        }

        const storageHit = await this.getFromStorage(cacheKey);
        if (storageHit) {
            this.setInMemory(cacheKey, storageHit);
            this.stats.hits++;
            return storageHit;
        }

        this.stats.misses++;
        try {
            const product = await shopifyApi.getProductById(id);
            if (product) {
                await this.set(cacheKey, product);
            }
            return product;
        } catch (error) {
            console.error('[ProductCache] Error fetching product:', error);
            return null;
        }
    }

    /**
     * Get multiple products by handles (batch)
     */
    async getProductsByHandles(handles: string[]): Promise<any[]> {
        const results: any[] = [];
        const uncached: string[] = [];

        // Check cache for each handle
        for (const handle of handles) {
            const cacheKey = `${CACHE_CONFIG.productPrefix}handle_${handle}`;
            const cached = this.getFromMemory(cacheKey) || (await this.getFromStorage(cacheKey));

            if (cached) {
                results.push(cached);
                this.stats.hits++;
            } else {
                uncached.push(handle);
                this.stats.misses++;
            }
        }

        // Fetch uncached products (one by one since getProductsByHandles doesn't exist)
        if (uncached.length > 0) {
            try {
                for (const handle of uncached) {
                    const product = await shopifyApi.getProductByHandle(handle);
                    if (product) {
                        const cacheKey = `${CACHE_CONFIG.productPrefix}handle_${product.handle}`;
                        await this.set(cacheKey, product);
                        results.push(product);
                    }
                }
            } catch (error) {
                console.error('[ProductCache] Error fetching products:', error);
            }
        }

        return results;
    }

    /**
     * Get collection products with caching
     */
    async getCollectionProducts(handle: string, first: number = 20): Promise<any[]> {
        const cacheKey = `${CACHE_CONFIG.collectionPrefix}${handle}_${first}`;

        const memoryHit = this.getFromMemory(cacheKey);
        if (memoryHit) {
            this.stats.hits++;
            return memoryHit;
        }

        this.stats.misses++;
        try {
            // Use getProductsByCollection which exists in shopifyApi
            const result = await shopifyApi.getProductsByCollection(handle, first);

            // Handle the edges format from Shopify API
            let products: any[] = [];
            if (result && 'edges' in result && Array.isArray(result.edges)) {
                products = result.edges.map((edge: any) => edge.node);
            } else if (Array.isArray(result)) {
                products = result;
            }

            if (products && products.length > 0) {
                await this.set(cacheKey, products);

                // Also cache individual products
                for (const product of products) {
                    if (product?.handle) {
                        const productKey = `${CACHE_CONFIG.productPrefix}handle_${product.handle}`;
                        await this.set(productKey, product);
                    }
                }
            }
            return products;
        } catch (error) {
            console.error('[ProductCache] Error fetching collection:', error);
            return [];
        }
    }

    /**
     * Prefetch products (for better UX)
     */
    async prefetch(handles: string[]): Promise<void> {
        // Don't wait for result
        this.getProductsByHandles(handles).catch(() => { });
    }

    /**
     * Invalidate cache for a specific product
     */
    async invalidateProduct(handle: string): Promise<void> {
        const cacheKey = `${CACHE_CONFIG.productPrefix}handle_${handle}`;
        this.memoryCache.delete(cacheKey);
        await AsyncStorage.removeItem(cacheKey);
        this.stats.size = this.memoryCache.size;
    }

    /**
     * Clear all product cache
     */
    async clearAll(): Promise<void> {
        // Clear memory cache
        this.memoryCache.clear();

        // Clear storage
        const keys = await AsyncStorage.getAllKeys();
        const productKeys = keys.filter(
            (k) => k.startsWith(CACHE_CONFIG.productPrefix) || k.startsWith(CACHE_CONFIG.collectionPrefix)
        );
        await AsyncStorage.multiRemove(productKeys);

        this.stats = { hits: 0, misses: 0, size: 0 };
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        return { ...this.stats, size: this.memoryCache.size };
    }

    // Private methods
    private getFromMemory(key: string): any | null {
        const entry = this.memoryCache.get(key);
        if (!entry) return null;

        // Check expiration
        if (Date.now() > entry.expiresAt) {
            this.memoryCache.delete(key);
            return null;
        }

        return entry.data;
    }

    private setInMemory(key: string, data: any): void {
        // Enforce max items
        if (this.memoryCache.size >= CACHE_CONFIG.maxItems) {
            // Remove oldest entry
            const oldestKey = this.memoryCache.keys().next().value;
            if (oldestKey) this.memoryCache.delete(oldestKey);
        }

        this.memoryCache.set(key, {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + CACHE_CONFIG.maxAge,
        });

        this.stats.size = this.memoryCache.size;
    }

    private async getFromStorage(key: string): Promise<any | null> {
        try {
            const raw = await AsyncStorage.getItem(key);
            if (!raw) return null;

            const entry: CacheEntry<any> = JSON.parse(raw);

            // Check expiration
            if (Date.now() > entry.expiresAt) {
                await AsyncStorage.removeItem(key);
                return null;
            }

            return entry.data;
        } catch (error) {
            return null;
        }
    }

    private async set(key: string, data: any): Promise<void> {
        const entry: CacheEntry<any> = {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + CACHE_CONFIG.maxAge,
        };

        // Set in memory
        this.setInMemory(key, data);

        // Set in storage
        try {
            await AsyncStorage.setItem(key, JSON.stringify(entry));
        } catch (error) {
            console.warn('[ProductCache] Storage error:', error);
        }
    }

    private async loadFromStorage(): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const productKeys = keys.filter((k) => k.startsWith(CACHE_CONFIG.productPrefix));

            // Load most recent items into memory
            const items = await AsyncStorage.multiGet(productKeys.slice(0, CACHE_CONFIG.maxItems));

            for (const [key, value] of items) {
                if (value) {
                    try {
                        const entry: CacheEntry<any> = JSON.parse(value);
                        if (Date.now() <= entry.expiresAt) {
                            this.memoryCache.set(key, entry);
                        }
                    } catch { }
                }
            }

            this.stats.size = this.memoryCache.size;
        } catch (error) {
            console.warn('[ProductCache] Load error:', error);
        }
    }
}

// Export singleton
export const productCache = ProductCacheService.getInstance();

// Export class for testing
export { ProductCacheService };

export default productCache;
