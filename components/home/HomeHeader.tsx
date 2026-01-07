import React, { useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ImageBackground,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchBar } from '@/components/ui/SearchBar';
import { LocationButton } from '@/components/ui/LocationButton';
import { EstimatedTimeDisplay } from '@/components/ui/EstimatedTimeDisplay';
import { CategoryNavigationBar } from '@/components/home/CategoryNavigationBar';
import { Colors } from '@/constants/theme';

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

  // Optimized interpolations
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, stickyThreshold],
    outputRange: [0, -headerTranslateAmount],
    extrapolate: 'clamp',
  });

  const topInfoBarOpacity = scrollY.interpolate({
    inputRange: [0, stickyThreshold * 0.7, stickyThreshold],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });

  const headerWhiteBackgroundOpacity = scrollY.interpolate({
    inputRange: [0, stickyThreshold * 0.3, stickyThreshold],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

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
    return {
      source: { uri: backgroundImage },
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
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
        },
      ]}
      collapsable={false}
      renderToHardwareTextureAndroid={true}
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout;
        onHeaderHeightChange?.(height);
      }}
    >
      <HeaderWrapper
        {...headerWrapperProps}
        style={headerContainerStyle}
        collapsable={false}
      >
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: Colors.backgroundWhite,
              opacity: headerWhiteBackgroundOpacity,
              zIndex: 0,
            },
          ]}
          pointerEvents="none"
          collapsable={false}
        />
        <View style={{ position: 'relative', zIndex: 1 }} collapsable={false}>
          <Animated.View
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
                <Text style={[styles.serviceStatusText, { color: textColor }]}>
                  Kiddo
                </Text>
                <EstimatedTimeDisplay
                  estimatedTime={estimatedTime}
                  loading={loadingTime}
                  textColor={textColor}
                />
              </View>
              <LocationButton
                address={address}
                textColor={textColor}
                onPress={onLocationPress}
              />
            </View>
          </Animated.View>

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceStatusText: {
    fontSize: 22,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
});

