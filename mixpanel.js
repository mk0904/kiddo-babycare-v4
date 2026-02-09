import { NativeModules, Platform } from 'react-native';

// Replace 'YOUR_PROJECT_TOKEN' with your actual Mixpanel project token
// Get it from: https://mixpanel.com/project/settings
const MIXPANEL_TOKEN = 'PLACEHOLDER_MIXPANEL_TOKEN';

// Initialize Mixpanel only if native module is available
let mixpanel = null;

// Initialize Mixpanel - try to use native module, fallback if not available
try {
  if (Platform.OS === 'web') {
    console.log('⚠️ Mixpanel: Web platform - using fallback');
    throw new Error('Web platform');
  }

  // Try to require and initialize Mixpanel
  const { Mixpanel } = require('mixpanel-react-native');
  
  // Check if native module is actually available
  if (NativeModules.MixpanelReactNative == null) {
    console.log('⚠️ Mixpanel: Native module not linked - using fallback');
    console.log('💡 Make sure you ran: npx expo run:ios (not Expo Go)');
    throw new Error('Native module not available');
  }

  // Mixpanel constructor requires: token and trackAutomaticEvents (boolean)
  mixpanel = new Mixpanel(MIXPANEL_TOKEN, true);
  mixpanel.init();
  console.log('✅ Mixpanel initialized successfully');
  console.log('📊 Events will be sent to Mixpanel dashboard');
} catch (error) {
  console.warn('⚠️ Mixpanel initialization failed:', error.message);
  console.log('📝 Using fallback - events logged to console only');
  console.log('💡 To enable Mixpanel: Run "npx expo run:ios" (not Expo Go)');
  
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

