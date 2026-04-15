import { getBackendApiPath, getBackendBase } from './backendBase';

export interface AssignedDeliveryPartner {
  name: string | null;
  contact: string | null;
}

/**
 * Per Try & Buy line item after delivery (recorded in delivery-partner-service, exposed on GET delivery-status).
 * Keys in the map should be Shopify LineItem id: numeric string or full `gid://shopify/LineItem/…`.
 *
 * Wire payloads may send `storePackingRecord.tryBuyVariants[]` with `isCustomerSelected` and `sizeLabel`;
 * the client maps that to `finalSizeLabel` / `returnedAll`.
 */
export interface DeliveryPartnerTryBuyPostDeliveryLine {
  /** Size/variant label to show as what the customer kept (original or try size). */
  finalSizeLabel?: string | null;
  /** Customer returned both items for this Try & Buy line — hide Try & Buy UI; omit size if nothing kept. */
  returnedAll?: boolean | null;
  /** Product thumbnail from delivery-partner packing payload when Storefront omits variant image. */
  imageUrl?: string | null;
  /** True when `items[].isTryAndBuy` from delivery-status (resolution can apply without Shopify trial attr). */
  isTryAndBuyLine?: boolean | null;
}

export type DeliveryPartnerTryBuyPostDeliveryMap = Record<string, DeliveryPartnerTryBuyPostDeliveryLine>;

export interface DeliveryPartnerOrderStatus {
  shopifyOrderId: string;
  status: string;
  /**
   * Event / non–last-mile fulfilment: hide map, rider/partner UI, and “Arriving by” ETA on order summary.
   * Backend may send `isEventsOrder` (typo); we normalize to this field.
   */
  isEventOrder?: boolean;
  deliveryPartner: AssignedDeliveryPartner;
  /** Optional live rider position from GET delivery-status (when WebSocket is unused). */
  rider_lat?: number | string | null;
  rider_lng?: number | string | null;
  riderLatitude?: number | string | null;
  riderLongitude?: number | string | null;
  /** ISO 8601 milestones from delivery-partner-service (via kiddo-service). */
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  /**
   * Normalized map for Try & Buy outcomes + thumbnails. Built from `tryBuyPostDelivery`,
   * and merged with the **`items`** array from GET delivery-status (kiddo-service forwards this
   * from delivery-partner). Same row keys: line `id`, `shopifyVariantId`, `imageUrl`, packing outcomes.
   */
  tryBuyPostDelivery?: DeliveryPartnerTryBuyPostDeliveryMap | null;
  /** Raw `items` from delivery-status when the backend includes it (also folded into `tryBuyPostDelivery`). */
  items?: unknown;
  /**
   * Flat Try & Buy unit rows (`orderLineItemId`, `sku`, `riderDecision`, `sizeLabel`, …) —
   * folded into `tryBuyPostDelivery` with **riderDecision: keep** winning for post-delivery size.
   */
  tryBuyLines?: unknown;
}

export function isDeliveryStatusDelivered(st: DeliveryPartnerOrderStatus | null | undefined): boolean {
  if (!st) return false;
  const s = String(st.status ?? '').trim().toLowerCase();
  if (s === 'delivered') return true;
  if (st.deliveredAt != null && String(st.deliveredAt).trim() !== '') return true;
  return false;
}

export type LiveTabBannerPhase = 'packing' | 'tracking' | 'delivered';

const TAB_BANNER_TERMINAL_HIDE = new Set([
  'cancelled',
  'canceled',
  'returned',
  'return_requested',
  'refunded',
]);

/**
 * At or after `out_for_delivery` — tab pill uses {@link computeDeliveryHeaderStatusText} like order details.
 * `rider_assigned` and earlier stay on the "getting packed" pill.
 */
