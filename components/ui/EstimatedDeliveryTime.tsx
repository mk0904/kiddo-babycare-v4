import React, { useMemo, memo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { configService } from '@/services/configService';
import { getDeliveryTimeFromGoogleMaps } from '@/config/deliveryConfig';

interface EstimatedDeliveryTimeProps {
  addressLatitude?: number;
  addressLongitude?: number;
  address?: {
    latitude?: number;
    longitude?: number;
  };
  style?: any;
  showIcon?: boolean;
}

// Get dark store location and delivery config from configService
const getDeliveryConfig = () => {
  const deliveryConfig = configService.getDeliveryConfig() || {};
  return {
    darkStoreLatitude: deliveryConfig.darkStoreLocation?.latitude || 28.540546501290788,
    darkStoreLongitude: deliveryConfig.darkStoreLocation?.longitude || 77.37018854503113,
    packingTime: deliveryConfig.packingTime || 5,
    travelTimePerKm: deliveryConfig.travelTimePerKm || 2,
    maxDeliveryTime: deliveryConfig.maxDeliveryTime || 60,
  };
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

/**
 * Calculate estimated delivery time from dark store
 * Formula: distance (km) * travelTimePerKm + packingTime
 */
const calculateDeliveryTime = (distanceKm: number): number => {
  const config = getDeliveryConfig();
  const travelTime = distanceKm * config.travelTimePerKm;
  const totalTime = Math.round(config.packingTime + travelTime);
  return totalTime;
};

const EstimatedDeliveryTimeComponent: React.FC<EstimatedDeliveryTimeProps> = ({
  addressLatitude,
  addressLongitude,
  address,
  style,
  showIcon = true,
}) => {
  // Extract coordinates once and use them as stable dependencies
  const lat = addressLatitude ?? address?.latitude;
  const lon = addressLongitude ?? address?.longitude;

  const [googleMapsTime, setGoogleMapsTime] = useState<number | null>(null);
  const [loadingGoogleMaps, setLoadingGoogleMaps] = useState(false);

  // Try to get delivery time from Google Maps API (for two-wheelers)
  useEffect(() => {
    if (!lat || !lon) {
      setGoogleMapsTime(null);
      return;
    }

    let cancelled = false;
    setLoadingGoogleMaps(true);

    getDeliveryTimeFromGoogleMaps(lat, lon)
      .then((time) => {
        if (!cancelled) {
          setGoogleMapsTime(time);
          setLoadingGoogleMaps(false);
        }
      })
      .catch((error) => {
        console.error('Error fetching Google Maps delivery time:', error);
        if (!cancelled) {
          setGoogleMapsTime(null);
          setLoadingGoogleMaps(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  // Calculate delivery time using distance-based fallback
  const { deliveryTime: fallbackTime, isServiceable: fallbackServiceable } = useMemo(() => {
    try {
      // If no address coordinates, can't calculate
      if (!lat || !lon) {
        return { deliveryTime: null, isServiceable: true };
      }

      // Get dark store location from config
      const config = getDeliveryConfig();
      const darkStoreLat = config.darkStoreLatitude;
      const darkStoreLon = config.darkStoreLongitude;

      // Calculate distance from dark store to address
      const distanceKm = calculateDistance(darkStoreLat, darkStoreLon, lat, lon);

      // Calculate delivery time
      const time = calculateDeliveryTime(distanceKm);

      // Check if serviceable (within max delivery time)
      const serviceable = time <= config.maxDeliveryTime;

      return { deliveryTime: time, isServiceable: serviceable };
    } catch (error) {
      console.error('Error calculating delivery time:', error);
      return { deliveryTime: null, isServiceable: true };
    }
  }, [lat, lon]);

  // Use Google Maps time if available, otherwise use fallback
  const deliveryTime = googleMapsTime ?? fallbackTime;
  const config = getDeliveryConfig();
  const isServiceable = deliveryTime !== null && deliveryTime <= config.maxDeliveryTime;

  // Show loading indicator while fetching from Google Maps
  if (loadingGoogleMaps && fallbackTime === null) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  // Don't show anything if we can't calculate
  if (deliveryTime === null) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {showIcon && (
        <Ionicons 
          name="time-outline" 
          size={14} 
          color={isServiceable ? Colors.textSecondary : '#EF4444'} 
        />
      )}
      <Text style={[styles.text, !isServiceable && styles.textNotServiceable]}>
        {deliveryTime} min
      </Text>
    </View>
  );
};

// Memoize the component to prevent re-renders when parent re-renders
export const EstimatedDeliveryTime = memo(EstimatedDeliveryTimeComponent, (prevProps, nextProps) => {
  // Only re-render if coordinates actually change
  const prevLat = prevProps.addressLatitude ?? prevProps.address?.latitude;
  const prevLon = prevProps.addressLongitude ?? prevProps.address?.longitude;
  const nextLat = nextProps.addressLatitude ?? nextProps.address?.latitude;
  const nextLon = nextProps.addressLongitude ?? nextProps.address?.longitude;
  
  return prevLat === nextLat && prevLon === nextLon;
});

// Export hook to get delivery status
export const useDeliveryStatus = (
  addressLatitude?: number,
  addressLongitude?: number,
  address?: { latitude?: number; longitude?: number }
) => {
  // Extract coordinates once for stable dependencies
  const lat = addressLatitude ?? address?.latitude;
  const lon = addressLongitude ?? address?.longitude;

  const [googleMapsTime, setGoogleMapsTime] = useState<number | null>(null);
  const [loadingGoogleMaps, setLoadingGoogleMaps] = useState(false);

  // Try to get delivery time from Google Maps API (for two-wheelers)
  useEffect(() => {
    if (!lat || !lon) {
      setGoogleMapsTime(null);
      setLoadingGoogleMaps(false);
      return;
    }

    let cancelled = false;
    setLoadingGoogleMaps(true);

    getDeliveryTimeFromGoogleMaps(lat, lon)
      .then((time) => {
        if (!cancelled) {
          setGoogleMapsTime(time);
          setLoadingGoogleMaps(false);
        }
      })
      .catch((error) => {
        console.error('Error fetching Google Maps delivery time:', error);
        if (!cancelled) {
          setGoogleMapsTime(null);
          setLoadingGoogleMaps(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  // Calculate delivery time using distance-based fallback
  const { deliveryTime: fallbackTime, isServiceable: fallbackServiceable } = useMemo(() => {
    try {
      if (!lat || !lon) {
        return { deliveryTime: null, isServiceable: true };
      }

      const config = getDeliveryConfig();
      const darkStoreLat = config.darkStoreLatitude;
      const darkStoreLon = config.darkStoreLongitude;

      const distanceKm = calculateDistance(darkStoreLat, darkStoreLon, lat, lon);
      const time = calculateDeliveryTime(distanceKm);
      const serviceable = time <= config.maxDeliveryTime;

      return { deliveryTime: time, isServiceable: serviceable };
    } catch (error) {
      console.error('Error calculating delivery status:', error);
      return { deliveryTime: null, isServiceable: true };
    }
  }, [lat, lon]); // Only depend on coordinate values, not object references

  // Use Google Maps time if available, otherwise use fallback
  const deliveryTime = googleMapsTime ?? fallbackTime;
  const config = getDeliveryConfig();
  const isServiceable = deliveryTime !== null && deliveryTime <= config.maxDeliveryTime;

  return { isServiceable, deliveryTime, loading: loadingGoogleMaps && fallbackTime === null };
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontFamily: Fonts.Medium,
    color: Colors.textSecondary,
  },
  textNotServiceable: {
    color: '#EF4444',
  },
});
