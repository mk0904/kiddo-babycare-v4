declare module 'react-native-freshchat-sdk' {
  export class FreshchatConfig {
    constructor(appId: string, appKey: string);
    domain: string;
    teamMemberInfoVisible: boolean;
    cameraCaptureEnabled: boolean;
    gallerySelectionEnabled: boolean;
    responseExpectationEnabled: boolean;
    showNotificationBanner: boolean;
    notificationSoundEnabled: boolean;
    themeName: string;
    stringsBundle: string;
  }

  export class FreshchatUser {
    firstName: string;
    lastName: string;
    email: string;
    phoneCountryCode: string;
    phone: string;
  }

  export class ConversationOptions {
    tags: string[];
    filteredViewTitle: string;
  }

  export const Freshchat: {
    init: (config: FreshchatConfig) => void;
    showConversations: (options?: ConversationOptions) => void;
    showFAQs: () => void;
    setUser: (user: FreshchatUser, callback: (error: any) => void) => void;
    resetUser: (callback?: (error: any) => void) => void;
    setPushRegistrationToken: (token: string) => void;
    handlePushNotification: (data: any) => void;
    isFreshchatNotification: (data: any, callback: (isFreshchat: boolean) => void) => void;
  };
}
