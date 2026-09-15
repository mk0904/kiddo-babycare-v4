import React, { useMemo, memo, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { getDeliveryEta, EtaRequestItem } from '@/config/deliveryConfig';
import { appConfigService } from '@/services/appConfigService';
import { resolveDeliveryServiceable } from '@/utils/deliveryServiceability';
import { useCartStore } from '@/store/cartStore';

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
  const lat = addressLatitude ?? address?.latitude;
  const lon = addressLongitude ?? address?.longitude;

  const cartItems = useCartStore((s) => s.lineItems);
  const etaRequestItems = useMemo(() => cartItems.map(item => ({
      quantity: item.quantity,
      l1: item.tags?.[0]
  })), [cartItems]);

  const [deliveryTime, setDeliveryTime] = useState<number | null>(null);
  const [isServiceable, setIsServiceable] = useState(true);
  const [loadingEta, setLoadingEta] = useState(false);
  const [appConfigRev, setAppConfigRev] = useState(0);
  useEffect(() => appConfigService.subscribe(() => setAppConfigRev((x) => x + 1)), []);

  // Fetch ETA from backend.
  useEffect(() => {
    if (!lat || !lon) {
      setDeliveryTime(null);
      return;
    }

    let cancelled = false;
    setLoadingEta(true);

    getDeliveryEta(lat, lon, { items: etaRequestItems })
      .then((eta) => {
        if (!cancelled) {
          setDeliveryTime(eta?.etaMinutes ?? null);
          const threshold = appConfigService.getServicableDistanceKm();
          setIsServiceable(resolveDeliveryServiceable(eta, threshold));
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
  }, [lat, lon, appConfigRev, JSON.stringify(etaRequestItems)]);

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
  options?: { hasGiftWrap?: boolean; items?: EtaRequestItem[] }
) => {
  const lat = addressLatitude ?? address?.latitude;
  const lon = addressLongitude ?? address?.longitude;

  const cartItems = useCartStore((s) => s.lineItems);
  const defaultEtaRequestItems = useMemo(() => cartItems.map(item => ({
      quantity: item.quantity,
      l1: item.tags?.[0]
  })), [cartItems]);

  const [deliveryTime, setDeliveryTime] = useState<number | null>(null);
  const [isServiceable, setIsServiceable] = useState(true);
  const [loadingEta, setLoadingEta] = useState(false);
  const [appConfigRev, setAppConfigRev] = useState(0);
  useEffect(() => appConfigService.subscribe(() => setAppConfigRev((x) => x + 1)), []);

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

    const finalItems = options?.items ?? defaultEtaRequestItems;

    getDeliveryEta(lat, lon, { hasGiftWrap: options?.hasGiftWrap === true, items: finalItems })
      .then((eta) => {
        if (!cancelled) {
          setDeliveryTime(eta?.etaMinutes ?? null);
          const threshold = appConfigService.getServicableDistanceKm();
          setIsServiceable(resolveDeliveryServiceable(eta, threshold));
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
  }, [lat, lon, options?.hasGiftWrap, JSON.stringify(options?.items ?? defaultEtaRequestItems), appConfigRev]);

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
