import {
  calculateDistance,
  DARK_STORE_LOCATION,
  type EtaResponse,
} from '@/config/deliveryConfig';

/** Keys kiddo-service may use for straight-line or comparable km distance on POST /eta. */
const ETA_DISTANCE_KEYS = [
  'distanceKm',
  'distance_km',
  'straightLineDistanceKm',
  'straight_line_distance_km',
  'deliveryDistanceKm',
  'delivery_distance_km',
  'distanceFromStoreKm',
  'distance_from_store_km',
] as const;

function numKm(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function etaDistanceKmFromPayload(eta: EtaResponse | null | undefined): number | undefined {
  if (!eta) return undefined;
  const direct = numKm(eta.distanceKm ?? eta.distance_km);
  if (direct !== undefined) return direct;
  const rec = eta as Record<string, unknown>;
  for (const k of ETA_DISTANCE_KEYS) {
    const v = numKm(rec[k]);
    if (v !== undefined) return v;
  }
  return undefined;
}

/** When ETA omits distance fields but includes drop coordinates (usual case). */
function distanceKmFromEtaLatLng(eta: EtaResponse | null | undefined): number | undefined {
  if (!eta) return undefined;
  const lat = typeof eta.lat === 'number' ? eta.lat : Number(eta.lat);
  const lng = typeof eta.lng === 'number' ? eta.lng : Number(eta.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return calculateDistance(DARK_STORE_LOCATION.latitude, DARK_STORE_LOCATION.longitude, lat, lng);
}

function effectiveEtaDistanceKm(eta: EtaResponse | null | undefined): number | undefined {
  return etaDistanceKmFromPayload(eta) ?? distanceKmFromEtaLatLng(eta);
}

/**
 * Uses POST /eta payload + app config `servicableDistance` (km).
 * Prefers explicit distance fields from ETA; if missing, derives km from ETA `lat`/`lng` vs app dark store
 * (`DARK_STORE_LOCATION`) so the zone works before kiddo-service adds `distanceKm`.
 * If a threshold is set but distance cannot be determined, falls back to ETA `isServiceable`.
 */
export function resolveDeliveryServiceable(
  eta: EtaResponse | null | undefined,
  servicableDistanceKm: number | null | undefined
): boolean {
  const threshold =
    servicableDistanceKm != null ? Number(servicableDistanceKm) : NaN;
  const hasThreshold = Number.isFinite(threshold) && threshold > 0;
  if (hasThreshold) {
    const d = effectiveEtaDistanceKm(eta);
    if (d !== undefined) {
      return d <= threshold;
    }
  }
  return eta?.isServiceable ?? true;
}
