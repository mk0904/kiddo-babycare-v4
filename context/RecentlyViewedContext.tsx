import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface RecentlyViewedItem {
    id: string;
    handle: string;
    title?: string;
    image?: string;
}

interface RecentlyViewedContextType {
    recentlyViewedItems: RecentlyViewedItem[];
    addToRecentlyViewed: (product: { id: string; handle: string; title?: string; image?: string }) => void;
    getRecentlyViewed: (excludeHandle?: string) => RecentlyViewedItem[];
    clearRecentlyViewed: () => void;
    loading: boolean;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextType | null>(null);

export const useRecentlyViewed = () => {
    const context = useContext(RecentlyViewedContext);
    if (!context) {
        throw new Error('useRecentlyViewed must be used within RecentlyViewedProvider');
    }
    return context;
};

const STORAGE_KEY = 'recently_viewed_products';
const MAX_ITEMS = 20;

export const RecentlyViewedProvider = ({ children }: { children: React.ReactNode }) => {
    const [recentlyViewedItems, setRecentlyViewedItems] = useState<RecentlyViewedItem[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Ref to store debounce timeout
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        loadRecentlyViewed();
    }, []);

    useEffect(() => {
        // Debounce saves to prevent excessive AsyncStorage writes
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            saveRecentlyViewed();
        }, 500) as unknown as NodeJS.Timeout;

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [recentlyViewedItems]);

    const loadRecentlyViewed = async () => {
        try {
            const saved = await AsyncStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setRecentlyViewedItems(Array.isArray(parsed) ? parsed : []);
            }
        } catch (error) {
            console.error('Error loading recently viewed:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveRecentlyViewed = async () => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(recentlyViewedItems));
        } catch (error) {
            console.error('Error saving recently viewed:', error);
        }
    };

    const addToRecentlyViewed = useCallback((product: { id: string; handle: string; title?: string; image?: string }) => {
        if (!product.id || !product.handle) return;
        
        setRecentlyViewedItems((prevItems) => {
            // Remove existing item if present
            const filtered = prevItems.filter((item) => item.handle !== product.handle);
            
            // Add to beginning
            const updated = [{ ...product }, ...filtered];
            
            // Limit to MAX_ITEMS
            return updated.slice(0, MAX_ITEMS);
        });
    }, []);

    const getRecentlyViewed = useCallback((excludeHandle?: string) => {
        if (!excludeHandle) {
            return recentlyViewedItems;
        }
        return recentlyViewedItems.filter((item) => item.handle !== excludeHandle);
    }, [recentlyViewedItems]);

    const clearRecentlyViewed = useCallback(() => {
        setRecentlyViewedItems([]);
    }, []);

    const value = useMemo(
        () => ({
            recentlyViewedItems,
            addToRecentlyViewed,
            getRecentlyViewed,
            clearRecentlyViewed,
            loading,
        }),
        [recentlyViewedItems, addToRecentlyViewed, getRecentlyViewed, clearRecentlyViewed, loading],
    );

    return <RecentlyViewedContext.Provider value={value}>{children}</RecentlyViewedContext.Provider>;
};

