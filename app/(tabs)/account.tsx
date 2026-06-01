import { accountConfig } from '@/config/accountConfig';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { nectorApi } from '@/services/nectorApi';
import { oneSignalService } from '@/services/oneSignalService';
import { useCartItemCount } from '@/store/cartStore';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigationState } from '@react-navigation/native';
import { useRouter, useSegments } from 'expo-router';
import { Freshchat } from 'react-native-freshchat-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

    const handleRequestNotificationPermission = async () => {
        const ONESIGNAL_ASKED_KEY = 'onesignal_permission_asked';
        try {
            // Always check current status first – if already allowed, don’t show any dialog
            const hasPermission = await oneSignalService.getPermissionStatus();
            if (hasPermission) {
                Alert.alert('Notifications', 'Notifications are already enabled for this app.');
                return;
            }
            const alreadyAsked = await AsyncStorage.getItem(ONESIGNAL_ASKED_KEY);
            if (alreadyAsked === 'true') {
                // They denied before; open Settings so they can enable there
                await Linking.openSettings();
                return;
            }
            // First time: show system Allow dialog only (no “Open Settings” prompt)
            await oneSignalService.requestPermission(false);
            await AsyncStorage.setItem(ONESIGNAL_ASKED_KEY, 'true');
        } catch (error: any) {
            if (__DEV__) console.warn('[OneSignal] Permission request error:', error);
        }
    };

    const handleDeleteAccount = () => {
        try {
            const { trackTappedInProfile } = require('@/utils/mixpanelHelpers');
            trackTappedInProfile('Delete account');
        } catch (e) {
            console.warn('Analytics tracking error:', e);
        }

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
        try {
            const { trackTappedInProfile } = require('@/utils/mixpanelHelpers');
            trackTappedInProfile(actionConfig.title || actionConfig.action?.type || 'unknown_option');
        } catch (e) {
            console.warn('Analytics tracking error:', e);
        }

        const { type, ...params } = actionConfig.action;

        switch (type) {
            case 'navigate':
                if (params.screen) {
                    // Adjust navigation to Expo Router paths
                    const screenMap: { [key: string]: string } = {
                        'Orders': '/orders',
                        'Loyalty': '/loyalty',
                        'Rewards': '/rewards',
                        'Referral': '/referral',
                        'Wallet': '/wallet',
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

            case 'freshchat':
                Freshchat.showConversations();
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
        return null;
    };

    const getUserInitials = () => {
        if (!user) return 'U';
        const first = user.firstName && user.firstName !== 'user' ? user.firstName.charAt(0) : '';
        const last = user.lastName && user.lastName !== '_' ? user.lastName.charAt(0) : '';
        return (first + last).toUpperCase() || 'U';
    };

    const userName = getUserDisplayName();
    const userPhone = user?.phone || config.profile.defaultPhoneText;
    const userEmail = user?.email || config.profile.defaultEmailText;

    if (isGuest || !user) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <View style={styles.customHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Account</Text>
                </View>
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
            <View style={styles.customHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Account</Text>
            </View>
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
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
                    <View style={styles.header}>
                        <View style={styles.profileSection}>
                            {config.profile.showAvatar && (
                                <View style={styles.avatarContainer}>
                                    <View style={[
                                        styles.avatar,
                                        { width: config.profile.avatarSize, height: config.profile.avatarSize, borderRadius: config.profile.avatarSize / 2 }
                                    ]}>
                                        <Text style={styles.avatarText}>
                                            {getUserInitials()}
                                        </Text>
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
                    <View style={styles.quickActionsContainer}>
                        {config.quickActions.map((action) => {
                            const badgeCount = getBadgeCount(action);
                            const iconName = action.icon as any;

                            return (
                                <TouchableOpacity
                                    key={action.id}
                                    style={styles.quickActionCard}
                                    onPress={() => handleAction(action)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.quickActionCardInner}>
                                        <View style={styles.quickActionIconCircle}>
                                            <Ionicons
                                                name={iconName}
                                                size={24}
                                                color={Colors.primary}
                                            />
                                        </View>
                                        <Text style={styles.quickActionTitle}>
                                            {action.title}
                                        </Text>

                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* Menu Items */}
                <View style={styles.menuCard}>
                    {config.menuItems && config.menuItems.length > 0 && config.menuItems.map((item, index) => {
                        const iconName = item.icon as any;

                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={[
                                    styles.menuItem,
                                    index === 0 && { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
                                ]}
                                onPress={() => handleAction(item)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.menuItemLeft}>
                                    <Ionicons
                                        name={iconName}
                                        size={20}
                                        color={'#181D27'}
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

                    {/* Logout Button inside menu card */}
                    {config.logout && config.logout.enabled && (
                        <TouchableOpacity
                            style={[styles.menuItem, { borderBottomWidth: 0, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }]}
                            onPress={handleLogout}
                            activeOpacity={0.7}
                        >
                            <View style={styles.menuItemLeft}>
                                <Ionicons
                                    name="log-out-outline"
                                    size={22}
                                    color={Colors.primary}
                                    style={styles.menuIcon}
                                />
                                <Text style={[styles.menuItemText, { color: Colors.primary }]}>
                                    {config.logout.confirmText}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Notification Permission Card */}
                {oneSignalService.isAvailable() && (
                    <TouchableOpacity
                        style={styles.notificationCard}
                        onPress={handleRequestNotificationPermission}
                        activeOpacity={0.7}
                    >
                        <View style={styles.menuItemLeft}>
                            <Ionicons
                                name="notifications-outline"
                                size={22}
                                color={Colors.text}
                                style={styles.menuIcon}
                            />
                            <Text style={styles.menuItemText}>
                                Enable notifications
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={Colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}

                {/* Delete Account Button */}
                <TouchableOpacity
                    style={styles.deleteAccountWrapper}
                    onPress={handleDeleteAccount}
                    activeOpacity={0.7}
                    disabled={deletingAccount}
                >
                    {deletingAccount ? (
                        <ActivityIndicator size="small" color={Colors.textSecondary} />
                    ) : (
                        <>
                            <Ionicons name="trash-outline" size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                            <Text style={styles.deleteAccountText}>Delete account</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* App Version */}
                {config.version && config.version.enabled && (
                    <View style={styles.versionContainer}>
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
        backgroundColor: '#F8F9FB',
    },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backButton: {
        padding: 4,
        marginRight: 15,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        paddingTop: 30,
        paddingBottom: 20,
        backgroundColor: '#F8F9FB',
    },
    profileSection: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarContainer: {
        marginBottom: 16,
    },
    avatar: {
        backgroundColor: '#EEEEEE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: Colors.primary,
        fontFamily: Fonts.Bold,
        fontSize: 32,
    },
    userInfo: {
        alignItems: 'center',
    },
    userName: {
        fontSize: 22,
        color: Colors.text,
        fontFamily: Fonts.Bold,
        marginBottom: 4,
        textAlign: 'center',
    },
    userPhone: {
        fontSize: 16,
        color: Colors.textSecondary,
        fontFamily: Fonts.Medium,
        textAlign: 'center',
    },
    quickActionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    quickActionCard: {
        flex: 1,
        marginHorizontal: 6,
    },
    quickActionCardInner: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 20,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',

    },
    quickActionIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#0000000D',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    quickActionTitle: {
        fontSize: 12,
        color: '#181D27',
        fontFamily: Fonts.LexendMedium,
        textAlign: 'center',
        lineHeight: 18,
    },

    menuCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 20,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F2',
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    menuIcon: {
        marginRight: 14,
        color: '#181D27',
    },
    menuItemText: {
        fontSize: Fonts.SmallFontSize,
        color: '#181D27',
        fontFamily: Fonts.LexendMedium,
    },
    notificationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 18,
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    deleteAccountWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    deleteAccountText: {
        fontSize: 16,
        color: Colors.textSecondary,
        fontFamily: Fonts.Medium,
    },
    versionContainer: {
        alignItems: 'center',
        marginTop: 20,
        paddingBottom: 20,
    },
    versionText: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
    },
    loginRequiredWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#FFFFFF',
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
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: Fonts.Bold,
    },
});