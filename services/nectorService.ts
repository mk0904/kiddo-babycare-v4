// Nector Loyalty Service
// Ported from gauntlet libs/integrations/nector
// Implements rewards, referrals, wallet, and coin redemption

// Configuration
const NECTOR_CONFIG = {
    // Backend proxy endpoint (recommended) or direct Nector API
    baseUrl: process.env.EXPO_PUBLIC_NECTOR_API_URL || 'https://api.nector.io',
    appId: process.env.EXPO_PUBLIC_NECTOR_APP_ID || '',
    // Enable dev mode when no credentials configured
    isDevMode: !process.env.EXPO_PUBLIC_NECTOR_APP_ID,
};

// Mock data for development
const MOCK_RULES: NectorRules = {
    coin_per_unit: 0.1, // 10% of purchase as coins
    coin_value: 1,
    coin_name: 'Coins',
    currency_code: 'INR',
    minimum_cart_value: 500,
};

const MOCK_USER: NectorUser = {
    _id: 'mock_user',
    lead_id: 'mock_lead',
    email: 'test@example.com',
    name: 'Test User',
    available: 150,
    lifetime: 500,
    redeemed: 350,
    tier: 'Gold',
    referral_code: 'TESTREF123',
};

// Types
export interface NectorUser {
    _id: string;
    lead_id: string;
    email: string;
    name: string;
    phone?: string;
    available: number; // Available coins
    lifetime: number; // Lifetime earned coins
    redeemed: number; // Redeemed coins
    tier?: string;
    referral_code?: string;
}

export interface NectorRules {
    coin_per_unit: number;
    coin_value: number; // Value of 1 coin in currency
    coin_name: string;
    currency_code: string;
    minimum_cart_value?: number;
    tierAction?: {
        meta?: {
            reward_condition?: Record<string, { bonus_factor: number }>;
        };
    };
    referral_config?: {
        referrer_reward?: number;
        referee_reward?: number;
    };
}

export interface WayToEarn {
    triggerId: string;
    content: string;
    reward: number;
    isApplied: boolean;
}

export interface WayToRedeem {
    offer_id: string;
    title: string;
    description: string;
    points_required: number;
    discount_value: number;
    discount_type: 'percentage' | 'fixed';
}

export interface WalletTransaction {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    created_at: string;
}

export interface RedeemedCoupon {
    id: string;
    code: string;
    value: number;
    description: string;
    expire: string;
}

export interface Referral {
    id: string;
    referee_email: string;
    referee_name?: string;
    status: 'pending' | 'completed';
    reward?: number;
    created_at: string;
}

export interface NectorResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Nector Loyalty Service
 * Provides loyalty points, rewards, referrals, and coin redemption
 */
class NectorService {
    private static instance: NectorService;
    private rules: NectorRules | null = null;
    private rulesStatus: 'init' | 'loading' | 'idle' | 'error' = 'init';

    private constructor() { }

    static getInstance(): NectorService {
        if (!NectorService.instance) {
            NectorService.instance = new NectorService();
        }
        return NectorService.instance;
    }

    /**
     * Check if running in dev mode (no credentials)
     */
    isDevMode(): boolean {
        return NECTOR_CONFIG.isDevMode;
    }

    /**
     * Initialize and fetch Nector rules
     */
    async init(): Promise<void> {
        if (this.rulesStatus === 'loading') return;

        // Use mock data in dev mode
        if (NECTOR_CONFIG.isDevMode) {
            console.log('[NectorService] Running in dev mode - using mock data');
            this.rules = MOCK_RULES;
            this.rulesStatus = 'idle';
            return;
        }

        try {
            this.rulesStatus = 'loading';
            const response = await this.fetch('/aggregatedDetails');

            if (response.success && response.data) {
                const data = response.data;
                this.rules = {
                    coin_per_unit: data?.integrationinfos?.shopify?.meta?.rule?.prepaidpayment_reward?.coin_per_unit || 0,
                    coin_value: data?.businessinfos?.entity?.quickdeploy_meta?.cashback_value || 1,
                    coin_name: data?.businessinfos?.entity?.coin_name || 'Points',
                    currency_code: data?.businessinfos?.entity?.currency_code || 'INR',
                    minimum_cart_value: data?.actioninfos?.checkoutcheckbox_action?.meta?.offer_rule?.minimumcart?.amount,
                    tierAction: data?.actioninfos?.tier_action,
                    referral_config: data?.actioninfos?.referral_action?.meta,
                };
                this.rulesStatus = 'idle';
            } else {
                // Fallback to mock rules on error
                console.warn('[NectorService] Failed to fetch rules, using defaults');
                this.rules = MOCK_RULES;
                this.rulesStatus = 'idle';
            }
        } catch (error) {
            console.warn('[NectorService] Init error, using defaults:', error);
            this.rules = MOCK_RULES;
            this.rulesStatus = 'idle';
        }
    }

