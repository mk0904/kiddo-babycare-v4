// User Store - Zustand slice for authentication and user state
// Handles login, logout, skip/guest mode, and user profile

import { AUTH_SCHEMA_VERSION } from '@/constants/versionConfig';
import { Customer } from '@/services/customerService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Types
export interface UserProfile extends Customer {
    customerId?: string;
    accessToken?: string;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'guest' | 'unauthenticated';

interface UserState {
    // Rehydration flag - true once AsyncStorage has been read (prevents false logout on cold start)
    _hasRehydrated: boolean;

    // Auth schema version for force re-login (bump in versionConfig to invalidate all sessions once)
    authSchemaVersion: number;

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

/** Raw persisted state from last rehydration (before merge). Used for force re-login check. */
let cachedRehydratedState: Record<string, unknown> | null = null;

export function getCachedRehydratedUserState(): Record<string, unknown> | null {
    return cachedRehydratedState;
}

const initialState: UserState = {
    _hasRehydrated: false,
    authSchemaVersion: AUTH_SCHEMA_VERSION,
    user: null,
    status: 'unauthenticated', // Start as unauthenticated, not idle - prevents loading loop
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
                
                // Track login success (backend → Mixpanel)
                try {
                    const { trackEvent, identifyUser } = require('@/utils/mixpanelHelpers');
                    const userId = user.id || user.customerId || user.email || user.phone;
                    identifyUser(userId, {
                        email: user.email,
                        phone: user.phone,
                        name: user.displayName || `${user.firstName} ${user.lastName}`.trim(),
                    });
                    trackEvent('Login Success', {
                        userId,
                        loginProvider: 'phone',
                        email: user.email,
                        phone: user.phone,
                    });
                } catch (e) {
                    console.warn('Analytics tracking error:', e);
                }
                // Register push subscription with backend (fire-and-forget)
                (async () => {
                    try {
                        const { oneSignalService } = require('@/services/oneSignalService');
                        const { pushRegistrationService } = require('@/services/pushRegistrationService');
                        const sub = await oneSignalService.checkSubscriptionStatus();
                        const uid = user.id || user.customerId || user.email || user.phone;
                        if (uid && sub?.id) await pushRegistrationService.registerWithBackend(uid, sub.id);
                    } catch (_) { /* ignore */ }
                })();
            },

            // Logout user
            logout: async () => {
                set({
                    ...initialState,
                    _hasRehydrated: true, // Keep true - intentional logout, don't trigger loading state
                    status: 'unauthenticated',
                    hasSkippedLogin: false,
                });
                console.log('[UserStore] User logged out');
                
                // Reset analytics identity on logout
                try {
                    const { resetUser } = require('@/utils/mixpanelHelpers');
                    resetUser();
                } catch (e) {
                    console.warn('Analytics reset error:', e);
                }
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
            storage: (() => {
                const base = createJSONStorage(() => AsyncStorage);
                return {
                    getItem: async (name: string) => {
                        const value = await base.getItem(name);
                        if (value && typeof value === 'object' && value !== null && 'state' in value) {
                            cachedRehydratedState = (value as { state: Record<string, unknown> }).state;
                        } else {
                            cachedRehydratedState = null;
                        }
                        return value;
                    },
                    setItem: base.setItem,
                    removeItem: base.removeItem,
                };
            })(),
            partialize: (state) => ({
                authSchemaVersion: state.authSchemaVersion,
                user: state.user,
                status: state.status,
                isGuest: state.isGuest,
                hasSkippedLogin: state.hasSkippedLogin,
                accessToken: state.accessToken,
                lastLoginAt: state.lastLoginAt,
                loginProvider: state.loginProvider,
            }),
            onRehydrateStorage: () => (state, err) => {
                // When hydration finishes, ensure we don't get stuck in idle/loading
                if (state) {
                    if (state.status === 'idle' || state.status === 'loading') {
                        state.status = 'unauthenticated';
                    }
                } else {
                    // If rehydration fails or returns null, ensure we're unauthenticated
                    console.warn('⚠️ AsyncStorage rehydration returned null - using default state');
                }
                // Mark rehydration complete so routing can safely use auth state
                // Use setTimeout to avoid updating during persist merge
                setTimeout(() => {
                    useUserStore.setState({ _hasRehydrated: true });
                }, 0);
            },
            // Skip rehydration if it takes too long (non-blocking)
            skipHydration: false,
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
export const selectHasRehydrated = (state: UserStore) => state._hasRehydrated;

export default useUserStore;
