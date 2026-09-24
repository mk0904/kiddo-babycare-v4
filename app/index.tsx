import { useAuth } from '@/context/AuthContext';
import { Redirect, useRootNavigationState, useSegments } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function Index() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  // Wait for auth rehydration and root router initialization
  if (loading || !rootNavigationState?.key) {
    return <View style={styles.container} />;
  }

  const inAuthGroup = segments[0] === '(auth)';
  const inTabsGroup = segments[0] === '(tabs)';

  if (!isAuthenticated && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isAuthenticated && !inTabsGroup) {
    return <Redirect href="/(tabs)" />;
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

