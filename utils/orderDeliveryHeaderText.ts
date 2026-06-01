/**
 * Shared delivery status header line — keep in sync with order details (`app/orders/[id]/v2.tsx` consumer).
 */
import { DEFAULT_ETA_MINUTES } from '@/config/deliveryConfig';
import {
  isDeliveryStatusDelivered,
  type DeliveryPartnerOrderStatus,
} from '@/services/deliveryPartnerService';

/** Backend may send these when the rider is at the drop-off (before Shopify shows delivered). */
export const ARRIVED_AT_CUSTOMER_STATUSES = new Set([
  'arrived',
  'arrived_at_location',
  'at_destination',
  'at_delivery_location',
  'rider_arrived',
  'reached_destination',
  'reached_customer',
  'reached_location',
]);

/** Rider actively en-route — live ETA, near-dropoff, WebSocket, etc. */
export const DELIVERY_ACTIVE_STATUSES = new Set([
  'rider_assigned',
  'out_for_delivery',
  'dispatched',
  'on_the_way',
  'in_transit',
  'transit',
  'picking_up',
  'picked_up',
  'delivery_started',
  'en_route',
]);

const LIVE_ETA_TERMINAL_STATUSES = new Set([
  'delivered',
  'cancelled',
  'canceled',
  'returned',
  'refunded',
]);

/**
 * Whether we may call Directions-backed live ETA and show it in the header.
 * Includes early UX states: empty key (pill shows "Placed") and explicit `placed` from DPS,
 * not only {@link DELIVERY_ACTIVE_STATUSES}.
 */
export function statusAllowsLiveDirectionsEta(statusKey: string): boolean {
  const k = String(statusKey ?? '').trim().toLowerCase();
  if (LIVE_ETA_TERMINAL_STATUSES.has(k)) return false;
  if (!k || k === 'placed') return true;
  return DELIVERY_ACTIVE_STATUSES.has(k);
}

/** Meters between two WGS84 points (haversine). */
export function distanceMetersLatLng(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

export function parsePartnerIsoToMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null;
  const t = Date.parse(String(iso));
  return Number.isFinite(t) ? t : null;
}

export function formatClockEnIN(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  return `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
}

export function formatShortDateEnIN(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function shippingAddressString(address: any): string {
  if (!address) return '';
  return [
    address.address1,
    address.address2,
    address.city,
    address.province,
    address.zip,
    address.country,
  ]
    .filter(Boolean)
    .join(', ')
    .trim();
}

export type DeliveryHeaderStatusInput = {
  order: any | null;
  paramEta?: string | null;
  deliveryPartnerStatus: DeliveryPartnerOrderStatus | null;
  liveEtaMinutes: number | null;
  riderCoords: { latitude: number; longitude: number } | null;
  destinationCoords: { latitude: number; longitude: number } | null;
};

/** Primary status line above the map / in the live tab pill — same rules as order details. */
export function computeDeliveryHeaderStatusText(input: DeliveryHeaderStatusInput): string {
  const { order, paramEta, deliveryPartnerStatus, liveEtaMinutes, riderCoords, destinationCoords } =
    input;

  const isEventOrder = deliveryPartnerStatus?.isEventOrder === true;

  const deliveryStatusKey = String(deliveryPartnerStatus?.status ?? '').trim().toLowerCase();
  const hasPartnerStatus = deliveryStatusKey.length > 0;
  const shopifyFulfilled = order?.fulfillmentStatus === 'FULFILLED';
  const partnerSaysDelivered =
    deliveryStatusKey === 'delivered' || isDeliveryStatusDelivered(deliveryPartnerStatus);
  const isDelivered = shopifyFulfilled || partnerSaysDelivered;

  if (isEventOrder && !isDelivered) {
    return '';
  }

  const staticEtaMinutes =
    Number(paramEta ?? order?.estimatedDeliveryMinutes ?? DEFAULT_ETA_MINUTES) || DEFAULT_ETA_MINUTES;

  const partnerDeliveredAtMs = parsePartnerIsoToMs(deliveryPartnerStatus?.deliveredAt);

  const isRiderNearDropoff =
    !!riderCoords &&
    !!destinationCoords &&
    DELIVERY_ACTIVE_STATUSES.has(deliveryStatusKey) &&
    distanceMetersLatLng(riderCoords, destinationCoords) <= 110;

  const canShowLiveEtaWithoutRider =
    !deliveryStatusKey || deliveryStatusKey === 'placed';
  const showLiveEtaInHeader =
    liveEtaMinutes != null &&
    !!destinationCoords &&
    statusAllowsLiveDirectionsEta(deliveryStatusKey) &&
    (!!riderCoords || canShowLiveEtaWithoutRider) &&
    !isRiderNearDropoff &&
    !ARRIVED_AT_CUSTOMER_STATUSES.has(deliveryStatusKey);

  const orderPlacedAt = order?.processedAt || order?.createdAt;
  const baseTime = orderPlacedAt ? new Date(orderPlacedAt) : new Date();
  const deliveryByDate = showLiveEtaInHeader
    ? new Date(Date.now() + Math.max(1, Math.round(liveEtaMinutes!)) * 60 * 1000)
    : new Date(baseTime.getTime() + staticEtaMinutes * 60 * 1000);
  const h = deliveryByDate.getHours();
  const m = deliveryByDate.getMinutes();
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  const timeStr = `${hour12}:${m.toString().padStart(2, '0')}${ampm}`;
  const dateStr = deliveryByDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const deliveryByTimeStr = `${timeStr}, ${dateStr}`;
  const hasArrivalTimePassed = deliveryByDate.getTime() < Date.now();

  const isRiderAtCustomer =
    !isDelivered &&
    (ARRIVED_AT_CUSTOMER_STATUSES.has(deliveryStatusKey) || isRiderNearDropoff);

  if (isDelivered) {
    if (partnerDeliveredAtMs != null) {
      const dd = new Date(partnerDeliveredAtMs);
      return `Delivered at ${formatClockEnIN(dd)}, ${formatShortDateEnIN(dd)}`;
    }
    return `Delivered by ${deliveryByTimeStr}`;
  }
  if (isRiderAtCustomer && !isDelivered) {
    return 'Your rider has arrived at your address';
  }
  if (showLiveEtaInHeader) {
    const mins = Math.max(1, Math.round(liveEtaMinutes!));
    const liveArrival = new Date(Date.now() + mins * 60 * 1000);
    return `Arriving by ${formatClockEnIN(liveArrival)}, ${formatShortDateEnIN(liveArrival)}`;
  }
  // Fallback only when delivery-partner status is unavailable; otherwise DPS status remains source of truth.
  if (hasArrivalTimePassed && !hasPartnerStatus) {
    const arrivedDateStr = deliveryByDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `Arrived at ${timeStr}, ${arrivedDateStr}`;
  }
  return `Arriving by ${deliveryByTimeStr}`;
}
