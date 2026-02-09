// Coupon Service - Uses config-based discounts and Shopify API for application
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHOPIFY_ADMIN_API_URL, SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_STORE_DOMAIN } from '@/config/shopify';
import { configService } from './configService';

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
  minimumPurchaseAmount?: string | number | null;
  minimumItemCount?: number | null; // Minimum number of items required in cart
  startsAt?: string | null;
  endsAt?: string | null;
  usageLimitPerUser?: number | null; // How many times a single user can use this coupon
  usageLimit?: number; // Total usage limit (optional, for future use)
  usageCount?: number;
  firstOrderOnly?: boolean; // Only valid for first order
  ticketingOnly?: boolean; // Only valid for ticketing products (Events, Playhouses, Petting Farms)
  nonCombinable?: boolean; // If true, this coupon cannot be combined with other coupons
}

// Get discounts from config
const getConfigDiscounts = (): CouponCode[] => {
  try {
    const discountsConfig = configService.getDiscountsConfig();
    
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
      minimumItemCount: dc.minimumItemCount || null,
      startsAt: dc.startsAt,
      endsAt: dc.endsAt,
      usageLimitPerUser: dc.usageLimitPerUser || null,
      firstOrderOnly: dc.firstOrderOnly || false,
      ticketingOnly: dc.ticketingOnly || false,
      nonCombinable: dc.nonCombinable || false,
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
 * @param forTicketing - If true, only return ticketing-only coupons. If false, only return non-ticketing coupons. If undefined, return all.
 */
export const getAvailableCouponCodes = async (forTicketing?: boolean): Promise<CouponCode[]> => {
  // Use config-based discounts
  const allCoupons = getConfigDiscounts();
  
  // Filter based on ticketing requirement
  if (forTicketing === true) {
    // For ticketing products, ONLY return ticketing-only coupons
    return allCoupons.filter(coupon => coupon.ticketingOnly === true);
  } else if (forTicketing === false) {
    return allCoupons.filter(coupon => !coupon.ticketingOnly);
  }
  
  return allCoupons;
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

/**
 * Get coupon usage count for a specific user
 * @param couponCode - The coupon code
 * @param userId - User ID (can be customer ID, email, or phone)
 * @returns Number of times the user has used this coupon
 */
const getCouponUsageForUser = async (
  couponCode: string,
  userId: string | null
): Promise<number> => {
  if (!userId) return 0; // Guest users can't have usage limits tracked
  
  try {
    const storageKey = `coupon_usage_${couponCode.toUpperCase()}_${userId}`;
    const data = await AsyncStorage.getItem(storageKey);
    if (data) {
      const usage = JSON.parse(data);
      return usage.count || 0;
    }
    return 0;
  } catch (error) {
    console.error('[CouponService] Error getting coupon usage:', error);
    return 0;
  }
};

/**
 * Increment coupon usage count for a user (called after successful order)
 * @param couponCode - The coupon code
 * @param userId - User ID
 */
export const incrementCouponUsage = async (
  couponCode: string,
  userId: string | null
): Promise<void> => {
  if (!userId) return; // Don't track for guest users
  
  try {
    const storageKey = `coupon_usage_${couponCode.toUpperCase()}_${userId}`;
    const currentUsage = await getCouponUsageForUser(couponCode, userId);
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        count: currentUsage + 1,
        lastUsedAt: new Date().toISOString(),
      })
    );
    console.log(`[CouponService] Incremented usage for ${couponCode} by user ${userId}`);
  } catch (error) {
    console.error('[CouponService] Error incrementing coupon usage:', error);
  }
};

/**
 * Validate coupon code conditions (minimum purchase, dates, usage limits, etc.)
 * @param coupon - The coupon code to validate
 * @param cartSubtotal - Current cart subtotal
 * @param userId - User ID for checking usage limits (optional)
 * @param cartItemCount - Number of items in cart (for minimumItemCount validation)
 * @returns Object with isValid flag and error message if invalid
 */
