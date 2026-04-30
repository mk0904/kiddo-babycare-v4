/**
 * Checkout Service - Creates draft orders and completes checkout via backend.
 * Replaces direct Shopify Admin + Razorpay usage so changes don't require app release.
 */
import axios from 'axios';
import { Platform } from 'react-native';
import { getBackendApiPath } from './backendBase';

/** Bill breakdown for backend to persist on Shopify order. */
export interface CheckoutBillDetails {
  subtotal: number;
  subtotalAfterDiscount: number;
  deliveryFee: number;
  giftWrappingFee: number;
  discount: number;
  total: number;
  currencyCode: string;
}

// Mirrors backend CheckoutDraftRequest
export interface CheckoutDraftRequest {
  items: Array<{
    variantId: string;
    quantity: number;
    price: number;
    title?: string;
    variantTitle?: string;
    image?: string;
    compareAtPrice?: number;
    tags?: string[];
    bookingDate?: string;
    /**
     * Per Shopify draft line item. Backend should map to Admin API `lineItems[].customAttributes`
     * (e.g. Try & Buy: try_buy_trial_variant_id, try_buy_trial_variant_title, try_buy_trial_option_value).
     */
    customAttributes?: Record<string, string>;
  }>;
  totalAmount: number;
  currencyCode?: string;
  email?: string;
  phone?: string;
  name?: string;
  customerId?: string;
  address?: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    /** Save as: Home/Work/Other/Events – backend sets on Shopify draft order shipping address */
    addressType?: string;
  };
  giftWrapping?: { name: string; price: number };
  couponCode?: string;
  discountAmount?: number;
  deliverySchedule?: {
    date: string;
    time: string;
    day: string;
    dateFormat: string;
    timeSlotLabel?: string;
  };
  /** 'scheduled' | 'instant' – backend stores on order for fulfillment. */
  deliveryType?: 'scheduled' | 'instant';
  /** Payment method – backend stores on Shopify order. */
  paymentMethod?: 'razorpay' | 'cod' | 'free' | 'try_and_buy';
  /** Full bill breakdown – backend can put in order note or metafields. */
  billDetails?: CheckoutBillDetails;
  selectedShoe?: string;
  /** Free shoes offer: selected size (e.g. S1, S2) – backend should store in Shopify order (note_attributes or similar) */
  selectedShoeSize?: string;
  /**
   * Free puzzle (milestone) – variant id + age label. Backends that only read `selected_shoe` / `selected_shoe_size`
   * should also accept puzzle via those same two slots: see `createDraft` payload (mirrored + explicit snake_case).
   */
  selectedPuzzleId?: string;
  selectedPuzzleAge?: string;
  /** Tag only: backend must create draft with all items; use only for order tagging, not for filtering line items */
  isTryAndBuy?: boolean;
  /** School coupon data: backend should store in Shopify order attributes. */
  schoolCouponData?: {
    childName: string;
    parentName: string;
    dob: string;
    gender: string;
  } | null;
  /** App version for coupon/eligibility. Required for checkout/draft (same as get coupon by phone). */
  appVersion: string;
  /** Device type for coupon/eligibility ('ios' | 'android'). Required for checkout/draft (same as get coupon by phone). */
  deviceType: string;
}

export interface CheckoutDraftResponse {
  draft_order_id: string;
  draft_order_name?: string;
  total: number;
  currency: string;
  razorpay_key_id?: string;
  razorpay_order_id?: string;
}

