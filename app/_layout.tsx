import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import NetInfo from "@react-native-community/netinfo";
import NoInternetScreen from "@/components/NoInternetScreen";

import { ForceReloginCheck } from '@/components/ForceReloginCheck';
import { UpdateRequiredScreen } from '@/components/UpdateRequiredScreen';
import { AnimatedSplashScreen } from '@/components/ui/AnimatedSplashScreen';
import { EntryScreensCarousel } from '@/components/ui/EntryScreensCarousel';
import { isAppUpdateRequired } from '@/constants/versionConfig';
import { AddressProvider } from '@/context/AddressContext';
import { AuthProvider } from '@/context/AuthContext';
import { NectorProvider } from '@/context/NectorContext';
import { RecentlyViewedProvider } from '@/context/RecentlyViewedContext';
import { LiveDeliveryStackOffsetProvider } from '@/context/LiveDeliveryStackOffsetContext';
import { MilestoneDockProvider } from '@/context/MilestoneDockContext';
import { MilestoneInlineCartProvider } from '@/context/MilestoneInlineCartContext';
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
import type { EntryScreenItem } from '@/types/appConfig';
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
const ANDROID_SPLASH_BG = '#F4EEE5';
const ENTRY_SCREENS_SEEN_KEY = 'entry_screens_seen_v1';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Show push notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Prevent the default Expo splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

