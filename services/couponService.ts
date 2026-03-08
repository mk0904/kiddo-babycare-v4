// Coupon Service - Backend (kiddo-service) only; no kiddoAppConfig fallback.
import { SHOPIFY_ADMIN_ACCESS_TOKEN, SHOPIFY_ADMIN_API_URL } from '@/config/shopify';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const COUPONS_API_BASE = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

/** Coupons by phone: POST {COUPONS_API_BASE}/coupons/by-phone
 *  Body: { phone, cartSubTotal, cartItemCount, hasTicketing, hasClothing }
 *  Backend looks up customer by phone in Shopify and returns eligible coupons; if not found, treats as 0 orders.
 */
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
  /** If false, coupon is hidden from UI (not in getAvailableCouponCodes); manual entry still applies it via validateCouponCode */
  isVisible?: boolean;
  /** Max discount in currency units (e.g. INR). Applied when valueType is percentage (or fixed) to cap the discount. */
  maxDiscountAmount?: number | null;
}

export interface GetEligibleCouponsParams {
  /** User phone for lookup (backend finds Shopify customer by phone). Pass null/empty for guest → 0 orders. */
  phone: string | null;
  cartSubTotal: number;
  cartItemCount: number;
  hasTicketing: boolean;
  hasClothing: boolean;
  /** Category/tag strings from cart (e.g. from line item tags) for category-specific coupons. */
  cartCategories?: string[];
  /** App version for version-gated coupons (e.g. from Constants.expoConfig?.version). */
  appVersion?: string;
  /** Device type for device-gated coupons (e.g. 'ios' | 'android' from Platform.OS). */
  deviceType?: string;
}

/**
 * Fetch eligible coupons from backend via by-phone endpoint.
 * Backend looks up customer by phone and returns eligible coupons; if not found, treats as 0 orders.
 * Returns [] when coupons is null or on error.
 */
