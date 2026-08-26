import { CategoryNavigationBar } from '@/components/home/CategoryNavigationBar';
import { TryAtHomePill } from '@/components/home/TryAtHomePill';
import { LocationButton } from '@/components/ui/LocationButton';
import type { SearchBarStyleConfig } from '@/components/ui/SearchBar';
import { SearchBar } from '@/components/ui/SearchBar';
import { Fonts } from '@/constants/theme';
import { configService } from '@/services/configService';
import type { HeaderGlassConfig } from '@/types/headerGlassTypes';
import {
    headerGlassTintIsVisible,
    resolveHeaderGlassConfig,
} from '@/utils/headerGlassConfig';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    Animated,
    Image,
    ImageBackground,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const kiddoAppConfig = require('@/config/kiddoAppConfig.json');

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
    iconUrl?: string;
    /** Remote config: `header.glass` */
    globalGlass?: HeaderGlassConfig | null;
    /** Remote config: `categories.items.<key>.header.glass` */
    categoryGlass?: HeaderGlassConfig | null;
  };
  searchSuggestions?: string[];
  onSearchPress?: () => void;
  onTryAtHomePress?: () => void;
  onLocationPress?: () => void;
  categories?: Array<{
    key: string;
    label: string;
    iconImage?: any;
    iconUrl?: string;
    activeIconImage?: any;
    activeIconUrl?: string;
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
  onTryAtHomePress,
  onLocationPress,
  categories = [],
  selectedCategory,
  onCategorySelect,
  onHeaderHeightChange,
}: HomeHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Read remote-configurable style overrides from kiddoAppConfig
  const headerStyles = useMemo(() => {
    return (kiddoAppConfig as any)?.header?.styles ?? {};
  }, []);

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

  const glass = useMemo(
    () =>
      resolveHeaderGlassConfig(
        headerConfig.globalGlass,
        headerConfig.categoryGlass
      ),
    [headerConfig.globalGlass, headerConfig.categoryGlass]
  );

  const imageSource = useMemo(() => {
    if (!backgroundImage) return null;
    if (typeof backgroundImage === 'string' && backgroundImage.startsWith('assets/')) {
      const assetMap: Record<string, number> = {
        'assets/images/BabyGearBanner.png': require('@/assets/images/BabyGearBanner.png'),
        'assets/images/Baby-Gear.png': require('@/assets/images/Baby-Gear.png'),
      };
      return assetMap[backgroundImage] ?? { uri: backgroundImage };
    }
    return { uri: backgroundImage };
  }, [backgroundImage]);

  const renderGlassOverlay = () => {
    if (!glass.enabled) return null;

    // Define Android fallback underlay color based on glass tint
    const androidFallbackBg = glass.blurTint === 'dark'
      ? 'rgba(30, 30, 30, 0.85)'
      : 'rgba(255, 255, 255, 0.85)';

    return (
      <>
        {Platform.OS === 'android' && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: androidFallbackBg }
            ]}
            pointerEvents="none"
          />
        )}
        <BlurView
          intensity={
            Platform.OS === 'ios' ? glass.blurIntensityIos : glass.blurIntensityAndroid
          }
          tint={glass.blurTint}
          experimentalBlurMethod={Platform.OS === 'android' ? 'oem' : undefined}
          style={StyleSheet.absoluteFill}
        />
        {headerGlassTintIsVisible(glass.tintColor) ? (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: glass.tintColor }]}
            pointerEvents="none"
          />
        ) : null}
      </>
    );
  };

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
  const ADDRESS_BOTTOM_MARGIN = 12;
  const ADDRESS_BAR_HEIGHT = (headerStyles?.heights?.addressBarHeight ?? 80) + ADDRESS_BOTTOM_MARGIN;
  const TOTAL_HEADER_HEIGHT = (headerStyles?.heights?.totalHeaderHeight ?? 185) + ADDRESS_BOTTOM_MARGIN;

  const contentTranslateY = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT],
    outputRange: [0, -ADDRESS_BAR_HEIGHT],
    extrapolate: 'clamp',
  });

  /** Hero image slides up and fades out as the sticky header takes over. */
  const headerBackgroundTranslateY = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT],
    outputRange: [0, -TOTAL_HEADER_HEIGHT * 0.5],
    extrapolate: 'clamp',
  });

  const headerBackgroundOpacity = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT * 0.45, ADDRESS_BAR_HEIGHT],
    outputRange: [1, 0.2, 0],
    extrapolate: 'clamp',
  });

  const stickyTranslateY = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT],
    outputRange: [ADDRESS_BAR_HEIGHT, -25],
    extrapolate: 'clamp',
  });

  const topInfoOpacity = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT * 0.8],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  /** Frosted glass only while collapsing — at scroll 0 the header image stays visible. */
  const stickyGlassOpacity = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT * 0.35, ADDRESS_BAR_HEIGHT],
    outputRange: [0, 0.85, 1],
    extrapolate: 'clamp',
  });

  const [stickyGlassMounted, setStickyGlassMounted] = useState(false);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      const active = value > 2;
      setStickyGlassMounted((prev) => (prev === active ? prev : active));
    });
    return () => scrollY.removeListener(id);
  }, [scrollY]);

  const headerBorderBottomOpacity = scrollY.interpolate({
    inputRange: [0, stickyThreshold * 0.8, stickyThreshold],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const searchTranslateY = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT],
    outputRange: [0, 50],
    extrapolate: 'clamp',
  });

  const categoryTranslateY = scrollY.interpolate({
    inputRange: [0, ADDRESS_BAR_HEIGHT],
    outputRange: [0, 25],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        {
          height: insets.top + TOTAL_HEADER_HEIGHT,
          transform: [{ translateY: headerTranslateY }],
          zIndex: 1000,
          backgroundColor: 'transparent',
          overflow: 'hidden',
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
      <Animated.View
        style={[
          styles.headerBackgroundLayer,
          {
            opacity: headerBackgroundOpacity,
            transform: [{ translateY: headerBackgroundTranslateY }],
          },
        ]}
        collapsable={false}
        pointerEvents="none"
      >
        {shouldUseImage && imageSource ? (
          <ImageBackground
            source={imageSource}
            style={styles.headerBackgroundFill}
            imageStyle={styles.headerBackgroundImage}
          />
        ) : (
          <View
            style={[
              styles.headerBackgroundFill,
              { backgroundColor: backgroundColor || 'transparent' },
            ]}
          />
        )}
      </Animated.View>

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
            <View
              style={[
                styles.topInfoBar,
                { paddingHorizontal: headerStyles?.topInfo?.paddingHorizontal ?? 20 },
              ]}
              collapsable={false}
            >
              <View style={styles.leftInfoContainer}>
                <View style={styles.kiddoRow}>
                  <Text
                    style={[
                      styles.kiddoHeaderText,
                      {
                        color: textColor,
                        fontSize: headerStyles?.topInfo?.tagline?.fontSize ?? 12,
                        lineHeight: headerStyles?.topInfo?.tagline?.lineHeight ?? 16,
                        letterSpacing: headerStyles?.topInfo?.tagline?.letterSpacing ?? 0,
                      },
                    ]}
                  >
                    The best for kids in
                  </Text>
                  {(address || isUnserviceable || locationStatus === 'loading') &&
                    (estimatedTime !== null || loadingTime || isUnserviceable) && (
                      <View style={styles.estimatedTimeWrapper}>
                        {loadingTime ? (
                          <Text style={[styles.estimatedTimeText, { color: textColor, fontSize: headerStyles?.topInfo?.eta?.fontSize ?? 23, lineHeight: headerStyles?.topInfo?.eta?.lineHeight ?? 28, letterSpacing: headerStyles?.topInfo?.eta?.letterSpacing ?? 0.3 }]}>...</Text>
                        ) : isUnserviceable ? (
                          <Text style={[styles.estimatedTimeText, styles.unserviceableText, { fontSize: headerStyles?.topInfo?.eta?.fontSize ?? 23, lineHeight: headerStyles?.topInfo?.eta?.lineHeight ?? 28 }]}>
                            Area unserviceable
                          </Text>
                        ) : estimatedTime !== null ? (
                          <View style={styles.estimatedTimeContent}>
                            <Text style={[styles.estimatedTimeText, { color: textColor, fontSize: headerStyles?.topInfo?.eta?.fontSize ?? 23, lineHeight: headerStyles?.topInfo?.eta?.lineHeight ?? 28, letterSpacing: headerStyles?.topInfo?.eta?.letterSpacing ?? 0.3 }]}>
                              {estimatedTime} mins
                            </Text>
                            <Image
                              source={require('@/assets/fonts/lightningsymbol.png')}
                              style={[styles.lightningIcon, { width: headerStyles?.topInfo?.lightningIcon?.width ?? 54, height: headerStyles?.topInfo?.lightningIcon?.height ?? 44 }]}
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
                    address={isUnserviceable ? 'Area Unserviceable' : address}
                    categoryLabel={addressCategoryLabel}
                    textColor={textColor}
                    onPress={onLocationPress}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {headerConfig?.iconUrl && (
                  <TouchableOpacity
                    onPress={() => router.push('/wallet')}
                    style={[
                      styles.wishlistButton,
                      {
                        width: headerStyles?.wishlistButton?.size ?? 44,
                        height: headerStyles?.wishlistButton?.size ?? 44,
                        backgroundColor: headerStyles?.wishlistButton?.backgroundColor ?? '#0000000f',
                        borderRadius: headerStyles?.wishlistButton?.borderRadius ?? 24,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: headerConfig.iconUrl }}
                      style={{ width: headerStyles?.wishlistButton?.iconSize ?? 28, height: headerStyles?.wishlistButton?.iconSize ?? 28 }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                )}
                {!configService.getTabBarConfig()?.visibleTabs?.includes('wishlist') && (
                  <TouchableOpacity
                    onPress={() => router.push('/wishlist')}
                    style={[
                      styles.wishlistButton,
                      {
                        width: headerStyles?.wishlistButton?.size ?? 44,
                        height: headerStyles?.wishlistButton?.size ?? 44,
                        backgroundColor: headerStyles?.wishlistButton?.backgroundColor ?? '#0000000f',
                        borderRadius: headerStyles?.wishlistButton?.borderRadius ?? 24,
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="heart-outline" size={headerStyles?.wishlistButton?.iconSize ?? 28} color={textColor} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>

        </Animated.View>
      </View>

      {/* One BlurView; static top: -insets.top reaches status bar (no animated paddingTop). */}
      <Animated.View
        style={[
          styles.stickySearchCategoryBlock,
          {
            position: 'absolute',
            top: insets.top,
            left: 0,
            right: 0,
            transform: [{ translateY: stickyTranslateY }],
          },
        ]}
        collapsable={false}
      >
        {glass.enabled && stickyGlassMounted ? (
          <Animated.View
            style={[
              styles.stickyGlassLayer,
              {
                top: -insets.top,
                bottom: Platform.OS === 'ios' ? -25 : undefined,
                height: Platform.OS === 'android' ? (insets.top + 150) : undefined,
                opacity: stickyGlassOpacity
              },
            ]}
            pointerEvents="none"
          >
            {renderGlassOverlay()}
          </Animated.View>
        ) : null}
        <View pointerEvents="box-none">
          <Animated.View
            style={[
              styles.searchContainer,
              {
                paddingLeft: headerStyles?.searchBar?.container?.paddingLeft ?? 10,
                paddingRight: headerStyles?.searchBar?.container?.paddingRight ?? 0,
                paddingTop: headerStyles?.searchBar?.container?.paddingTop ?? 0,
                paddingBottom: headerStyles?.searchBar?.container?.paddingBottom ?? 0,
                marginTop: headerStyles?.searchBar?.container?.marginTop ?? -25,
                marginBottom: headerStyles?.searchBar?.container?.marginBottom ?? 0,
                transform: [{ translateY: searchTranslateY }],
              },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.searchRow}>
              <View style={styles.searchBarWrap}>
                <SearchBar
                  suggestions={searchSuggestions}
                  onPress={onSearchPress}
                  styleConfig={headerStyles?.searchBar as SearchBarStyleConfig}
                />
              </View>
              <TryAtHomePill onPress={onTryAtHomePress} />
            </View>
          </Animated.View>
          {categories && categories.length > 0 ? (
            <Animated.View style={[styles.categoryBarAboveUnderlay, { transform: [{ translateY: categoryTranslateY }] }]} collapsable={false}>
              <CategoryNavigationBar
                categories={categories}
                selectedCategory={selectedCategory}
                onCategorySelect={onCategorySelect}
                scrollY={scrollY}
              />
            </Animated.View>
          ) : null}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerBackgroundLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    overflow: 'hidden',
  },
  headerBackgroundFill: {
    ...StyleSheet.absoluteFillObject,
  },
  headerBackgroundImage: {
    resizeMode: 'cover',
    width: '100%',
  },
  stickyGlassLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 0,
  },
  topInfoClip: {
    overflow: 'hidden',
  },
  topInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 0,
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
    marginTop: -10,
    marginBottom: 0,
  },
  kiddoHeaderText: {
    fontFamily: Fonts.LexendBold,
  },
  estimatedTimeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -10,
  },
  estimatedTimeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  lightningIcon: {
    marginLeft: 0,
  },
  estimatedTimeText: {
    fontFamily: Fonts.FredokaSemiBold,
  },
  unserviceableText: {
    color: '#DC2626',
  },
  searchContainer: {
    position: 'relative',
    zIndex: 1,
    paddingLeft: 10,
    paddingRight: -30,
    paddingTop: 0,
    paddingBottom: 4,
    marginTop: -25,
    backgroundColor: 'transparent',

  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,

  },
  searchBarWrap: {
    flex: 1,
    minWidth: 0,
  },
  wishlistButton: {
    padding: 8,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickySearchCategoryBlock: {
    position: 'relative',
    zIndex: 2,
    overflow: 'visible',
  },
  categoryBarAboveUnderlay: {
    position: 'relative',
    zIndex: 1,
  },
});

