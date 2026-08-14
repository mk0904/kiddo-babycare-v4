import { Colors, Fonts } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const kiddoAppConfig = require('@/config/kiddoAppConfig.json');

interface Category {
  key: string;
  label: string;
  iconImage?: any;
  iconUrl?: string;
  activeIconImage?: any;
  activeIconUrl?: string;
  color?: string;
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
  const iconPositionsRef = useRef<{ [key: string]: number }>({});
  const borderPositionAnim = useRef(new Animated.Value(0)).current;

  const selectedCategoryData = useMemo(
    () => categories.find((cat) => cat.key === selectedCategory),
    [categories, selectedCategory]
  );

  const categoryColor = useMemo(() => {
    const configColors = (kiddoAppConfig as any)?.categories?.navigationBar?.colors;
    return configColors?.[selectedCategory || 'all'] || selectedCategoryData?.color || '#D8B4FE';
  }, [selectedCategory, selectedCategoryData]);

  // Get icon sizes from config
  const iconSize = useMemo(() => {
    return (kiddoAppConfig as any)?.categories?.navigationBar?.iconSize || 50;
  }, []);

  const iconContainerSize = useMemo(() => {
    return (kiddoAppConfig as any)?.categories?.navigationBar?.iconContainerSize || 70;
  }, []);

  // Dynamic styles based on config
  const dynamicStyles = useMemo(() => ({
    categoryIconContainer: {
      width: iconContainerSize,
      height: iconContainerSize,
    },
    categoryIconImage: {
      width: iconSize,
      height: iconSize,
    },
  }), [iconSize, iconContainerSize]);

  useEffect(() => {
    if (selectedCategory && iconPositionsRef.current[selectedCategory] !== undefined) {
      Animated.timing(borderPositionAnim, {
        toValue: iconPositionsRef.current[selectedCategory],
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedCategory, borderPositionAnim]);

  const renderCategory = useCallback(
    (category: Category) => {
      const isSelected = category.key === selectedCategory;

      const handleLayout = (event: any) => {
        const { x } = event.nativeEvent.layout;
        iconPositionsRef.current[category.key] = x; // Use exact x position
      };

      return (
        <TouchableOpacity
          key={category.key}
          style={[defaultStyles.categoryItem, customStyles.categoryItem]}
          onPress={() => {
            onCategorySelect?.(category.key);
          }}
          activeOpacity={0.6}
          onLayout={handleLayout}
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
                dynamicStyles.categoryIconContainer,
                customStyles.categoryIconContainer,
                isSelected && defaultStyles.selectedIconContainer,
                isSelected && customStyles.selectedIconContainer,
              ]}
            >
              {category.activeIconUrl ? (
                <Image
                  source={{ uri: category.activeIconUrl }}
                  style={[defaultStyles.categoryIconImage, dynamicStyles.categoryIconImage]}
                  resizeMode="contain"
                />
              ) : category.activeIconImage ? (
                <Image
                  source={category.activeIconImage}
                  style={[defaultStyles.categoryIconImage, dynamicStyles.categoryIconImage]}
                  resizeMode="contain"
                />
              ) : category.iconUrl ? (
                <Image
                  source={{ uri: category.iconUrl }}
                  style={[defaultStyles.categoryIconImage, dynamicStyles.categoryIconImage]}
                  resizeMode="contain"
                />
              ) : category.iconImage ? (
                <Image
                  source={category.iconImage}
                  style={[defaultStyles.categoryIconImage, dynamicStyles.categoryIconImage]}
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
        </TouchableOpacity>
      );
    },
    [
      selectedCategory,
      dynamicStyles,
      customStyles,
      onCategorySelect,
    ]
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
        <View style={categoriesWrapperStyle}>
          <Animated.View
            style={[
              defaultStyles.slidingBorderContainer,
              {
                transform: [{ translateX: borderPositionAnim }],
                left: -1,
              },
            ]}
          >
            <View style={[StyleSheet.absoluteFill, { backgroundColor: categoryColor, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'white', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, bottom: -3, top: 2, left: +1, right: +1 }]} />
            <View style={[StyleSheet.absoluteFill, { borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, overflow: 'hidden' }]}>
              <LinearGradient
                colors={[`${categoryColor}15`, `${categoryColor}05`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </Animated.View>
          {categoryItems}
        </View>
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
    paddingTop: 0,
    paddingBottom: 0,
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
  slidingBorderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 76,
    height: 76,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    pointerEvents: 'none',
    marginTop: 0,
  },
  categoryIconWrapper: {
    padding: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    marginBottom: -12,
  },
  selectedIconWrapper: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: 0,
  },
  categoryIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  selectedIconContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  gradientBorderContainer: {
    width: 76,
    height: 76,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryIconImage: {
    width: 50,
    height: 50,
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
    fontFamily: Fonts.LexendSemiBold,
    marginTop: 0,
    marginBottom: 4,
    minHeight: 16,
    lineHeight: 14,
  },
  selectedCategoryLabel: {
    color: '#222222',
    fontSize: 12,
    fontFamily: Fonts.LexendSemiBold,
    lineHeight: 14,
  },
});

