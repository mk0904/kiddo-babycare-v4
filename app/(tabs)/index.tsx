import { BlockRenderer } from '@/components/content/BlockRenderer';
import { HomeHeader } from '@/components/home/HomeHeader';
import { AddressModal } from '@/components/modals/AddressModal';
import { ScrollToTopButton } from '@/components/ui/ScrollToTopButton';
import { geocodeAddress, getDeliveryTimeFromGoogleMaps } from '@/config/deliveryConfig';
import { Colors } from '@/constants/theme';
import { useAddress } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { configService } from '@/services/configService';
import { ContentBlock } from '@/types/content';
import { useFocusEffect, useNavigationState } from '@react-navigation/native';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { defaultAddress } = useAddress();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [loadingTime, setLoadingTime] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);

  // Use address from AddressContext
  const address = defaultAddress
    ? defaultAddress.address1 || 'Default Address'
    : null;

  const searchSuggestions = [
    'Search for Toys & Games',
    'Search for Baby Care Essentials',
    'Search for Diapers & Wipes',
    'Search for Baby Fashion',
    'Search for Baby Food & Nutrition',
  ];

  const headerConfig = useMemo(() => {
    const categoryHeader = configService.getCategoryHeaderConfig(selectedCategory);
    const globalHeader = configService.getConfig().header;

    // Priority: category header > global header
    const backgroundImage = categoryHeader?.backgroundImage || globalHeader?.backgroundImage;
    const backgroundColor = categoryHeader?.backgroundColor || globalHeader?.backgroundColor || 'transparent';

    return {
      backgroundColor,
      textColor: categoryHeader?.textColor || globalHeader?.textColor || '#FFFFFF',
      primaryColor: globalHeader?.primaryColor || '#FFFFFF',
      backgroundImage,
      hasImage: !!backgroundImage, // Automatically set based on backgroundImage existence
    };
  }, [selectedCategory, configLoading]);

  const categories = useMemo(() => {
    const configCategories = configService.getCategories();
    if (!configCategories?.order) {
      // Fallback to default categories
      return [
        {
          key: 'all',
          label: 'See all',
          iconImage: require('@/assets/images/shopall-selected.png'),
        },
        {
          key: 'girls',
          label: 'Girls',
          iconImage: require('@/assets/images/girls-fashion-selected.png'),
        },
        {
          key: 'boys',
          label: 'Boys',
          iconImage: require('@/assets/images/boys-fashion-selected.png'),
        },
        {
          key: 'babycare',
          label: 'Baby Care',
          iconImage: require('@/assets/images/babycare-selected.png'),
        },
        {
          key: 'toys',
          label: 'Toys',
          iconImage: require('@/assets/images/toys-selected.png'),
        },
        {
          key: 'babygear',
          label: 'Baby Gear',
          iconImage: require('@/assets/images/Baby-Gear.png'),
        },
      ];
    }

    // Build categories from config
    const categoryOrder = configCategories.order;
    const categoryItems = configCategories.items || {};
    const categoryStyles = configCategories.styles || {};

    return categoryOrder.map((key) => {
      const categoryDef = categoryItems[key];
      const defaultLabels: Record<string, string> = {
        all: 'See all',
        girls: 'Girls',
        boys: 'Boys',
        babycare: 'Baby Care',
        toys: 'Toys',
        babygear: 'Baby Gear',
      };
      const defaultIcons: Record<string, any> = {
        all: require('@/assets/images/shopall-selected.png'),
        girls: require('@/assets/images/girls-fashion-selected.png'),
        boys: require('@/assets/images/boys-fashion-selected.png'),
        babycare: require('@/assets/images/babycare-selected.png'),
        toys: require('@/assets/images/toys-selected.png'),
        babygear: require('@/assets/images/Baby-Gear.png'),
      };

      const icon = (categoryDef as { icon?: string })?.icon;
      const iconUrl = typeof icon === 'string' ? icon : undefined;
      return {
        key,
        label: categoryDef?.label || defaultLabels[key] || key,
        iconUrl: iconUrl || undefined,
        iconImage: iconUrl ? undefined : defaultIcons[key],
      };
    });
  }, [configLoading]);

  const handleCategorySelect = useCallback((categoryKey: string) => {
    // Track category viewed
    try {
      const { trackCategoryViewed } = require('@/utils/mixpanelHelpers');
      const categoryName = categories.find(c => c.key === categoryKey)?.label || categoryKey;
      trackCategoryViewed(categoryName, categoryKey);
    } catch (e) {
      console.warn('Mixpanel tracking error:', e);
    }
    if (categoryKey === selectedCategory) return;
    setSelectedCategory(categoryKey);
    // Scroll to top of the new category content
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [selectedCategory, categories]);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        await configService.loadConfig();
        const screenBlocks = configService.getScreenBlocks('home', selectedCategory);
        // Filter out horizontal rail blocks only (keep banners, carousels, and product lists)
        const filteredBlocks = screenBlocks.filter(
          (block) => block.type !== 'rail'
        );
        setBlocks(filteredBlocks);
      } catch (error) {
        console.error('[HomeScreen] Error loading config:', error);
      } finally {
        setConfigLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Update blocks when category changes
  useEffect(() => {
    const screenBlocks = configService.getScreenBlocks('home', selectedCategory);
    // Filter out horizontal rail blocks only (keep banners, carousels, and product lists)
    const filteredBlocks = screenBlocks.filter(
      (block) => block.type !== 'rail'
    );
    setBlocks(filteredBlocks);
  }, [selectedCategory]);

  const handleBlockPress = useCallback((block: ContentBlock, link?: string, item?: any) => {
    if (!link && !item?.collectionId) {
      return;
    }

    // Check if this is a collection click
    const isCollection = (typeof link === 'string' && link.includes('/collections/')) || item?.collectionId;

    if (isCollection) {
      let collectionId = '';
      let title = '';

      // Priority: item.collectionId > extract from link > item.id
      if (item?.collectionId) {
        collectionId = item.collectionId;
        title = item.collectionName || item.title || item.label || '';
      } else if (typeof link === 'string' && link.includes('/collections/')) {
        const parts = link.split('/collections/');
        collectionId = parts[parts.length - 1]?.split('?')[0] || ''; // Remove query params if any
        title = item?.collectionName || item?.title || item?.label || '';
      } else if (item?.id) {
        collectionId = item.id;
        title = item.title || item.label || '';
      }

      if (collectionId) {
        // Ensure collectionId is properly formatted (handle gid:// format)
        const formattedId = collectionId.startsWith('gid://')
          ? collectionId
          : collectionId;

        router.push({
          pathname: '/infinity/[collectionId]',
          params: { collectionId: formattedId, title: title || '' }
        } as any);
        return;
      }
    }

    // Handle other navigation
    if (link && typeof link === 'string') {
      router.push(link as any);
    }
  }, [router]);

  const insets = useSafeAreaInsets();

  // Use a safe initial estimate to prevent jump
  // Account for: safe area top + top info bar + search bar + category nav bar
  // Breakdown:
  // - Top info bar: ~60px (paddingTop: 8 + text content + marginBottom: 4)
  // - Search bar: ~70px (paddingVertical: 10 + search bar height ~50px)
  // - Category nav: ~90px (paddingTop: 4 + icon 63px + label ~20px + border 3px)
  // Total content: ~220px, using conservative estimate
  const initialHeaderHeight = useMemo(() => {
    const HEADER_CONTENT_HEIGHT = Platform.OS === 'ios' ? 220 : 230;
    return insets.top + HEADER_CONTENT_HEIGHT;
  }, [insets.top]);

  const [dynamicHeaderHeight, setDynamicHeaderHeight] = useState(0);

  // Tab bar visibility control
  const { setScrollDirection, reset: resetTabBar } = useTabBarVisibility();

  // Use the measured height if available, otherwise fallback to estimate
  // Add label height (approximately 40px) and gap (8px) to account for the delivery label only on homepage (all category)
  // Gap between label and content below remains 0px
  const effectiveHeaderHeight = dynamicHeaderHeight > 0 ? dynamicHeaderHeight : initialHeaderHeight;

  // Scroll-to-top button visibility
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollYValue = useRef(0);

  const handleSearchPress = useCallback(() => {
    console.log('Search pressed, navigating to /search');
    router.push('/search' as any);
  }, [router]);

  const handleLocationPress = () => {
    setShowAddressModal(true);
  };

  // Fetch estimated delivery time
  const fetchEstimatedTime = useCallback(async () => {
    if (!defaultAddress) {
      setEstimatedTime(null);
      setLoadingTime(false);
      return;
    }

    setLoadingTime(true);
    try {
      let lat = defaultAddress.latitude;
      let lng = defaultAddress.longitude;

      if (!lat || !lng) {
        // Geocode address to get coordinates
        const addressString = `${defaultAddress.address1 || ''} ${defaultAddress.city || ''} ${defaultAddress.state || ''} ${defaultAddress.pincode || ''}`.trim();
        const coords = await geocodeAddress(addressString);
        if (!coords) {
          setEstimatedTime(null);
          setLoadingTime(false);
          return;
        }
        lat = coords.latitude;
        lng = coords.longitude;
      }

      const deliveryTime = await getDeliveryTimeFromGoogleMaps(lat, lng);
      setEstimatedTime(deliveryTime);

      // Track delivery ETA checked
      try {
        const { trackDeliveryETAChecked } = require('@/utils/mixpanelHelpers');
        trackDeliveryETAChecked(address || 'Unknown', deliveryTime);
      } catch (e) {
        console.warn('Mixpanel tracking error:', e);
      }
    } catch (error) {
      console.error('Error fetching delivery time:', error);
      setEstimatedTime(null);
    } finally {
      setLoadingTime(false);
    }
  }, [defaultAddress]);

  useEffect(() => {
    fetchEstimatedTime();
  }, [fetchEstimatedTime]);

  // Track previous tab to detect tab switches vs back navigation
  const segments = useSegments();
  const navigationState = useNavigationState((state) => state);
  const previousTabRef = useRef<string | null>(null);
  const isInitialMount = useRef(true);
  const savedScrollPosition = useRef<number>(0);
  const wasOnDetailScreen = useRef(false);

  // Scroll to top only when switching tabs, not when navigating back
  useFocusEffect(
    useCallback(() => {
      // Check if we're on a detail screen (segments length > 1 means we're in a detail screen)
      const isOnDetailScreen = segments.length > 1;

      // If we're navigating to a detail screen, save scroll position
      if (isOnDetailScreen) {
        savedScrollPosition.current = scrollYValue.current;
        wasOnDetailScreen.current = true;
        return;
      }

      // Get current tab name
      const activeTab = navigationState?.routes?.[navigationState?.index]?.name || 'index';
      const previousTab = previousTabRef.current;

      // Only scroll to top if:
      // 1. It's the initial mount, OR
      // 2. We're switching from a different tab (not coming back from detail screen)
      const isTabSwitch = previousTab !== null && previousTab !== activeTab;
      const shouldScrollToTop = isInitialMount.current || (isTabSwitch && !wasOnDetailScreen.current);

      if (shouldScrollToTop && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: false });
        scrollY.setValue(0);
      } else if (wasOnDetailScreen.current && !isTabSwitch && scrollViewRef.current) {
        // Restore scroll position when coming back from detail screen
        scrollViewRef.current.scrollTo({ y: savedScrollPosition.current, animated: false });
        scrollY.setValue(savedScrollPosition.current);
      }

      // Update previous tab reference and reset detail screen flag
      previousTabRef.current = activeTab;
      wasOnDetailScreen.current = false;
      isInitialMount.current = false;
    }, [segments, navigationState, scrollY])
  );

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const isAtTop = offsetY <= 0;

        scrollYValue.current = offsetY;

        // Control tab bar visibility
        setScrollDirection(offsetY, isAtTop);

        // Show scroll-to-top button when scrolled down more than 300px
        setShowScrollToTop(offsetY > 300);
      },
    }
  );

  const handleScrollToTop = () => {
    resetTabBar(); // Reset tab bar visibility when scrolling to top
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Calculate label translateY to match header scroll behavior
  const headerTopHeight = useMemo(() => {
    return insets.top + 60;
  }, [insets.top]);

  const stickyThreshold = useMemo(() => {
    return headerTopHeight;
  }, [headerTopHeight]);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.mainColumn}>
        <HomeHeader
          scrollY={scrollY}
          address={address}
          estimatedTime={estimatedTime}
          loadingTime={loadingTime}
          headerConfig={headerConfig}
          searchSuggestions={searchSuggestions}
          onSearchPress={handleSearchPress}
          onLocationPress={handleLocationPress}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
          onHeaderHeightChange={setDynamicHeaderHeight}
        />

        <Animated.ScrollView
          ref={scrollViewRef}
          style={[
            styles.scrollView,
            Platform.OS === 'android' && { backgroundColor: Colors.backgroundWhite },
          ]}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: 0,
              minHeight: '100%',
            },
            Platform.OS === 'android' && { backgroundColor: Colors.backgroundWhite },
          ]}
        showsVerticalScrollIndicator={false}
        bounces={true}
        removeClippedSubviews={Platform.OS === 'android'}
        scrollEventThrottle={16}
        decelerationRate="normal"
        nestedScrollEnabled={true}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        overScrollMode="never"
        scrollEnabled={true}
        directionalLockEnabled={false}
      >
        <View style={styles.scrollViewContent}>
          {configLoading ? (
            <View style={styles.loadingContainer}>
              {/* Loading state */}
            </View>
          ) : (
            <BlockRenderer blocks={blocks} onBlockPress={handleBlockPress} />
          )}
        </View>
      </Animated.ScrollView>
      </View>

      {/* Scroll to Top Button */}
      <ScrollToTopButton
        visible={showScrollToTop}
        onPress={handleScrollToTop}
        bottomOffset={80}
      />

      {/* Address Modal */}
      <AddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        fromHome={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mainColumn: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  scrollContent: {
    paddingBottom: 80,
    paddingTop: 0,
    flexGrow: 1,
    backgroundColor: Colors.backgroundWhite,
  },
  scrollViewContent: {
    flex: 1,
    backgroundColor: Colors.backgroundWhite,
    minHeight: '100%',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    minHeight: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