export const validateCouponConditions = async (
  coupon: CouponCode,
  cartSubtotal: number,
  userId?: string | null,
  cartItemCount?: number,
  userOrderCount?: number
): Promise<{ isValid: boolean; error?: string }> => {
  try {
    // Check if coupon is active (date range)
    const now = new Date();
    
    if (coupon.startsAt) {
      const startDate = new Date(coupon.startsAt);
      if (now < startDate) {
        return {
          isValid: false,
          error: `This coupon code is not valid yet. It starts on ${startDate.toLocaleDateString()}.`,
        };
      }
    }
    
    if (coupon.endsAt) {
      const endDate = new Date(coupon.endsAt);
      // Set end date to end of day
      endDate.setHours(23, 59, 59, 999);
      if (now > endDate) {
        return {
          isValid: false,
          error: `This coupon code has expired. It was valid until ${endDate.toLocaleDateString()}.`,
        };
      }
    }
    
    // Check minimum purchase amount
    if (coupon.minimumPurchaseAmount) {
      const minAmount = typeof coupon.minimumPurchaseAmount === 'string' 
        ? parseFloat(coupon.minimumPurchaseAmount)
        : coupon.minimumPurchaseAmount;
      if (!isNaN(minAmount) && minAmount > 0) {
        if (cartSubtotal < minAmount) {
          const remaining = minAmount - cartSubtotal;
          return {
            isValid: false,
            error: `This coupon requires a minimum purchase of ₹${minAmount.toFixed(0)}. Add ₹${remaining.toFixed(0)} more to your cart.`,
          };
        }
      }
    }
    
    // Check minimum item count
    if (coupon.minimumItemCount && cartItemCount !== undefined) {
      const minItems = typeof coupon.minimumItemCount === 'number' ? coupon.minimumItemCount : parseInt(String(coupon.minimumItemCount));
      if (!isNaN(minItems) && minItems > 0) {
        if (cartItemCount < minItems) {
          const remaining = minItems - cartItemCount;
          return {
            isValid: false,
            error: `This coupon requires at least ${minItems} item${minItems > 1 ? 's' : ''} in your cart. Add ${remaining} more item${remaining > 1 ? 's' : ''}.`,
          };
        }
      }
    }
    
    // Check usage limit per user
    if (coupon.usageLimitPerUser && userId) {
      const userUsage = await getCouponUsageForUser(coupon.code, userId);
      if (userUsage >= coupon.usageLimitPerUser) {
        return {
          isValid: false,
          error: `You have already used this coupon code ${coupon.usageLimitPerUser} time${coupon.usageLimitPerUser > 1 ? 's' : ''}. This coupon can only be used ${coupon.usageLimitPerUser} time${coupon.usageLimitPerUser > 1 ? 's' : ''} per user.`,
        };
      }
    }
    
    // Check first order only
    if (coupon.firstOrderOnly) {
      if (userOrderCount === undefined || userOrderCount === null) {
        // If order count not provided, try to get from user store
        try {
          const { useUserStore } = await import('@/store/userStore');
          const userStore = useUserStore.getState();
          const orderCount = userStore.user?.numberOfOrders || 0;
          if (orderCount > 0) {
            return {
              isValid: false,
              error: 'This coupon code is only valid for your first order.',
            };
          }
        } catch (error) {
          console.error('[CouponService] Error checking user order count:', error);
        }
      } else if (userOrderCount > 0) {
        return {
          isValid: false,
          error: 'This coupon code is only valid for your first order.',
        };
      }
    }
    
    return { isValid: true };
  } catch (error: any) {
    console.error('[CouponService] Error validating coupon conditions:', error);
    return {
      isValid: false,
      error: 'Unable to validate coupon conditions. Please try again.',
    };
  }
};

/**
 * Get human-readable conditions text for a coupon
 * @param coupon - The coupon code
 * @returns Array of condition strings to display
 */
export const getCouponConditionsText = (coupon: CouponCode): string[] => {
  const conditions: string[] = [];
  
  // For ticketing coupons, show only essential condition
  if (coupon.ticketingOnly) {
    conditions.push('Valid for Events, Playhouses & Petting Farms');
    return conditions; // Return early for ticketing coupons
  }
  
  // For regular coupons, show essential conditions
  if (coupon.minimumPurchaseAmount) {
    const minAmount = typeof coupon.minimumPurchaseAmount === 'string' 
      ? parseFloat(coupon.minimumPurchaseAmount)
      : coupon.minimumPurchaseAmount;
    if (!isNaN(minAmount) && minAmount > 0) {
      conditions.push(`Min. purchase: ₹${minAmount.toFixed(0)}`);
    }
  }
  
  if (coupon.usageLimitPerUser) {
    if (coupon.usageLimitPerUser === 1) {
      conditions.push('One-time use per user');
    } else {
      conditions.push(`Max ${coupon.usageLimitPerUser} uses per user`);
    }
  }
  
  if (coupon.firstOrderOnly) {
    conditions.push('Valid for first order only');
  }
  
  if (coupon.endsAt) {
    const endDate = new Date(coupon.endsAt);
    conditions.push(`Valid until ${endDate.toLocaleDateString()}`);
  }
  
  return conditions;
};

export const couponService = {
  getAvailableCouponCodes,
  validateCouponCode,
  validateCouponConditions,
  incrementCouponUsage,
  getCouponConditionsText,
};

