import { Freshchat, FreshchatConfig, FreshchatUser } from 'react-native-freshchat-sdk';
import { FRESHCHAT_APP_ID, FRESHCHAT_APP_KEY, FRESHCHAT_DOMAIN } from '@/config/freshchat';

let initialized = false;

export const initializeFreshchat = () => {
  if (initialized) return;

  try {
    if (!FRESHCHAT_APP_ID || !FRESHCHAT_APP_KEY) {
      console.warn('[Freshchat] Missing APP_ID or APP_KEY in environment configuration. Initialization skipped.');
      return;
    }

    if (__DEV__) {
      console.log('[Freshchat] Starting initialization with options...', { 
        appId: FRESHCHAT_APP_ID, 
        domain: FRESHCHAT_DOMAIN 
      });
    }

    const freshchatConfig = new FreshchatConfig(FRESHCHAT_APP_ID, FRESHCHAT_APP_KEY);
    
    if (FRESHCHAT_DOMAIN) {
        freshchatConfig.domain = FRESHCHAT_DOMAIN;
    }
    
    freshchatConfig.teamMemberInfoVisible = true;
    freshchatConfig.cameraCaptureEnabled = true;
    freshchatConfig.gallerySelectionEnabled = true;
    freshchatConfig.responseExpectationEnabled = true;
    freshchatConfig.showNotificationBanner = true; //iOS only
    freshchatConfig.notificationSoundEnabled = true; //iOS only
    freshchatConfig.themeName = "CustomTheme.plist"; //iOS only
    freshchatConfig.stringsBundle = "FCCustomLocalizable"; //iOS only
    
    Freshchat.init(freshchatConfig);
    
    if (__DEV__) console.log('[Freshchat] SDK initialization triggered.');
    initialized = true;
  } catch (e) {
    console.error('[Freshchat] Failed to initialize:', e);
  }
};

export const setFreshchatUser = (user: { firstName?: string, lastName?: string, email?: string, phoneCountryCode?: string, phone?: string }) => {
  try {
    const freshchatUser = new FreshchatUser();
    
    if (user.firstName) freshchatUser.firstName = user.firstName;
    if (user.lastName) freshchatUser.lastName = user.lastName;
    if (user.email) freshchatUser.email = user.email;
    if (user.phoneCountryCode) freshchatUser.phoneCountryCode = user.phoneCountryCode;
    if (user.phone) {
      // Ensure phone is just digits
      freshchatUser.phone = user.phone.replace(/\D/g, '');
    }

    console.log('[Freshchat] -------------------------------------');
    console.log('[Freshchat] Passing User Data to Freshchat SDK:');
    console.log('[Freshchat] First Name:', freshchatUser.firstName);
    console.log('[Freshchat] Last Name:', freshchatUser.lastName);
    console.log('[Freshchat] Email:', freshchatUser.email);
    console.log('[Freshchat] Phone Code:', freshchatUser.phoneCountryCode);
    console.log('[Freshchat] Phone:', freshchatUser.phone);
    console.log('[Freshchat] -------------------------------------');

    Freshchat.setUser(freshchatUser, (error: any) => {
      if (error) {
        console.error('[Freshchat] Failed to set user:', error);
      } else {
        if (__DEV__) console.log('[Freshchat] User set successfully');
      }
    });
  } catch (e) {
    console.error('[Freshchat] Error setting user:', e);
  }
};

export const resetFreshchatUser = () => {
  try {
    Freshchat.resetUser((error: any) => {
      if (error) {
        console.error('[Freshchat] Failed to reset user:', error);
      } else {
        if (__DEV__) console.log('[Freshchat] User reset successfully');
      }
    });
  } catch (e) {
    console.error('[Freshchat] Error resetting user:', e);
  }
};

export const openFreshchat = () => {
  try {
    console.log('[Freshchat] openFreshchat triggered by user interaction');

    // 1. Ensure SDK is initialized
    initializeFreshchat();

    // 2. Set User Details from global store
    const { useUserStore } = require('@/store/userStore');
    const user = useUserStore.getState().user;
    if (user) {
      setFreshchatUser({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneCountryCode: '+91',
        phone: user.phone,
      });
    }

    // 3. Open the Freshchat conversations UI
    setTimeout(() => {
      Freshchat.showConversations();
    }, 200);

  } catch (e) {
    console.error('[Freshchat] Error opening chat:', e);
  }
};


