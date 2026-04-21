import { useEffect } from 'react';
import { useRouter, useSegments, Redirect, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Platform, Share } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/theme';

export default function Index() {
  // Get auth context - will throw if AuthProvider is not in tree
  // This is expected behavior - ensures proper setup
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for auth AND for the router to be fully initialized
    if (loading || !rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const isProductRoute = segments[0] === 'products';
    const isAtRoot = !segments[0] || segments[0] === 'index' || segments[0] === '';

    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Safety timeout: wait for deep link resolution before forcing home redirect
      const timeout = setTimeout(() => {
        if (isAtRoot && !inTabsGroup && !isProductRoute) {
          router.replace('/(tabs)');
        }
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated, loading, segments, router]);

  // Show loading screen while checking auth or waiting for router
  if (loading || !rootNavigationState?.key) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Only allow redirection if we are specifically on the root/index segment
  const isAtRoot = !segments[0] || segments[0] === 'index' || segments[0] === '';

  // If not authenticated, the useEffect and existing layout logic will handle it
  // We return a simple loader while the router resolves the deep link
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundWhite,
  },
});

