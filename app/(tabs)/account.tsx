import { accountConfig } from '@/config/accountConfig';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { nectorApi } from '@/services/nectorApi';
import { useCartItemCount } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigationState } from '@react-navigation/native';
import { useRouter, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function AccountScreen() {
    const router = useRouter();
    const { user, logout, isAuthenticated } = useAuth();
    const itemCount = useCartItemCount();
    const { setScrollDirection, reset } = useTabBarVisibility();
    const [pointsBalance, setPointsBalance] = useState(0);
    const [loadingPoints, setLoadingPoints] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

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
            const activeTab = navigationState?.routes?.[navigationState?.index]?.name || 'account';
            const previousTab = previousTabRef.current;
            const isTabSwitch = previousTab !== null && previousTab !== activeTab;

            if (isOnDetailScreen) {
                wasOnDetailScreen.current = true;
                return;
            }

            const shouldScrollToTop = isInitialMount.current || (isTabSwitch && !wasOnDetailScreen.current);

            if (shouldScrollToTop && scrollViewRef.current) {
                scrollViewRef.current.scrollTo({ y: 0, animated: false });
            }

            previousTabRef.current = activeTab;
            wasOnDetailScreen.current = false;
            isInitialMount.current = false;
        }, [segments, navigationState])
    );

    // Use config directly
    const config = accountConfig;
    const isGuest = !isAuthenticated || user?.isGuest === true;

    // Get customer ID in shopify- format
    const getCustomerId = () => {
        if (!user) return null;
        let customerId = user.customerId || user.id; // user.id from our User type might be different, ensure we get Shopify ID
        if (!customerId) return null;

        customerId = String(customerId);
        if (customerId.startsWith('shopify-')) {
            return customerId;
        }
        if (customerId.includes('gid://shopify/Customer/')) {
            return `shopify-${customerId.replace('gid://shopify/Customer/', '')}`;
        }
        if (/^\d+$/.test(customerId)) {
            return `shopify-${customerId}`;
        }
        return customerId;
    };

    // Fetch loyalty points when screen opens
    useEffect(() => {
        const fetchLoyaltyPoints = async () => {
            const customerId = getCustomerId();
            if (!customerId) return;

            setLoadingPoints(true);
            try {
                const response = await nectorApi.getLeadByCustomerId(customerId);

                // Extract available points from data.item.available
                const availableValue = response?.data?.item?.available;
                const available = availableValue ? parseFloat(String(availableValue)) : 0;

                setPointsBalance(available);
            } catch (error) {
                setPointsBalance(0);
            } finally {
                setLoadingPoints(false);
            }
        };

        if (user && !isGuest) {
            fetchLoyaltyPoints();
        }
    }, [user, isGuest]);

    const handleLogout = () => {
        if (!config.logout.enabled) return;

        Alert.alert(
            config.logout.title,
            config.logout.message,
            [
                {
                    text: config.logout.cancelText,
                    style: 'cancel',
                },
                {
                    text: config.logout.confirmText,
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await logout();
                            router.replace('/'); // Go to home after logout
                        } catch (error) {
                            console.error('Logout error:', error);
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to delete your account? This action cannot be undone. All your data, orders, and information will be permanently deleted.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setDeletingAccount(true);
                            const customerId = getCustomerId();
                            if (!customerId) {
                                Alert.alert('Error', 'Unable to identify your account. Please try logging out and logging back in.');
                                setDeletingAccount(false);
                                return;
                            }

                            // In a real app, call delete customer API here
                            // await shopifyApi.deleteCustomer(customerId);

                            // Logout user after successful deletion
                            await logout();

                            Alert.alert(
                                'Account Deleted',
                                'Your account has been successfully deleted. You will be logged out.',
                                [{ text: 'OK', onPress: () => router.replace('/') }]
                            );
                        } catch (error: any) {
                            Alert.alert(
                                'Error',
                                error.message || 'Failed to delete account. Please try again or contact support.',
                                [{ text: 'OK' }]
                            );
                        } finally {
                            setDeletingAccount(false);
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    };

    const handleAction = (actionConfig: any) => {
        const { type, ...params } = actionConfig.action;

        switch (type) {
            case 'navigate':
                if (params.screen) {
                    // Adjust navigation to Expo Router paths
                    const screenMap: { [key: string]: string } = {
                        'Orders': '/orders',
                        'Loyalty': '/loyalty',
                        'Rewards': '/rewards',
                        'Returns': '/returns',
                        'Addresses': '/address',
                        'Wishlist': '/wishlist',
                        'ContactSupport': '/support',
                        'Profile': '/profile/edit',
                    };

                    const path = screenMap[params.screen];
                    if (path) {
                        router.push(path as any);
                    } else {
                        console.warn(`Route not found for screen: ${params.screen}`);
                        // Fallback or todo
                    }
                }
                break;

            case 'webview':
                // Navigate to WebView screen
                if (params.url) {
                    router.push({
                        pathname: '/webview',
                        params: {
                            url: params.url,
                            title: params.title || actionConfig.title || 'Web View',
                        },
                    } as any);
                }
                break;

            case 'alert':
                Alert.alert(params.title || 'Alert', params.message || '');
                break;

            case 'logout':
                handleLogout();
                break;

            case 'custom':
                if (params.handler) {
                    params.handler();
                }
                break;

            default:
                break;
        }
    };

    const getBadgeCount = (action: any) => {
        if (!action.showBadge) return 0;

        switch (action.badgeSource) {
            case 'cart':
                return itemCount;
            case 'static':
                return action.badgeValue || 0;
            default:
                return 0;
        }
    };

    // Display user name - don't show "user_" or just "user"
    const getUserDisplayName = () => {
        if (!user) return config.profile.defaultUserName;

        // If firstName is "user" and lastName is "_", don't show it
        if (user.firstName === 'user' && (user.lastName === '_' || !user.lastName)) {
            return null; // Return null to show nothing
        }

        // If we have both firstName and lastName (and lastName is not "_")
        if (user.firstName && user.lastName && user.lastName !== '_') {
            return `${user.firstName} ${user.lastName}`.trim();
        }

        // If we have firstName only
        if (user.firstName && user.firstName !== 'user') {
            return user.firstName;
        }

        // Default fallback
        return null; // Show nothing if no valid name
    };

    const userName = getUserDisplayName();
    const userPhone = user?.phone || config.profile.defaultPhoneText;
    const userEmail = user?.email || config.profile.defaultEmailText;

    if (isGuest || !user) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <ScreenHeader title="Account" />
                <View style={styles.loginRequiredWrapper}>
                    <Text style={styles.loginTitle}>Login to access your account</Text>
                    <Text style={styles.loginSubtitle}>
                        View your orders, addresses, rewards and wishlist after you login.
                    </Text>
                    <TouchableOpacity
                        style={styles.loginCTA}
                        onPress={() => router.push('/(auth)/login' as any)} // Adjust login route as needed
                        activeOpacity={0.85}
                    >
                        <Ionicons name="log-in" size={20} color={Colors.backgroundWhite} style={{ marginRight: 8 }} />
                        <Text style={styles.loginCTAText}>Login</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <ScreenHeader title="Account" />
            <ScrollView
                ref={scrollViewRef}
                style={[styles.scrollView, Platform.OS === 'android' && { backgroundColor: Colors.backgroundWhite }]}
                contentContainerStyle={[styles.scrollContent, Platform.OS === 'android' && { backgroundColor: Colors.backgroundWhite }]}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                scrollEventThrottle={16}
                onScroll={(event) => {
                    const offsetY = event.nativeEvent.contentOffset.y;
                    const isAtTop = offsetY <= 0;
                    setScrollDirection(offsetY, isAtTop);
                }}
                onScrollToTop={() => {
                    reset();
                }}
            >
                {/* Header Section */}
                {config.profile && (
                    <View style={[styles.header, config.styles?.header]}>
                        <View style={styles.profileSection}>
                            {config.profile.showAvatar && (
                                <View style={styles.avatarContainer}>
                                    <View style={[
                                        styles.avatar,
                                        { width: config.profile.avatarSize, height: config.profile.avatarSize, borderRadius: config.profile.avatarSize / 2 }
                                    ]}>
                                        {userName ? (
                                            <Text style={[
                                                styles.avatarText,
                                                { fontSize: config.profile.avatarSize * 0.4 }
                                            ]}>
                                                {userName.charAt(0).toUpperCase()}
                                            </Text>
                                        ) : (
                                            <Ionicons name="person-outline" size={config.profile.avatarSize * 0.5} color={Colors.backgroundWhite} />
                                        )}
                                    </View>
                                </View>
                            )}
                            <View style={styles.userInfo}>
                                {userName && <Text style={styles.userName}>{userName}</Text>}
                                {config.profile.showPhone && userPhone && (
                                    <Text style={styles.userPhone}>{userPhone}</Text>
                                )}
                            </View>
                        </View>
                    </View>
                )}

                {/* Quick Actions */}
                {config.quickActions && config.quickActions.length > 0 && (
                    <View style={[styles.quickActionsContainer, config.styles?.quickActions]}>
                        {config.quickActions.map((action) => {
                            const badgeCount = getBadgeCount(action);
                            const isLoyaltyAction = action.id === 'loyalty';
                            // Check if icon exists in Ionicons, otherwise fallback
                            const iconName = action.icon as any;

                            return (
                                <TouchableOpacity
                                    key={action.id}
                                    style={styles.quickActionCard}
                                    onPress={() => handleAction(action)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.quickActionCardInner}>
                                        <View style={styles.quickActionIconContainer}>
                                            <Ionicons
                                                name={iconName}
                                                size={20}
                                                color={Colors.primary}
                                            />
                                            {action.showBadge && badgeCount > 0 && (
                                                <View style={styles.badge}>
                                                    <Text style={styles.badgeText}>
                                                        {badgeCount > 99 ? '99+' : badgeCount}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.quickActionTitleContainer}>
                                            <Text style={styles.quickActionTitle} numberOfLines={2}>
                                                {action.title}
                                            </Text>
                                            {/* Show Kiddo Cash balance for loyalty action */}
                                            {isLoyaltyAction && (
                                                <View style={styles.loyaltyBalanceContainer}>
                                                    {loadingPoints ? (
                                                        <Text style={styles.loyaltyBalanceText}>...</Text>
                                                    ) : (
                                                        <Text style={styles.loyaltyBalanceText}>
                                                            ₹{Math.round(pointsBalance)}
                                                        </Text>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Menu Items */}
                {config.menuItems && config.menuItems.length > 0 && (
                    <View style={styles.menuContainer}>
                        {config.menuItems.map((item, index) => {
                            const iconName = item.icon as any;

                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[
                                        styles.menuItem,
                                        index === config.menuItems.length - 1 && styles.menuItemLast,
                                    ]}
                                    onPress={() => handleAction(item)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.menuItemLeft}>
                                        <Ionicons
                                            name={iconName}
                                            size={22}
                                            color={Colors.text}
                                            style={styles.menuIcon}
                                        />
                                        <Text style={styles.menuItemText}>
                                            {item.title}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={20}
                                        color={Colors.textSecondary}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                        
                        {/* Logout Button inside menu container */}
                        {config.logout && config.logout.enabled && (
                            <>
                                <View style={styles.menuDivider} />
                                <TouchableOpacity
                                    style={styles.menuItemLogout}
                                    onPress={handleLogout}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.menuItemLeft}>
                                        <Ionicons
                                            name="log-out-outline"
                                            size={22}
                                            color="#ff4444"
                                            style={styles.menuIcon}
                                        />
                                        <Text style={styles.menuItemTextLogout}>
                                            {config.logout.confirmText}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}

                {/* Delete Account Button */}
                <View style={styles.dangerZone}>
                    <TouchableOpacity
                        style={[styles.deleteAccountButton, deletingAccount && styles.deleteAccountButtonDisabled]}
                        onPress={handleDeleteAccount}
                        activeOpacity={0.7}
                        disabled={deletingAccount}
                    >
                        {deletingAccount ? (
                            <>
                                <ActivityIndicator size="small" color="#ff4444" />
                                <Text style={styles.deleteAccountText}>Deleting...</Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="trash-outline" size={20} color="#ff4444" />
                                <Text style={styles.deleteAccountText}>Delete Account</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* App Version */}
                {config.version && config.version.enabled && (
                    <View style={[styles.versionContainer, config.styles?.version]}>
                        <Text style={styles.versionText}>{config.version.text}</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    scrollView: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
        ...Platform.select({
            android: {
                elevation: 0,
            },
        }),
    },
    scrollContent: {
        paddingBottom: 80, // Extra padding for tab bar (60px + safe area)
        flexGrow: 1,
        backgroundColor: Colors.backgroundWhite,
        ...Platform.select({
            android: {
                minHeight: '100%',
            },
        }),
    },
    header: {
        backgroundColor: Colors.backgroundWhite,
        borderBottomColor: Colors.grey,
    },
    profileSection: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatar: {
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: Colors.backgroundWhite,
        fontFamily: Fonts.Bold,
    },
    userInfo: {
        alignItems: 'center',
    },
    userName: {
        fontSize: 22,
        color: Colors.text,
        fontFamily: Fonts.Bold,
        marginBottom: 8,
        textAlign: 'center',
    },
    userPhone: {
        fontSize: 15,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
        textAlign: 'center',
    },
    quickActionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 20,
        gap: 12,
    },
    quickActionCard: {
        flex: 1,
        minWidth: 0,
        aspectRatio: 1,
    },
    quickActionCardInner: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
        width: '100%',
        height: '100%',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    quickActionIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        borderWidth: 2,
        borderColor: Colors.backgroundWhite,
    },
    badgeText: {
        color: Colors.backgroundWhite,
        fontSize: 11,
        fontFamily: Fonts.Bold,
        fontWeight: '700',
    },
    quickActionTitleContainer: {
        minHeight: 56,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    quickActionTitle: {
        fontSize: 14,
        color: Colors.text,
        fontFamily: Fonts.SemiBold,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 20,
    },
    loyaltyBalanceContainer: {
        marginTop: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: Colors.primary,
        borderRadius: 12,
    },
    loyaltyBalanceText: {
        fontSize: 12,
        color: Colors.backgroundWhite,
        fontFamily: Fonts.Bold,
        fontWeight: '700',
    },
    menuContainer: {
        backgroundColor: '#fafafa',
        borderRadius: 16,
        marginHorizontal: 20,
        marginTop: 8,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.border,
        backgroundColor: '#fafafa',
    },
    menuItemLast: {
        borderBottomWidth: 0,
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    menuIcon: {
        marginRight: 16,
    },
    menuItemText: {
        fontSize: 16,
        color: Colors.text,
        fontFamily: Fonts.Medium,
    },
    menuDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.border,
    },
    menuItemLogout: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: '#fafafa',
    },
    menuItemTextLogout: {
        fontSize: 16,
        color: '#ff4444',
        fontFamily: Fonts.SemiBold,
        fontWeight: '600',
    },
    loginRequiredWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: Colors.backgroundWhite,
    },
    loginTitle: {
        fontSize: 20,
        color: Colors.text,
        fontFamily: Fonts.Bold,
        textAlign: 'center',
        marginBottom: 8,
    },
    loginSubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    loginCTA: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
    },
    loginCTAText: {
        fontSize: 16,
        color: '#fff',
        fontFamily: Fonts.SemiBold,
    },
    versionContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    versionText: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
    },
    dangerZone: {
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 10,
    },
    deleteAccountButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ffcccc',
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    deleteAccountText: {
        fontSize: 16,
        color: '#ff4444',
        fontFamily: Fonts.SemiBold,
        marginLeft: 8,
    },
    deleteAccountButtonDisabled: {
        opacity: 0.6,
    },
});