export const getEligibleCouponsFromBackend = async (params: GetEligibleCouponsParams): Promise<CouponCode[]> => {
  const { phone, cartSubTotal, cartItemCount, hasTicketing, hasClothing, cartCategories, appVersion, deviceType } = params;

  try {
    const url = `${COUPONS_API_BASE.replace(/\/+$/, '')}/coupons/by-phone`;
    if (__DEV__) console.log('[CouponService] Fetching coupons by-phone');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const body: Record<string, unknown> = {
      phone: phone ?? '',
      cartSubTotal,
      cartItemCount,
      hasTicketing,
      hasClothing,
    };
    if (cartCategories != null && cartCategories.length > 0) body.cartCategories = cartCategories;
    if (appVersion != null && appVersion !== '') body.appVersion = appVersion;
    if (deviceType != null && deviceType !== '') body.deviceType = deviceType;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (__DEV__) {
        const errText = await response.text();
        console.warn('[CouponService] Backend coupons API error:', response.status, response.statusText, errText?.slice(0, 200));
      }
      return [];
    }

    const data = await response.json();
    const looksLikeCoupon = (c: any) => c && typeof c === 'object' && (c.code != null || c.couponCode != null || c.value != null);
    let coupons: any[] | undefined = data?.coupons ?? data?.eligibleCoupons ?? data?.couponCodes ?? data?.eligible;
    if (!Array.isArray(coupons) && data?.coupon != null) coupons = [data.coupon];
    if (!Array.isArray(coupons) && data?.data != null) {
      const d = data.data;
      coupons = Array.isArray(d) ? d : d?.coupons ?? d?.eligibleCoupons ?? d?.couponCodes ?? (d?.coupon != null ? [d.coupon] : undefined);
    }
    if (!Array.isArray(coupons) && data?.result?.coupons != null) coupons = data.result.coupons;
    if (!Array.isArray(coupons) && Array.isArray(data)) {
      if (data.length > 0 && looksLikeCoupon(data[0])) coupons = data;
    }
    if (!Array.isArray(coupons) && data != null) {
      for (const key of Object.keys(data)) {
        const v = data[key];
        if (Array.isArray(v) && v.length > 0 && looksLikeCoupon(v[0])) {
          coupons = v;
          break;
        }
      }
    }
    if (!Array.isArray(coupons)) {
      if (__DEV__) console.warn('[CouponService] Could not find coupons array in response. Top-level keys:', data ? Object.keys(data) : []);
      return [];
    }

    // Normalize coupon objects: ensure each has a `code` field (backend may use `couponCode`)
    const normalized = coupons.map((c: any) => ({
      ...c,
      code: (c.code ?? c.couponCode ?? '').toString().trim(),
    })) as CouponCode[];

    if (__DEV__) console.log('[CouponService] Loaded', normalized.length, 'eligible coupons from backend');
    return normalized;
  } catch (error: any) {
    if (__DEV__) console.warn('[CouponService] Backend unavailable:', error?.message || error);
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
 * Fetch eligible coupon codes from backend API.
 * Backend handles all eligibility logic (order history, usage limits, first order, etc.).
 * @param params - phone, cartSubTotal, cartItemCount, hasTicketing, hasClothing
 */
export const getAvailableCouponCodes = async (params?: GetEligibleCouponsParams): Promise<CouponCode[]> => {
  if (!params) return [];
  return getEligibleCouponsFromBackend(params);
};

/**
 * Fetch eligible coupon codes from backend API.
 * Same as getAvailableCouponCodes - backend returns only eligible coupons.
 */
export const getAllCouponCodes = async (params?: GetEligibleCouponsParams): Promise<CouponCode[]> => {
  if (!params) return [];
  return getEligibleCouponsFromBackend(params);
};

export interface CouponApplicability {
  applicable: boolean;
  reason?: string;
}

/**
 * Check if a coupon is applicable for display purposes.
 * Accepts optional userOrderCount and couponUsageCount for firstOrderOnly and usageLimitPerUser checks.
 */
export const getCouponApplicabilityForDisplay = (
  coupon: CouponCode,
  options: {
    hasTicketingProducts: boolean;
    hasFashionItems: boolean;
    cartSubtotal: number;
    cartItemCount?: number;
    userOrderCount?: number;
    couponUsageCount?: number;
  }
): CouponApplicability => {
  const {
    hasTicketingProducts,
    hasFashionItems,
    cartSubtotal,
    cartItemCount = 0,
    userOrderCount = 0,
    couponUsageCount = 0,
  } = options;

  if (coupon.clothingOnly && !hasFashionItems) {
    return { applicable: false, reason: 'Add a fashion item to use this offer' };
  }
  if (coupon.ticketingOnly && !hasTicketingProducts) {
    return { applicable: false, reason: 'Valid for Events, Playhouses & Petting Farms' };
  }
  if (!coupon.ticketingOnly && !coupon.clothingOnly && hasTicketingProducts && !hasFashionItems) {
    return { applicable: false, reason: 'Valid for apparel only' };
  }
  if (coupon.minimumPurchaseAmount) {
    const minAmount = typeof coupon.minimumPurchaseAmount === 'string'
      ? parseFloat(coupon.minimumPurchaseAmount)
      : coupon.minimumPurchaseAmount;
    if (!isNaN(minAmount) && minAmount > 0 && cartSubtotal < minAmount) {
      const remaining = minAmount - cartSubtotal;
      return { applicable: false, reason: `Add ₹${Math.ceil(remaining)} more` };
    }
  }
  if (coupon.minimumItemCount && cartItemCount < coupon.minimumItemCount) {
    const remaining = coupon.minimumItemCount - cartItemCount;
    return { applicable: false, reason: `Add ${remaining} more item${remaining > 1 ? 's' : ''}` };
  }
  // First order only - user has already placed orders
  if (coupon.firstOrderOnly && userOrderCount > 0) {
    return { applicable: false, reason: 'Valid for first order only' };
  }
  // Usage limit per user - already used
  if (coupon.usageLimitPerUser && couponUsageCount >= coupon.usageLimitPerUser) {
    return { applicable: false, reason: `Already used (max ${coupon.usageLimitPerUser} per user)` };
  }
  return { applicable: true };
};

/**
 * Validate a coupon code - checks if it exists in backend's eligible coupons.
 * Backend must return all eligible codes (including isVisible: false) so hidden codes
 * can be applied when user types them manually.
 * @param code - The coupon code to validate
 * @param params - Optional cart context for backend validation (phone, cartSubTotal, etc.)
 */
export const validateCouponCode = async (
  code: string,
  params?: GetEligibleCouponsParams
): Promise<CouponCode | null> => {
  try {
    const upperCode = (code ?? '').trim().toUpperCase();
    if (!upperCode) return null;

    if (!params) {
      console.warn('[CouponService] validateCouponCode called without params - cannot validate via backend');
      return null;
    }

    const eligibleCoupons = await getEligibleCouponsFromBackend(params);
    const normalize = (s: string | null | undefined) =>
      (s ?? '').toString().trim().toUpperCase().replace(/\s+/g, '');
    const upperCodeNorm = upperCode.replace(/\s+/g, '');
    const matchingCoupon = eligibleCoupons.find(
      (coupon) => normalize(coupon.code ?? (coupon as any).couponCode) === upperCodeNorm
    );

    if (!matchingCoupon && __DEV__ && eligibleCoupons.length > 0) {
      const codes = eligibleCoupons.map((c) => c.code ?? (c as any).couponCode).filter(Boolean);
      console.warn('[CouponService] Code not in eligible list. Looking for:', upperCode, '| Eligible codes:', codes);
    }
    return matchingCoupon || null;
  } catch (error: any) {
    console.error('[CouponService] Error validating coupon code:', error);
    return null;
  }
};

/**
 * Get count of distinct users who have used this coupon (for usageLimit / "limited to N users").
 * Uses order shippingAddress.phone as user identifier.
 */
const getDistinctUserCountForCoupon = async (couponCode: string): Promise<number> => {
  try {
    const { orderService } = await import('./orderService');
    const allOrders = await orderService.getAllOrders();
    const completedWithCoupon = allOrders.filter(
      (order: any) =>
        order.couponCode?.toUpperCase() === couponCode.toUpperCase() &&
        order.status !== 'cancelled' &&
        ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered'].includes(order.status)
    );
    const phones = new Set(
      completedWithCoupon
        .map((o: any) => o.shippingAddress?.phone?.trim?.())
        .filter(Boolean)
    );
    return phones.size;
  } catch (error) {
    console.error('[CouponService] Error getting distinct user count for coupon:', error);
    return 0;
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
    // 2. Belong to this user (order.userId === userId; legacy orders without userId are not counted)
    // 3. Are NOT cancelled
    // 4. Are completed/delivered (or at least placed and not cancelled)
    const completedOrdersWithCoupon = allOrders.filter((order: any) => {
      const hasCoupon = order.couponCode?.toUpperCase() === couponCode.toUpperCase();
      const belongsToUser = order.userId != null && String(order.userId).trim() === String(userId).trim();
      const isNotCancelled = order.status !== 'cancelled';
      const isCompleted = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered'].includes(order.status);
      return hasCoupon && belongsToUser && isNotCancelled && isCompleted;
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
    
    // No local orders for this user+coupon: use AsyncStorage (orders may exist only in Shopify)
    const storageKey = `coupon_usage_${couponCode.toUpperCase()}_${userId}`;
    const data = await AsyncStorage.getItem(storageKey);
    const storageCount = data ? (JSON.parse(data).count || 0) : 0;
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
 * Get coupon usage counts for multiple codes (efficient - fetches orders once).
 * Use for display applicability when showing all coupons.
 */
export const getCouponUsagesForUser = async (
  couponCodes: string[],
  userId: string | null
): Promise<Record<string, number>> => {
  const result: Record<string, number> = {};
  if (!userId || couponCodes.length === 0) return result;
  for (const code of couponCodes) {
    result[code.toUpperCase()] = await getCouponUsageForUser(code, userId);
  }
  return result;
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

    // Check total redemption limit (e.g. "limited to 3 users only")
    if (coupon.usageLimit != null && coupon.usageLimit > 0) {
      const distinctUsers = await getDistinctUserCountForCoupon(coupon.code);
      if (distinctUsers >= coupon.usageLimit) {
        return {
          isValid: false,
          error: 'This coupon has reached its redemption limit.',
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

  if (coupon.usageLimit != null && coupon.usageLimit > 0) {
    conditions.push(`Limited to ${coupon.usageLimit} user${coupon.usageLimit === 1 ? '' : 's'} only`);
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
  getEligibleCouponsFromBackend,
  getAvailableCouponCodes,
  getAllCouponCodes,
  getCouponApplicabilityForDisplay,
  getCouponUsagesForUser,
  validateCouponCode,
  validateCouponConditions,
  incrementCouponUsage,
  resetCouponUsage,
  getCouponConditionsText,
};

