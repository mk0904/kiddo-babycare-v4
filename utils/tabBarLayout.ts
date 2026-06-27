import { configService } from '@/services/configService';

export const FLOATING_TAB_BAR_BOTTOM_MARGIN = 0;
export const MILESTONE_NAV_GAP = 0;
export const DEFAULT_TAB_BAR_HEIGHT = 68;

/** Shared glass pill surface (tab bar + view cart). */
export const GLASS_PILL_TINT = 'rgba(196, 0, 0, 0.72)'; // #C40000 — slightly darker than 0.6
export const GLASS_PILL_TEXT_COLOR = '#FAFAFA';
export const GLASS_PILL_BRAND_RED = '#C40000';
export const GLASS_PILL_BLUR_INTENSITY_IOS = 40;
export const GLASS_PILL_BLUR_INTENSITY_ANDROID = 40;

export function getTabBarHeight(): number {
    return configService.getTabBarConfig()?.styles?.height ?? DEFAULT_TAB_BAR_HEIGHT;
}

/** Screen bottom → top edge of the floating tab bar pill. */
export function getTabBarStackBottom(safeAreaBottom: number): number {
    return Math.max(safeAreaBottom, 0) + FLOATING_TAB_BAR_BOTTOM_MARGIN + getTabBarHeight();
}

/** Screen bottom → bottom edge of the milestone dock (sits above tab bar with gap). */
export function getMilestoneDockBottom(safeAreaBottom: number): number {
    return getTabBarStackBottom(safeAreaBottom) + MILESTONE_NAV_GAP;
}
