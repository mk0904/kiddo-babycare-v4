import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
} from 'react-native';
import { Colors } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Category {
  key: string;
  label: string;
  iconImage?: any;
  iconUrl?: string;
}

interface CategoryNavigationBarProps {
  categories?: Category[];
  selectedCategory?: string;
  onCategorySelect?: (key: string) => void;
  styles?: {
    container?: any;
    categoryItem?: any;
    categoryIconWrapper?: any;
    selectedIconWrapper?: any;
    categoryIconContainer?: any;
    selectedIconContainer?: any;
    categoryLabel?: any;
    selectedCategoryLabel?: any;
    scrollContent?: any;
    categoriesWrapper?: any;
  };
}

export function CategoryNavigationBar({
  categories = [],
  selectedCategory,
  onCategorySelect,
  styles: customStyles = {},
}: CategoryNavigationBarProps) {
  const borderAnimationsRef = useRef<{ [key: string]: Animated.Value }>({});

  useEffect(() => {
    categories.forEach((category) => {
      if (!borderAnimationsRef.current[category.key]) {
        borderAnimationsRef.current[category.key] = new Animated.Value(
          category.key === selectedCategory ? 1 : 0
        );
      }
    });
  }, [categories, selectedCategory]);

  useEffect(() => {
    categories.forEach((category) => {
      const isSelected = category.key === selectedCategory;
      const animValue = borderAnimationsRef.current[category.key];

      if (animValue) {
        Animated.timing(animValue, {
          toValue: isSelected ? 1 : 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [selectedCategory, categories]);

  const renderCategory = useCallback(
    (category: Category) => {
      const isSelected = category.key === selectedCategory;

      if (!borderAnimationsRef.current[category.key]) {
        borderAnimationsRef.current[category.key] = new Animated.Value(
          isSelected ? 1 : 0
        );
      }

      const borderAnim = borderAnimationsRef.current[category.key];

      const borderAnimatedStyle = {
        opacity: borderAnim,
        transform: [
          {
            scaleX: borderAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1],
            }),
          },
        ],
      };

      return (
        <TouchableOpacity
          key={category.key}
          style={[defaultStyles.categoryItem, customStyles.categoryItem]}
          onPress={() => {
            onCategorySelect?.(category.key);
          }}
          activeOpacity={0.6}
        >
          <View
            style={[
              defaultStyles.categoryIconWrapper,
              isSelected && defaultStyles.selectedIconWrapper,
              customStyles.categoryIconWrapper,
              isSelected && customStyles.selectedIconWrapper,
            ]}
          >
            <View
              style={[
                defaultStyles.categoryIconContainer,
                customStyles.categoryIconContainer,
                isSelected && defaultStyles.selectedIconContainer,
                isSelected && customStyles.selectedIconContainer,
              ]}
            >
              {category.iconUrl ? (
                <Image
                  source={{ uri: category.iconUrl }}
                  style={defaultStyles.categoryIconImage}
                  resizeMode="contain"
                />
              ) : category.iconImage ? (
                <Image
                  source={category.iconImage}
                  style={defaultStyles.categoryIconImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={defaultStyles.categoryIconText}>
                  {category.label.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          </View>
          <Text
            style={[
              defaultStyles.categoryLabel,
              !isSelected && customStyles.categoryLabel,
              isSelected && defaultStyles.selectedCategoryLabel,
              isSelected && customStyles.selectedCategoryLabel,
            ]}
          >
            {category.label}
          </Text>
          <Animated.View
            style={[defaultStyles.selectedBottomBorder, borderAnimatedStyle]}
          />
        </TouchableOpacity>
      );
    },
    [selectedCategory, customStyles, onCategorySelect]
  );

  const containerStyle = useMemo(
    () => [defaultStyles.container, customStyles.container],
    [customStyles.container]
  );

  const scrollContentStyle = useMemo(
    () => [defaultStyles.scrollContent, customStyles.scrollContent],
    [customStyles.scrollContent]
  );

  const categoriesWrapperStyle = useMemo(
    () => [defaultStyles.categoriesWrapper, customStyles.categoriesWrapper],
    [customStyles.categoriesWrapper]
  );

  const categoryItems = useMemo(
    () => categories.map((category) => renderCategory(category)),
    [categories, renderCategory]
  );

  if (categories.length === 0) {
    return null;
  }

  return (
    <View style={containerStyle}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={scrollContentStyle}
      >
        <View style={categoriesWrapperStyle}>{categoryItems}</View>
      </ScrollView>
    </View>
  );
}

const defaultStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 0,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  categoriesWrapper: {
    paddingTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    minWidth: SCREEN_WIDTH,
    gap: 16,
  },
  categoryItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    position: 'relative',
  },
  categoryIconWrapper: {
    padding: 0,
    borderRadius: 18,
    backgroundColor: 'transparent',
  },
  selectedIconWrapper: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    padding: 0,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  selectedIconContainer: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E5E5E5',
    borderWidth: 1,
  },
  categoryIconImage: {
    width: 28,
    height: 28,
  },
  categoryIconText: {
    fontSize: 18,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  categoryLabel: {
    fontSize: 11,
    color: '#222222',
    textAlign: 'center',
    fontWeight: '400',
    marginVertical: 4,
    minHeight: 16,
    lineHeight: 14,
  },
  selectedCategoryLabel: {
    color: '#222222',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  selectedBottomBorder: {
    position: 'absolute',
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#222222',
    marginTop: 4,
  },
});

