import { Colors, Fonts } from '@/constants/theme';
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
import Svg, { Path } from 'react-native-svg';

/**
 * Chrome tab geometry, from the official chrome-tabs SVG (viewBox height 36):
 * bottom inverse: c 4.5 0 9 -3.5 9 -8
 * top corner:     c 0 -4.5 3.5 -8 8 -8
 *
 * The bottom curve is an *inverse* corner: horizontal tangent on the baseline,
 * vertical tangent on the side wall — not a convex hook.
 */
const TAB_EAR = 16;
const TAB_STROKE = 2;
const CHROME_SCALE = TAB_EAR / 9;
const BOTTOM_CURVE = 8 * CHROME_SCALE;
const TOP_RADIUS = 8 * CHROME_SCALE;
const BOTTOM_C1X = 4.5 * CHROME_SCALE;
const BOTTOM_C2Y = 3.5 * CHROME_SCALE;
const TOP_C1Y = 4.5 * CHROME_SCALE;
const TOP_C2X = 3.5 * CHROME_SCALE;

function buildChromeTabPaths(width: number, height: number, stroke: number) {
  const pad = stroke / 2;
  const x0 = pad;
  const y0 = pad;
  const w = width - pad;
  const h = height - pad;
  const left = x0 + TAB_EAR;
  const right = w - TAB_EAR;

  const strokeD = [
    `M ${x0} ${h}`,
    `C ${x0 + BOTTOM_C1X} ${h} ${left} ${h - BOTTOM_C2Y} ${left} ${h - BOTTOM_CURVE}`,
    `L ${left} ${y0 + TOP_RADIUS}`,
    `C ${left} ${y0 + TOP_RADIUS - TOP_C1Y} ${left + TOP_C2X} ${y0} ${left + TOP_RADIUS} ${y0}`,
    `L ${right - TOP_RADIUS} ${y0}`,
    `C ${right - TOP_C2X} ${y0} ${right} ${y0 + TOP_RADIUS - TOP_C1Y} ${right} ${y0 + TOP_RADIUS}`,
    `L ${right} ${h - BOTTOM_CURVE}`,
    `C ${right} ${h - BOTTOM_C2Y} ${w - BOTTOM_C1X} ${h} ${w} ${h}`,
  ].join(' ');

  return {
    strokeD,
    fillD: `${strokeD} L ${x0} ${h} Z`,
  };
}

function ChromeTabHighlight({
  width,
  height,
  color,
}: {
  width: number;
  height: number;
  color: string;
}) {
  const { fillD, strokeD } = useMemo(
    () => buildChromeTabPaths(width, height, TAB_STROKE),
    [width, height]
  );

  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      pointerEvents="none"
    >
      <Path d={fillD} fill="#FFFFFF" />
      <Path d={fillD} fill={color} fillOpacity={0.08} />
      <Path
        d={strokeD}
        fill="none"
        stroke={color}
        strokeWidth={TAB_STROKE}
        strokeLinejoin="round"
        strokeLinecap="butt"
      />
    </Svg>
  );
}

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
    slidingBorderContainer: {
      width: iconContainerSize + 8 + TAB_EAR * 2,
      // Match the icon + label row so the scoops sit on the header edge, not in clipped overflow.
      height: iconContainerSize + 2,
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
              dynamicStyles.slidingBorderContainer,
              {
                transform: [{ translateX: borderPositionAnim }],
                left: -TAB_EAR - 1,
              },
            ]}
          >
            <ChromeTabHighlight
              width={dynamicStyles.slidingBorderContainer.width}
              height={dynamicStyles.slidingBorderContainer.height}
              color={categoryColor}
            />
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
    overflow: 'visible',
  },
  scrollContent: {
    paddingHorizontal: 0,
    overflow: 'visible',
  },
  categoriesWrapper: {
    paddingTop: 0,
    paddingBottom: 0,
    overflow: 'visible',
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
    zIndex: 1,
  },
  slidingBorderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    pointerEvents: 'none',
    marginTop: 8,
    overflow: 'visible',
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

