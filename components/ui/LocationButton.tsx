import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface LocationButtonProps {
  address?: string | null;
  textColor?: string;
  onPress?: () => void;
}

export function LocationButton({
  address,
  textColor = Colors.text,
  onPress,
}: LocationButtonProps) {
  const locationButtonScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(locationButtonScale, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 400,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(locationButtonScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 400,
      friction: 8,
    }).start();
  };

  return (
    <TouchableOpacity
      style={styles.locationRow}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          transform: [{ scale: locationButtonScale }],
        }}
      >
        {address ? (
          <>
            <Ionicons
              name="location"
              size={14}
              color={textColor}
              style={styles.locationIcon}
            />
            <Text
              style={[styles.locationText, { color: textColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {address}
            </Text>
          </>
        ) : (
          <>
            <Ionicons
              name="add-circle-outline"
              size={14}
              color={textColor}
              style={styles.locationIcon}
            />
            <Text style={[styles.addAddressText, { color: textColor }]}>
              Add Address
            </Text>
          </>
        )}
        <Ionicons
          name="chevron-down"
          size={14}
          color={textColor}
          style={styles.locationChevron}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    maxWidth: '85%',
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    fontSize: 12,
    color: Colors.text,
    marginRight: 2,
    fontWeight: '700',
  },
  addAddressText: {
    fontSize: 12,
    color: Colors.primary,
    marginRight: 2,
    fontWeight: '600',
  },
  locationChevron: {
    marginTop: 1,
    marginLeft: 0,
  },
});

