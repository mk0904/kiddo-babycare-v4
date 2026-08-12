import { areAllMilestoneSlotsCompleted, buildMilestoneUIModel } from '@/components/home/milestoneUIFromConfig';
import { useMilestoneDockHeightSafe } from '@/context/MilestoneDockContext';
import { useMilestoneInlineCartActive } from '@/context/MilestoneInlineCartContext';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { appConfigService } from '@/services/appConfigService';
import { useCartItemCount } from '@/store/cartStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingCartCta } from './FloatingCartCta';

interface FloatingCartButtonProps {
    showTabBar?: boolean;
    /** Extra space reserved above the tab bar (e.g. live delivery pill + home milestone strip). */
    anchorExtraOffset?: number;
    /**
     * Pixel distance from screen bottom to the top of the tab bar (bar + home indicator).
     * When set, matches TabBar `totalHeight` so the cart anchor aligns with the real bar height from config.
     */
    tabBarReserveHeight?: number;
    /** Current active route name from the navigator (faster than usePathname). */
    activeRouteName?: string;
}

const FloatingCartButton: React.FC<FloatingCartButtonProps> = ({
    showTabBar = false,
    anchorExtraOffset = 0,
    tabBarReserveHeight,
    activeRouteName,
}) => {
    const itemCount = useCartItemCount();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const { isVisible: isTabBarVisible } = useTabBarVisibility();
    const cartInMilestoneRow = useMilestoneInlineCartActive();
    const milestoneDockHeight = useMilestoneDockHeightSafe();

    const [milestoneUiRev, setMilestoneUiRev] = React.useState(0);
    React.useEffect(() => {
        const off = appConfigService.subscribe(() => setMilestoneUiRev((x) => x + 1));
        return off;
    }, []);

    const milestoneUI = appConfigService.getMilestoneUI();
    const milestoneModel = React.useMemo(() => buildMilestoneUIModel(milestoneUI), [milestoneUI, milestoneUiRev]);
    const { width: windowWidth } = useWindowDimensions();
    
    // activeRouteName from props is faster than usePathname during transitions
    const rawRoute = activeRouteName || pathname;
    const currentRoute = rawRoute?.replace(/^\//, '') || 'index';
    
    const isHome = currentRoute === 'index' || currentRoute === '(tabs)/index' || pathname === '/';
    const isCategory = currentRoute === 'category' || currentRoute === '(tabs)/category' || pathname === '/category';
    const isInfinity = currentRoute?.startsWith('infinity/') || pathname?.startsWith('/infinity/');
    const isWishlist = currentRoute === 'wishlist' || currentRoute === '(tabs)/wishlist' || pathname === '/wishlist' || pathname === '/(tabs)/wishlist';
    
    const [isCelebrationSeen, setIsCelebrationSeen] = React.useState<boolean | null>(null);
    React.useEffect(() => {
        const check = async () => {
            const val = await AsyncStorage.getItem('milestone_all_done_home_strip_seen_v1');
            setIsCelebrationSeen(val === 'true');
        };
        check();
        // Also listen to config updates which might happen after order success
        const off = appConfigService.subscribe(check);
        return off;
    }, []);

    const isAllDoneFromConfig = React.useMemo(() => milestoneUI ? areAllMilestoneSlotsCompleted(milestoneUI) : false, [milestoneUI]);
    const isFinished = isAllDoneFromConfig || isCelebrationSeen === true;

    const hasMilestones = milestoneModel && milestoneModel.slots && milestoneModel.slots.some(s => s.activeIconUrl || s.inactiveIconUrl || s.title);
    
    // Switch between milestone screens (where cart is inline) and others (where it floats)
    const isMilestoneScreen = isHome || isCategory || isInfinity;
    // If milestones are completed and seen, don't hide the global cart (we want it centered)
    const shouldHideGlobalCart = isMilestoneScreen && hasMilestones && !isFinished;

    const TAB_BAR_HEIGHT = 60;
    const bottomInset = Math.max(insets.bottom, 0);
    const tabBarBlockHeight =
        showTabBar && tabBarReserveHeight != null && tabBarReserveHeight > 0
            ? tabBarReserveHeight
            : showTabBar
                ? TAB_BAR_HEIGHT + bottomInset
                : bottomInset;
    const isCartScreen = pathname === '/cart';
    const isAccount = currentRoute === 'account' || currentRoute === '(tabs)/account' || pathname === '/account' || pathname === '/(tabs)/account';
    const isPDP = pathname?.includes('/products/');

    const PDP_PADDING_TOP = 16;
    const PDP_CONTENT_HEIGHT = 48;
    const PDP_PADDING_BOTTOM = Math.max(insets.bottom, 20);
    const PDP_BORDER = 1;
    const PDP_BOTTOM_BAR_HEIGHT = PDP_PADDING_TOP + PDP_CONTENT_HEIGHT + PDP_PADDING_BOTTOM + PDP_BORDER;

    const pdpBottomOffset = PDP_BOTTOM_BAR_HEIGHT + 12;
    const baseBottomOffset = tabBarBlockHeight + (anchorExtraOffset || 0);
    const hiddenBottomOffset = isPDP ? pdpBottomOffset : bottomInset + 18;

    // `cartInMilestoneRow` stays true while Home/Category tabs stay mounted (React Navigation).
    // Stack routes like `/search` still read that flag and would hide the pill everywhere — only
    // suppress the floating cart when we're actually on a screen that shows the inline milestone cart.
    const hideBecauseCartIsInMilestoneRow = isMilestoneScreen && cartInMilestoneRow;

    const visible =
        itemCount > 0 && !isCartScreen && !isAccount && !isWishlist && !shouldHideGlobalCart && !hideBecauseCartIsInMilestoneRow;

    if (!visible) {
        return null;
    }

    const currentBottomOffset =
        showTabBar && isTabBarVisible
            ? baseBottomOffset
            : hiddenBottomOffset + (anchorExtraOffset || 0);

    return (
        <View
            style={[
                styles.container, 
                { bottom: currentBottomOffset },
            ]}
            pointerEvents="box-none"
        >
            <View style={{ opacity: 1 }}>
                <FloatingCartCta 
                    onPress={() => router.push('/cart' as any)} 
                    testID="floating-view-cart" 
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10000,
        elevation: 10000,
        alignItems: 'center',
    },
});

export default FloatingCartButton;
