import { CategoryNavigationBar } from '@/components/home/CategoryNavigationBar';
import { LocationButton } from '@/components/ui/LocationButton';
import { SearchBar } from '@/components/ui/SearchBar';
import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import {
  Animated,
  Image,
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
  /** Saved address title (Home / Work / custom name) — shown before street line */
  addressCategoryLabel?: string | null;
  estimatedTime?: number | null;
  loadingTime?: boolean;
  /** When true, show "Area unserviceable" instead of ETA (detected location outside delivery range). */
  isUnserviceable?: boolean;
  /** For optional copy when no address: 'loading' | 'serviceable' | 'unserviceable' | 'denied' | 'error' */
  locationStatus?: string;
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
  addressCategoryLabel,
  estimatedTime,
  loadingTime = false,
  isUnserviceable = false,
  locationStatus,
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

  // Header is in document flow (no overlay), so keep it fixed — no translate on scroll
  const headerTranslateY = useMemo(() => new Animated.Value(0), []);

  /**
   * SIMPLE COLLAPSE LOGIC:
   * We use translateY to move the content.
   */
  const ADDRESS_BAR_HEIGHT = 80;
  const TOTAL_HEADER_HEIGHT = 220;

  const contentTranslateY = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT],
    outputRange: [0, -ADDRESS_BAR_HEIGHT],
    extrapolate: 'clamp',
  });

  // This controls the position of the sticky Search/Category part
  const stickyTranslateY = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT],
    outputRange: [ADDRESS_BAR_HEIGHT, 0], // Starts below Address bar, slides to top
    extrapolate: 'clamp',
  });

  const topInfoOpacity = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT * 0.8],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerBorderBottomOpacity = scrollY.interpolate({
    inputRange: [0, stickyThreshold * 0.8, stickyThreshold],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const HeaderWrapper = useMemo(() => {
    const BaseComponent = (shouldUseImage && backgroundImage ? ImageBackground : View);
    return Animated.createAnimatedComponent(BaseComponent as React.ComponentType<any>);
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
        overflow: 'hidden' as const,
      },
    ],
    [shouldUseImage, backgroundColor, insets.top]
  );

  return (
    <Animated.View
      style={[
        {
          height: insets.top + TOTAL_HEADER_HEIGHT,
          transform: [{ translateY: headerTranslateY }],
          zIndex: 1000,
          backgroundColor: 'transparent',
        },
      ]}
      collapsable={false}
      renderToHardwareTextureAndroid={true}
      pointerEvents="box-none"
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
        style={[
          styles.headerContainer,
          { 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            zIndex: -1,
            transform: [{ translateY: contentTranslateY }] // Synchronize background move
          }
        ]}
        collapsable={false}
        pointerEvents="none"
      />

      <View style={{ flex: 1, paddingTop: insets.top }} pointerEvents="box-none">
        <Animated.View
          style={{
            position: 'relative',
            zIndex: 1,
          }}
          collapsable={false}
          pointerEvents="box-none"
        >
          {/* Top Info (Address + ETA) */}
          <Animated.View
            style={[
              styles.topInfoClip,
              { 
                opacity: topInfoOpacity,
                transform: [{ translateY: contentTranslateY }]
              }
            ]}
            collapsable={false}
          >
            <View style={styles.topInfoBar} collapsable={false}>
              <View style={styles.leftInfoContainer}>
                <View style={styles.kiddoRow}>
                  <Text style={[styles.kiddoHeaderText, { color: textColor }]}>
                    The best for kids in
                  </Text>
                  {(address || isUnserviceable || locationStatus === 'loading') &&
                    (estimatedTime !== null || loadingTime || isUnserviceable) && (
                      <View style={styles.estimatedTimeWrapper}>
                        {loadingTime ? (
                          <Text style={[styles.estimatedTimeText, { color: textColor }]}>...</Text>
                        ) : isUnserviceable ? (
                          <Text style={[styles.estimatedTimeText, styles.unserviceableText]}>
                            Area unserviceable
                          </Text>
                        ) : estimatedTime !== null ? (
                          <View style={styles.estimatedTimeContent}>
                            <Text style={[styles.estimatedTimeText, { color: textColor }]}>
                              {estimatedTime} mins
                            </Text>
                            <Image
                              source={require('@/assets/fonts/lightningsymbol.png')}
                              style={styles.lightningIcon}
                              resizeMode="contain"
                              accessibilityIgnoresInvertColors
                            />
                          </View>
                        ) : null}
                      </View>
                    )}
                </View>
                <View style={styles.addressRow}>
                  <LocationButton
                    address={address}
                    categoryLabel={addressCategoryLabel}
                    textColor={textColor}
                    onPress={onLocationPress}
                  />
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/wishlist')}
                style={styles.wishlistButton}
                activeOpacity={0.7}
              >
                <Ionicons name="heart-outline" size={24} color={textColor} />
              </TouchableOpacity>
            </View>
          </Animated.View>

        </Animated.View>
      </View>

      {/* Sticky Section - Now positioned exactly where it belongs for better touch detection */}
      <Animated.View 
        style={[
          styles.stickySearchCategoryBlock, 
          { 
            position: 'absolute',
            top: insets.top,
            left: 0,
            right: 0,
            transform: [{ translateY: stickyTranslateY }] 
          } 
        ]} 
        collapsable={false}
      >
        <View style={styles.searchContainer}>
          <SearchBar suggestions={searchSuggestions} onPress={onSearchPress} />
        </View>
        {categories && categories.length > 0 ? (
          <View style={styles.categoryBarAboveUnderlay} collapsable={false}>
            <CategoryNavigationBar
              categories={categories}
              selectedCategory={selectedCategory}
              onCategorySelect={onCategorySelect}
            />
          </View>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    width: '100%',
    height: '100%', // Cover the full outer container height
    overflow: 'hidden',
  },
  topInfoClip: {
    overflow: 'hidden',
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
    gap: 0,
    marginBottom: 2,
  },
  addressRow: {
    marginTop: -5,
  },
  kiddoHeaderText: {
    fontSize: 15,
    lineHeight: 16,
    fontFamily: Fonts.LexendBold,
    letterSpacing: 0,
  },
  estimatedTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -6,
  },
  estimatedTimeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  lightningIcon: {
    width: 54,
    height: 54,
    marginLeft: 0,
  },
  estimatedTimeText: {
    fontSize: 23,
    lineHeight: 28,
    fontFamily: Fonts.FredokaSemiBold,
    letterSpacing: 0.3,
  },
  unserviceableText: {
    color: '#DC2626',
  },
  searchContainer: {
    position: 'relative',
    zIndex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  wishlistButton: {
    padding: 4,
    marginLeft: 8,
  },
  stickySearchCategoryBlock: {
    position: 'relative',
    zIndex: 2,
  },
  categoryBarAboveUnderlay: {
    position: 'relative',
    zIndex: 1,
  },
});

