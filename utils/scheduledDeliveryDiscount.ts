/**
 * Checks if a cart line item matches any configured category for scheduled discount.
 * Checks both item tags and item title (case-insensitive substring match).
 */
export function isItemEligibleForScheduledDiscount(
    item: { tags?: string[]; title?: string },
    categories: string[] = []
): boolean {
    if (!item || !categories || categories.length === 0) return false;
    const cats = categories.map((c) => c.toLowerCase().trim()).filter(Boolean);
    if (cats.length === 0) return false;
    const tags = (item.tags || []).map((t) => String(t).toLowerCase().trim());
    const title = (item.title || '').toLowerCase().trim();

    return cats.some((cat) => {
        // Check if any tag contains the category keyword or vice-versa
        const tagMatch = tags.some((t) => t.includes(cat) || cat.includes(t));
        if (tagMatch) return true;
        // Check if title contains the category keyword
        return title.includes(cat);
    });
}

/**
 * Calculates subtotal for all eligible items in the cart.
 */
export function getScheduledDiscountEligibleSubtotal(
    items: Array<{ price: number; quantity: number; tags?: string[]; title?: string }>,
    categories: string[] = []
): number {
    if (!categories || categories.length === 0) return 0;
    return items.reduce((sum, item) => {
        if (isItemEligibleForScheduledDiscount(item, categories)) {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 1;
            return sum + price * quantity;
        }
        return sum;
    }, 0);
}

/**
 * Calculates the discount amount if scheduled delivery is active and offer is enabled.
 */
export function calculateScheduledDiscount(
    eligibleSubtotal: number,
    isScheduled: boolean,
    discountPercent: number = 0,
    enabled: boolean = false
): number {
    if (!enabled || !isScheduled || eligibleSubtotal <= 0 || discountPercent <= 0) {
        return 0;
    }
    return Math.round(eligibleSubtotal * (discountPercent / 100));
}
