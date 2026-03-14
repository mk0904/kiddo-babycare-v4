import { CategoryNavigationBar } from '@/components/home/CategoryNavigationBar';
import { LocationButton } from '@/components/ui/LocationButton';
import { SearchBar } from '@/components/ui/SearchBar';
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
    Animated,
    ImageBackground,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HomeHeaderProps {
  scrollY: Animated.Value;
  address?: string | null;
  estimatedTime?: number | null;
  loadingTime?: boolean;
  headerConfig?: {
    backgroundColor?: string;
    textColor?: string;
    primaryColor?: string;
    backgroundImage?: string;
    hasImage?: boolean;
  };
  searchSuggestions?: string[];
  onSearchPress?: () => void;
  onLocationPress?: () => void;
  categories?: Array<{
    key: string;
    label: string;
    iconImage?: any;
    iconUrl?: string;
  }>;
  selectedCategory?: string;
  onCategorySelect?: (key: string) => void;
  onHeaderHeightChange?: (height: number) => void;
}

export function HomeHeader({
  scrollY,
  address,
  estimatedTime,
  loadingTime = false,
  headerConfig = {},
  searchSuggestions = [],
  onSearchPress,
  onLocationPress,
  categories = [],
  selectedCategory,
  onCategorySelect,
  onHeaderHeightChange,
}: HomeHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    backgroundColor = 'transparent',
    textColor = '#FFFFFF',
    primaryColor = '#FFFFFF',
    backgroundImage,
    hasImage = true,
  } = headerConfig;

  // Determine if we should use background image
  // Priority: backgroundImage exists > hasImage flag
  const shouldUseImage = useMemo(() => {
    return !!(backgroundImage || hasImage);
  }, [backgroundImage, hasImage]);

  const headerTopHeight = useMemo(() => {
    return insets.top + 60;
  }, [insets.top]);

  const stickyThreshold = useMemo(() => {
    return headerTopHeight;
  }, [headerTopHeight]);

  const headerTranslateAmount = useMemo(() => {
    return headerTopHeight - insets.top;
  }, [headerTopHeight, insets.top]);

  // Header is in document flow (no overlay), so keep it fixed — no translate on scroll
  const headerTranslateY = useMemo(() => new Animated.Value(0), []);

  // Keep top info bar always visible (header is in flow, no collapse)
  const topInfoBarOpacity = 1;

  // Remove white background overlay - keep original background always visible

  const headerBorderBottomOpacity = scrollY.interpolate({
    inputRange: [0, stickyThreshold * 0.8, stickyThreshold],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const HeaderWrapper = useMemo(() => {
    return (shouldUseImage && backgroundImage ? ImageBackground : View) as React.ComponentType<any>;
  }, [shouldUseImage, backgroundImage]);

  const headerWrapperProps = useMemo(() => {
    if (!shouldUseImage || !backgroundImage) return {};
    
    // Helper function to resolve local asset paths
    const getImageSource = () => {
      // Check if it's a local asset path (starts with "assets/")
      if (typeof backgroundImage === 'string' && backgroundImage.startsWith('assets/')) {
        // Map asset paths to require statements
        const assetMap: Record<string, any> = {
          'assets/images/BabyGearBanner.png': require('@/assets/images/BabyGearBanner.png'),
          'assets/images/Baby-Gear.png': require('@/assets/images/Baby-Gear.png'),
        };
        return assetMap[backgroundImage] || { uri: backgroundImage };
      }
      // Remote URL
      return { uri: backgroundImage };
    };
    
    return {
      source: getImageSource(),
      imageStyle: {
        resizeMode: 'cover' as const,
        width: '100%',
        flex: 1,
      },
    };
  }, [shouldUseImage, backgroundImage]);

  const headerContainerStyle = useMemo(
    () => [
      styles.headerContainer,
      {
        backgroundColor: shouldUseImage ? 'transparent' : backgroundColor,
        paddingTop: insets.top,
        ...(shouldUseImage && { overflow: 'hidden' as const }),
      },
    ],
    [shouldUseImage, backgroundColor, insets.top]
  );

  return (
    <Animated.View
      style={[
        {
          transform: [{ translateY: headerTranslateY }],
          zIndex: 1000,
        },
      ]}
      collapsable={false}
      renderToHardwareTextureAndroid={true}
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout;
        // Only update if height is valid and greater than 0
        // This ensures we always have a valid measurement
        if (height > 0) {
          onHeaderHeightChange?.(height);
        }
      }}
    >
      <HeaderWrapper
        {...headerWrapperProps}
        style={headerContainerStyle}
        collapsable={false}
      >
        <View style={{ position: 'relative', zIndex: 1 }} collapsable={false}>
          <View
            style={[
              styles.topInfoBar,
              {
                opacity: topInfoBarOpacity,
              },
            ]}
            collapsable={false}
          >
            <View style={styles.leftInfoContainer}>
              <View style={styles.kiddoRow}>
                <Text style={[styles.kiddoHeaderText, { color: textColor }]}>
                  The best for your kiddo 
                </Text>
                {address && (estimatedTime !== null || loadingTime) && (
                  <View style={styles.estimatedTimeWrapper}>
                    {loadingTime ? (
                      <Text style={[styles.estimatedTimeText, { color: textColor }]}>...</Text>
                    ) : estimatedTime !== null ? (
                      <Text style={[styles.estimatedTimeText, { color: textColor }]}>
                        in ⚡️{estimatedTime} mins
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
              <LocationButton
                address={address}
                textColor={textColor}
                onPress={onLocationPress}
              />
            </View>
            <TouchableOpacity
              onPress={() => router.push('/wishlist')}
              style={styles.wishlistButton}
              activeOpacity={0.7}
            >
              <Ionicons name="heart-outline" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <SearchBar
              suggestions={searchSuggestions}
              onPress={onSearchPress}
            />
          </View>

          {categories && categories.length > 0 && (
            <CategoryNavigationBar
              categories={categories}
              selectedCategory={selectedCategory}
              onCategorySelect={onCategorySelect}
            />
          )}
        </View>
      </HeaderWrapper>
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: '#E5E5E5',
            opacity: headerBorderBottomOpacity,
            zIndex: 1000,
          },
        ]}
        pointerEvents="none"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    overflow: 'visible',
  },
  topInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  leftInfoContainer: {
    flex: 1,
  },
  kiddoRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
    marginBottom: 4,
  },
  kiddoHeaderText: {
    fontSize: 15,
    fontFamily: Fonts.Black,
    fontWeight: '900',
    letterSpacing: 0,
  },
  estimatedTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  estimatedTimeText: {
    fontSize: 19,
    fontFamily: Fonts.Bold,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  wishlistButton: {
    padding: 4,
    marginLeft: 8,
  },
});

