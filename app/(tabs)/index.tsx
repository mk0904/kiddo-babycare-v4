import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { HomeHeader } from '@/components/home/HomeHeader';
import { BlockRenderer } from '@/components/content/BlockRenderer';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAddress } from '@/context/AddressContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { configService } from '@/services/configService';
import { ContentBlock } from '@/types/content';
import { ScrollToTopButton } from '@/components/ui/ScrollToTopButton';
import { AddressModal } from '@/components/modals/AddressModal';

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
          label: 'Girls Fashion',
          iconImage: require('@/assets/images/girls-fashion-selected.png'),
        },
        {
          key: 'boys',
          label: 'Boys Fashion',
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
        girls: 'Girls Fashion',
        boys: 'Boys Fashion',
        babycare: 'Baby Care',
        toys: 'Toys',
      };
      const defaultIcons: Record<string, any> = {
        all: require('@/assets/images/shopall-selected.png'),
        girls: require('@/assets/images/girls-fashion-selected.png'),
        boys: require('@/assets/images/boys-fashion-selected.png'),
        babycare: require('@/assets/images/babycare-selected.png'),
        toys: require('@/assets/images/toys-selected.png'),
      };

      return {
        key,
        label: categoryDef?.label || defaultLabels[key] || key,
        iconImage: defaultIcons[key],
      };
    });
  }, [configLoading]);

  const handleCategorySelect = useCallback((categoryKey: string) => {
    if (categoryKey === selectedCategory) return;
    setSelectedCategory(categoryKey);
  }, [selectedCategory]);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      setConfigLoading(true);
      try {
        await configService.loadConfig();
        const screenBlocks = configService.getScreenBlocks('home', selectedCategory);
        setBlocks(screenBlocks);
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
    setBlocks(screenBlocks);
  }, [selectedCategory]);

  const handleBlockPress = useCallback((block: ContentBlock, link?: string, item?: any) => {
    if (!link && !item?.collectionId) {
      return;
    }

    // Check if this is a collection click
    const isCollection = link?.includes('/collections/') || item?.collectionId;
    
    if (isCollection) {
      let collectionId = '';
      let title = '';

      // Priority: item.collectionId > extract from link > item.id
      if (item?.collectionId) {
        collectionId = item.collectionId;
        title = item.collectionName || item.title || item.label || '';
      } else if (link?.includes('/collections/')) {
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
    if (link) {
      router.push(link as any);
    }
  }, [router]);

  const insets = useSafeAreaInsets();

  // Use a safe initial estimate to prevent jump
  const initialHeaderHeight = useMemo(() => {
    const HEADER_CONTENT_HEIGHT = Platform.OS === 'ios' ? 125 : 135;
    return insets.top + HEADER_CONTENT_HEIGHT;
  }, [insets.top]);

  const [dynamicHeaderHeight, setDynamicHeaderHeight] = useState(0);

  // Tab bar visibility control
  const { setScrollDirection, reset: resetTabBar } = useTabBarVisibility();

  // Use the measured height if available, otherwise fallback to estimate
  const effectiveHeaderHeight = dynamicHeaderHeight > 0 ? dynamicHeaderHeight : initialHeaderHeight;

  // Scroll-to-top button visibility
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollYValue = useRef(0);

  const handleSearchPress = () => {
    router.push('/search' as any);
  };

  const handleLocationPress = () => {
    setShowAddressModal(true);
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="light" />
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
          { paddingTop: effectiveHeaderHeight },
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