const TAB_BANNER_FROM_OUT_FOR_DELIVERY = new Set([
  'out_for_delivery',
  'dispatched',
  'on_the_way',
  'in_transit',
  'transit',
  'picking_up',
  'picked_up',
  'delivery_started',
  'en_route',
  'arrived',
  'arrived_at_location',
  'at_destination',
  'at_delivery_location',
  'rider_arrived',
  'reached_destination',
  'reached_customer',
  'reached_location',
]);

export function riderCoordsFromDeliveryStatus(
  st: DeliveryPartnerOrderStatus | null | undefined,
): { latitude: number; longitude: number } | null {
  if (!st) return null;
  const latRaw = st.rider_lat ?? st.riderLatitude;
  const lngRaw = st.rider_lng ?? st.riderLongitude;
  const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw ?? ''));
  const lng = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw ?? ''));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * Latest-order tab pill only: pre-`out_for_delivery` → packing; from OFD until delivered → tracking; delivered → delivered.
 */
export function liveTabBannerPhaseFromPartnerStatus(
  st: DeliveryPartnerOrderStatus | null | undefined,
): LiveTabBannerPhase | null {
  if (!st) return null;
  const s = String(st.status ?? '').trim().toLowerCase();
  if (TAB_BANNER_TERMINAL_HIDE.has(s)) return null;
  if (isDeliveryStatusDelivered(st) || s === 'completed') return 'delivered';
  if (!s) return 'packing';
  if (TAB_BANNER_FROM_OUT_FOR_DELIVERY.has(s)) return 'tracking';
  return 'packing';
}