    /**
     * Get current rules
     */
    getRules(): { status: typeof this.rulesStatus; data: NectorRules | null } {
        return {
            status: this.rulesStatus,
            data: this.rules,
        };
    }

    /**
     * Get user rewards and details
     */
    async getRewards(customerAccessToken: string): Promise<NectorResponse<{ user: NectorUser; rules: NectorRules }>> {
        // Return mock data in dev mode
        if (NECTOR_CONFIG.isDevMode) {
            return {
                success: true,
                data: {
                    user: MOCK_USER,
                    rules: MOCK_RULES,
                },
            };
        }

        try {
            const [userRes, rulesRes] = await Promise.all([
                this.fetch('/customer', { customerAccessToken }),
                this.fetch('/rules'),
            ]);

            if (userRes.success && rulesRes.success) {
                return {
                    success: true,
                    data: {
                        user: userRes.data?.item,
                        rules: this.transformRules(rulesRes.data),
                    },
                };
            }

            return { success: false, error: 'Failed to fetch rewards' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get wallet transactions
     */
    async getWalletTransactions(leadId: string, page: number = 1): Promise<NectorResponse<WalletTransaction[]>> {
        try {
            const response = await this.fetch(
                `/transactions?lead_id=${leadId}&sort=created_at&sort_op=DESC&page=${page}&limit=50`
            );

            if (response.success) {
                return {
                    success: true,
                    data: response.data?.items || [],
                };
            }

            return { success: false, error: 'Failed to fetch transactions' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get referral history
     */
    async getReferralHistory(referredByLeadId: string): Promise<NectorResponse<Referral[]>> {
        try {
            const response = await this.fetch(
                `/referrals?referred_by_lead_id=${referredByLeadId}&sort=created_at&sort_op=DESC&page=1&limit=100`
            );

            if (response.success) {
                return {
                    success: true,
                    data: response.data?.items || [],
                };
            }

            return { success: false, error: 'Failed to fetch referrals' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get ways to earn and redeem
     */
    async getRewardsProgram(
        leadId: string,
        tier: string = 'default'
    ): Promise<NectorResponse<{ waysToEarn: WayToEarn[]; waysToRedeem: WayToRedeem[] }>> {
        try {
            const [earnRes, redeemRes] = await Promise.all([
                this.fetch(`/triggers?lead_id=${leadId}&sort=created_at&sort_op=DESC&page=1&limit=100`),
                this.fetch(`/aggregatedOffers?tier=${tier}`),
            ]);

            return {
                success: true,
                data: {
                    waysToEarn: this.transformWaysToEarn(earnRes.data),
                    waysToRedeem: redeemRes.data?.businessoffers?.items?.[0] || [],
                },
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Get redeemed coupons
     */
    async getRedeemedCoupons(leadId: string): Promise<NectorResponse<RedeemedCoupon[]>> {
        try {
            const response = await this.fetch(
                `/coupons?lead_id=${leadId}&sort=created_at&sort_op=DESC&page=1&limit=100`
            );

            if (response.success) {
                return {
                    success: true,
                    data: (response.data?.items || []).map((coupon: any) => ({
                        id: coupon.lead_id,
                        code: coupon.value,
                        value: coupon.value,
                        description: coupon.description,
                        expire: coupon.expire,
                    })),
                };
            }

            return { success: false, error: 'Failed to fetch coupons' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Redeem coins for discount coupon
     */
    async redeemCoins(
        leadId: string,
        offerId: string,
        points: number
    ): Promise<NectorResponse<{ couponCode: string }>> {
        try {
            const response = await this.fetch('/offerredeems', {
                method: 'POST',
                body: { offer_id: offerId, lead_id: leadId, step: points },
            });

            if (response.success && response.data?.coupon) {
                return {
                    success: true,
                    data: { couponCode: response.data.coupon.value },
                };
            }

            return { success: false, error: 'Failed to redeem coins' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Checkout coin actions (list, perform, revert)
     */
    async checkoutAction(
        customerAccessToken: string,
        action: 'list' | 'perform' | 'revert',
        leadId: string,
        cartAmount: number
    ): Promise<NectorResponse<{ discountCode?: string; coinValue?: number }>> {
        try {
            const response = await this.fetch('/checkout-action', {
                method: 'POST',
                customerAccessToken,
                body: { action, lead_id: leadId, amount: cartAmount },
            });

            if (response.success) {
                const coupon = response.data?.data?.item?.coupons?.[0];
                return {
                    success: true,
                    data: {
                        discountCode: coupon?.value,
                        coinValue: coupon?.fiat_value || coupon?.meta?.coin_spent,
                    },
                };
            }

            return { success: false, error: 'Checkout action failed' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Apply referral code
     */
    async applyReferralCode(
        name: string,
        email: string,
        referralCode: string
    ): Promise<NectorResponse<{ success: boolean }>> {
        try {
            const response = await this.fetch('/referral-code', {
                method: 'POST',
                body: { name, email, referralCode },
            });

            return {
                success: response.success,
                data: { success: response.success },
                error: response.error,
            };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Record action (for ways to earn)
     */
    async recordAction(
        customerAccessToken: string,
        triggerId: string
    ): Promise<NectorResponse<{ credited: number }>> {
        try {
            const response = await this.fetch('/record-action', {
                method: 'POST',
                customerAccessToken,
                body: { triggerId },
            });

            if (response.success) {
                return {
                    success: true,
                    data: { credited: response.data?.credited || 0 },
                };
            }

            return { success: false, error: 'Failed to record action' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Calculate coins earned for a purchase
     */
    calculateEarnings(amount: number, userTier?: string): number {
        if (!this.rules || this.rulesStatus !== 'idle') return 0;

        const baseEarnings = amount * this.rules.coin_per_unit;

        // Apply tier bonus if available
        if (userTier && this.rules.tierAction?.meta?.reward_condition?.[userTier]) {
            const bonusFactor = this.rules.tierAction.meta.reward_condition[userTier].bonus_factor || 1;
            return Math.floor(baseEarnings * bonusFactor);
        }

        return Math.floor(baseEarnings);
    }

    /**
     * Calculate coin value in currency
     */
    getCoinValue(coins: number): number {
        if (!this.rules) return 0;
        return coins * (this.rules.coin_value || 1);
    }

    // Private helper methods
    private async fetch(
        endpoint: string,
        options: {
            method?: 'GET' | 'POST' | 'PUT';
            customerAccessToken?: string;
            body?: Record<string, any>;
        } = {}
    ): Promise<NectorResponse<any>> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'x-app-id': NECTOR_CONFIG.appId,
            };

            if (options.customerAccessToken) {
                headers['X-Customer-Access-Token'] = options.customerAccessToken;
            }

            const response = await fetch(`${NECTOR_CONFIG.baseUrl}${endpoint}`, {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined,
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true, data: data.data || data };
            }

            return { success: false, error: data.message || 'Request failed' };
        } catch (error: any) {
            console.error(`[NectorService] Fetch error for ${endpoint}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    private transformRules(data: any): NectorRules {
        return {
            coin_per_unit: data?.integrationinfos?.shopify?.meta?.rule?.prepaidpayment_reward?.coin_per_unit || 0,
            coin_value: data?.businessinfos?.entity?.quickdeploy_meta?.cashback_value || 1,
            coin_name: data?.businessinfos?.entity?.coin_name || 'Points',
            currency_code: data?.businessinfos?.entity?.currency_code || 'INR',
            tierAction: data?.actioninfos?.tier_action,
            referral_config: {
                referrer_reward: data?.actioninfos?.referral_action?.meta?.referrer_reward,
                referee_reward: data?.actioninfos?.referral_action?.meta?.referee_reward,
            },
        };
    }

    private transformWaysToEarn(data: any): WayToEarn[] {
        const activities = data?.activities?.map((item: any) => item.trigger_id) || [];

        return (data?.items || []).map((item: any) => ({
            triggerId: item._id,
            content: item.content,
            reward: item.reward,
            isApplied: activities.includes(item._id),
        }));
    }
}

// Export singleton instance
export const nectorService = NectorService.getInstance();

// Export class for testing
export { NectorService };

export default nectorService;
