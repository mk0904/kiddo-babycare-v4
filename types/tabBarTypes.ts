// Tab Bar Configuration Types

export interface TabBarItemConfig {
    icon: string;        // URL for inactive state icon
    activeIcon: string;  // URL for active state icon
    label: string;       // Tab label
}

export interface TabBarStyles {
    backgroundColor?: string;
    activeTintColor?: string;
    inactiveTintColor?: string;
    height?: number;
    bottomMargin?: number;
    iconSize?: number;   // Configurable icon size
    /** Simulated icon lens during tab slide: 'apple' (default) or 'water' (stronger liquid bulge). */
    lensPreset?: 'apple' | 'water';
    shadowColor?: string;
    shadowOpacity?: number;
    shadowRadius?: number;
    shadowOffset?: { width: number; height: number };
}

export interface TabBarConfig {
    items: {
        [routeName: string]: TabBarItemConfig;
    };
    styles?: TabBarStyles;
    visibleTabs?: string[]; // Array of route names to show in tab bar (e.g., ["index", "wishlist", "account"])
}
