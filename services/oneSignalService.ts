// Import OneSignal - Android uses direct import (original working code), iOS uses safe import for simulator
import { Platform } from 'react-native';

let OneSignal: any = null;
let importError: any = null;

if (Platform.OS === 'android') {
  // Android: Use original direct import - this was working perfectly
  // @ts-ignore - Direct import works fine on Android
  try {
    OneSignal = require('react-native-onesignal').default;
    console.log('✅ [OneSignal] Android module loaded');
  } catch (error: any) {
    console.error('❌ [OneSignal] Android import failed:', error);
    importError = error;
  }
} else {
  // iOS: Use safe lazy import to handle simulator NativeEventEmitter error
  try {
    console.log('🔵 [OneSignal] Attempting to load iOS module...');
    const OneSignalModule = require('react-native-onesignal');
    // OneSignal v5 structure: module has OneSignal.OneSignal property
    const moduleExports = OneSignalModule.default || OneSignalModule;
    console.log('🔵 [OneSignal] Module keys:', moduleExports ? Object.keys(moduleExports) : 'null');
    
    // Try to get the actual OneSignal SDK object
    // In v5, it might be at OneSignal.OneSignal or just OneSignal
    if (moduleExports?.OneSignal) {
      OneSignal = moduleExports.OneSignal;
      console.log('✅ [OneSignal] iOS module loaded via OneSignal.OneSignal');
    } else if (typeof moduleExports?.initialize === 'function') {
      OneSignal = moduleExports;
      console.log('✅ [OneSignal] iOS module loaded directly');
    } else {
      OneSignal = moduleExports;
      console.log('✅ [OneSignal] iOS module loaded (fallback)');
    }
    console.log('🔵 [OneSignal] Final OneSignal type:', typeof OneSignal);
    console.log('🔵 [OneSignal] Final OneSignal keys:', OneSignal ? Object.keys(OneSignal) : 'null');
  } catch (error: any) {
    importError = error;
    // Use warn so dev overlay doesn't block the app when OneSignal isn't available (e.g. simulator)
    console.warn('❌ [OneSignal] iOS import failed:', error?.message ?? error);
    if (error?.message?.includes('NativeEventEmitter') || error?.message?.includes('requires a non-null argument')) {
      console.log('📱 [OneSignal] Disabled (iOS simulator / native module not available)');
    } else {
      console.warn('⚠️ [OneSignal] Module not available on iOS. In production ensure: 1) Native module linked 2) Pods installed 3) Framework in build');
    }
  }
}

const ONESIGNAL_APP_ID = 'f27e340f-3a14-47bb-abef-d94319e7e93e';

/**
 * OneSignal Service
 * Handles OneSignal initialization and permission requests
 */
