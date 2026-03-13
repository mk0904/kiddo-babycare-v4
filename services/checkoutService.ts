/**
 * Checkout Service - Creates draft orders and completes checkout via backend.
 * Replaces direct Shopify Admin + Razorpay usage so changes don't require app release.
 */
import axios from 'axios';
import { configService } from './configService';

const PRODUCTION_BACKEND_URL = 'https://kiddo-service-874125225773.asia-south1.run.app/api/v1';

function getBackendBase(): string {
  const raw = configService.getRawConfig();
  const base = raw?.providers?.backend?.baseUrl || PRODUCTION_BACKEND_URL;
  return (base as string).replace(/\/+$/, '');
}

function getApiPath(path: string): string {
  const base = getBackendBase();
  const prefix = base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  return `${prefix}/${path.replace(/^\//, '')}`;
}

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
  /** Tag only: backend must create draft with all items; use only for order tagging, not for filtering line items */
  isTryAndBuy?: boolean;
  /** App version for coupon/eligibility (e.g. Constants.expoConfig?.version). */
  appVersion?: string;
  /** Device type for coupon/eligibility (e.g. 'ios' | 'android' from Platform.OS). */
  deviceType?: string;
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
  const url = getApiPath('checkout/draft');
  const payload = {
    items: body.items.map((it) => ({
      variantId: it.variantId,
      quantity: it.quantity,
      price: it.price,
      title: it.title,
      variantTitle: it.variantTitle,
      image: it.image,
      compareAtPrice: it.compareAtPrice,
      tags: it.tags ?? [],
      bookingDate: it.bookingDate ?? '',
    })),
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
        }
      : undefined,
    giftWrapping: body.giftWrapping,
    couponCode: body.couponCode ?? '',
    discountAmount: body.discountAmount ?? 0,
    deliverySchedule: body.deliverySchedule,
    deliveryType: body.deliveryType ?? (body.deliverySchedule?.date && body.deliverySchedule?.time ? 'scheduled' : 'instant'),
    paymentMethod: body.paymentMethod ?? 'cod',
    billDetails: body.billDetails,
    selectedShoe: body.selectedShoe ?? '',
    selectedShoeSize: body.selectedShoeSize ?? '',
    isTryAndBuy: body.isTryAndBuy ?? false,
    appVersion: body.appVersion ?? '',
    deviceType: body.deviceType ?? '',
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
  const url = getApiPath('checkout/complete');
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
