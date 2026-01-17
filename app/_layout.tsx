import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AnimatedSplashScreen } from '@/components/ui/AnimatedSplashScreen';
import { AddressProvider } from '@/context/AddressContext';
import { AuthProvider } from '@/context/AuthContext';
import { NectorProvider } from '@/context/NectorContext';
import { RecentlyViewedProvider } from '@/context/RecentlyViewedContext';
import { TabBarVisibilityProvider } from '@/context/TabBarVisibilityContext';
import { TryAndBuyProvider } from '@/context/TryAndBuyContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
  const [isSplashVisible, setIsSplashVisible] = React.useState(true);
  const [appIsReady, setAppIsReady] = React.useState(false);

  const [fontsLoaded] = useFonts({
    'Metropolis-Regular': require('../assets/fonts/Metropolis-Regular.otf'),
    'Metropolis-Medium': require('../assets/fonts/Metropolis-Medium.otf'),
    'Metropolis-SemiBold': require('../assets/fonts/Metropolis-SemiBold.otf'),
    'Metropolis-Bold': require('../assets/fonts/Metropolis-Bold.otf'),
  });

  // Hide the native splash screen as soon as component mounts
  // This happens before the custom splash renders
  React.useEffect(() => {
    // Hide native splash immediately
    const hideNativeSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // Ignore errors
      }
    };
    hideNativeSplash();
    
    if (fontsLoaded) {
      setAppIsReady(true);
    }
  }, [fontsLoaded]);

  if (!fontsLoaded || !appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
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
                    <StatusBar style="auto" />
                    </ThemeProvider>
                  </TryAndBuyProvider>
                </RecentlyViewedProvider>
              </WishlistProvider>
            </AddressProvider>
          </NectorProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

