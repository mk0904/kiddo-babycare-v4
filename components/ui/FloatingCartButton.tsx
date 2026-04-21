import { Colors, Fonts } from '@/constants/theme';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useCartItemCount, useCartItems, useCartTotal } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FloatingCartButtonProps {
    showTabBar?: boolean;
    /** Extra space reserved above the tab bar (e.g. live delivery pill + home milestone strip). */
    anchorExtraOffset?: number;
    /**
     * Pixel distance from screen bottom to the top of the tab bar (bar + home indicator).
     * When set, matches TabBar `totalHeight` so the cart anchor aligns with the real bar height from config.
     */
    tabBarReserveHeight?: number;
}

const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({
    showTabBar = false,
    anchorExtraOffset = 0,
    tabBarReserveHeight,
}) => {
    // Use Zustand store instead of context
    const cartItems = useCartItems();
    const itemCount = useCartItemCount();
    const cartTotal = useCartTotal();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const { isVisible: isTabBarVisible } = useTabBarVisibility();

    // Animations - separate for native vs JS driven
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const bottomOffsetAnim = useRef(new Animated.Value(0)).current;

    const TAB_BAR_HEIGHT = 60;
    const bottomInset = Math.max(insets.bottom, 0);
    const tabBarBlockHeight =
        showTabBar && tabBarReserveHeight != null && tabBarReserveHeight > 0
            ? tabBarReserveHeight
            : showTabBar
                ? TAB_BAR_HEIGHT + bottomInset
                : bottomInset;
    const isCartScreen = pathname === '/cart';
    const isPDP = pathname?.includes('/products/');

    // Calculate bottom bar height on PDP:
    // padding top (16) + content height (~48) + padding bottom (Math.max(insets.bottom, 20)) + border (1)
    const PDP_PADDING_TOP = 16;
    const PDP_CONTENT_HEIGHT = 48; // Approximate height of price + button
    const PDP_PADDING_BOTTOM = Math.max(bottomInset, 20);
    const PDP_BORDER = 1;
    const PDP_BOTTOM_BAR_HEIGHT = PDP_PADDING_TOP + PDP_CONTENT_HEIGHT + PDP_PADDING_BOTTOM + PDP_BORDER;

    // On PDP, position above the bottom bar with some spacing
    const pdpBottomOffset = PDP_BOTTOM_BAR_HEIGHT + 12;
    const baseBottomOffset = tabBarBlockHeight + 0 + (anchorExtraOffset || 0);
    const hiddenBottomOffset = isPDP ? pdpBottomOffset : bottomInset + 18;

    // Entrance animation (native driver)
    useEffect(() => {
        if (itemCount > 0 && !isCartScreen) {
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
            }).start();
        } else {
            Animated.timing(scaleAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [itemCount, isCartScreen]);

    // Bottom position animation (JS driver - can't use native for layout)
    useEffect(() => {
        const targetOffset = showTabBar && isTabBarVisible ? baseBottomOffset : hiddenBottomOffset;
        Animated.spring(bottomOffsetAnim, {
            toValue: targetOffset,
            useNativeDriver: false,
            tension: 40,
            friction: 8,
        }).start();
    }, [isTabBarVisible, showTabBar, baseBottomOffset, hiddenBottomOffset, anchorExtraOffset]);

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: cartItems[0]?.currencyCode || 'INR',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    // Get product images
    const productImages = cartItems.slice(0, 3).map(item => item.image).filter(Boolean);

    if (itemCount === 0 || isCartScreen) {
        return null;
    }

    const handlePress = () => {
        router.push('/cart' as any);
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { bottom: bottomOffsetAnim },
            ]}
            pointerEvents="box-none"
        >
            <Animated.View
                style={{
                    transform: [{ scale: scaleAnim }],
                    opacity: scaleAnim,
                }}
            >
                <TouchableOpacity
                    style={styles.button}
                    onPress={handlePress}
                    activeOpacity={0.95}
                >
                    {/* Glassmorphism background for iOS */}
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
                    ) : null}

                    {/* Gradient overlay */}
                    <LinearGradient
                        colors={[Colors.primary, '#E84E4B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Subtle shine effect */}
                    <View style={styles.shineOverlay} />

                    {/* Content */}
                    <View style={styles.content}>
                        {/* Left: Stacked product images */}
                        <View style={styles.leftSection}>
                            {productImages.length > 0 ? (
                                <View style={styles.imagesContainer}>
                                    {productImages.map((imageUrl, index) => (
                                        <View
                                            key={`${imageUrl}-${index}`}
                                            style={[
                                                styles.imageWrapper,
                                                { zIndex: productImages.length - index },
                                                index > 0 && { marginLeft: -20 },
                                            ]}
                                        >
                                            <Image
                                                source={{ uri: imageUrl }}
                                                style={styles.productImage}
                                                contentFit="cover"
                                            />
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View style={styles.cartIconContainer}>
                                    <Ionicons name="cart" size={18} color="#FFF" />
                                </View>
                            )}
                        </View>

                        {/* Center: Text */}
                        <View style={styles.textSection}>
                            <Text style={styles.viewCartText} numberOfLines={1}>View cart</Text>
                            <Text style={styles.itemCountText}>
                                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                            </Text>
                        </View>

                        {/* Right: Arrow badge */}
                        <View style={styles.arrowContainer}>
                            <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                        </View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10000,
        elevation: 10000,
    },
    button: {
        minWidth: 160,
        height: 52,
        borderRadius: 26,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: Colors.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.4,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
                backgroundColor: Colors.primary,
            },
        }),
    },
    shineOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        height: '100%',
    },
    leftSection: {
        marginRight: 10,
    },
    imagesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    imageWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.9)',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
            },
        }),
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    cartIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textSection: {
        marginRight: 4,
    },
    viewCartText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: Fonts.Bold,
        marginBottom: 1,
    },
    itemCountText: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.85)',
        fontFamily: Fonts.Regular,
    },
    arrowContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
});

export default FloatingCartButton;
