// Delivery Configuration
// Calculate delivery time based on distance: 2 mins per km + 5 mins

import { getBackendApiPath, backendFetch } from '@/services/backendBase';
export const DARK_STORE_LOCATION = {
  latitude: 28.540546501290788,
  longitude: 77.37018854503113,
};

// Packing time in minutes
export const PACKING_TIME = 5; // 5 mins for packing

// Calculate distance between two coordinates using Haversine formula
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
};

// Estimate delivery time in minutes based on distance
// Formula: (distance in km * 2 mins per km) + 5 mins packing time
// Use this formula everywhere the app shows ETA.
export const estimateDeliveryTime = (distanceKm: number): number => {
  const travelTime = distanceKm * 2; // 2 mins per km
  const totalTime = Math.ceil(PACKING_TIME + travelTime);
  return totalTime;
};

/** Default ETA (minutes) when distance/address is unknown. Used for order success and order detail when no stored ETA. */
export const DEFAULT_ETA_MINUTES = 30;

interface EtaOptions {
  hasGiftWrap?: boolean;
  originLatitude?: number;
  originLongitude?: number;
}

export interface EtaResponse {
  etaMinutes: number;
  isServiceable: boolean;
  storeTimeMin: number;
  giftWrapTimeMin?: number;
  googleTimeMin: number;
  gateToDoorMin: number;
  lat: number;
  lng: number;
  formattedAddress?: string;
  fallbackUsed: boolean;
  /** Distance in km from dark store to customer as returned by kiddo-service ETA (required for app-config radius checks). */
  distanceKm?: number;
  /** Snake_case alias if backend sends `distance_km`. */
  distance_km?: number;
  /** Configured service radius in km (when returned by kiddo-service). */
  maxServiceRadiusKm?: number;
}

async function postJSON<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await backendFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error calling backend ${path}:`, error);
    return null;
  }
}

export const getDeliveryEta = async (
  latitude: number,
  longitude: number,
  options: EtaOptions = {}
): Promise<EtaResponse | null> => {
  return postJSON<EtaResponse>('eta', {
    lat: latitude,
    lng: longitude,
    originLat: typeof options.originLatitude === 'number' ? options.originLatitude : undefined,
    originLng: typeof options.originLongitude === 'number' ? options.originLongitude : undefined,
    hasGiftWrap: options.hasGiftWrap === true,
  });
};

export const getDeliveryEtaForAddressDetails = async (
  address: string,
  options: EtaOptions = {}
): Promise<EtaResponse | null> => {
  return postJSON<EtaResponse>('eta', {
    address,
    hasGiftWrap: options.hasGiftWrap === true,
  });
};

// Get delivery time from backend ETA endpoint.
export const getDeliveryTimeFromGoogleMaps = async (
  latitude: number,
  longitude: number,
  options: EtaOptions = {}
): Promise<number | null> => {
  const data = await getDeliveryEta(latitude, longitude, options);
  return data?.etaMinutes ?? null;
};

export const getDeliveryEtaForAddress = async (
  address: string,
  options: EtaOptions = {}
): Promise<number | null> => {
  const data = await getDeliveryEtaForAddressDetails(address, options);
  return data?.etaMinutes ?? null;
};

// Geocode address to get coordinates
export const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
  const data = await postJSON<{ lat: number; lng: number }>('geocode/forward', { address });
  if (!data) return null;
  return {
    latitude: data.lat,
    longitude: data.lng,
  };
};

export interface ReverseGeocodeFullResponse {
  formattedAddress?: string;
  address1?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

/** Reverse geocode coordinates and return the full location object (city, state, area, pincode). */
export const reverseGeocodeFull = async (
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeFullResponse | null> => {
  return postJSON<ReverseGeocodeFullResponse>(
    'geocode/reverse',
    { lat: latitude, lng: longitude }
  );
};

/** Reverse geocode coordinates to a short label (locality or formatted address). */
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  const data = await reverseGeocodeFull(latitude, longitude);
  return data?.address1 || data?.city || data?.formattedAddress || null;
};