export const oneSignalService = {
  /**
   * Initialize OneSignal
   * Should be called once when app starts
   */
  initialize: (): boolean => {
    try {
      console.log('🔵 [OneSignal] Starting initialization...');
      console.log('🔵 [OneSignal] OneSignal module check:', !!OneSignal);
      
      // Check if OneSignal module exists
      if (!OneSignal) {
        console.warn('❌ [OneSignal] Module not found. Run: cd ios && pod install; ensure framework is in build.');
        return false;
      }

      console.log('🔵 [OneSignal] Module found, checking methods...');
      console.log('🔵 [OneSignal] OneSignal type:', typeof OneSignal);
      console.log('🔵 [OneSignal] OneSignal keys:', Object.keys(OneSignal || {}));
      
      // Check if we need to access OneSignal.OneSignal (v5 structure)
      let actualOneSignal = OneSignal;
      if (OneSignal?.OneSignal && typeof OneSignal.OneSignal === 'object') {
        console.log('🔵 [OneSignal] Found OneSignal.OneSignal structure, using nested object');
        actualOneSignal = OneSignal.OneSignal;
        console.log('🔵 [OneSignal] Nested OneSignal keys:', Object.keys(actualOneSignal || {}));
      }
      
      console.log('🔵 [OneSignal] Has initialize?', typeof actualOneSignal?.initialize === 'function');
      console.log('🔵 [OneSignal] Has setAppId?', typeof actualOneSignal?.setAppId === 'function');
      console.log('🔵 [OneSignal] Has Debug?', typeof actualOneSignal?.Debug === 'object');
      console.log('🔵 [OneSignal] Has Notifications?', typeof actualOneSignal?.Notifications === 'object');

      // Try different initialization methods for v5
      if (typeof actualOneSignal?.initialize === 'function') {
        console.log('🔵 [OneSignal] Using initialize() method');
        actualOneSignal.initialize(ONESIGNAL_APP_ID);
        console.log('✅ [OneSignal] Initialized successfully via initialize()');
        // Update OneSignal reference to the initialized object
        OneSignal = actualOneSignal;
        return true;
      } else if (typeof actualOneSignal?.setAppId === 'function') {
        console.log('🔵 [OneSignal] Using setAppId() method');
        actualOneSignal.setAppId(ONESIGNAL_APP_ID);
        console.log('✅ [OneSignal] Initialized successfully via setAppId()');
        OneSignal = actualOneSignal;
        return true;
      } else if (actualOneSignal?.Notifications) {
        // OneSignal v5 might auto-initialize, just verify it's available
        console.log('🔵 [OneSignal] Notifications API available, assuming initialized');
        console.log('🔵 [OneSignal] Trying to set App ID via Notifications...');
        try {
          // Some v5 versions initialize automatically, just need to verify
          if (actualOneSignal.Debug) {
            actualOneSignal.Debug.setLogLevel(actualOneSignal.LogLevel.Verbose);
          }
          OneSignal = actualOneSignal;
          console.log('✅ [OneSignal] Initialized (auto-initialized or already initialized)');
          return true;
        } catch (e: any) {
          console.error('❌ [OneSignal] Auto-init check failed:', e);
        }
      }
      
      // Last resort: try direct initialization
      console.log('🔵 [OneSignal] Trying direct initialization...');
      try {
        (actualOneSignal as any).initialize(ONESIGNAL_APP_ID);
        console.log('✅ [OneSignal] Initialized successfully (direct call)');
        OneSignal = actualOneSignal;
        return true;
      } catch (e: any) {
        console.error('❌ [OneSignal] Direct initialization failed:', e);
        console.error('❌ [OneSignal] Error message:', e?.message);
        console.error('❌ [OneSignal] Error stack:', e?.stack);
        console.error('❌ [OneSignal] OneSignal object structure:', {
          type: typeof actualOneSignal,
          keys: Object.keys(actualOneSignal || {}),
          hasInitialize: typeof actualOneSignal?.initialize,
          hasSetAppId: typeof actualOneSignal?.setAppId,
          hasNotifications: !!actualOneSignal?.Notifications,
        });
        return false;
      }
    } catch (error: any) {
      console.error('❌ [OneSignal] Initialization exception:', error);
      console.error('❌ [OneSignal] Error message:', error?.message);
      console.error('❌ [OneSignal] Error stack:', error?.stack);
      return false;
    }
  },

  /**
   * Request notification permission
   * Can be called on app open or when user clicks a button
   * @param fallbackToSettings - If true, will show native settings if permission was previously denied
   */
  requestPermission: async (fallbackToSettings: boolean = true): Promise<boolean> => {
    try {
      // Handle v5 nested structure
      let actualOneSignal = OneSignal;
      if (OneSignal?.OneSignal && typeof OneSignal.OneSignal === 'object') {
        actualOneSignal = OneSignal.OneSignal;
      }
      
      if (!actualOneSignal || !actualOneSignal.Notifications) {
        console.warn('⚠️ OneSignal.Notifications not available');
        return false;
      }

      if (typeof actualOneSignal.Notifications.requestPermission === 'function') {
        const result = await actualOneSignal.Notifications.requestPermission(fallbackToSettings);
        console.log('✅ OneSignal permission request result:', result);
        return result;
      } else {
        console.warn('⚠️ OneSignal.Notifications.requestPermission not available');
        return false;
      }
    } catch (error) {
      console.warn('⚠️ OneSignal permission request failed:', error);
      return false;
    }
  },

  /**
   * Check if OneSignal is available
   */
  isAvailable: (): boolean => {
    if (!OneSignal) return false;
    
    // Check if it's the nested structure (OneSignal.OneSignal)
    const actualOneSignal = OneSignal.OneSignal || OneSignal;
    
    // OneSignal is available if it has Notifications API or initialize method
    return !!(actualOneSignal && (
      typeof actualOneSignal.initialize === 'function' ||
      typeof actualOneSignal.setAppId === 'function' ||
      actualOneSignal.Notifications !== undefined
    ));
  },

  /**
   * Get current permission status
   */
  getPermissionStatus: async (): Promise<boolean> => {
    try {
      // Handle v5 nested structure
      let actualOneSignal = OneSignal;
      if (OneSignal?.OneSignal && typeof OneSignal.OneSignal === 'object') {
        actualOneSignal = OneSignal.OneSignal;
      }
      
      if (!actualOneSignal || !actualOneSignal.Notifications) {
        return false;
      }

      // Check permission using OneSignal API
      const perm = await actualOneSignal.Notifications.getPermissionAsync();
      console.log('📱 OneSignal Permission Status:', perm);
      return perm;
    } catch (error) {
      console.warn('⚠️ Failed to get OneSignal permission status:', error);
      return false;
    }
  },

  /**
   * Check push subscription status and ID
   * Returns subscription info including isSubscribed and id
   */
  checkSubscriptionStatus: async (): Promise<{ isSubscribed: boolean; id: string | null }> => {
    try {
      // Handle v5 nested structure
      let actualOneSignal = OneSignal;
      if (OneSignal?.OneSignal && typeof OneSignal.OneSignal === 'object') {
        actualOneSignal = OneSignal.OneSignal;
      }
      
      if (!actualOneSignal || !actualOneSignal.User || !actualOneSignal.User.pushSubscription) {
        console.warn('⚠️ OneSignal.User.pushSubscription not available');
        return { isSubscribed: false, id: null };
      }

      const id = await actualOneSignal.User.pushSubscription.getIdAsync();
      const isOptedIn = await actualOneSignal.User.pushSubscription.getOptedInAsync();
      
      console.log('📱 OneSignal Subscription Status:', {
        isSubscribed: isOptedIn,
        id: id,
      });
      
      return {
        isSubscribed: isOptedIn || false,
        id: id || null,
      };
    } catch (error) {
      console.warn('⚠️ Failed to get OneSignal subscription status:', error);
      return { isSubscribed: false, id: null };
    }
  },

  /**
   * Get comprehensive debug information for troubleshooting
   * Returns detailed status including all relevant info
   */
  getDebugInfo: async (): Promise<{
    platform: string;
    isAvailable: boolean;
    isInitialized: boolean;
    permissionStatus: boolean | null;
    subscriptionStatus: { isSubscribed: boolean; id: string | null };
    errors: string[];
    importError: string | null;
    initializationError: string | null;
    permissionError: string | null;
    subscriptionError: string | null;
  }> => {
    const debugInfo: any = {
      platform: Platform.OS,
      isAvailable: false,
      isInitialized: false,
      permissionStatus: null,
      subscriptionStatus: { isSubscribed: false, id: null },
      errors: [],
      importError: null,
      initializationError: null,
      permissionError: null,
      subscriptionError: null,
    };

    // Capture import error details
    if (importError) {
      const importErrMsg = `Import Error: ${importError?.message || 'Unknown'}\nCode: ${importError?.code || 'N/A'}\nStack: ${importError?.stack ? importError.stack.substring(0, 200) : 'N/A'}`;
      debugInfo.importError = importErrMsg;
      debugInfo.errors.push(importErrMsg);
    }

    try {
      // Check if OneSignal module is available
      // Handle v5 structure where OneSignal might be nested
      let actualOneSignal = OneSignal;
      if (OneSignal?.OneSignal && typeof OneSignal.OneSignal === 'object') {
        actualOneSignal = OneSignal.OneSignal;
      }
      
      debugInfo.isAvailable = !!(actualOneSignal && (
        typeof actualOneSignal.initialize === 'function' ||
        typeof actualOneSignal.setAppId === 'function' ||
        actualOneSignal.Notifications !== undefined
      ));
      
      if (!debugInfo.isAvailable) {
        const errMsg = 'OneSignal module not available - require() returned null/undefined or invalid structure';
        debugInfo.errors.push(errMsg);
        debugInfo.error = errMsg;
        
        // Add more details about why it's not available
        if (!OneSignal) {
          debugInfo.errors.push('OneSignal variable is null/undefined');
        } else {
          debugInfo.errors.push(`OneSignal keys: ${Object.keys(OneSignal || {}).join(', ')}`);
          if (OneSignal.OneSignal) {
            debugInfo.errors.push(`OneSignal.OneSignal keys: ${Object.keys(OneSignal.OneSignal || {}).join(', ')}`);
          }
          if (typeof actualOneSignal?.initialize !== 'function') {
            debugInfo.errors.push(`OneSignal.initialize is not a function (type: ${typeof actualOneSignal?.initialize})`);
          }
          if (!actualOneSignal?.Notifications) {
            debugInfo.errors.push('OneSignal.Notifications is not available');
          }
        }
        return debugInfo;
      }

      // Check if initialized (basic check)
      debugInfo.isInitialized = !!(actualOneSignal && actualOneSignal.Notifications);
      
      if (!debugInfo.isInitialized) {
        const errMsg = 'OneSignal.Notifications not available - initialization may have failed';
        debugInfo.errors.push(errMsg);
        debugInfo.initializationError = errMsg;
      }

      // Get permission status with detailed error capture
      try {
        if (actualOneSignal && actualOneSignal.Notifications) {
          if (typeof actualOneSignal.Notifications.getPermissionAsync === 'function') {
            debugInfo.permissionStatus = await actualOneSignal.Notifications.getPermissionAsync();
          } else {
            const errMsg = 'OneSignal.Notifications.getPermissionAsync is not a function';
            debugInfo.errors.push(errMsg);
            debugInfo.permissionError = errMsg;
          }
        } else {
          const errMsg = 'OneSignal.Notifications not available for permission check';
          debugInfo.errors.push(errMsg);
          debugInfo.permissionError = errMsg;
        }
      } catch (permError: any) {
        const errMsg = `Permission check failed:\nMessage: ${permError?.message || 'Unknown'}\nCode: ${permError?.code || 'N/A'}\nStack: ${permError?.stack ? permError.stack.substring(0, 200) : 'N/A'}`;
        debugInfo.errors.push(errMsg);
        debugInfo.permissionError = errMsg;
      }

      // Get subscription status with detailed error capture
      try {
        if (actualOneSignal && actualOneSignal.User && actualOneSignal.User.pushSubscription) {
          if (typeof actualOneSignal.User.pushSubscription.getIdAsync === 'function' && 
              typeof actualOneSignal.User.pushSubscription.getOptedInAsync === 'function') {
            const id = await actualOneSignal.User.pushSubscription.getIdAsync();
            const isOptedIn = await actualOneSignal.User.pushSubscription.getOptedInAsync();
            debugInfo.subscriptionStatus = {
              isSubscribed: isOptedIn || false,
              id: id || null,
            };
          } else {
            const errMsg = 'OneSignal.User.pushSubscription methods not available';
            debugInfo.errors.push(errMsg);
            debugInfo.subscriptionError = errMsg;
          }
        } else {
          const errMsg = 'OneSignal.User.pushSubscription not available';
          debugInfo.errors.push(errMsg);
          debugInfo.subscriptionError = errMsg;
          
          // Add details about what's missing
          if (!actualOneSignal?.User) {
            debugInfo.errors.push('OneSignal.User is not available');
          } else if (!actualOneSignal.User.pushSubscription) {
            debugInfo.errors.push('OneSignal.User.pushSubscription is not available');
          }
        }
      } catch (subError: any) {
        const errMsg = `Subscription check failed:\nMessage: ${subError?.message || 'Unknown'}\nCode: ${subError?.code || 'N/A'}\nStack: ${subError?.stack ? subError.stack.substring(0, 200) : 'N/A'}`;
        debugInfo.errors.push(errMsg);
        debugInfo.subscriptionError = errMsg;
      }
    } catch (error: any) {
      const errMsg = `Debug info failed:\nMessage: ${error?.message || 'Unknown'}\nCode: ${error?.code || 'N/A'}\nStack: ${error?.stack ? error.stack.substring(0, 200) : 'N/A'}`;
      debugInfo.errors.push(errMsg);
      debugInfo.error = errMsg;
    }

    return debugInfo;
  },
};

