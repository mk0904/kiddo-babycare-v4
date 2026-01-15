// Coupon Service - Uses config-based discounts and Shopify API for application
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
  value?: string | number;
  valueType?: 'percentage' | 'fixed_amount';
  minimumPurchaseAmount?: string;
  startsAt?: string;
  endsAt?: string;
  usageLimit?: number;
  usageCount?: number;
}

// Get discounts from config
const getConfigDiscounts = (): CouponCode[] => {
  try {
    const config = require('@/config/kiddoAppConfig.json');
    const discountsConfig = config.discounts;
    
    if (!discountsConfig || !discountsConfig.enabled) {
      return [];
    }
    
    return (discountsConfig.codes || []).map((dc: any) => ({
      code: dc.code,
      title: dc.title,
      description: dc.description,
      value: dc.value,
      valueType: dc.valueType || 'percentage',
      minimumPurchaseAmount: dc.minimumPurchaseAmount,
      startsAt: dc.startsAt,
      endsAt: dc.endsAt,
    }));
  } catch (error) {
    console.error('[CouponService] Error reading config discounts:', error);
    return [];
  }
};

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
 * Fetch all available discount codes from config
 */
export const getAvailableCouponCodes = async (): Promise<CouponCode[]> => {
  // Use config-based discounts
  return getConfigDiscounts();
};

/**
 * Validate a coupon code from config
 */
export const validateCouponCode = async (code: string): Promise<CouponCode | null> => {
  try {
    const upperCode = code.toUpperCase();
    
    // Get all available coupons from config
    const allCoupons = await getAvailableCouponCodes();
    
    // Find the coupon with matching code
    const matchingCoupon = allCoupons.find(coupon => coupon.code?.toUpperCase() === upperCode);
    
    if (matchingCoupon) {
      return matchingCoupon;
    }

    return null;
  } catch (error: any) {
    console.error('[CouponService] Error validating coupon code:', error);
    return null;
  }
};

export const couponService = {
  getAvailableCouponCodes,
  validateCouponCode,
};

