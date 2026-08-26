import { Fonts } from '@/constants/theme';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SearchIcon } from './SearchIcon';

export interface SearchBarStyleConfig {
  backgroundColor?: string;
  borderRadius?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
  placeholder?: {
    fontSize?: number;
    color?: string;
    letterSpacing?: number;
    fontFamily?: string;
  };
  icon?: {
    size?: number;
  };
}

interface SearchBarProps {
  placeholder?: string;
  suggestions?: string[];
  onPress?: () => void;
  styleConfig?: SearchBarStyleConfig;
}

export function SearchBar({
  placeholder = 'Search for products...',
  suggestions = [],
  onPress,
  styleConfig,
}: SearchBarProps) {
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (suggestions.length === 0) return;

    const interval = setInterval(() => {
      // Fade out current text
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        // Change text when fully faded out
        setCurrentSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        // Fade in new text
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [fadeAnim, suggestions.length]);

  useEffect(() => {
    fadeAnim.setValue(1);
  }, []);

  const displayText =
    suggestions.length > 0
      ? suggestions[currentSuggestionIndex]
      : placeholder;

  const handlePress = () => {
    console.log('SearchBar pressed, onPress:', !!onPress);
    if (onPress) {
      onPress();
    } else {
      console.warn('SearchBar onPress is not defined');
    }
  };

  const iconSize = styleConfig?.icon?.size ?? 20;

  const searchBarStyle = {
    backgroundColor: styleConfig?.backgroundColor ?? '#FFFFFF',
    borderRadius: styleConfig?.borderRadius ?? 25,
    paddingHorizontal: styleConfig?.paddingHorizontal ?? 16,
    paddingVertical: styleConfig?.paddingVertical ?? 12,
    shadowOpacity: styleConfig?.shadowOpacity ?? 0.1,
    shadowRadius: styleConfig?.shadowRadius ?? 4,
    elevation: styleConfig?.elevation ?? 3,
  };

  const placeholderStyle = {
    fontSize: styleConfig?.placeholder?.fontSize ?? 15,
    color: styleConfig?.placeholder?.color ?? '#666666',
    letterSpacing: styleConfig?.placeholder?.letterSpacing ?? 0.2,
    fontFamily: styleConfig?.placeholder?.fontFamily ?? Fonts.Medium,
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={styles.searchBarTouchable}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={[styles.searchBar, searchBarStyle]}>
        <View style={styles.searchIconContainer}>
          <SearchIcon size={iconSize} />
        </View>
        <View style={styles.animatedPlaceholderContainer}>
          <Animated.Text
            style={[styles.searchPlaceholder, placeholderStyle, { opacity: fadeAnim }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayText}
          </Animated.Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  searchBarTouchable: {
    width: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
  },
  animatedPlaceholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: 22,
    overflow: 'visible',
  },
  searchPlaceholder: {
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  searchIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});


