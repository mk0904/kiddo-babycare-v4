import * as Location from 'expo-location';

export type Coords = { lat: number; lng: number };

/**
 * Best-effort current coordinates for campaign geofence claim.
 * Never throws — returns null if permission denied, timeout, or error.
 */
export async function getCoordsBestEffort(timeoutMs = 4000): Promise<Coords | null> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      return null;
    }

    const last = await Location.getLastKnownPositionAsync();
    if (last?.coords) {
      return { lat: last.coords.latitude, lng: last.coords.longitude };
    }

    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!position || !('coords' in position)) {
      return null;
    }
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch (e) {
    console.warn('[location] getCoordsBestEffort failed', e);
    return null;
  }
}
