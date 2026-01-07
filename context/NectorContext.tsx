// Nector Loyalty Context
// Provides loyalty points, rewards, and referral functionality throughout the app

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from 'react';
import { nectorService, NectorUser, NectorRules, WayToEarn, WayToRedeem, WalletTransaction, Referral } from '@/services/nectorService';
import { useAuth } from './AuthContext';

// Types
interface NectorState {
    user: NectorUser | null;
    rules: NectorRules | null;
    waysToEarn: WayToEarn[];
    waysToRedeem: WayToRedeem[];
    transactions: WalletTransaction[];
    referrals: Referral[];
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;
}

interface NectorContextType extends NectorState {
    // Actions
    refreshRewards: () => Promise<void>;
    refreshTransactions: () => Promise<void>;
    refreshReferrals: () => Promise<void>;
    refreshProgram: () => Promise<void>;

    // Coin operations
    redeemCoins: (offerId: string, points: number) => Promise<{ success: boolean; couponCode?: string; error?: string }>;
    applyCoinsAtCheckout: (cartAmount: number) => Promise<{ success: boolean; discountCode?: string; error?: string }>;
    revertCheckoutCoins: (cartAmount: number) => Promise<void>;

    // Referral
    applyReferralCode: (code: string) => Promise<{ success: boolean; error?: string }>;

    // Computed values
    availableCoins: number;
    lifetimeCoins: number;
    coinValue: (coins: number) => number;
    calculateEarnings: (amount: number) => number;
    coinName: string;
}

const NectorContext = createContext<NectorContextType | undefined>(undefined);

export const useNector = () => {
    const context = useContext(NectorContext);
    if (!context) {
        throw new Error('useNector must be used within a NectorProvider');
    }
    return context;
};

interface NectorProviderProps {
    children: ReactNode;
}

