// Delivery Configuration
// Calculate delivery time based on distance: 2 mins per km + 5 mins

export const GOOGLE_MAP_API = 'PLACEHOLDER_GOOGLE_MAPS_KEY';
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
export const estimateDeliveryTime = (distanceKm: number): number => {
  const travelTime = distanceKm * 2; // 2 mins per km
  const totalTime = Math.ceil(PACKING_TIME + travelTime);
  return totalTime;
};

// Check if location is within delivery range (max 60 mins)
export const isWithinDeliveryRange = (latitude: number, longitude: number) => {
  if (!latitude || !longitude) {
    return {
      isDeliverable: false,
      distance: 0,
      estimatedTime: 0,
    };
  }

  const distance = calculateDistance(
    DARK_STORE_LOCATION.latitude,
    DARK_STORE_LOCATION.longitude,
    latitude,
    longitude
  );

  const estimatedTime = estimateDeliveryTime(distance);

  return {
    isDeliverable: estimatedTime <= 60, // Max 60 mins
    distance: distance,
    estimatedTime: estimatedTime,
  };
};

// Get delivery time using Google Maps Distance Matrix API (two-wheelers mode)
export const getDeliveryTimeFromGoogleMaps = async (
  latitude: number,
  longitude: number
): Promise<number | null> => {
  try {
    const origin = `${DARK_STORE_LOCATION.latitude},${DARK_STORE_LOCATION.longitude}`;
    const destination = `${latitude},${longitude}`;

    // Use two-wheelers mode for delivery
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=driving&key=${GOOGLE_MAP_API}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.rows[0] && data.rows[0].elements[0].status === 'OK') {
      const duration = data.rows[0].elements[0].duration.value; // Duration in seconds
      const travelTimeMinutes = Math.ceil(duration / 60);
      const totalMinutes = Math.ceil(PACKING_TIME + travelTimeMinutes);
      return totalMinutes;
    }
    return null;
  } catch (error) {
    console.error('Error fetching delivery time from Google Maps:', error);
    return null;
  }
};

// Geocode address to get coordinates
export const geocodeAddress = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAP_API}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    }
    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
};
