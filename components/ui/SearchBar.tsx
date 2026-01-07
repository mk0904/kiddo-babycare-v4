import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';

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
  const searchBarScale = useRef(new Animated.Value(1)).current;

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

  const handlePressIn = () => {
    Animated.spring(searchBarScale, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 400,
      friction: 8,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(searchBarScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 400,
      friction: 8,
    }).start();
  };

  const displayText =
    suggestions.length > 0
      ? suggestions[currentSuggestionIndex]
      : placeholder;

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          styles.searchBar,
          {
            transform: [{ scale: searchBarScale }],
          },
        ]}
      >
        <View style={styles.searchIconContainer}>
          <Ionicons name="search" size={20} color="#666666" />
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
        <View style={styles.searchRightIcon}>
          <Ionicons name="mic-outline" size={18} color="#999999" />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
    height: 52,
  },
  searchIconContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
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
  searchRightIcon: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
});