export const NectorProvider: React.FC<NectorProviderProps> = ({ children }) => {
    const { user: authUser, isAuthenticated, isGuest } = useAuth();

    // Get customer access token and ID from user store
    const customerAccessToken = (authUser as any)?.accessToken || null;
    const customerId = authUser ? getCustomerId(authUser) : null;

    // Helper to format customer ID for Nector
    function getCustomerId(user: any): string | null {
        if (!user) return null;
        let id = user.customerId || user.id;
        if (!id) return null;
        id = String(id);
        if (id.startsWith('shopify-')) return id;
        if (id.includes('gid://shopify/Customer/')) {
            return `shopify-${id.replace('gid://shopify/Customer/', '')}`;
        }
        if (/^\d+$/.test(id)) return `shopify-${id}`;
        return id;
    }

    const [state, setState] = useState<NectorState>({
        user: null,
        rules: null,
        waysToEarn: [],
        waysToRedeem: [],
        transactions: [],
        referrals: [],
        isLoading: false,
        isInitialized: false,
        error: null,
    });

    // Initialize Nector on mount
    useEffect(() => {
        initializeNector();
    }, []);

    // Fetch rewards when user logs in
    useEffect(() => {
        if (authUser && customerAccessToken) {
            refreshRewards();
        } else {
            // Clear user data on logout
            setState((prev) => ({
                ...prev,
                user: null,
                transactions: [],
                referrals: [],
            }));
        }
    }, [authUser, customerAccessToken]);

    const initializeNector = async () => {
        try {
            await nectorService.init();
            const { status, data } = nectorService.getRules();

            if (status === 'idle' && data) {
                setState((prev) => ({
                    ...prev,
                    rules: data,
                    isInitialized: true,
                }));
            }
        } catch (error) {
            console.error('[NectorContext] Init error:', error);
        }
    };

    const refreshRewards = useCallback(async () => {
        if (!customerAccessToken) return;

        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            const result = await nectorService.getRewards(customerAccessToken);

            if (result.success && result.data) {
                setState((prev) => ({
                    ...prev,
                    user: result.data?.user || null,
                    rules: result.data?.rules || null,
                    isLoading: false,
                }));
            } else {
                setState((prev) => ({
                    ...prev,
                    isLoading: false,
                    error: result.error || 'Failed to fetch rewards',
                }));
            }
        } catch (error: any) {
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: error.message,
            }));
        }
    }, [customerAccessToken]);

    const refreshTransactions = useCallback(async () => {
        if (!state.user?._id) return;

        try {
            const result = await nectorService.getWalletTransactions(state.user._id);
            if (result.success && result.data) {
                setState((prev) => ({ ...prev, transactions: result.data || [] }));
            }
        } catch (error) {
            console.error('[NectorContext] Transactions error:', error);
        }
    }, [state.user?._id]);

    const refreshReferrals = useCallback(async () => {
        if (!state.user?._id) return;

        try {
            const result = await nectorService.getReferralHistory(state.user._id);
            if (result.success && result.data) {
                setState((prev) => ({ ...prev, referrals: result.data || [] }));
            }
        } catch (error) {
            console.error('[NectorContext] Referrals error:', error);
        }
    }, [state.user?._id]);

    const refreshProgram = useCallback(async () => {
        if (!state.user?._id) return;

        try {
            const result = await nectorService.getRewardsProgram(
                state.user._id,
                state.user.tier || 'default'
            );
            if (result.success && result.data) {
                setState((prev) => ({
                    ...prev,
                    waysToEarn: result.data?.waysToEarn || [],
                    waysToRedeem: (result.data?.waysToRedeem as any) || [],
                }));
            }
        } catch (error) {
            console.error('[NectorContext] Program error:', error);
        }
    }, [state.user?._id, state.user?.tier]);

    const redeemCoins = useCallback(
        async (offerId: string, points: number) => {
            if (!state.user?._id) {
                return { success: false, error: 'User not logged in' };
            }

            try {
                const result = await nectorService.redeemCoins(state.user._id, offerId, points);

                if (result.success && result.data?.couponCode) {
                    // Refresh rewards after redemption
                    await refreshRewards();
                    return { success: true, couponCode: result.data.couponCode };
                }

                return { success: false, error: result.error || 'Redemption failed' };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        },
        [state.user?._id, refreshRewards]
    );

    const applyCoinsAtCheckout = useCallback(
        async (cartAmount: number) => {
            if (!customerAccessToken || !state.user?._id) {
                return { success: false, error: 'User not logged in' };
            }

            try {
                const result = await nectorService.checkoutAction(
                    customerAccessToken,
                    'perform',
                    state.user._id,
                    cartAmount
                );

                if (result.success && result.data?.discountCode) {
                    return { success: true, discountCode: result.data.discountCode };
                }

                return { success: false, error: result.error || 'Failed to apply coins' };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        },
        [customerAccessToken, state.user?._id]
    );

    const revertCheckoutCoins = useCallback(
        async (cartAmount: number) => {
            if (!customerAccessToken || !state.user?._id) return;

            try {
                await nectorService.checkoutAction(
                    customerAccessToken,
                    'revert',
                    state.user._id,
                    cartAmount
                );
            } catch (error) {
                console.error('[NectorContext] Revert coins error:', error);
            }
        },
        [customerAccessToken, state.user?._id]
    );

    const applyReferralCode = useCallback(
        async (code: string) => {
            if (!authUser?.email) {
                return { success: false, error: 'User not logged in' };
            }

            try {
                const result = await nectorService.applyReferralCode(
                    authUser.displayName || 'Customer',
                    authUser.email,
                    code
                );

                if (result.success) {
                    await refreshRewards();
                    return { success: true };
                }

                return { success: false, error: result.error || 'Invalid referral code' };
            } catch (error: any) {
                return { success: false, error: error.message };
            }
        },
        [authUser, refreshRewards]
    );

    // Computed values
    const availableCoins = state.user?.available || 0;
    const lifetimeCoins = state.user?.lifetime || 0;
    const coinName = state.rules?.coin_name || 'Points';

    const coinValue = useCallback(
        (coins: number) => nectorService.getCoinValue(coins),
        []
    );

    const calculateEarnings = useCallback(
        (amount: number) => nectorService.calculateEarnings(amount, state.user?.tier),
        [state.user?.tier]
    );

    const value: NectorContextType = {
        ...state,
        refreshRewards,
        refreshTransactions,
        refreshReferrals,
        refreshProgram,
        redeemCoins,
        applyCoinsAtCheckout,
        revertCheckoutCoins,
        applyReferralCode,
        availableCoins,
        lifetimeCoins,
        coinValue,
        calculateEarnings,
        coinName,
    };

    return (
        <NectorContext.Provider value={value}>{children}</NectorContext.Provider>
    );
};

export default NectorProvider;
