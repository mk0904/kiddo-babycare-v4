import ProductCard from '@/components/products/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import FloatingCartButton from '@/components/ui/FloatingCartButton';
import LoginRequiredModal from '@/components/ui/LoginRequiredModal';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/theme';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useWishlist } from '@/context/WishlistContext';
import { useFocusEffect, useNavigationState } from '@react-navigation/native';
import { useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Platform,
    StyleSheet,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 8; // Consistent gap between product cards
const HORIZONTAL_PADDING = 20;
const CARD_WIDTH = (SCREEN_WIDTH - (HORIZONTAL_PADDING * 2) - GAP) / 2;

export default function WishlistScreen() {
    const { wishlistItems, removeFromWishlist, loading } = useWishlist();
    const { setScrollDirection, reset: resetTabBar } = useTabBarVisibility();
    const router = useRouter();
    const [showLoginRequired, setShowLoginRequired] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Assuming we might have auth check here later, for now we just show list
    // If you have useAuth hook, uncomment and use it similar to Kiddo
    // const { isAuthenticated } = useAuth();
    // useEffect(() => { if (!isAuthenticated) setShowLoginRequired(true); }, [isAuthenticated]);

    // Reset tab bar visibility when entering the screen
    useEffect(() => {
        resetTabBar();
        return () => resetTabBar();
    }, []);

    // Track navigation to prevent scroll-to-top on back navigation
    const segments = useSegments();
    const navigationState = useNavigationState((state) => state);
    const previousTabRef = useRef<string | null>(null);
    const isInitialMount = useRef(true);
    const wasOnDetailScreen = useRef(false);

    // Scroll to top only when switching tabs, not when navigating back
    useFocusEffect(
        useCallback(() => {
            const isOnDetailScreen = segments.length > 1;
            const activeTab = navigationState?.routes?.[navigationState?.index]?.name || 'wishlist';
            const previousTab = previousTabRef.current;
            const isTabSwitch = previousTab !== null && previousTab !== activeTab;

            if (isOnDetailScreen) {
                wasOnDetailScreen.current = true;
                return;
            }

            // Track opened_wishlist
            if (!wasOnDetailScreen.current) {
                try {
                    const { trackOpenedWishlist } = require('@/utils/mixpanelHelpers');
                    const itemCount = wishlistItems.length;
                    const wishlistedItems = wishlistItems.map(item => item.id || item.productId || '');
                    const wishlistedCategories = Array.from(new Set(wishlistItems.map(item => item.productType || item.category || '').filter(Boolean)));
                    const wishlistValue = wishlistItems.reduce((sum, item) => {
                        const price = parseFloat(item.priceRange?.minVariantPrice?.amount || item.price || '0');
                        return sum + (isNaN(price) ? 0 : price);
                    }, 0);
                    const availability = wishlistItems.map(item => item.availableForSale !== false ? 'in_stock' : 'out_of_stock');
                    
                    trackOpenedWishlist(itemCount, wishlistedCategories, wishlistedItems, wishlistValue, availability);
                } catch (e) {
                    console.warn('Analytics tracking error:', e);
                }
            }

            const shouldScrollToTop = isInitialMount.current || (isTabSwitch && !wasOnDetailScreen.current);

            if (shouldScrollToTop && flatListRef.current) {
                flatListRef.current.scrollToOffset({ offset: 0, animated: false });
            }

            previousTabRef.current = activeTab;
            wasOnDetailScreen.current = false;
            isInitialMount.current = false;
        }, [segments, navigationState])
    );

    const handleProductPress = (product: any) => {
        router.push(`/products/${encodeURIComponent(product.id)}`);
    };

    const handleAddToCart = (product: any) => {
        router.push(`/products/${encodeURIComponent(product.id)}`);
    };


    const renderItem = useCallback(({ item, index }: { item: any, index: number }) => {
        // Construct product object compatible with ProductCard
        const product = {
            id: item.id || item.productId,
            title: item.title || item.productTitle,
            price: { amount: item.priceRange?.minVariantPrice?.amount || item.price || '0', currencyCode: 'INR' },
            images: { edges: [{ node: { url: item.images?.edges?.[0]?.node?.url || item.image } }] },
            tags: item.tags || [],
            productType: item.productType || item.product_type || '',
            // Add other fields as needed by your ProductCard
        };

        const isLastInRow = (index + 1) % 2 === 0;

        return (
            <View style={[styles.productWrapper, {
                width: CARD_WIDTH,
                marginRight: isLastInRow ? 0 : GAP,
                marginBottom: GAP
            }]}>
                <ProductCard
                    product={product}
                    onPress={() => handleProductPress(product)}
                    onAddToCart={() => handleAddToCart(product)}
                    numColumns={2}
                    horizontalPadding={HORIZONTAL_PADDING}
                    gap={GAP}
                    containerStyle={{ width: '100%' }}
                />
            </View>
        );
    }, [removeFromWishlist]);

    const handleScroll = (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        const isAtTop = offsetY <= 0;
        setScrollDirection(offsetY, isAtTop);
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader title="Wishlist" showBack showWishlist={false} />
            {wishlistItems.length === 0 ? (
                <EmptyState
                    icon="heart-outline"
                    title="Your Wishlist is Empty"
                    subtitle="Tap the heart icon on any product to add it to your wishlist"
                    buttonText="Start Shopping"
                    onButtonPress={() => router.push('/')}
                />
            ) : (
                <View style={{ flex: 1, minHeight: 2 }}>
                    <FlatList
                        ref={flatListRef}
                        data={wishlistItems}
                        renderItem={renderItem}
                        numColumns={2}
                        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
                        showsVerticalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        columnWrapperStyle={styles.columnWrapper}
                        removeClippedSubviews={Platform.OS === 'android'}
                        initialNumToRender={12}
                        maxToRenderPerBatch={12}
                        windowSize={Platform.OS === 'ios' ? 15 : 10}
                        updateCellsBatchingPeriod={50}
                    />
                </View>
            )}

            <LoginRequiredModal
                visible={showLoginRequired}
                onClose={() => {
                    setShowLoginRequired(false);
                    router.back();
                }}
                onLogin={() => router.push('/login')} // Update with actual login route
            />
            <FloatingCartButton showTabBar={false} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB', // Using the light grey/white background
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: HORIZONTAL_PADDING,
        paddingTop: 12,
        paddingBottom: 40,
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    productWrapper: {
        position: 'relative',
    },
});
