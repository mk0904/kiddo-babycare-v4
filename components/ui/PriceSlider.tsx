import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, LayoutChangeEvent } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  useDerivedValue,
} from 'react-native-reanimated';
import { Colors, Fonts } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMB_SIZE = 28;

interface PriceSliderProps {
  min: number;
  max: number;
  value?: { min: number; max: number };
  onValueChange: (value: { min: number; max: number }) => void;
  step?: number;
}

export const PriceSlider: React.FC<PriceSliderProps> = ({
  min,
  max,
  value,
  onValueChange,
  step = 100,
}) => {
  const [sliderWidth, setSliderWidth] = useState(SCREEN_WIDTH - 200); // Default fallback
  
  // Use local state for real-time label updates
  const [displayMin, setDisplayMin] = useState(value?.min ?? min);
  const [displayMax, setDisplayMax] = useState(value?.max ?? max);

  // Shared values for high-performance slider movement
  const minPos = useSharedValue(0);
  const maxPos = useSharedValue(sliderWidth);
  
  const startMinPos = useSharedValue(0);
  const startMaxPos = useSharedValue(0);

  // Update shared values when props or sliderWidth change
  useEffect(() => {
    const nextMin = value?.min ?? min;
    const nextMax = value?.max ?? max;
    setDisplayMin(nextMin);
    setDisplayMax(nextMax);
    
    const range = max - min || 1;
    minPos.value = ((nextMin - min) / range) * sliderWidth;
    maxPos.value = ((nextMax - min) / range) * sliderWidth;
  }, [value, min, max, sliderWidth]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setSliderWidth(width);
    }
  };

  const updateLabels = (pos: number, isMin: boolean) => {
    const range = max - min || 1;
    const val = min + (pos / sliderWidth) * range;
    const rounded = Math.round(val / step) * step;
    if (isMin) {
      setDisplayMin(rounded);
    } else {
      setDisplayMax(rounded);
    }
  };

  const handleApply = (finalMinPos: number, finalMaxPos: number) => {
    const range = max - min || 1;
    const realMin = min + (finalMinPos / sliderWidth) * range;
    const realMax = min + (finalMaxPos / sliderWidth) * range;
    
    onValueChange({
      min: Math.round(realMin / step) * step,
      max: Math.round(realMax / step) * step,
    });
  };

  const minGesture = Gesture.Pan()
    .onBegin(() => {
      startMinPos.value = minPos.value;
    })
    .onUpdate((event) => {
      let nextPos = startMinPos.value + event.translationX;
      // Boundaries: 0 to maxPos (leave space for thumb)
      if (nextPos < 0) nextPos = 0;
      if (nextPos > maxPos.value - 20) nextPos = maxPos.value - 20;
      minPos.value = nextPos;
      runOnJS(updateLabels)(nextPos, true);
    })
    .onEnd(() => {
      runOnJS(handleApply)(minPos.value, maxPos.value);
    });

  const maxGesture = Gesture.Pan()
    .onBegin(() => {
      startMaxPos.value = maxPos.value;
    })
    .onUpdate((event) => {
      let nextPos = startMaxPos.value + event.translationX;
      // Boundaries: minPos to sliderWidth
      if (nextPos > sliderWidth) nextPos = sliderWidth;
      if (nextPos < minPos.value + 20) nextPos = minPos.value + 20;
      maxPos.value = nextPos;
      runOnJS(updateLabels)(nextPos, false);
    })
    .onEnd(() => {
      runOnJS(handleApply)(minPos.value, maxPos.value);
    });

  const minThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: minPos.value - THUMB_SIZE / 2 }],
  }));

  const maxThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: maxPos.value - THUMB_SIZE / 2 }],
  }));

  const railStyle = useAnimatedStyle(() => ({
    left: minPos.value,
    width: Math.max(0, maxPos.value - minPos.value),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.priceLabels}>
        <View style={styles.labelBox}>
          <Text style={styles.labelTitle}>Min Price</Text>
          <Text style={styles.labelValue}>₹{Math.round(displayMin)}</Text>
        </View>
        <View style={styles.labelBox}>
          <Text style={styles.labelTitle}>Max Price</Text>
          <Text style={styles.labelValue}>₹{Math.round(displayMax)}</Text>
        </View>
      </View>

      <View style={styles.sliderRoot} onLayout={onLayout}>
        <View style={styles.railContainer}>
          <View style={styles.fullRail} />
          <Animated.View style={[styles.activeRail, railStyle]} />
        </View>

        <GestureDetector gesture={minGesture}>
          <Animated.View style={[styles.thumb, minThumbStyle]}>
            <View style={styles.thumbDot} />
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={maxGesture}>
          <Animated.View style={[styles.thumb, maxThumbStyle]}>
            <View style={styles.thumbDot} />
          </Animated.View>
        </GestureDetector>
      </View>
      
      <View style={styles.rangeIndicators}>
        <Text style={styles.rangeText}>₹{min}</Text>
        <Text style={styles.rangeText}>₹{max}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 24,
    paddingHorizontal: 12,
    width: '100%',
  },
  priceLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  labelBox: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 90,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignItems: 'center',
  },
  labelTitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: Fonts.Medium,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  labelValue: {
    fontSize: 15,
    color: Colors.text,
    fontFamily: Fonts.Bold,
  },
  sliderRoot: {
    height: THUMB_SIZE,
    width: '100%',
    justifyContent: 'center',
    position: 'relative',
  },
  railContainer: {
    height: 6,
    width: '100%',
    backgroundColor: '#E9ECEF',
    borderRadius: 3,
    position: 'relative',
  },
  fullRail: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E9ECEF',
    borderRadius: 3,
  },
  activeRail: {
    position: 'absolute',
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    // Elevation for Android
    elevation: 4,
  },
  thumbDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  rangeIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  rangeText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Fonts.Regular,
  }
});
