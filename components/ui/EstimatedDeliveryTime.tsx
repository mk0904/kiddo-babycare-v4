import React, { useMemo, memo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { getDeliveryEta } from '@/config/deliveryConfig';

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

  const [deliveryTime, setDeliveryTime] = useState<number | null>(null);
  const [isServiceable, setIsServiceable] = useState(true);
  const [loadingEta, setLoadingEta] = useState(false);

  // Fetch ETA from backend.
  useEffect(() => {
    if (!lat || !lon) {
      setDeliveryTime(null);
      return;
    }

    let cancelled = false;
    setLoadingEta(true);

    getDeliveryEta(lat, lon)
      .then((eta) => {
        if (!cancelled) {
          setDeliveryTime(eta?.etaMinutes ?? null);
          setIsServiceable(eta?.isServiceable ?? true);
          setLoadingEta(false);
        }
      })
      .catch((error) => {
        console.error('Error fetching delivery ETA:', error);
        if (!cancelled) {
          setDeliveryTime(null);
          setIsServiceable(true);
          setLoadingEta(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  // Show loading indicator while fetching ETA
  if (loadingEta && deliveryTime === null) {
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
  address?: { latitude?: number; longitude?: number },
  options?: { hasGiftWrap?: boolean }
) => {
  // Extract coordinates once for stable dependencies
  const lat = addressLatitude ?? address?.latitude;
  const lon = addressLongitude ?? address?.longitude;

  const [deliveryTime, setDeliveryTime] = useState<number | null>(null);
  const [isServiceable, setIsServiceable] = useState(true);
  const [loadingEta, setLoadingEta] = useState(false);

  // Fetch ETA from backend.
  useEffect(() => {
    if (!lat || !lon) {
      setDeliveryTime(null);
      setIsServiceable(true);
      setLoadingEta(false);
      return;
    }

    let cancelled = false;
    setLoadingEta(true);

    getDeliveryEta(lat, lon, { hasGiftWrap: options?.hasGiftWrap === true })
      .then((eta) => {
        if (!cancelled) {
          setDeliveryTime(eta?.etaMinutes ?? null);
          setIsServiceable(eta?.isServiceable ?? true);
          setLoadingEta(false);
        }
      })
      .catch((error) => {
        console.error('Error fetching delivery ETA:', error);
        if (!cancelled) {
          setDeliveryTime(null);
          setIsServiceable(true);
          setLoadingEta(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lon, options?.hasGiftWrap]);

  return { isServiceable, deliveryTime, loading: loadingEta && deliveryTime === null };
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