export interface CheckoutCompleteRequest {
  draft_order_id: string;
  payment_method: 'cod' | 'razorpay' | 'free' | 'try_and_buy';
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface CheckoutCompleteResponse {
  success: boolean;
  order?: {
    id: string;
    name: string;
    created_at?: string;
  };
  draft?: {
    id: string;
    name: string;
  };
}

/**
 * Create a draft order on the backend. Returns draft id, total, and Razorpay key for client SDK.
 */
export async function createDraft(body: CheckoutDraftRequest): Promise<CheckoutDraftResponse> {
  const url = getBackendApiPath('checkout/draft');
  const shoeId = (body.selectedShoe ?? '').trim();
  const shoeSize = (body.selectedShoeSize ?? '').trim();
  const puzzleId = (body.selectedPuzzleId ?? '').trim();
  const puzzleAge = (body.selectedPuzzleAge ?? '').trim();
  /** When shoes + puzzle are never both set, same two fields as shoes can carry puzzle variant + age. */
  const giftSlotId = shoeId || puzzleId;
  const giftSlotDetail = shoeSize || puzzleAge;

  const payload = {
    items: body.items.map((it) => {
      const row: Record<string, unknown> = {
        variantId: it.variantId,
        quantity: it.quantity,
        price: it.price,
        title: it.title,
        variantTitle: it.variantTitle,
        image: it.image,
        compareAtPrice: it.compareAtPrice,
        tags: it.tags ?? [],
        bookingDate: it.bookingDate ?? '',
      };
      if (it.customAttributes && Object.keys(it.customAttributes).length > 0) {
        row.customAttributes = Object.entries(it.customAttributes).map(([key, value]) => ({
          key,
          value: String(value),
        }));
      }
      return row;
    }),
    totalAmount: body.totalAmount,
    currencyCode: body.currencyCode ?? 'INR',
    email: body.email ?? '',
    phone: body.phone ?? '',
    name: body.name ?? '',
    customerId: body.customerId ?? '',
    address: body.address
      ? {
          name: body.address.name,
          address: body.address.address,
          city: body.address.city,
          state: body.address.state,
          pincode: body.address.pincode,
          phone: body.address.phone,
          ...(body.address.addressType != null && body.address.addressType !== '' && { addressType: body.address.addressType }),
        }
      : undefined,
    giftWrapping: body.giftWrapping,
    couponCode: body.couponCode ?? '',
    coupon_code: body.couponCode ?? '',
    discountAmount: body.discountAmount ?? 0,
    deliverySchedule: body.deliverySchedule,
    deliveryType: body.deliveryType ?? (body.deliverySchedule?.date && body.deliverySchedule?.time ? 'scheduled' : 'instant'),
    paymentMethod: body.paymentMethod ?? 'cod',
    billDetails: body.billDetails,
    // Same two fields as free shoes: for puzzle, variant id → "shoe" slot, age label → "size" slot.
    selectedShoe: giftSlotId,
    selectedShoeSize: giftSlotDetail,
    selectedPuzzleId: puzzleId,
    selectedPuzzleAge: puzzleAge,
    /** Parity with backends that use snake_case (same as shoes). */
    selected_shoe: giftSlotId,
    selected_shoe_size: giftSlotDetail,
    /** Explicit puzzle (camel + snake) so backends don’t have to infer from coupon only. */
    selected_puzzle_id: puzzleId,
    selected_puzzle_age: puzzleAge,
    schoolCouponData: body.schoolCouponData,
    isTryAndBuy: body.isTryAndBuy ?? false,
    // Always send non-empty appVersion and deviceType (same as get coupon by phone)
    appVersion: (body.appVersion != null && String(body.appVersion).trim() !== '') ? String(body.appVersion).trim() : '0.0.0',
    deviceType: (body.deviceType != null && String(body.deviceType).trim() !== '') ? String(body.deviceType).trim() : Platform.OS,
  };
  const { data } = await axios.post<CheckoutDraftResponse>(url, payload, {
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });
  return data;
}

/**
 * Complete a draft order (verify Razorpay if needed, then complete in Shopify).
 * On 4xx/5xx, throws with the backend error message when available.
 */
export async function completeDraft(body: CheckoutCompleteRequest): Promise<CheckoutCompleteResponse> {
  const url = getBackendApiPath('checkout/complete');
  try {
    const { data } = await axios.post<CheckoutCompleteResponse>(url, body, {
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
    return data;
  } catch (err: any) {
    const msg =
      err.response?.data?.error ??
      err.response?.data?.message ??
      (typeof err.response?.data === 'string' ? err.response.data : null) ??
      err.message;
    throw new Error(msg || 'Order completion failed');
  }
}

export const checkoutService = {
  createDraft,
  completeDraft,
};
