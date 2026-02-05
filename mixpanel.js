import { NativeModules, Platform } from 'react-native';

// Replace 'YOUR_PROJECT_TOKEN' with your actual Mixpanel project token
// Get it from: https://mixpanel.com/project/settings
const MIXPANEL_TOKEN = 'PLACEHOLDER_MIXPANEL_TOKEN';

// Initialize Mixpanel only if native module is available
let mixpanel = null;

// Check if native module exists before trying to use it
const isNativeModuleAvailable = () => {
  if (Platform.OS === 'web') return false;
  try {
    // Check if the native module is available
    return NativeModules.MixpanelReactNative != null;
  } catch {
    return false;
  }
};

try {
  if (isNativeModuleAvailable()) {
    const { Mixpanel } = require('mixpanel-react-native');
    mixpanel = new Mixpanel(MIXPANEL_TOKEN);
    mixpanel.init();
    console.log('✅ Mixpanel initialized successfully');
  } else {
    console.log('⚠️ Mixpanel native module not available - using fallback');
    // Create a no-op mixpanel object
    mixpanel = {
      track: (event, props) => {
        console.log('[Mixpanel Fallback] Track:', event, props);
      },
      identify: (userId) => {
        console.log('[Mixpanel Fallback] Identify:', userId);
      },
      people: { 
        set: (props) => {
          console.log('[Mixpanel Fallback] People.set:', props);
        }
      },
      reset: () => {
        console.log('[Mixpanel Fallback] Reset');
      },
    };
  }
} catch (error) {
  console.error('❌ Mixpanel initialization failed:', error);
  // Create a no-op mixpanel object for fallback
  mixpanel = {
    track: (event, props) => {
      console.log('[Mixpanel Fallback] Track:', event, props);
    },
    identify: (userId) => {
      console.log('[Mixpanel Fallback] Identify:', userId);
    },
    people: { 
      set: (props) => {
        console.log('[Mixpanel Fallback] People.set:', props);
      }
    },
    reset: () => {
      console.log('[Mixpanel Fallback] Reset');
    },
  };
}

export { mixpanel };