let bootExperienceCompletedForSession = false;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const user = useUserStore(state => state.user);
  const [isSplashVisible, setIsSplashVisible] = React.useState(!bootExperienceCompletedForSession);
  const [entryScreens, setEntryScreens] = React.useState<EntryScreenItem[]>([]);
  const [isEntryScreensVisible, setIsEntryScreensVisible] = React.useState(false);
  const [isEntryScreensDecisionPending, setIsEntryScreensDecisionPending] = React.useState(
    !bootExperienceCompletedForSession,
  );
  const [isStartupGateOpen, setIsStartupGateOpen] = React.useState(bootExperienceCompletedForSession);
  const [appIsReady, setAppIsReady] = React.useState(false);
  const metaReadyRef = React.useRef(Platform.OS !== 'ios');
  const metaInitStartedRef = React.useRef(false);
  const entryPrefetchStartedRef = React.useRef(false);
  const [isConnected, setIsConnected] = React.useState<boolean | null>(true);

  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  const updateRequired = useMemo(() => isAppUpdateRequired(currentVersion), [currentVersion]);
  const appConfigPayload = useMemo(
    () => ({
      phone: user?.phone ?? undefined,
      customerId: user?.customerId ?? user?.id ?? undefined,
      appVersion: Constants.expoConfig?.version ?? undefined,
      deviceType: Platform.OS,
    }),
    [user?.phone, user?.customerId, user?.id],
  );

  const resolveEntryScreensDecision = useCallback((screens: EntryScreenItem[]) => {
    setEntryScreens(screens);
    setIsEntryScreensDecisionPending(false);
    if (!isSplashVisible && screens.length > 0) {
      setIsEntryScreensVisible(true);
    }
  }, [isSplashVisible]);

  const prefetchEntryScreens = useCallback(async () => {
    if (bootExperienceCompletedForSession) {
      setIsEntryScreensDecisionPending(false);
      setIsStartupGateOpen(true);
      return;
    }
    if (entryPrefetchStartedRef.current) return;
    entryPrefetchStartedRef.current = true;
    try {
      const alreadySeenEntryScreens = await AsyncStorage.getItem(ENTRY_SCREENS_SEEN_KEY);
      if (alreadySeenEntryScreens === 'true') {
        resolveEntryScreensDecision([]);
        return;
      }

      let screens = appConfigService.getEntryScreens();
      if (screens.length === 0) {
        await Promise.race([
          appConfigService.loadAppConfig(false, appConfigPayload),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
        ]);
        screens = appConfigService.getEntryScreens();
      }
      resolveEntryScreensDecision(screens);
    } catch {
      resolveEntryScreensDecision([]);
    }
  }, [appConfigPayload, resolveEntryScreensDecision]);

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
    Fredoka_600SemiBold,
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
        appConfigService.loadAppConfig(false, appConfigPayload).catch((error) => {
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

    // Initialize OneSignal in background with delay (non-blocking).
    // On iOS, wait for ATT to finish (metaReadyRef) so dialogs don't stack.
    const startOneSignalInit = () => {
      const initOneSignal = async () => {
        try {
          const initPromise = new Promise<boolean>((resolve) => {
            try {
              const initialized = oneSignalService.initialize();
              resolve(initialized);
            } catch {
              resolve(false);
            }
          });

          const timeoutPromise = new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), 5000);
          });

          const initialized = await Promise.race([initPromise, timeoutPromise]);
          if (!initialized) {
            if (Platform.OS === 'ios') {
              console.warn('📱 [OneSignal] On iOS Simulator OneSignal is unavailable. Showing notification permission via expo-notifications so you see the same prompt as on device.');
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

          try {
            const ONESIGNAL_ASKED_KEY = 'onesignal_permission_asked';
            const previouslyAsked = await AsyncStorage.getItem(ONESIGNAL_ASKED_KEY);
            const hasPermission = await oneSignalService.getPermissionStatus();
            if (!hasPermission) {
              await oneSignalService.requestPermission(false);
              await AsyncStorage.setItem(ONESIGNAL_ASKED_KEY, 'true');

              // Only show "Notifications off → Open Settings" for users who previously
              // denied. On first ask the system dialog just appeared; a stale
              // getPermissionStatus() would wrongly trigger this alert (race condition).
              if (Platform.OS === 'ios' && previouslyAsked === 'true') {
                await new Promise(r => setTimeout(r, 500));
                const stillOff = await oneSignalService.getPermissionStatus();
                if (!stillOff) {
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
            }
          } catch (error) {
            if (__DEV__) console.warn('[OneSignal] permission error:', error);
          }

          // Check status in background and register with backend
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
            void clevertapService.syncNativePushTokenWithCleverTap();
          }, 3000);
        } catch (error) {
          if (__DEV__) console.warn('[OneSignal] init error:', error);
        }
      };

      initOneSignal().catch(() => {});
    };

    // On iOS, wait for ATT dialog to resolve before showing notification permission.
    // This prevents permission dialogs from stacking on top of each other.
    if (Platform.OS === 'ios') {
      const waitForATT = () => {
        if (metaReadyRef.current) {
          setTimeout(startOneSignalInit, 300);
        } else {
          setTimeout(waitForATT, 200);
        }
      };
      setTimeout(waitForATT, 500);
    } else {
      setTimeout(startOneSignalInit, 1000);
    }
    
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
  }, [fontsLoaded, fontError, appConfigPayload]);

  React.useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    return () => unsubscribe();
  }, []);

  const handleRetry = useCallback(() => {
    NetInfo.refresh().then(state => {
      setIsConnected(state.isConnected);
    });
  }, []);

  React.useEffect(() => {
    void prefetchEntryScreens();
  }, [prefetchEntryScreens]);

  const handleSplashFinish = useCallback(() => {
    if (bootExperienceCompletedForSession) {
      setIsSplashVisible(false);
      setIsStartupGateOpen(true);
      return;
    }
    setIsSplashVisible(false);
    if (!isEntryScreensDecisionPending && entryScreens.length > 0) {
      setIsEntryScreensVisible(true);
    }
  }, [entryScreens.length, isEntryScreensDecisionPending]);

  React.useEffect(() => {
    if (isSplashVisible) return;
    if (isEntryScreensDecisionPending) return;
    setIsEntryScreensVisible(entryScreens.length > 0);
  }, [isSplashVisible, isEntryScreensDecisionPending, entryScreens.length]);

  React.useEffect(() => {
    if (isSplashVisible) return;
    if (isEntryScreensDecisionPending) return;
    if (isEntryScreensVisible) return;
    if (entryScreens.length === 0) {
      bootExperienceCompletedForSession = true;
      setIsStartupGateOpen(true);
    }
  }, [isSplashVisible, isEntryScreensDecisionPending, isEntryScreensVisible, entryScreens.length]);

  const handleEntryScreensDone = useCallback(() => {
    AsyncStorage.setItem(ENTRY_SCREENS_SEEN_KEY, 'true').catch((error) => {
      if (__DEV__) console.warn('[RootLayout] Failed to persist entry-screen completion:', error);
    });
    setIsEntryScreensVisible(false);
    setEntryScreens([]);
    bootExperienceCompletedForSession = true;
    setIsStartupGateOpen(true);
  }, []);

  const shouldHoldForEntryScreens =
    !isSplashVisible &&
    (isEntryScreensDecisionPending || (entryScreens.length > 0 && !isEntryScreensVisible));

  // Always render providers, even during loading, to prevent "useAuth must be used within AuthProvider" errors
  if (!isConnected) {
    return <NoInternetScreen onRetry={handleRetry} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {isSplashVisible && (
            <AnimatedSplashScreen
              onFinish={handleSplashFinish}
            />
          )}
          {!isSplashVisible && isEntryScreensVisible && (
            <EntryScreensCarousel
              screens={entryScreens}
              onDone={handleEntryScreensDone}
            />
          )}
          {shouldHoldForEntryScreens && (
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: ANDROID_SPLASH_BG, zIndex: 99999 }} />
          )}
          {(!fontsLoaded || !appIsReady || !isStartupGateOpen || shouldHoldForEntryScreens) ? (
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
                    <TabBarVisibilityProvider>
                      <MilestoneDockProvider>
                        <MilestoneInlineCartProvider>
                          <LiveDeliveryStackOffsetProvider>
                            <Stack screenOptions={{ headerShown: false }}>
                              <Stack.Screen name="index" />
                              <Stack.Screen name="(auth)" />
                              <Stack.Screen name="(tabs)" />
                              <Stack.Screen name="products/[id]" />
                              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                            </Stack>
                          </LiveDeliveryStackOffsetProvider>
                        </MilestoneInlineCartProvider>
                      </MilestoneDockProvider>
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

