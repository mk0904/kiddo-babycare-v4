// User Store - Zustand slice for authentication and user state
// Handles login, logout, skip/guest mode, and user profile

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Customer } from '@/services/customerService';

// Types
export interface UserProfile extends Customer {
    customerId?: string;
    accessToken?: string;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'guest' | 'unauthenticated';

interface UserState {
    // User data
    user: UserProfile | null;
    status: AuthStatus;
    isGuest: boolean;
    hasSkippedLogin: boolean;

    // Session data
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: number | null;

    // Metadata
    lastLoginAt: number | null;
    loginProvider: 'phone' | 'email' | 'google' | 'apple' | null;
}

interface UserActions {
    // Auth actions
    login: (user: UserProfile, accessToken?: string) => Promise<void>;
    logout: () => Promise<void>;
    skipLogin: () => void;

    // User profile actions
    updateProfile: (updates: Partial<UserProfile>) => void;
    setAccessToken: (token: string, expiresAt?: number) => void;

    // State helpers
    setLoading: () => void;
    reset: () => void;

    // Computed helpers
    isAuthenticated: () => boolean;
    canAccessPremiumFeatures: () => boolean;
    getCustomerId: () => string | null;
}

export type UserStore = UserState & UserActions;

const initialState: UserState = {
    user: null,
    status: 'idle',
    isGuest: false,
    hasSkippedLogin: false,
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    lastLoginAt: null,
    loginProvider: null,
};

export const useUserStore = create<UserStore>()(
    persist(
        (set, get) => ({
            ...initialState,

            // Login user
            login: async (user: UserProfile, accessToken?: string) => {
                set({
                    user,
                    status: 'authenticated',
                    isGuest: false,
                    hasSkippedLogin: false,
                    accessToken: accessToken || user.accessToken || user.customerAccessToken || null,
                    lastLoginAt: Date.now(),
                    loginProvider: 'phone', // Default to phone for OTP
                });
                console.log('[UserStore] User logged in:', user.email || user.phone);
            },

            // Logout user
            logout: async () => {
                set({
                    ...initialState,
                    status: 'unauthenticated',
                    hasSkippedLogin: false,
                });
                console.log('[UserStore] User logged out');
            },

            // Skip login (guest mode)
            skipLogin: () => {
                set({
                    user: null,
                    status: 'guest',
                    isGuest: true,
                    hasSkippedLogin: true,
                    accessToken: null,
                });
                console.log('[UserStore] Login skipped - guest mode');
            },

            // Update user profile
            updateProfile: (updates: Partial<UserProfile>) => {
                const { user } = get();
                if (user) {
                    set({
                        user: { ...user, ...updates },
                    });
                }
            },

            // Set access token
            setAccessToken: (token: string, expiresAt?: number) => {
                set({
                    accessToken: token,
                    tokenExpiresAt: expiresAt || null,
                });
            },

            // Set loading state
            setLoading: () => {
                set({ status: 'loading' });
            },

            // Reset store
            reset: () => {
                set(initialState);
            },

            // Check if authenticated (not guest, has user)
            isAuthenticated: () => {
                const { status, user } = get();
                return status === 'authenticated' && user !== null;
            },

            // Check if can access premium features (must be logged in)
            canAccessPremiumFeatures: () => {
                const { status } = get();
                return status === 'authenticated';
            },

            // Get Shopify customer ID in proper format
            getCustomerId: () => {
                const { user } = get();
                if (!user) return null;

                let customerId = user.customerId || user.id;
                if (!customerId) return null;

                customerId = String(customerId);

                // Format for Nector: shopify-{id}
                if (customerId.startsWith('shopify-')) {
                    return customerId;
                }
                if (customerId.includes('gid://shopify/Customer/')) {
                    return `shopify-${customerId.replace('gid://shopify/Customer/', '')}`;
                }
                if (/^\d+$/.test(customerId)) {
                    return `shopify-${customerId}`;
                }
                return customerId;
            },
        }),
        {
            name: 'user-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                user: state.user,
                status: state.status,
                isGuest: state.isGuest,
                hasSkippedLogin: state.hasSkippedLogin,
                accessToken: state.accessToken,
                lastLoginAt: state.lastLoginAt,
                loginProvider: state.loginProvider,
            }),
            onRehydrateStorage: () => (state) => {
                // When hydration finishes, ensure we don't get stuck in idle/loading
                if (state) {
                    if (state.status === 'idle' || state.status === 'loading') {
                        state.status = 'unauthenticated';
                    }
                }
            },
        }
    )
);

// Selectors for optimized renders
export const selectUser = (state: UserStore) => state.user;
export const selectIsAuthenticated = (state: UserStore) => state.status === 'authenticated';
export const selectIsGuest = (state: UserStore) => state.isGuest;
export const selectHasSkippedLogin = (state: UserStore) => state.hasSkippedLogin;
export const selectAuthStatus = (state: UserStore) => state.status;
export const selectAccessToken = (state: UserStore) => state.accessToken;

export default useUserStore;
