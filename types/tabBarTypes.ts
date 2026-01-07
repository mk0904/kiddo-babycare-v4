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
    iconSize?: number;   // Configurable icon size
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
}
