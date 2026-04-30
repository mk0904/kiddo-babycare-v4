/** Horizontal insets and gap (notches); split is of the width between insets, minus the gap. */
const SIDE_INSET = 12;
const MILESTONE_CART_GAP = 6;

const MILESTONE_FRACTION = 0.65;
const CART_FRACTION = 0.35;

/** Shared height for milestone pill and `FloatingCartCta` in `MilestoneCartRow` (one visual row). */
export const MILESTONE_CART_ROW_PILL_HEIGHT = 64;

export type HomeMilestoneRowLayout = {
    sideInset: number;
    gap: number;
    /** Usable width between the two side insets. */
    innerWidth: number;
    /** Width of the `MilestoneTracker` strip (70% of inner − gap). */
    milestoneWidth: number;
    /** Width of the `View cart` column (30% of inner − gap). */
    cartColumnWidth: number;
    /**
     * For the absolutely positioned `milestoneDock` on home:
     * `left` and `right` insets so the dock is exactly `milestoneWidth` wide and leaves room for the cart.
     */
    milestoneDockLeft: number;
    milestoneDockRight: number;
};

/**
 * On Home, when the cart button sits beside the milestone strip, split the row
 * 70% milestone / 30% cart (of the area between the side insets, minus a gap between them).
 *
 * The `MilestoneCartRow` that uses this is unmounted when `KiddoRewardsWelcomeModal` is visible,
 * so the two UIs are never shown together.
 */
export function getHomeMilestoneRowLayout(screenWidth: number): HomeMilestoneRowLayout {
    const innerWidth = screenWidth - 2 * SIDE_INSET;
    const rowMinusGap = Math.max(0, innerWidth - MILESTONE_CART_GAP);
    const milestoneWidth = MILESTONE_FRACTION * rowMinusGap;
    const cartColumnWidth = CART_FRACTION * rowMinusGap;
    return {
        sideInset: SIDE_INSET,
        gap: MILESTONE_CART_GAP,
        innerWidth,
        milestoneWidth,
        cartColumnWidth,
        milestoneDockLeft: SIDE_INSET,
        milestoneDockRight: SIDE_INSET + cartColumnWidth + MILESTONE_CART_GAP,
    };
}
