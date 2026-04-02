import { getBackendApiPath, getBackendBase } from './backendBase';

export interface AssignedDeliveryPartner {
  name: string | null;
  contact: string | null;
}

export interface DeliveryPartnerOrderStatus {
  shopifyOrderId: string;
  status: string;
  deliveryPartner: AssignedDeliveryPartner;
}

export type DeliveryTrackingMessage =
  | { type: 'location'; lat?: number; lng?: number; timestamp?: string | number; riderOnline?: boolean }
  | { type: 'rider_online'; lat?: number | null; lng?: number | null; timestamp?: string | number | null }
  | { type: 'rider_offline' }
  | { type: 'order_delivered' }
  | { type: 'rider_assigned'; riderId?: string };

export type DeliveryTrackingHandlers = {
  onMessage: (message: DeliveryTrackingMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: unknown) => void;
};

function getDeliveryTrackingWsUrl(shopifyOrderId: string, accessToken: string): string {
  const base = getBackendBase().replace(/\/+$/, '');
  const wsBase = base.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  const prefix = wsBase.endsWith('/api/v1') ? wsBase : `${wsBase}/api/v1`;
  return `${prefix}/orders/${encodeURIComponent(shopifyOrderId)}/live-location/ws?access_token=${encodeURIComponent(accessToken)}`;
}

export type DeliveryRouteCoordinate = { latitude: number; longitude: number };

export interface DeliveryRouteResponse {
  coordinates: DeliveryRouteCoordinate[];
}

function numCoord(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeRouteCoordinates(raw: unknown): DeliveryRouteCoordinate[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryRouteCoordinate[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const lat = numCoord(o.latitude) ?? numCoord(o.lat);
    const lng = numCoord(o.longitude) ?? numCoord(o.lng);
    if (lat == null || lng == null) continue;
    out.push({ latitude: lat, longitude: lng });
  }
  return out;
}

/**
 * Road-snapped route from kiddo-service (Directions API on server only).
 * @param rider Live GPS; pass null to route from server dark-store → destination until live location arrives.
 */
export async function getDeliveryRouteForOrder(
  shopifyOrderId: string,
  accessToken: string,
  rider: DeliveryRouteCoordinate | null,
): Promise<DeliveryRouteResponse | null> {
  const oid = String(shopifyOrderId || '').trim();
  const token = String(accessToken || '').trim();
  if (!oid || !token) return null;

  try {
    const base = getBackendApiPath(`orders/${encodeURIComponent(oid)}/delivery-route`);
    const params = new URLSearchParams();
    if (
      rider &&
      Number.isFinite(rider.latitude) &&
      Number.isFinite(rider.longitude)
    ) {
      params.set('rider_lat', String(rider.latitude));
      params.set('rider_lng', String(rider.longitude));
    }
    const qs = params.toString();
    const sep = base.includes('?') ? '&' : '?';
    const url = qs ? `${base}${sep}${qs}` : base;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      if (__DEV__) {
        let detail = '';
        try {
          detail = (await response.text()).slice(0, 200);
        } catch (_) {}
        console.warn(
          `[delivery-route] ${response.status} ${url}`,
          detail || '',
        );
      }
      return null;
    }
    const body = (await response.json()) as { coordinates?: unknown };
    const coordinates = normalizeRouteCoordinates(body?.coordinates);
    return coordinates.length >= 2 ? { coordinates } : null;
  } catch (error) {
    console.error('Error fetching delivery route:', error);
    return null;
  }
}

export async function getDeliveryPartnerOrderStatus(
  shopifyOrderId: string,
): Promise<DeliveryPartnerOrderStatus | null> {
  const normalized = String(shopifyOrderId || '').trim();
  if (!normalized) return null;

  try {
    const response = await fetch(getBackendApiPath(`orders/${encodeURIComponent(normalized)}/delivery-status`));
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as DeliveryPartnerOrderStatus;
  } catch (error) {
    console.error('Error fetching delivery partner status:', error);
    return null;
  }
}

export function subscribeToDeliveryTracking(
  shopifyOrderId: string,
  accessToken: string,
  handlers: DeliveryTrackingHandlers,
): () => void {
  const normalizedOrderId = String(shopifyOrderId || '').trim();
  const normalizedToken = String(accessToken || '').trim();
  if (!normalizedOrderId || !normalizedToken) {
    return () => {};
  }

  const socket = new WebSocket(getDeliveryTrackingWsUrl(normalizedOrderId, normalizedToken));

  socket.onopen = () => {
    handlers.onOpen?.();
  };
  socket.onerror = (error) => {
    handlers.onError?.(error);
  };
  socket.onclose = () => {
    handlers.onClose?.();
  };
  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(String(event.data || '{}')) as DeliveryTrackingMessage;
      handlers.onMessage(parsed);
    } catch (error) {
      handlers.onError?.(error);
    }
  };

  return () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };
}
