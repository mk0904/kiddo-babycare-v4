import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface EstimatedTimeDisplayProps {
  estimatedTime?: number | null;
  loading?: boolean;
  textColor?: string;
}

export function EstimatedTimeDisplay({
  estimatedTime,
  loading = false,
  textColor = Colors.text,
}: EstimatedTimeDisplayProps) {
  const heartScale = useRef(new Animated.Value(1)).current;
  const heartRotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (estimatedTime !== null || loading) {
      const pulseAnimation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(heartScale, {
              toValue: 1.2,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(heartScale, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(heartRotation, {
              toValue: -0.15,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(heartRotation, {
              toValue: 0.15,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(heartRotation, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      pulseAnimation.start();

      return () => {
        pulseAnimation.stop();
      };
    }
  }, [estimatedTime, loading, heartScale, heartRotation]);

  if (estimatedTime === null && !loading) {
    return null;
  }

  const heartAnimationStyle = {
    transform: [
      { scale: heartScale },
      {
        rotate: heartRotation.interpolate({
          inputRange: [-0.15, 0.15],
          outputRange: ['-8deg', '8deg'],
        }),
      },
    ],
  };

  return (
    <View style={styles.estimatedTimeContainer}>
      <Animated.View style={heartAnimationStyle}>
        <Ionicons
          name="heart"
          size={18}
          color={textColor}
          style={styles.heartIcon}
        />
      </Animated.View>
      {loading ? (
        <Text style={[styles.estimatedTimeText, { color: textColor }]}>
          ...
        </Text>
      ) : estimatedTime !== null ? (
        <Text style={[styles.estimatedTimeText, { color: textColor }]}>
          in {estimatedTime} mins
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  estimatedTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heartIcon: {
    marginRight: 4,
  },
  estimatedTimeText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
});

