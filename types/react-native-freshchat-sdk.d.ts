declare module 'react-native-freshchat-sdk' {
  export class FreshchatConfig {
    constructor(appId: string, appKey: string);
    domain: string;
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
    resetUser: () => void;
  };
}
