import { Fonts } from '@/constants/theme';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SearchIcon } from './SearchIcon';

interface SearchBarProps {
  placeholder?: string;
  suggestions?: string[];
  onPress?: () => void;
}

export function SearchBar({
  placeholder = 'Search for products...',
  suggestions = [],
  onPress,
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

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={styles.searchBarTouchable}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.searchBar}>
        <View style={styles.searchIconContainer}>
          <SearchIcon size={20} />
        </View>
        <View style={styles.animatedPlaceholderContainer}>
          <Animated.Text
            style={[styles.searchPlaceholder, { opacity: fadeAnim }]}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  animatedPlaceholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: 22,
    overflow: 'visible',
  },
  searchPlaceholder: {
    fontSize: 15,
    color: '#666666',
    fontFamily: Fonts.Medium,
    includeFontPadding: false,
    textAlignVertical: 'center',
    letterSpacing: 0.2,
  },
  searchIconContainer: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

