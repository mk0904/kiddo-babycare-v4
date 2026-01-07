export const accountConfig = {
    // Profile Section Configuration
    profile: {
        showAvatar: true,
        avatarSize: 80,
        showPhone: true,
        showEmail: true,
        defaultUserName: "User",
        defaultPhoneText: "Not available",
        defaultEmailText: "Not available",
    },

    // Quick Actions Configuration
    quickActions: [
        {
            id: "orders",
            title: "My Orders",
            icon: "receipt",
            showBadge: false,
            badgeSource: "static", // "static" | "cart" | "custom"
            badgeValue: 0,
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "Orders",
            },
        },
        {
            id: "loyalty",
            title: "Rewards",
            icon: "wallet",
            showBadge: false,
            badgeSource: "static",
            badgeValue: 0,
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "Rewards",
            },
        },
        {
            id: "addresses",
            title: "Saved Addresses",
            icon: "location",
            showBadge: false,
            badgeSource: "static",
            badgeValue: 0,
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "Addresses",
            },
        },
    ],

    // Menu Items Configuration
    menuItems: [
        {
            id: "favorites",
            title: "Wishlist",
            icon: "heart-outline",
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "Wishlist",
            },
        },
        {
            id: "returns",
            title: "My Returns",
            icon: "swap-horizontal-outline",
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "Returns",
            },
        },
        {
            id: "help",
            title: "Help & Support",
            icon: "help-circle-outline",
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "ContactSupport",
            },
        },
        {
            id: "about",
            title: "About Us",
            icon: "information-circle-outline",
            actionType: "webview",
            action: {
                type: "webview",
                url: "https://kiddo-quick-baby-joy-m4bpo.myshopify.com/pages/about-us",
                title: "About Us",
            },
        },
        {
            id: "terms",
            title: "Terms & Conditions",
            icon: "document-text-outline",
            actionType: "webview",
            action: {
                type: "webview",
                url: "https://kiddo-quick-baby-joy-m4bpo.myshopify.com/pages/terms-and-conditions",
                title: "Terms & Conditions",
            },
        },
        {
            id: "privacy",
            title: "Privacy Policy",
            icon: "shield-checkmark-outline",
            actionType: "webview",
            action: {
                type: "webview",
                url: "https://kiddo-quick-baby-joy-m4bpo.myshopify.com/pages/privacy-policy",
                title: "Privacy Policy",
            },
        },
        {
            id: "logout",
            title: "Logout",
            icon: "log-out-outline",
            actionType: "logout",
            action: {
                type: "logout",
            },
        },
    ],

    // Logout Configuration
    logout: {
        enabled: true,
        title: "Logout",
        message: "Are you sure you want to logout?",
        confirmText: "Logout",
        cancelText: "Cancel",
    },

    // App Version Configuration
    version: {
        enabled: true,
        text: "Kiddo App v1.0.0",
    },

    // Styles Configuration
    styles: {
        header: {
            paddingTop: 60,
            paddingBottom: 20,
            paddingHorizontal: 20,
        },
        quickActions: {
            paddingHorizontal: 20,
            paddingVertical: 20,
        },
        menuContainer: {
            marginTop: 10,
            paddingHorizontal: 20,
        },
        logoutButton: {
            marginHorizontal: 20,
            marginTop: 20,
            paddingVertical: 16,
            borderRadius: 12,
            borderWidth: 1,
        },
        version: {
            marginTop: 20,
            paddingBottom: 10,
        },
    },
};
