import { BlockRenderer } from '@/components/content/BlockRenderer';
import { HomeHeader } from '@/components/home/HomeHeader';
import { KiddoRewardsWelcomeModal } from '@/components/home/KiddoRewardsWelcomeModal';
import { AddressModal } from '@/components/modals/AddressModal';
import { MilestoneTabDock } from '@/components/ui/MilestoneTabDock';
import {
  getDeliveryEta,
  getDeliveryEtaForAddress,
  reverseGeocode,
} from '@/config/deliveryConfig';
import { getAppVersionForApi } from '@/constants/versionConfig';
import { useAddress } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { useLiveDeliveryStackOffset } from '@/context/LiveDeliveryStackOffsetContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { appConfigService } from '@/services/appConfigService';
import { configService } from '@/services/configService';
import { useCartItemCount } from '@/store/cartStore';
import { ContentBlock } from '@/types/content';
import { getAddressTitleLabel } from '@/utils/addressDisplay';
import { useFocusEffect, useIsFocused, useNavigationState } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const isHomeTabFocused = useIsFocused();
  const router = useRouter();
  const { user } = useAuth();
  const { defaultAddress, setDetectedLocation } = useAddress();
  const cartItemCount = useCartItemCount();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [loadingTime, setLoadingTime] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [milestoneExpanded, setMilestoneExpanded] = useState(false);
  /** While Kiddo rewards welcome popup is open, hide the home milestone row (`getHomeMilestoneRowLayout` + `MilestoneCartRow`). */
  const [kiddoWelcomePopupVisible, setKiddoWelcomePopupVisible] = useState(false);
  const [milestoneUiRev, setMilestoneUiRev] = useState(0);
  /** Subscribe + one bump on mount so we re-read if app config finished loading before this effect ran. */
  useEffect(() => {
    const off = appConfigService.subscribe(() => setMilestoneUiRev((x) => x + 1));
    setMilestoneUiRev((x) => x + 1);
    return off;
  }, []);

  // Refresh app-config whenever Home regains focus so milestone step moves in-session after checkout.
  useFocusEffect(
    useCallback(() => {
      void appConfigService.loadAppConfig(true, {
        phone: user?.phone ?? undefined,
        customerId: (user?.customerId ?? user?.id) != null ? String(user?.customerId ?? user?.id) : undefined,
        appVersion: getAppVersionForApi(),
        deviceType: Platform.OS,
      });
    }, [user?.phone, user?.customerId, user?.id])
  );

  const milestoneUI = useMemo(() => appConfigService.getMilestoneUI(), [milestoneUiRev]);

  // Auto-detected location when user has no saved address (serviceable / unserviceable)
  type LocationStatus = 'idle' | 'loading' | 'serviceable' | 'unserviceable' | 'denied' | 'error';
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [detectedLocationLabel, setDetectedLocationLabel] = useState<string | null>(null);
  const [detectedEta, setDetectedEta] = useState<number | null>(null);

  // Use address from AddressContext when set; otherwise show detected location or prompt
  const address = defaultAddress
    ? defaultAddress.address1 || 'Default Address'
    : (detectedLocationLabel || (locationStatus === 'unserviceable' ? null : null));
  const displayAddress = defaultAddress
    ? (defaultAddress.address1 || 'Default Address')
    : detectedLocationLabel;

  const addressCategoryLabel = useMemo(() => {
    if (!defaultAddress) return null;
    return getAddressTitleLabel(defaultAddress);
  }, [defaultAddress]);
  const isUnserviceable = !defaultAddress && locationStatus === 'unserviceable';
  const homeEstimatedTime = defaultAddress ? estimatedTime : detectedEta;
  const homeLoadingTime = defaultAddress ? loadingTime : locationStatus === 'loading';

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

    // Background image / copy can follow category; backgroundColor stays global so it does not shift per tab.
    const backgroundImage = categoryHeader?.backgroundImage || globalHeader?.backgroundImage;
    const backgroundColor = globalHeader?.backgroundColor || 'transparent';

    return {
      backgroundColor,
      textColor: categoryHeader?.textColor || globalHeader?.textColor || '#FFFFFF',
      primaryColor: globalHeader?.primaryColor || '#FFFFFF',
      backgroundImage,
      hasImage: !!backgroundImage, // Automatically set based on backgroundImage existence
    };
  }, [selectedCategory, configLoading]);

  /** Main scroll area fill — from kiddo config (categories.defaultPageBackgroundColor / items.*.pageBackgroundColor) */
  const pageBackgroundColor = useMemo(
    () => configService.getCategoryPageBackgroundColor(selectedCategory),
    [selectedCategory, configLoading]
  );

  const categories = useMemo(() => {
    const configCategories = configService.getCategories();
    if (!configCategories?.order) {
      // Fallback to minimal default categories (no bundled icons)
      return [
        { key: 'all', label: 'See all' },
        { key: 'girls', label: 'Girls' },
        { key: 'boys', label: 'Boys' },
        { key: 'babycare', label: 'Baby Care' },
        { key: 'toys', label: 'Toys' },
        { key: 'babygear', label: 'Baby Gear' },
      ];
    }

    // Build categories from config
    const categoryOrder = configCategories.order;
    const categoryItems = configCategories.items || {};

    return categoryOrder.map((key) => {
      const categoryDef = categoryItems[key];

      const icon = (categoryDef as { icon?: string })?.icon;
      const iconUrl = typeof icon === 'string' ? icon : undefined;
      return {
        key,
        label: categoryDef?.label || key,
        iconUrl: iconUrl || undefined,
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

  const tabBarStackBottom = useMemo(() => {
    const tabBarHeight = configService.getTabBarConfig()?.styles?.height ?? 60;
    return Math.max(insets.bottom, 0) + tabBarHeight;
  }, [insets.bottom, configLoading]);

  const { stackExtraPx: liveDeliveryStackExtra } = useLiveDeliveryStackOffset();

  const scrollBottomPad = useMemo(() => {
    const milestoneReserve = 130; // milestoneExpanded ? 380 : 130;
    return Math.max(80, tabBarStackBottom + milestoneReserve);
  }, [tabBarStackBottom]);

  // Use a safe initial estimate to prevent jump
  // Account for: safe area top + top info bar + search bar + category nav bar
  // Breakdown:
  // - Top info bar: ~60px (paddingTop: 8 + text content + marginBottom: 4)
  // - Search bar: ~70px (paddingVertical: 10 + search bar height ~50px)
  // - Category nav: ~90px (paddingTop: 4 + icon 63px + label ~20px + border 3px)
  // Total content: ~220px, using conservative estimate
  const initialHeaderHeight = useMemo(() => {
    const HEADER_CONTENT_HEIGHT = Platform.OS === 'ios' ? 220 : 220;
    return insets.top + HEADER_CONTENT_HEIGHT;
  }, [insets.top]);

  const [dynamicHeaderHeight, setDynamicHeaderHeight] = useState(0);

  // Tab bar visibility control
  const { isVisible: isTabBarVisibleFromScroll, setScrollDirection, reset: resetTabBar } =
    useTabBarVisibility();

  const isInlineCartVisible = cartItemCount > 0 && !milestoneExpanded;

  /** Match `TabBar` → `FloatingCartButton` `anchorExtraOffset` on Home (milestone strip + live pill stack). */
  const scrollToTopAnchorExtra = useMemo(() => {
    if (!isTabBarVisibleFromScroll) return 0;
    // const milestoneStripReserveForStack = Math.max(milestoneDockHeight, 0) + 12;
    const milestoneStripReserveForStack = 12;
    const milestoneReserveForCart = milestoneStripReserveForStack + 4;
    return liveDeliveryStackExtra + milestoneReserveForCart;
  }, [isTabBarVisibleFromScroll, liveDeliveryStackExtra]);

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
      let deliveryTime: number | null = null;
      if (defaultAddress.latitude && defaultAddress.longitude) {
        const eta = await getDeliveryEta(defaultAddress.latitude, defaultAddress.longitude);
        deliveryTime = eta?.etaMinutes ?? null;
      } else {
        const addressString = `${defaultAddress.address1 || ''} ${defaultAddress.city || ''} ${defaultAddress.state || ''} ${defaultAddress.pincode || ''}`.trim();
        if (!addressString) {
          setEstimatedTime(null);
          setLoadingTime(false);
          return;
        }
        deliveryTime = await getDeliveryEtaForAddress(addressString);
      }
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

  // When user clears their address, reset so we can re-detect location
  const hadAddressRef = useRef(!!defaultAddress);
  useEffect(() => {
    if (defaultAddress) {
      hadAddressRef.current = true;
      return;
    }
    if (hadAddressRef.current) {
      hadAddressRef.current = false;
      setLocationStatus('idle');
      setDetectedLocationLabel(null);
      setDetectedEta(null);
      setDetectedLocation('idle');
    }
  }, [defaultAddress, setDetectedLocation]);

  // Auto-detect location on home when user has no saved address (e.g. after login)
  useEffect(() => {
    if (defaultAddress) return;
    if (locationStatus !== 'idle') return;

    let cancelled = false;
    setLocationStatus('loading');

    (async () => {
      try {
        // Check current permission first; only request if not already granted (avoids asking every app open on Android)
        let { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          status = (await Location.requestForegroundPermissionsAsync()).status;
          if (cancelled) return;
        }
        if (status !== 'granted') {
          setLocationStatus('denied');
          setDetectedLocationLabel('Tap to add delivery address');
          setDetectedLocation('denied');
          return;
        }

        let position: Location.LocationObject | null = await Location.getLastKnownPositionAsync();
        if (!position?.coords && !cancelled) {
          position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        }
        if (cancelled || !position?.coords) {
          setLocationStatus('error');
          setDetectedLocationLabel('Tap to add delivery address');
          setDetectedLocation('error');
          return;
        }

        const { latitude, longitude } = position.coords;
        const eta = await getDeliveryEta(latitude, longitude);
        if (cancelled) return;

        if (!eta) {
          setLocationStatus('error');
          setDetectedLocationLabel('Tap to add delivery address');
          setDetectedLocation('error');
          return;
        }

        if (!eta.isServiceable) {
          setLocationStatus('unserviceable');
          setDetectedLocationLabel(null);
          setDetectedEta(null);
          setDetectedLocation('unserviceable');
          return;
        }

        const label = await reverseGeocode(latitude, longitude);
        if (cancelled) return;

        setLocationStatus('serviceable');
        setDetectedLocationLabel(label || 'Current location');
        setDetectedEta(eta.etaMinutes);
        setDetectedLocation('serviceable', eta.etaMinutes);
      } catch (e) {
        if (!cancelled) {
          setLocationStatus('error');
          setDetectedLocationLabel('Tap to add delivery address');
          setDetectedLocation('error');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [defaultAddress]);

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
        <View style={styles.headerWrapper}>
          <HomeHeader
            scrollY={scrollY}
            address={displayAddress}
            addressCategoryLabel={addressCategoryLabel}
            estimatedTime={homeEstimatedTime}
            loadingTime={homeLoadingTime}
            isUnserviceable={isUnserviceable}
            locationStatus={locationStatus}
            headerConfig={headerConfig}
            searchSuggestions={searchSuggestions}
            onSearchPress={handleSearchPress}
            onLocationPress={handleLocationPress}
            categories={categories}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
            onHeaderHeightChange={() => { }} // Not using dynamic height updates anymore
          />
        </View>

        <Animated.ScrollView
          ref={scrollViewRef}
          style={[styles.scrollView, { backgroundColor: pageBackgroundColor }]}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: initialHeaderHeight, // Start content below the absolute header
              minHeight: '100%',
              backgroundColor: pageBackgroundColor,
              paddingBottom: scrollBottomPad,
            },
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
          <View style={[styles.scrollViewContent, { backgroundColor: pageBackgroundColor }]}>
            {configLoading ? (
              <View style={styles.loadingContainer}>
                {/* Loading state */}
              </View>
            ) : (
              <BlockRenderer blocks={blocks} onBlockPress={handleBlockPress} blockSpacing={0} />
            )}
          </View>
        </Animated.ScrollView>
      </View>

      {/* Scroll to Top Button */}
      {/* <ScrollToTopButton
        visible={showScrollToTop}
        onPress={handleScrollToTop}
        tabBarReserveHeight={tabBarStackBottom}
        anchorExtraOffset={scrollToTopAnchorExtra}
      /> */}

      <MilestoneTabDock
        milestoneUI={milestoneUI}
        visible={!kiddoWelcomePopupVisible}
        onMilestoneExpandedChange={setMilestoneExpanded}
        isInlineWithCart={isInlineCartVisible}
        anchorMode="tabBar"
      />

      {/* Address Modal */}
      <AddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        fromHome={true}
      />

      {/* Home: separate Kiddo rewards “first visit” popup (Modal + centered card). Not the milestone strip expander. */}
      <KiddoRewardsWelcomeModal
        milestoneUI={milestoneUI}
        open={!milestoneExpanded}
        isHomeTabFocused={isHomeTabFocused}
        onVisibilityChange={setKiddoWelcomePopupVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  mainColumn: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    flexGrow: 1,
  },
  scrollViewContent: {
    flex: 1,
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
