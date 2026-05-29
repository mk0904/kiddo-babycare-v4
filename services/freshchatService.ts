import { Freshchat, FreshchatConfig } from 'react-native-freshchat-sdk';
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
    
    Freshchat.init(freshchatConfig);
    
    if (__DEV__) console.log('[Freshchat] SDK initialization triggered.');
    initialized = true;
  } catch (e) {
    console.error('[Freshchat] Failed to initialize:', e);
  }
};
