// Coupon Service - Uses config-based discounts and Shopify API for application
import { SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_ADMIN_API_URL } from '@/config/shopify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { configService } from './configService';

// Remote config URL for fetching discounts at runtime
const REMOTE_CONFIG_URL = 'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/kiddoAppConfig.json?v=1768512538';

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
  clothingOnly?: boolean; // Only valid when cart has clothing/fashion items
  nonCombinable?: boolean; // If true, this coupon cannot be combined with other coupons
}

// Cache for remote discounts to avoid fetching on every call
let cachedRemoteDiscounts: CouponCode[] | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// Get discounts from remote config (for live updates) with fallback to local
const getConfigDiscounts = async (): Promise<CouponCode[]> => {
  try {
    // Try to fetch from remote first (for live updates)
    const now = Date.now();
    if (!cachedRemoteDiscounts || (now - lastFetchTime) > CACHE_DURATION) {
      try {
        const response = await fetch(REMOTE_CONFIG_URL);
        if (response.ok) {
          const remoteConfig = await response.json();
          const discountsConfig = remoteConfig.discounts;
          
          if (discountsConfig && discountsConfig.enabled) {
            const remoteDiscounts = (discountsConfig.codes || []).map((dc: any) => ({
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
              clothingOnly: dc.clothingOnly || false,
              nonCombinable: dc.nonCombinable || false,
            }));
            cachedRemoteDiscounts = remoteDiscounts;
            lastFetchTime = now;
            console.log('[CouponService] ✅ Loaded discounts from remote config');
            return remoteDiscounts;
          }
        }
      } catch (remoteError) {
        console.warn('[CouponService] Failed to fetch remote discounts, falling back to local:', remoteError);
      }
    } else if (cachedRemoteDiscounts) {
      // Return cached remote discounts
      return cachedRemoteDiscounts;
    }
    
    // Fallback to local config if remote fetch fails
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
      clothingOnly: dc.clothingOnly || false,
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
 * @param hasTicketing - If true, cart has ticketing items. If false, cart has no ticketing items. If undefined, unknown.
 * @param hasClothing - If true, cart has clothing items. If false, cart has no clothing items. If undefined, unknown.
 */
export const getAvailableCouponCodes = async (hasTicketing?: boolean, hasClothing?: boolean): Promise<CouponCode[]> => {
  // Use config-based discounts (now fetches from remote first)
  const allCoupons = await getConfigDiscounts();
  
  let filteredCoupons = allCoupons;
  
  // If cart has BOTH ticketing and clothing items, show both types of coupons
  if (hasTicketing === true && hasClothing === true) {
    // Show: ticketing-only coupons, clothing-only coupons, and regular coupons (non-restricted)
    filteredCoupons = filteredCoupons.filter(coupon => 
      coupon.ticketingOnly === true || 
      coupon.clothingOnly === true || 
      (!coupon.ticketingOnly && !coupon.clothingOnly)
    );
  }
  // If cart has ONLY ticketing items (no clothing)
  else if (hasTicketing === true && hasClothing === false) {
    // Show: ticketing-only coupons and regular coupons (exclude clothing-only)
    filteredCoupons = filteredCoupons.filter(coupon => 
      coupon.ticketingOnly === true || 
      (!coupon.ticketingOnly && !coupon.clothingOnly)
    );
  }
  // If cart has ONLY clothing items (no ticketing)
  else if (hasTicketing === false && hasClothing === true) {
    // Show: clothing-only coupons and regular coupons (exclude ticketing-only)
    filteredCoupons = filteredCoupons.filter(coupon => 
      coupon.clothingOnly === true || 
      (!coupon.ticketingOnly && !coupon.clothingOnly)
    );
  }
  // If cart has NEITHER ticketing nor clothing
  else if (hasTicketing === false && hasClothing === false) {
    // Show: only regular coupons (exclude both ticketing-only and clothing-only)
    filteredCoupons = filteredCoupons.filter(coupon => 
      !coupon.ticketingOnly && !coupon.clothingOnly
    );
  }
  // If we don't know the cart contents (undefined), show all coupons
  // This handles edge cases where cart state is unclear
  
  return filteredCoupons;
};

/**
 * Validate a coupon code from config
 */
export const validateCouponCode = async (code: string): Promise<CouponCode | null> => {
  try {
    const upperCode = code.toUpperCase();
    
    // Get all available coupons (fetches from remote first)
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
 * Checks actual completed orders (not cancelled) instead of just AsyncStorage
 * @param couponCode - The coupon code
 * @param userId - User ID (can be customer ID, email, or phone)
 * @returns Number of times the user has used this coupon in completed orders
 */
const getCouponUsageForUser = async (
  couponCode: string,
  userId: string | null
): Promise<number> => {
  if (!userId) return 0; // Guest users can't have usage limits tracked
  
  try {
    // Check actual completed orders instead of just AsyncStorage
    // This ensures cancelled orders don't count towards usage limit
    const { orderService } = await import('./orderService');
    const allOrders = await orderService.getAllOrders();
    
    // Filter orders that:
    // 1. Have the matching coupon code
    // 2. Are NOT cancelled
    // 3. Are completed/delivered (or at least placed and not cancelled)
    const completedOrdersWithCoupon = allOrders.filter(order => {
      const hasCoupon = order.couponCode?.toUpperCase() === couponCode.toUpperCase();
      const isNotCancelled = order.status !== 'cancelled';
      // Count orders that are placed or beyond (not cancelled)
      const isCompleted = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered'].includes(order.status);
      return hasCoupon && isNotCancelled && isCompleted;
    });
    
    const usageCount = completedOrdersWithCoupon.length;
    
    // Always prioritize actual orders over AsyncStorage
    // If we have actual orders, use that count and sync AsyncStorage
    if (usageCount > 0) {
      const storageKey = `coupon_usage_${couponCode.toUpperCase()}_${userId}`;
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          count: usageCount,
          lastUsedAt: completedOrdersWithCoupon[completedOrdersWithCoupon.length - 1]?.createdAt || new Date().toISOString(),
        })
      );
      return usageCount;
    }
    
    // If no actual orders found, check AsyncStorage but also verify it's not stale
    // If AsyncStorage has a count but no orders exist, it might be from a cancelled order
    // So we should reset it to 0
    const storageKey = `coupon_usage_${couponCode.toUpperCase()}_${userId}`;
    const data = await AsyncStorage.getItem(storageKey);
    const storageCount = data ? (JSON.parse(data).count || 0) : 0;
    
    // If AsyncStorage has a count but no actual orders, reset it
    // This handles the case where an order was cancelled/deleted
    if (storageCount > 0 && usageCount === 0) {
      // Reset AsyncStorage to match actual orders (0)
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify({
          count: 0,
          lastUsedAt: null,
        })
      );
      return 0;
    }
    
    return storageCount;
  } catch (error) {
    console.error('[CouponService] Error getting coupon usage:', error);
    // Fallback to AsyncStorage if order service fails
    try {
      const storageKey = `coupon_usage_${couponCode.toUpperCase()}_${userId}`;
      const data = await AsyncStorage.getItem(storageKey);
      if (data) {
        const usage = JSON.parse(data);
        return usage.count || 0;
      }
    } catch (fallbackError) {
      console.error('[CouponService] Fallback error:', fallbackError);
    }
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
 * Reset coupon usage for a user (useful when orders are cancelled)
 * @param couponCode - The coupon code
 * @param userId - User ID
 */
export const resetCouponUsage = async (
  couponCode: string,
  userId: string | null
): Promise<void> => {
  if (!userId) return;
  
  try {
    const storageKey = `coupon_usage_${couponCode.toUpperCase()}_${userId}`;
    await AsyncStorage.setItem(
      storageKey,
      JSON.stringify({
        count: 0,
        lastUsedAt: null,
      })
    );
    console.log(`[CouponService] Reset usage for ${couponCode} by user ${userId}`);
  } catch (error) {
    console.error('[CouponService] Error resetting coupon usage:', error);
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
  
  // For clothing-only coupons, add apparel condition
  if (coupon.clothingOnly) {
    conditions.push('Only for apparel');
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
  resetCouponUsage,
  getCouponConditionsText,
};

