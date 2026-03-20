import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { Alert, Linking, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { ForceReloginCheck } from '@/components/ForceReloginCheck';
import { UpdateRequiredScreen } from '@/components/UpdateRequiredScreen';
import { AnimatedSplashScreen } from '@/components/ui/AnimatedSplashScreen';
import { isAppUpdateRequired } from '@/constants/versionConfig';
import { AddressProvider } from '@/context/AddressContext';
import { AuthProvider } from '@/context/AuthContext';
import { NectorProvider } from '@/context/NectorContext';
import { RecentlyViewedProvider } from '@/context/RecentlyViewedContext';
import { TabBarVisibilityProvider } from '@/context/TabBarVisibilityContext';
import { TryAndBuyProvider } from '@/context/TryAndBuyContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { appConfigService } from '@/services/appConfigService';
import { configService } from '@/services/configService';
import { oneSignalService } from '@/services/oneSignalService';
import { pushRegistrationService } from '@/services/pushRegistrationService';
import { useUserStore } from '@/store/userStore';
import { initMetaSDK, requestMetaTrackingPermission } from '@/utils/metaSDK';
import { clevertapService } from '@/services/clevertapService';
import { identifyUser, trackEvent } from '@/utils/mixpanelHelpers';

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Cache data for 5 minutes
      gcTime: 1000 * 60 * 10, // Keep data in memory for 10 minutes (formerly cacheTime)
    },
  },
});

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the default Expo splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const user = useUserStore(state => state.user);
  const [isSplashVisible, setIsSplashVisible] = React.useState(false);
  const [appIsReady, setAppIsReady] = React.useState(false);
  const metaReadyRef = React.useRef(Platform.OS !== 'ios');
  const metaInitStartedRef = React.useRef(false);

  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  const updateRequired = useMemo(() => isAppUpdateRequired(currentVersion), [currentVersion]);

  // Track screen views
  useScreenTracking();

  const [fontsLoaded, fontError] = useFonts({
    'Metropolis-Regular': require('../assets/fonts/Metropolis-Regular.otf'),
    'Metropolis-Medium': require('../assets/fonts/Metropolis-Medium.otf'),
    'Metropolis-SemiBold': require('../assets/fonts/Metropolis-SemiBold.otf'),
    'Metropolis-Bold': require('../assets/fonts/Metropolis-Bold.otf'),
    bogart: require('./assets/fonts/BOGARTREGULARTRIAL.ttf'),
    'Bogart-SemiBold': require('../assets/fonts/Bogart-Alt-Medium-trial.ttf'),
    // Each weight loaded as its own family so components can use fontFamily: 'Lexend-Bold'
    // without needing fontWeight – which reliably works on both iOS and Android.
    'Lexend': require('../assets/fonts/Lexend-Regular.ttf'),
    'Lexend-Regular': require('../assets/fonts/Lexend-Regular.ttf'),
    'Lexend-Medium': require('../assets/fonts/Lexend-Medium.ttf'),
    'Lexend-SemiBold': require('../assets/fonts/Lexend-SemiBold.ttf'),
    'Lexend-Bold': require('../assets/fonts/Lexend-Bold.ttf'),
  });

  React.useEffect(() => {
    if (fontsLoaded) console.log('[Fonts] Loaded OK:', fontsLoaded);
    if (fontError) console.warn('[Fonts] Error:', fontError);
  }, [fontsLoaded, fontError]);


  // Hide the native splash screen as soon as component mounts
  // This happens before the custom splash renders
  React.useEffect(() => {
    let fontTimeout: ReturnType<typeof setTimeout> | null = null;
    let isReadySet = false;

    const setReady = () => {
      if (isReadySet) return;
      isReadySet = true;
      
      if (fontTimeout) {
        clearTimeout(fontTimeout);
        fontTimeout = null;
      }
      
      // Preload config in background (non-blocking), then app config from backend (cart/checkout, free shoes, gift wrap)
      configService.loadConfig().then(() => {
        appConfigService.loadAppConfig(false, {
          phone: user?.phone ?? undefined,
          customerId: user?.customerId ?? user?.id ?? undefined,
          appVersion: Constants.expoConfig?.version ?? undefined,
          deviceType: Platform.OS,
        }).catch((error) => {
          if (__DEV__) console.warn('[RootLayout] Failed to load app config from backend:', error);
        });
      }).catch((error) => {
        if (__DEV__) console.warn('[RootLayout] Failed to preload config:', error);
      });
      
      setAppIsReady(true);
      try {
        // Identify user on app open so CleverTap attributes App Launched to profile (DAU/WAU/MAU)
        const u = useUserStore.getState().user;
        if (u) {
          const uid = u.id || u.customerId || u.email || u.phone;
          if (uid) identifyUser(uid, { name: u.firstName || (u as any).name, email: u.email, phone: u.phone });
        }
        trackEvent('App Opened');
      } catch (e) {
        console.warn('Analytics tracking error:', e);
      }
    };

    // On iOS: only set ready (and thus send events) after ATT + ATE flag + Meta init.
    const trySetReady = () => {
      if (isReadySet) return;
      if (Platform.OS === 'ios' && !metaReadyRef.current) return;
      if (!fontsLoaded && !fontError) return;
      setReady();
    };

    // Meta order on iOS: request ATT → set ATE flag → init SDK → then send events.
    // Guard with a ref so this only runs once, even if the effect re-runs due to font state changes.
    if (!metaInitStartedRef.current) {
      metaInitStartedRef.current = true;
      (async () => {
        try {
          if (Platform.OS === 'ios') {
            await requestMetaTrackingPermission();
          }
          initMetaSDK();
          if (Platform.OS === 'ios') metaReadyRef.current = true;
        } catch (e) {
          if (__DEV__) console.warn('[Meta SDK] early init error:', e);
          if (Platform.OS === 'ios') metaReadyRef.current = true;
        }
        trySetReady();
      })();
    }

    // Set a timeout to ensure app loads even if fonts fail
    fontTimeout = setTimeout(() => {
      console.warn('⚠️ Font loading timeout - proceeding without fonts');
      trySetReady();
    }, 5000); // 5 second timeout

    // Initialize OneSignal in background with delay (non-blocking)
    // Delay to ensure app loads first, then initialize OneSignal
    setTimeout(() => {
      const initOneSignal = async () => {
        try {
          // 1️⃣ Initialize OneSignal with timeout protection
          const initPromise = new Promise<boolean>((resolve) => {
            try {
              const initialized = oneSignalService.initialize();
              resolve(initialized);
            } catch {
              resolve(false);
            }
          });

          // Add timeout to prevent hanging
          const timeoutPromise = new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), 5000);
          });

          const initialized = await Promise.race([initPromise, timeoutPromise]);
          if (!initialized) {
            if (Platform.OS === 'ios') {
              console.warn('📱 [OneSignal] On iOS Simulator OneSignal is unavailable. Showing notification permission via expo-notifications so you see the same prompt as on device.');
              // On iOS Simulator, still show the system notification permission dialog (expo-notifications fallback)
              const ONESIGNAL_ASKED_KEY = 'onesignal_permission_asked';
              try {
                const alreadyAsked = await AsyncStorage.getItem(ONESIGNAL_ASKED_KEY);
                if (alreadyAsked !== 'true') {
                  const { status: existing } = await Notifications.getPermissionsAsync();
                  if (existing !== 'granted') {
                    await Notifications.requestPermissionsAsync();
                  }
                  await AsyncStorage.setItem(ONESIGNAL_ASKED_KEY, 'true');
                }
              } catch (e) {
                console.warn('📱 [OneSignal] expo-notifications fallback failed:', e);
              }
            }
            // Register native push token with CleverTap when OneSignal init fails (token is independent per provider)
            void clevertapService.syncNativePushTokenWithCleverTap();
            try {
              const userStore = useUserStore.getState();
              const userId =
                userStore.user?.id ||
                userStore.user?.customerId ||
                userStore.user?.email ||
                userStore.user?.phone ||
                null;
              if (userId) await pushRegistrationService.registerWithBackend(userId, null);
            } catch (e) {
              if (__DEV__) console.warn('[Push] Backend registration failed:', e);
            }
            return;
          }

          // When permission is off, always try the system prompt. On iOS, after user has denied or disabled in Settings, the system won't show "Allow" again – so we offer Settings.
          try {
            const hasPermission = await oneSignalService.getPermissionStatus();
            if (!hasPermission) {
              await oneSignalService.requestPermission(false);
              await AsyncStorage.setItem('onesignal_permission_asked', 'true');
              const stillOff = await oneSignalService.getPermissionStatus();
              if (Platform.OS === 'ios' && !stillOff) {
                Alert.alert(
                  'Notifications off',
                  'To get order updates and offers, enable notifications in Settings.',
                  [
                    { text: 'Later', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => Linking.openSettings() },
                  ]
                );
              }
            }
          } catch (error) {
            if (__DEV__) console.warn('[OneSignal] permission error:', error);
          }

          // Check status in background and register with backend when we have subscription id + user
          setTimeout(async () => {
            try {
              const subStatus = await oneSignalService.checkSubscriptionStatus();
              try {
                const userStore = useUserStore.getState();
                const userId =
                  userStore.user?.id ||
                  userStore.user?.customerId ||
                  userStore.user?.email ||
                  userStore.user?.phone ||
                  null;
                if (userId) {
                  await pushRegistrationService.registerWithBackend(
                    userId,
                    subStatus.isSubscribed && subStatus.id ? subStatus.id : null
                  );
                }
              } catch (e) {
                if (__DEV__) console.warn('[Push] Backend registration failed:', e);
              }
            } catch (error) {
              if (__DEV__) console.warn('[OneSignal] status check error:', error);
            }
            // CleverTap: explicit native token (FCM / APNs) — see clevertapService.syncNativePushTokenWithCleverTap
            void clevertapService.syncNativePushTokenWithCleverTap();
          }, 3000); // Wait 3 seconds before checking (gives OneSignal time to subscribe)
        } catch (error) {
          if (__DEV__) console.warn('[OneSignal] init error:', error);
        }
      };

      // Run OneSignal initialization in background (non-blocking)
      initOneSignal().catch(() => {});
    }, 1000); // Short delay so app mounts first, then init OneSignal (was 5s – reduced so push subscribes sooner)
    
    // Hide native splash immediately
    const hideNativeSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // Ignore errors
      }
    };
    hideNativeSplash();
    
    // Set app ready if fonts loaded OR if there was an error (don't block on font errors)
    if (fontsLoaded || fontError) {
      trySetReady();
    }

    // Cleanup timeout
    return () => {
      if (fontTimeout) {
        clearTimeout(fontTimeout);
      }
    };
  }, [fontsLoaded, fontError]);

  // Always render providers, even during loading, to prevent "useAuth must be used within AuthProvider" errors
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {(!fontsLoaded || !appIsReady) ? (
            null
          ) : updateRequired ? (
            <View style={{ flex: 1 }}>
              <UpdateRequiredScreen />
            </View>
          ) : (
          <>
            <ForceReloginCheck />
            <NectorProvider>
            <AddressProvider>
              <WishlistProvider>
                <RecentlyViewedProvider>
                  <TryAndBuyProvider>
                    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                    {isSplashVisible && (
                      <AnimatedSplashScreen
                        onFinish={() => setIsSplashVisible(false)}
                      />
                    )}
                    <TabBarVisibilityProvider>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                      </Stack>
                    </TabBarVisibilityProvider>
                    <StatusBar style="dark" />
                    </ThemeProvider>
                  </TryAndBuyProvider>
                </RecentlyViewedProvider>
              </WishlistProvider>
            </AddressProvider>
          </NectorProvider>
          </>
          )}
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