/** True when DPS sent a real outcome (kept size and/or returned both), not an empty stub. */
export function hasTryBuyPostDeliveryResolution(
  line: DeliveryPartnerTryBuyPostDeliveryLine | null | undefined,
): boolean {
  if (!line) return false;
  if (line.returnedAll === true) return true;
  const label = line.finalSizeLabel != null ? String(line.finalSizeLabel).trim() : '';
  return label !== '';
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function isTruthyFlag(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function normalizeTryBuyPostDeliveryLineRecord(rec: Record<string, unknown>): DeliveryPartnerTryBuyPostDeliveryLine {
  const labelRaw = rec.finalSizeLabel ?? rec.final_size_label;
  const returnedRaw = rec.returnedAll ?? rec.returned_all;
  const hasExplicitLabel = labelRaw != null && String(labelRaw).trim() !== '';
  const explicitReturned =
    returnedRaw === true || returnedRaw === 'true' || returnedRaw === 1 || returnedRaw === '1';

  let line: DeliveryPartnerTryBuyPostDeliveryLine;

  if (hasExplicitLabel || explicitReturned) {
    line = {
      finalSizeLabel: hasExplicitLabel ? String(labelRaw).trim() : null,
      returnedAll: explicitReturned,
    };
  } else {
    /** DPS stores outcomes on each try variant; rider marks exactly one as customer-selected. */
    const packing = rec.storePackingRecord ?? rec.store_packing_record;
    const variantsRaw =
      rec.tryBuyVariants ??
      rec.try_buy_variants ??
      (isPlainObject(packing) ? (packing as Record<string, unknown>).tryBuyVariants : undefined) ??
      (isPlainObject(packing) ? (packing as Record<string, unknown>).try_buy_variants : undefined);

    if (!Array.isArray(variantsRaw) || variantsRaw.length === 0) {
      line = { finalSizeLabel: null, returnedAll: false };
    } else {
      const selected = variantsRaw.find((x) => {
        if (!x || typeof x !== 'object') return false;
        const o = x as Record<string, unknown>;
        const flag =
          o.isCustomerSelected ??
          o.is_customer_selected ??
          o.isCustomerSelect ??
          o.is_customer_select;
        return isTruthyFlag(flag);
      }) as Record<string, unknown> | undefined;

      if (selected) {
        const sl = selected.sizeLabel ?? selected.size_label;
        const label = sl != null && String(sl).trim() !== '' ? String(sl).trim() : null;
        line = { finalSizeLabel: label, returnedAll: false };
      } else {
        line = { finalSizeLabel: null, returnedAll: true };
      }
    }
  }

  const img = rec.imageUrl ?? rec.image_url;
  if (img != null && String(img).trim() !== '') {
    line = { ...line, imageUrl: String(img).trim() };
  }
  const isTb = rec.isTryAndBuy ?? rec.is_try_and_buy;
  if (isTruthyFlag(isTb)) {
    line = { ...line, isTryAndBuyLine: true };
  }
  return line;
}

/** Register DPS line under REST line id, Storefront variant id, and numeric aliases so order rows can match. */
function aliasTryBuyLineKeys(
  out: DeliveryPartnerTryBuyPostDeliveryMap,
  normalized: DeliveryPartnerTryBuyPostDeliveryLine,
  rec: Record<string, unknown>,
): void {
  const register = (raw: unknown) => {
    if (raw == null) return;
    const s = String(raw).trim();
    if (!s) return;
    out[s] = normalized;
    const lineM = s.match(/LineItem\/(\d+)/i);
    if (lineM?.[1]) out[lineM[1]] = normalized;
    const varM = s.match(/ProductVariant\/(\d+)/i);
    if (varM?.[1]) out[varM[1]] = normalized;
    const digits = s.replace(/\D/g, '');
    if (digits && /^\d+$/.test(digits)) out[digits] = normalized;
  };
  register(rec.id ?? rec.lineItemId ?? rec.line_item_id ?? rec.shopifyLineItemId);
  register(rec.shopifyVariantId ?? rec.shopify_variant_id);
}

/** Map Try & Buy outcome to every Storefront variant id on that line (`items` row + `tryBuyAvailableVariants`). */
function registerTryBuyOutcomeForAllLineVariantIds(
  out: DeliveryPartnerTryBuyPostDeliveryMap,
  normalized: DeliveryPartnerTryBuyPostDeliveryLine,
  itemRec: Record<string, unknown>,
): void {
  const pushVid = (vid: unknown) => {
    if (vid == null || String(vid).trim() === '') return;
    aliasTryBuyLineKeys(out, normalized, { shopifyVariantId: vid } as Record<string, unknown>);
  };
  pushVid(itemRec.shopifyVariantId ?? itemRec.shopify_variant_id);
  const avail = itemRec.tryBuyAvailableVariants ?? itemRec.try_buy_available_variants;
  if (Array.isArray(avail)) {
    for (const v of avail) {
      if (!isPlainObject(v)) continue;
      const o = v as Record<string, unknown>;
      pushVid(o.shopifyVariantId ?? o.shopify_variant_id);
    }
  }
}

/**
 * DPS `tryBuyLines[]`: group by `orderLineItemId`, pick row with **riderDecision: keep** (fallback:
 * `isCustomerSelected`), register map by line id + skus + **all variant ids** from the matching `items` row.
 */
function normalizeTryBuyLinesWire(
  raw: unknown,
  itemsHint?: unknown,
): DeliveryPartnerTryBuyPostDeliveryMap | null {
  const arr = parseDeliveryItemsField(raw);
  if (!Array.isArray(arr) || arr.length === 0) return null;

  const byLineId = new Map<string, Record<string, unknown>[]>();
  for (const el of arr) {
    if (!isPlainObject(el)) continue;
    const rec = el as Record<string, unknown>;
    const lid = rec.orderLineItemId ?? rec.order_line_item_id;
    if (lid == null || String(lid).trim() === '') continue;
    const idStr = String(lid).trim();
    if (!byLineId.has(idStr)) byLineId.set(idStr, []);
    byLineId.get(idStr)!.push(rec);
  }
  if (byLineId.size === 0) return null;

  const itemsArr = Array.isArray(itemsHint) ? itemsHint : null;

  const out: DeliveryPartnerTryBuyPostDeliveryMap = {};
  for (const [lineId, rows] of byLineId) {
    const keepRow =
      rows.find((r) => {
        const rd = r.riderDecision ?? r.rider_decision;
        return String(rd ?? '').trim().toLowerCase() === 'keep';
      }) ??
      rows.find((r) => {
        const flag =
          r.isCustomerSelected ??
          r.is_customer_selected ??
          r.isCustomerSelect ??
          r.is_customer_select;
        return isTruthyFlag(flag);
      });

    let normalized: DeliveryPartnerTryBuyPostDeliveryLine;
    if (!keepRow) {
      normalized = {
        finalSizeLabel: null,
        returnedAll: true,
        isTryAndBuyLine: true,
      };
    } else {
      const sl = keepRow.sizeLabel ?? keepRow.size_label;
      const label = sl != null && String(sl).trim() !== '' ? String(sl).trim() : null;
      normalized = {
        finalSizeLabel: label,
        returnedAll: false,
        isTryAndBuyLine: true,
      };
    }

    aliasTryBuyLineKeys(out, normalized, { id: lineId });
    for (const r of rows) {
      const sku = r.sku ?? r['SKU'];
      if (sku != null && String(sku).trim() !== '') {
        out[String(sku).trim()] = normalized;
      }
    }

    if (itemsArr) {
      for (const rawItem of itemsArr) {
        if (!isPlainObject(rawItem)) continue;
        const ir = rawItem as Record<string, unknown>;
        const iid = ir.id ?? ir.lineItemId ?? ir.line_item_id ?? ir.shopifyLineItemId;
        if (iid == null || String(iid).trim() !== String(lineId).trim()) continue;
        registerTryBuyOutcomeForAllLineVariantIds(out, normalized, ir);
        break;
      }
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeTryBuyPostDeliveryWire(raw: unknown): DeliveryPartnerTryBuyPostDeliveryMap | null {
  if (raw == null || typeof raw !== 'object') return null;

  if (Array.isArray(raw)) {
    const out: DeliveryPartnerTryBuyPostDeliveryMap = {};
    for (const el of raw) {
      if (!isPlainObject(el)) continue;
      const line = el as Record<string, unknown>;
      const idRaw = line.id ?? line.lineItemId ?? line.line_item_id ?? line.shopifyLineItemId;
      const varRaw = line.shopifyVariantId ?? line.shopify_variant_id;
      if (
        (idRaw == null || String(idRaw).trim() === '') &&
        (varRaw == null || String(varRaw).trim() === '')
      ) {
        continue;
      }
      const normalized = normalizeTryBuyPostDeliveryLineRecord(line);
      aliasTryBuyLineKeys(out, normalized, line);
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  const obj = raw as Record<string, unknown>;
  const out: DeliveryPartnerTryBuyPostDeliveryMap = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || typeof v !== 'object' || Array.isArray(v)) continue;
    const rec = v as Record<string, unknown>;
    const normalized = normalizeTryBuyPostDeliveryLineRecord(rec);
    out[k] = normalized;
    aliasTryBuyLineKeys(out, normalized, rec);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** `items` from DB is sometimes a JSON string. */
function parseDeliveryItemsField(raw: unknown): unknown {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    try {
      const p = JSON.parse(t) as unknown;
      return Array.isArray(p) ? p : null;
    } catch {
      return null;
    }
  }
  return null;
}

function mergeTryBuyPostDeliveryMaps(
  a: DeliveryPartnerTryBuyPostDeliveryMap | null,
  b: DeliveryPartnerTryBuyPostDeliveryMap | null,
): DeliveryPartnerTryBuyPostDeliveryMap | null {
  if (!a && !b) return null;
  return { ...(a ?? {}), ...(b ?? {}) };
}

function normalizeDeliveryPartnerOrderStatusPayload(data: unknown): DeliveryPartnerOrderStatus {
  if (data == null || typeof data !== 'object') {
    return data as DeliveryPartnerOrderStatus;
  }
  const o = data as Record<string, unknown>;
  /** Legacy map fields from DPS (if any). Later merges win on duplicate keys. */
  let explicit: DeliveryPartnerTryBuyPostDeliveryMap | null = null;
  explicit = mergeTryBuyPostDeliveryMaps(explicit, normalizeTryBuyPostDeliveryWire(o.tryBuyPostDelivery));
  explicit = mergeTryBuyPostDeliveryMaps(explicit, normalizeTryBuyPostDeliveryWire(o.try_buy_post_delivery));
  /** `items` from GET delivery-status — primary source for packing lines + imageUrl. */
  const itemsRaw =
    o.items ??
    o.Items ??
    o.orderItems ??
    o.order_items ??
    o.packingItems ??
    o.packing_items;
  const itemsParsed = parseDeliveryItemsField(itemsRaw);
  const fromItems = normalizeTryBuyPostDeliveryWire(itemsParsed);
  const tryBuyLinesRaw = o.tryBuyLines ?? o.try_buy_lines ?? o.tryBuyLine ?? o.try_buy_line;
  const fromTryBuyLines = normalizeTryBuyLinesWire(tryBuyLinesRaw, itemsParsed);
  const tryBuy = mergeTryBuyPostDeliveryMaps(
    mergeTryBuyPostDeliveryMaps(explicit, fromItems),
    fromTryBuyLines,
  );
  const rawEventTrue =
    o.isEventOrder === true ||
    o.isEventsOrder === true ||
    (typeof o.isEventOrder === 'string' && String(o.isEventOrder).toLowerCase() === 'true');
  const rawEventFalse =
    o.isEventOrder === false ||
    o.isEventsOrder === false ||
    (typeof o.isEventOrder === 'string' &&
      ['false', '0', 'no'].includes(String(o.isEventOrder).toLowerCase()));

  const out = {
    ...(data as DeliveryPartnerOrderStatus),
    ...(tryBuy != null ? { tryBuyPostDelivery: tryBuy } : {}),
  } as DeliveryPartnerOrderStatus;

  if (rawEventTrue) {
    out.isEventOrder = true;
  } else if (rawEventFalse) {
    out.isEventOrder = false;
  } else {
    delete (out as { isEventOrder?: boolean }).isEventOrder;
  }
  return out;
}

function expandDpsMatchKeys(lineIdKeys: string[]): Set<string> {
  const set = new Set<string>();
  for (const k of lineIdKeys) {
    const t = String(k).trim();
    if (!t) continue;
    set.add(t);
    const vm = t.match(/ProductVariant\/(\d+)/i);
    if (vm?.[1]) set.add(vm[1]);
    const lm = t.match(/LineItem\/(\d+)/i);
    if (lm?.[1]) set.add(lm[1]);
    const digits = t.replace(/\D/g, '');
    if (digits && /^\d+$/.test(digits)) set.add(digits);
  }
  return set;
}

function normalizeTitleForDpsMatch(s: string): string {
  return s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
}

function matchDeliveryItemRowByKeys(
  items: unknown[],
  want: Set<string>,
): Record<string, unknown> | null {
  for (const raw of items) {
    if (!isPlainObject(raw)) continue;
    const rec = raw as Record<string, unknown>;
    const rowCand: unknown[] = [
      rec.id,
      rec.shopifyVariantId,
      rec.shopify_variant_id,
      rec.shopifyLineItemId,
      rec.lineItemId,
      rec.line_item_id,
    ];
    for (const rk of rowCand) {
      if (rk == null) continue;
      const t = String(rk).trim();
      if (!t) continue;
      if (want.has(t)) return rec;
      const vm = t.match(/ProductVariant\/(\d+)/i);
      if (vm?.[1] && want.has(vm[1])) return rec;
      const lm = t.match(/LineItem\/(\d+)/i);
      if (lm?.[1] && want.has(lm[1])) return rec;
      const digits = t.replace(/\D/g, '');
      if (digits && want.has(digits)) return rec;
    }
  }
  return null;
}

export type ResolveTryBuyPostDeliveryFallback = {
  /** Same as Shopify line `try_buy_trial_variant_id` — matches `items[].tryBuyTrialVariantId`. */
  tryBuyTrialVariantId?: string | null;
  /** Matches `items[].title` when variant/line ids are missing (e.g. draft order shape). */
  lineTitle?: string | null;
};

/**
 * Resolve packing row for a Shopify order line: `tryBuyPostDelivery` map, then **`items`** by variant/line id,
 * then fallback: **`tryBuyTrialVariantId`** / **line title** (DPS rows align with trial id on Try & Buy orders).
 */
export function resolveTryBuyPostDeliveryLineForKeys(
  status: DeliveryPartnerOrderStatus | null | undefined,
  lineIdKeys: string[],
  fallback?: ResolveTryBuyPostDeliveryFallback,
): DeliveryPartnerTryBuyPostDeliveryLine | null {
  if (!status) return null;

  if (lineIdKeys.length > 0) {
    const map = status.tryBuyPostDelivery;
    if (map) {
      const fromMap = lineIdKeys.map((k) => map[k]).find((x) => x != null) ?? null;
      if (fromMap) return fromMap;
    }
    const itemsForKeys = status.items;
    if (Array.isArray(itemsForKeys)) {
      const want = expandDpsMatchKeys(lineIdKeys);
      const rec = matchDeliveryItemRowByKeys(itemsForKeys, want);
      if (rec) return normalizeTryBuyPostDeliveryLineRecord(rec);
    }
  }

  const items = status.items;
  if (!Array.isArray(items)) return null;

  const trial = fallback?.tryBuyTrialVariantId?.trim();
  if (trial) {
    const trialDigits = trial.replace(/\D/g, '');
    for (const raw of items) {
      if (!isPlainObject(raw)) continue;
      const rec = raw as Record<string, unknown>;
      const tid = rec.tryBuyTrialVariantId ?? rec.try_buy_trial_variant_id;
      if (tid == null) continue;
      const ts = String(tid).trim();
      if (ts === trial || (trialDigits && ts.replace(/\D/g, '') === trialDigits)) {
        return normalizeTryBuyPostDeliveryLineRecord(rec);
      }
    }
  }

  const titleNeedle = fallback?.lineTitle?.trim();
  if (titleNeedle) {
    const want = normalizeTitleForDpsMatch(titleNeedle);
    for (const raw of items) {
      if (!isPlainObject(raw)) continue;
      const rec = raw as Record<string, unknown>;
      const tit = rec.title;
      if (tit != null && normalizeTitleForDpsMatch(String(tit)) === want) {
        return normalizeTryBuyPostDeliveryLineRecord(rec);
      }
    }
  }

  return null;
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
 * @param rider  Live GPS of the rider; pass null to route from server dark-store → destination.
 * @param destination  Customer delivery coords; required for a meaningful route.
 */
export async function getDeliveryRouteForOrder(
  shopifyOrderId: string,
  rider: DeliveryRouteCoordinate | null,
  destination?: DeliveryRouteCoordinate | null,
): Promise<DeliveryRouteResponse | null> {
  const oid = String(shopifyOrderId || '').trim();
  if (!oid) return null;

  try {
    const base = getBackendApiPath(`orders/${encodeURIComponent(oid)}/delivery-route`);
    const params = new URLSearchParams();
    if (rider && Number.isFinite(rider.latitude) && Number.isFinite(rider.longitude)) {
      params.set('rider_lat', String(rider.latitude));
      params.set('rider_lng', String(rider.longitude));
    }
    if (destination && Number.isFinite(destination.latitude) && Number.isFinite(destination.longitude)) {
      params.set('dest_lat', String(destination.latitude));
      params.set('dest_lng', String(destination.longitude));
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
        try { detail = (await response.text()).slice(0, 200); } catch (_) {}
        console.warn(`[delivery-route] ${response.status} ${url}`, detail || '');
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
    const body: unknown = await response.json();
    return normalizeDeliveryPartnerOrderStatusPayload(body);
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
