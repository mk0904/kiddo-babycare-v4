import { useEffect } from 'react';
import { useSegments } from 'expo-router';

/**
 * Hook to automatically track screen views in Mixpanel
 * Call this in your root layout or any screen component
 */
export const useScreenTracking = () => {
  const segments = useSegments();

  useEffect(() => {
    // Get current screen name from segments
    const screenName = segments.length > 0 
      ? segments[segments.length - 1] 
      : 'Home';

    // Track screen view
    try {
      const { mixpanel } = require('@/mixpanel');
      if (mixpanel) {
        mixpanel.track('Screen View', {
          screen: screenName,
          path: segments.join('/'),
        });
      }
    } catch (e) {
      // Silently fail - mixpanel might not be initialized
    }
  }, [segments]);
};

