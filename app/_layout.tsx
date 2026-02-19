import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useMemo } from 'react';
import { View } from 'react-native';
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
import { mixpanel } from '@/mixpanel';
import { configService } from '@/services/configService';
import { oneSignalService } from '@/services/oneSignalService';

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
  const [isSplashVisible, setIsSplashVisible] = React.useState(false);
  const [appIsReady, setAppIsReady] = React.useState(false);

  const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
  const updateRequired = useMemo(() => isAppUpdateRequired(currentVersion), [currentVersion]);

  // Track screen views
  useScreenTracking();

  const [fontsLoaded, fontError] = useFonts({
    'Metropolis-Regular': require('../assets/fonts/Metropolis-Regular.otf'),
    'Metropolis-Medium': require('../assets/fonts/Metropolis-Medium.otf'),
    'Metropolis-SemiBold': require('../assets/fonts/Metropolis-SemiBold.otf'),
    'Metropolis-Bold': require('../assets/fonts/Metropolis-Bold.otf'),
  });

  // Hide the native splash screen as soon as component mounts
  // This happens before the custom splash renders
  React.useEffect(() => {
    let fontTimeout: NodeJS.Timeout | null = null;
    let isReadySet = false;

    const setReady = () => {
      if (isReadySet) return;
      isReadySet = true;
      
      if (fontTimeout) {
        clearTimeout(fontTimeout);
        fontTimeout = null;
      }
      
      // Preload config in background (non-blocking)
      // This ensures config is available when OTP service is called
      configService.loadConfig().catch((error) => {
        // Config loading failed, but OTP service will fallback to local config
        if (__DEV__) {
          console.warn('[RootLayout] Failed to preload config:', error);
        }
      });
      
      setAppIsReady(true);
      // Track app opened event
      if (mixpanel) {
        try {
          mixpanel.track('App Opened');
          console.log('✅ Mixpanel: App Opened event tracked');
        } catch (e) {
          console.warn('Mixpanel tracking error:', e);
        }
      } else {
        console.warn('⚠️ Mixpanel not initialized');
      }
    };

    // Set a timeout to ensure app loads even if fonts fail
    fontTimeout = setTimeout(() => {
      console.warn('⚠️ Font loading timeout - proceeding without fonts');
      setReady();
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
            } catch (error) {
              console.warn('⚠️ OneSignal initialization error:', error);
              resolve(false);
            }
          });

          // Add timeout to prevent hanging
          const timeoutPromise = new Promise<boolean>((resolve) => {
            setTimeout(() => {
              console.warn('⚠️ OneSignal initialization timeout');
              resolve(false);
            }, 5000); // 5 second timeout
          });

          const initialized = await Promise.race([initPromise, timeoutPromise]);
          
          if (!initialized) {
            console.error('❌ [OneSignal] Initialization failed or timed out');
            console.error('❌ [OneSignal] This is a critical error - OneSignal will not work');
            return;
          }

          // Request permission only once (persist flag so we don't ask every app open)
          const ONESIGNAL_ASKED_KEY = 'onesignal_permission_asked';
          try {
            const hasPermission = await oneSignalService.getPermissionStatus();
            if (!hasPermission) {
              const alreadyAsked = await AsyncStorage.getItem(ONESIGNAL_ASKED_KEY);
              if (alreadyAsked !== 'true') {
                await oneSignalService.requestPermission(true);
                await AsyncStorage.setItem(ONESIGNAL_ASKED_KEY, 'true');
              }
            }
          } catch (error) {
            console.warn('⚠️ OneSignal permission request error:', error);
          }

          // Check status in background (non-blocking) - increased delay for better reliability
          setTimeout(async () => {
            try {
              // 2️⃣ Check permission status
              const perm = await oneSignalService.getPermissionStatus();
              console.log('📱 Permission Status:', perm);
              
              // 3️⃣ & 4️⃣ Check subscription status and ID
              const subStatus = await oneSignalService.checkSubscriptionStatus();
              console.log('📱 Subscription Status:', subStatus);
              
              // Get comprehensive debug info (for logging only, no alerts)
              const debugInfo = await oneSignalService.getDebugInfo();
              console.log('📱 [OneSignal] Debug info:', debugInfo);
              
              if (subStatus.isSubscribed && subStatus.id) {
                console.log('✅ OneSignal push is set up correctly!');
              } else {
                console.warn('⚠️ OneSignal push not fully set up:', subStatus);
              }
            } catch (error) {
              console.warn('⚠️ OneSignal status check error:', error);
            }
          }, 5000); // Wait 5 seconds before checking status (gives OneSignal time to fully initialize and subscribe)
        } catch (error) {
          console.warn('⚠️ OneSignal initialization error:', error);
        }
      };

      // Run OneSignal initialization in background (non-blocking)
      initOneSignal().catch((error) => {
        console.warn('⚠️ OneSignal init error:', error);
      });
    }, 5000); // Delay OneSignal init by 5 seconds to ensure app loads first
    
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
      setReady();
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

