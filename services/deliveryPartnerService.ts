import { getBackendApiPath, getBackendBase } from './backendBase';

export interface AssignedDeliveryPartner {
  name: string | null;
  contact: string | null;
}

export interface DeliveryPartnerOrderStatus {
  shopifyOrderId: string;
  status: string;
  deliveryPartner: AssignedDeliveryPartner;
  /** Optional live rider position from GET delivery-status (when WebSocket is unused). */
  rider_lat?: number | string | null;
  rider_lng?: number | string | null;
  riderLatitude?: number | string | null;
  riderLongitude?: number | string | null;
}

export type DeliveryTrackingMessage =
  | {
      type: 'location';
      lat?: number | string;
      lng?: number | string;
      latitude?: number | string;
      longitude?: number | string;
      timestamp?: string | number;
      riderOnline?: boolean;
    }
  | {
      type: 'rider_online';
      lat?: number | string | null;
      lng?: number | string | null;
      latitude?: number | string | null;
      longitude?: number | string | null;
      timestamp?: string | number | null;
    }
  | { type: 'rider_offline' }
  | { type: 'order_delivered' }
  | { type: 'rider_assigned'; riderId?: string };

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function numCoord(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Accept lat/lng from WS whether backend sends numbers, strings, or latitude/longitude keys. */
export function parseTrackingCoordinates(message: {
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}): { latitude: number; longitude: number } | null {
  const latRaw =
    message.latitude != null && message.latitude !== ''
      ? message.latitude
      : message.lat != null && message.lat !== ''
        ? message.lat
        : null;
  const lngRaw =
    message.longitude != null && message.longitude !== ''
      ? message.longitude
      : message.lng != null && message.lng !== ''
        ? message.lng
        : null;
  let lat: number | null = null;
  let lng: number | null = null;
  if (typeof latRaw === 'number' && Number.isFinite(latRaw)) lat = latRaw;
  else if (typeof latRaw === 'string') {
    const n = parseFloat(latRaw);
    if (Number.isFinite(n)) lat = n;
  }
  if (typeof lngRaw === 'number' && Number.isFinite(lngRaw)) lng = lngRaw;
  else if (typeof lngRaw === 'string') {
    const n = parseFloat(lngRaw);
    if (Number.isFinite(n)) lng = n;
  }
  if (lat == null || lng == null) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * Find rider coordinates when the server nests them (data/payload/location) or uses alternate keys
 * (rider_lat, GeoJSON, etc.). Used so live tracking still works across backend payload shapes.
 */
export function extractLatLngDeep(value: unknown, depth = 0): { latitude: number; longitude: number } | null {
  if (depth > 8) return null;

  if (Array.isArray(value) && value.length >= 2) {
    const a = numCoord(value[0]);
    const b = numCoord(value[1]);
    if (a != null && b != null) {
      const absA = Math.abs(a);
      const absB = Math.abs(b);
      // Heuristic: India ~ lat 6–37, lng 68–97; GeoJSON is [lng, lat]
      const looksLikeGeoJSON = absA <= 180 && absB <= 90 && absA > absB;
      if (looksLikeGeoJSON) return { latitude: b, longitude: a };
      return { latitude: a, longitude: b };
    }
    for (const el of value) {
      const inner = extractLatLngDeep(el, depth + 1);
      if (inner) return inner;
    }
    return null;
  }

  if (!isPlainObject(value)) return null;

  const direct = parseTrackingCoordinates(value as Parameters<typeof parseTrackingCoordinates>[0]);
  if (direct) return direct;

  const rlat =
    numCoord(value.rider_lat) ??
    numCoord(value.riderLat) ??
    numCoord(value.delivery_lat) ??
    numCoord(value.deliveryLat);
  const rlng =
    numCoord(value.rider_lng) ??
    numCoord(value.riderLng) ??
    numCoord(value.delivery_lng) ??
    numCoord(value.deliveryLng);
  if (rlat != null && rlng != null) return { latitude: rlat, longitude: rlng };

  if (value.type === 'Point' && Array.isArray(value.coordinates)) {
    const c = value.coordinates;
    const lng = numCoord(c[0]);
    const lat = numCoord(c[1]);
    if (lat != null && lng != null) return { latitude: lat, longitude: lng };
  }

  const geom = value.geometry;
  if (isPlainObject(geom) && geom.type === 'Point' && Array.isArray(geom.coordinates)) {
    const c = geom.coordinates;
    const lng = numCoord(c[0]);
    const lat = numCoord(c[1]);
    if (lat != null && lng != null) return { latitude: lat, longitude: lng };
  }

  for (const k of [
    'data',
    'payload',
    'message',
    'location',
    'body',
    'rider',
    'position',
    'coords',
    'coordinate',
    'result',
    'content',
  ]) {
    if (value[k] !== undefined && value[k] !== null) {
      const inner = extractLatLngDeep(value[k], depth + 1);
      if (inner) return inner;
    }
  }

  return null;
}

function normalizeWsEventType(raw: unknown): string {
  if (!isPlainObject(raw)) return '';
  const t = raw.type ?? raw.event ?? raw.eventType ?? raw.action;
  return String(t ?? '')
    .trim()
    .toLowerCase();
}

function dispatchTrackingPayload(raw: unknown, handlers: DeliveryTrackingHandlers): void {
  if (raw == null) return;
  if (Array.isArray(raw)) {
    for (const item of raw) dispatchTrackingPayload(item, handlers);
    return;
  }
  if (!isPlainObject(raw)) return;

  const eventType = normalizeWsEventType(raw);

  if (
    eventType === 'rider_offline' ||
    eventType === 'order_delivered' ||
    eventType === 'rider_assigned'
  ) {
    if (eventType === 'rider_offline') handlers.onMessage({ type: 'rider_offline' });
    else if (eventType === 'order_delivered') handlers.onMessage({ type: 'order_delivered' });
    else handlers.onMessage({ type: 'rider_assigned', riderId: typeof raw.riderId === 'string' ? raw.riderId : undefined });
    return;
  }

  if (eventType === 'location' || eventType === 'rider_online' || eventType === 'rider_location') {
    handlers.onMessage(raw as DeliveryTrackingMessage);
    return;
  }

  const coords = extractLatLngDeep(raw);
  if (coords) {
    const ts = raw.timestamp ?? raw.ts ?? raw.time ?? raw.updated_at;
    handlers.onMessage({
      type: 'location',
      lat: coords.latitude,
      lng: coords.longitude,
      timestamp:
        typeof ts === 'string' || typeof ts === 'number' ? ts : undefined,
      riderOnline: raw.riderOnline !== false && raw.online !== false,
    });
  }
}

export type DeliveryTrackingHandlers = {
  onMessage: (message: DeliveryTrackingMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: unknown) => void;
};

function getDeliveryTrackingWsUrl(shopifyOrderId: string, accessToken?: string | null): string {
  const base = getBackendBase().replace(/\/+$/, '');
  const wsBase = base.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  const prefix = wsBase.endsWith('/api/v1') ? wsBase : `${wsBase}/api/v1`;
  const token = String(accessToken ?? '').trim();
  const qs = token ? `?access_token=${encodeURIComponent(token)}` : '';
  return `${prefix}/orders/${encodeURIComponent(shopifyOrderId)}/live-location/ws${qs}`;
}

export type DeliveryRouteCoordinate = { latitude: number; longitude: number };

export interface DeliveryRouteResponse {
  coordinates: DeliveryRouteCoordinate[];
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
  rider: DeliveryRouteCoordinate | null,
): Promise<DeliveryRouteResponse | null> {
  const oid = String(shopifyOrderId || '').trim();
  if (!oid) return null;

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
      headers: { Accept: 'application/json' },
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
  accessToken: string | null | undefined,
  handlers: DeliveryTrackingHandlers,
): () => void {
  const normalizedOrderId = String(shopifyOrderId || '').trim();
  const normalizedToken = String(accessToken || '').trim();
  if (!normalizedOrderId) {
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
      const text = String(event.data ?? '');
      if (!text.trim()) return;
      const parsed: unknown = JSON.parse(text);
      dispatchTrackingPayload(parsed, handlers);
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
