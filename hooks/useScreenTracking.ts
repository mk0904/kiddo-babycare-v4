import { trackScreenView } from '@/utils/mixpanelHelpers';
import { useEffect } from 'react';
import { useSegments } from 'expo-router';

/**
 * Hook to automatically track screen views (backend → Mixpanel)
 */
export const useScreenTracking = () => {
  const segments = useSegments();

  useEffect(() => {
    const screenName = segments.length > 0 ? segments[segments.length - 1] : 'Home';
    try {
      trackScreenView(screenName, { path: segments.join('/') });
    } catch {
      // Silently fail
    }
  }, [segments]);
};

