export const accountConfig = {
    // Profile Section Configuration
    profile: {
        showAvatar: true,
        avatarSize: 100,
        showPhone: true,
        showEmail: false,
        defaultUserName: "User",
        defaultPhoneText: "Not available",
        defaultEmailText: "Not available",
    },

    // Quick Actions Configuration
    quickActions: [
        {
            id: "orders",
            title: "My\norders",
            icon: "list-outline",
            showBadge: false,
            badgeSource: "static",
            badgeValue: 0,
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "Orders",
            },
        },
        {
            id: "quick_chat",
            title: "Need\nHelp",
            icon: "chatbubbles-outline",
            showBadge: false,
            badgeSource: "static",
            badgeValue: 0,
            actionType: "freshchat",
            action: {
                type: "freshchat",
            },
        },
        {
            id: "refer",
            title: "Refer &\nEarn",
            icon: "person-add-outline",
            showBadge: false,
            badgeSource: "static",
            badgeValue: 0,
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "Referral",
            },
        },
        // {
        //     id: "wallet",
        //     title: "Kiddo\nCash",
        //     icon: "wallet-outline",
        //     showBadge: false,
        //     badgeSource: "static",
        //     badgeValue: 0,
        //     actionType: "navigate",
        //     action: {
        //         type: "navigate",
        //         screen: "Wallet",
        //     },
        // },
    ],

    // Menu Items Configuration
    menuItems: [
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
            id: "demo_bookings",
            title: "Demo Bookings",
            icon: "calendar-outline",
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "DemoBookings",
            },
        },
        {
            id: "return_refund",
            title: "Return and Refund",
            icon: "refresh-outline",
            actionType: "navigate",
            action: {
                type: "navigate",
                screen: "ReturnRefund",
            },
        },
        {
            id: "about",
            title: "About us",
            icon: "happy-outline",
            actionType: "webview",
            action: {
                type: "webview",
                url: "https://kiddo-quick-baby-joy-m4bpo.myshopify.com/pages/about-us",
                title: "About us",
            },
        },
        {
            id: "terms",
            title: "Terms & conditions",
            icon: "document-text-outline",
            actionType: "webview",
            action: {
                type: "webview",
                url: "https://kiddo-quick-baby-joy-m4bpo.myshopify.com/pages/terms-and-conditions",
                title: "Terms & conditions",
            },
        },
        {
            id: "privacy",
            title: "Privacy policy",
            icon: "shield-checkmark-outline",
            actionType: "webview",
            action: {
                type: "webview",
                url: "https://kiddo-quick-baby-joy-m4bpo.myshopify.com/pages/privacy-policy",
                title: "Privacy policy",
            },
        },
    ],

    // Logout Configuration
    logout: {
        enabled: true,
        title: "Log out",
        message: "Are you sure you want to log out?",
        confirmText: "Log out",
        cancelText: "Cancel",
    },

    // App Version Configuration
    version: {
        enabled: false,
        text: "Kiddo App v1.0.0",
    },

    // Styles Configuration
    styles: {
        header: {
            paddingTop: 40,
            paddingBottom: 20,
            paddingHorizontal: 20,
        },
        quickActions: {
            paddingHorizontal: 20,
            paddingVertical: 10,
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