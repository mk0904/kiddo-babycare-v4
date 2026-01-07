import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import { Alert } from 'react-native';

interface WishlistContextType {
    wishlistItems: any[];
    addToWishlist: (product: any) => void;
    removeFromWishlist: (productId: string) => void;
    isInWishlist: (productId: string) => boolean;
    toggleWishlist: (product: any) => void;
    clearWishlist: () => void;
    getWishlistCount: () => number;
    loading: boolean;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

export const useWishlist = () => {
    const context = useContext(WishlistContext);
    if (!context) {
        throw new Error('useWishlist must be used within WishlistProvider');
    }
    return context;
};

export const WishlistProvider = ({ children }: { children: React.ReactNode }) => {
    const [wishlistItems, setWishlistItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { isAuthenticated, user } = useAuth();
    const router = useRouter();

    // Ref to store debounce timeout
    const saveWishlistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const isGuest = !isAuthenticated || user?.isGuest === true;

    useEffect(() => {
        loadWishlist();
    }, []);

    useEffect(() => {
        // Debounce wishlist saves to prevent excessive AsyncStorage writes
        if (saveWishlistTimeoutRef.current) {
            clearTimeout(saveWishlistTimeoutRef.current);
        }

        saveWishlistTimeoutRef.current = setTimeout(() => {
            saveWishlist();
        }, 500) as unknown as NodeJS.Timeout; // 500ms debounce delay

        return () => {
            if (saveWishlistTimeoutRef.current) {
                clearTimeout(saveWishlistTimeoutRef.current);
            }
        };
    }, [wishlistItems]);

    const loadWishlist = async () => {
        try {
            const savedWishlist = await AsyncStorage.getItem('wishlist');
            if (savedWishlist) {
                setWishlistItems(JSON.parse(savedWishlist));
            }
        } catch (error) {
            console.error('Error loading wishlist:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveWishlist = async () => {
        try {
            await AsyncStorage.setItem('wishlist', JSON.stringify(wishlistItems));
        } catch (error) {
            console.error('Error saving wishlist:', error);
        }
    };

    // Memoize wishlist count to prevent unnecessary recalculations
    const wishlistCount = useMemo(() => {
        return wishlistItems.length;
    }, [wishlistItems]);

    const showLoginAlert = () => {
        Alert.alert(
            'Login Required',
            'Please login to use wishlist.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Login', onPress: () => router.push('/(auth)/login') }
            ]
        );
    };

    const addToWishlist = useCallback((product: any) => {
        if (isGuest) {
            showLoginAlert();
            return;
        }
        setWishlistItems((prevItems) => {
            // Handle both id and _id logic from kiddo
            const productId = product.id || product._id;
            const existingItem = prevItems.find((item) => (item.id || item._id) === productId);
            if (existingItem) {
                return prevItems; // Already in wishlist
            }
            return [...prevItems, product];
        });
    }, [isGuest, router]);

    const removeFromWishlist = useCallback((productId: string) => {
        setWishlistItems((prevItems) => prevItems.filter((item) => (item.id || item._id) !== productId));
    }, []);

    const isInWishlist = useCallback((productId: string) => {
        return wishlistItems.some((item) => (item.id || item._id) === productId);
    }, [wishlistItems]);

    const toggleWishlist = useCallback((product: any) => {
        if (isGuest) {
            showLoginAlert();
            return;
        }
        const productId = product.id || product._id;
        if (isInWishlist(productId)) {
            removeFromWishlist(productId);
        } else {
            addToWishlist(product);
        }
    }, [isGuest, isInWishlist, removeFromWishlist, addToWishlist]);

    const clearWishlist = useCallback(() => {
        setWishlistItems([]);
    }, []);

    const getWishlistCount = useCallback(() => {
        return wishlistCount;
    }, [wishlistCount]);

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo(
        () => ({
            wishlistItems,
            addToWishlist,
            removeFromWishlist,
            isInWishlist,
            toggleWishlist,
            clearWishlist,
            getWishlistCount,
            loading,
        }),
        [
            wishlistItems,
            addToWishlist,
            removeFromWishlist,
            isInWishlist,
            toggleWishlist,
            clearWishlist,
            getWishlistCount,
            loading,
        ],
    );

    return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};
