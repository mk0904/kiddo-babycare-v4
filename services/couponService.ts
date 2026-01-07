// Coupon Service - Uses Shopify Admin API for coupon code functionality
import axios from 'axios';
import { SHOPIFY_ADMIN_API_URL, SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_STORE_DOMAIN } from '@/config/shopify';

const adminClient = axios.create({
  baseURL: SHOPIFY_ADMIN_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
  },
  timeout: 15000,
});

export interface CouponCode {
  code: string;
  title?: string;
  description?: string;
  value?: string;
  valueType?: 'percentage' | 'fixed_amount';
  minimumPurchaseAmount?: string;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  usageCount?: number;
}

export interface PriceRule {
  id: string;
  title: string;
  value: string;
  valueType: 'percentage' | 'fixed_amount';
  startsAt: string;
  endsAt: string | null;
  usageLimit: number | null;
  usageCount: number;
  customerSelection: string;
  minimumPurchaseAmount: string | null;
  discountCodes: CouponCode[];
}

/**
 * Fetch all available discount codes from Shopify Admin API
 */
export const getAvailableCouponCodes = async (): Promise<CouponCode[]> => {
  if (!SHOPIFY_ADMIN_ACCESS_TOKEN) {
    console.warn('[CouponService] Admin API token not configured');
    return [];
  }

  try {
    // Fetch active price rules
    const priceRulesResponse = await adminClient.get('/price_rules.json', {
      params: {
        status: 'active',
        limit: 250,
      },
    });

    const priceRules: any[] = priceRulesResponse.data?.price_rules || [];

    if (priceRules.length === 0) {
      return [];
    }

    // Fetch discount codes for each price rule
    const couponPromises = priceRules.map(async (priceRule: any) => {
      try {
        const codesResponse = await adminClient.get(`/price_rules/${priceRule.id}/discount_codes.json`);
        const discountCodes: any[] = codesResponse.data?.discount_codes || [];

        return discountCodes.map((dc: any) => ({
          code: dc.code,
          title: priceRule.title,
          description: priceRule.description || '',
          value: priceRule.value,
          valueType: priceRule.value_type === 'percentage' ? 'percentage' : 'fixed_amount',
          minimumPurchaseAmount: priceRule.minimum_subtotal_amount || null,
          startsAt: priceRule.starts_at,
          endsAt: priceRule.ends_at,
          usageLimit: priceRule.usage_limit,
          usageCount: priceRule.usage_count || 0,
        }));
      } catch (error) {
        console.error(`[CouponService] Error fetching codes for price rule ${priceRule.id}:`, error);
        return [];
      }
    });

    const couponArrays = await Promise.all(couponPromises);
    const allCoupons = couponArrays.flat();

    // Filter out expired coupons
    const now = new Date().toISOString();
    const validCoupons = allCoupons.filter((coupon) => {
      if (coupon.endsAt && coupon.endsAt < now) {
        return false;
      }
      if (coupon.startsAt && coupon.startsAt > now) {
        return false;
      }
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return false;
      }
      return true;
    });

    return validCoupons;
  } catch (error: any) {
    console.error('[CouponService] Error fetching coupon codes:', error);
    if (error.response) {
      console.error('[CouponService] Response status:', error.response.status);
      console.error('[CouponService] Response data:', error.response.data);
    }
    return [];
  }
};

/**
 * Validate a coupon code using Admin API
 * Since Admin API doesn't support searching by code directly, we fetch all coupons and search locally
 */
export const validateCouponCode = async (code: string): Promise<CouponCode | null> => {
  if (!SHOPIFY_ADMIN_ACCESS_TOKEN) {
    console.warn('[CouponService] Admin API token not configured');
    return null;
  }

  try {
    const upperCode = code.toUpperCase();
    
    // Fetch all available coupons and search for the matching code
    const allCoupons = await getAvailableCouponCodes();
    
    // Find the coupon with matching code
    const matchingCoupon = allCoupons.find(coupon => coupon.code?.toUpperCase() === upperCode);
    
    if (matchingCoupon) {
      return matchingCoupon;
    }

    // If not found in available coupons, try fetching from price rules directly
    // This handles cases where the coupon might exist but wasn't in the initial fetch
    try {
      const priceRulesResponse = await adminClient.get('/price_rules.json', {
        params: {
          status: 'active',
          limit: 250,
        },
      });

      const priceRules: any[] = priceRulesResponse.data?.price_rules || [];

      // Search through all price rules for the discount code
      for (const priceRule of priceRules) {
        try {
          const codesResponse = await adminClient.get(`/price_rules/${priceRule.id}/discount_codes.json`);
          const discountCodes: any[] = codesResponse.data?.discount_codes || [];

          const matchingCode = discountCodes.find((dc: any) => dc.code?.toUpperCase() === upperCode);
          
          if (matchingCode) {
            // Check if price rule is active
            if (priceRule.status !== 'active') {
              return null;
            }

            // Check dates
            const now = new Date().toISOString();
            if (priceRule.ends_at && priceRule.ends_at < now) {
              return null;
            }
            if (priceRule.starts_at && priceRule.starts_at > now) {
              return null;
            }

            // Check usage limit
            if (priceRule.usage_limit && priceRule.usage_count >= priceRule.usage_limit) {
              return null;
            }

            return {
              code: matchingCode.code,
              title: priceRule.title,
              description: priceRule.description || '',
              value: priceRule.value,
              valueType: priceRule.value_type === 'percentage' ? 'percentage' : 'fixed_amount',
              minimumPurchaseAmount: priceRule.minimum_subtotal_amount || null,
              startsAt: priceRule.starts_at,
              endsAt: priceRule.ends_at,
              usageLimit: priceRule.usage_limit,
              usageCount: priceRule.usage_count || 0,
            };
          }
        } catch (error) {
          // Continue searching other price rules
          continue;
        }
      }
    } catch (error) {
      console.error('[CouponService] Error searching price rules:', error);
    }

    return null;
  } catch (error: any) {
    console.error('[CouponService] Error validating coupon code:', error);
    if (error.response) {
      console.error('[CouponService] Response status:', error.response.status);
      console.error('[CouponService] Response data:', error.response.data);
    }
    return null;
  }
};

export const couponService = {
  getAvailableCouponCodes,
  validateCouponCode,
};

