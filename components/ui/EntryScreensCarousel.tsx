import { Fonts } from '@/constants/theme';
import type { EntryScreenItem } from '@/types/appConfig';

import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AUTO_ADVANCE_MS = 3000;

type EntryScreensCarouselProps = {
  screens: EntryScreenItem[];
  onDone: () => void;
};

export function EntryScreensCarousel({ screens, onDone }: EntryScreensCarouselProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<EntryScreenItem> | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const total = screens.length;

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const idx = Math.max(0, Math.min(total - 1, Math.round(x / SCREEN_WIDTH)));
    setActiveIndex(idx);
  };

  const handleNext = () => {
    if (activeIndex >= total - 1) {
      onDone();
    } else {
      const next = activeIndex + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }
  };

  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (total <= 0) return;
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    autoTimerRef.current = setTimeout(() => {
      handleNext();
    }, AUTO_ADVANCE_MS);
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [activeIndex, total, onDone]);

  if (total === 0) return null;

  return (
    <View style={styles.container}>
      <View style={[styles.topDotsWrap, { top: insets.top + 14 }]}>
        <View style={styles.dotsRow}>
          {screens.map((_, idx) => (
            <View key={`dot-${idx}`} style={[styles.dot, idx === activeIndex ? styles.dotActive : null]} />
          ))}
        </View>
        <Pressable style={styles.nextButton} hitSlop={15} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Skip</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={screens}
        keyExtractor={(_, idx) => `entry-screen-${idx}`}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 100000,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topDotsWrap: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dot: {
    width: 36, // 3x current (was 7)
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
    marginHorizontal: 2,
  },
  dotActive: {
    width: 36, // 3x current (was 18)
    backgroundColor: '#F15E5E',
  },
  nextButton: {
    position: 'absolute',
    right: 16,
    top: -5,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nextButtonText: {
    fontSize: 14,
    color: '#181D27',
    fontFamily: Fonts.SemiBold,
  },
});
