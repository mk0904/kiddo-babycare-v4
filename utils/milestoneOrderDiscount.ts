import { milestoneCurrentStepFromConfig } from '@/components/home/milestoneUIFromConfig';
import type { MilestoneFreeGiftKind } from '@/utils/cartMilestoneFreeGift';
import type { MilestoneSlotConfig, MilestoneUIConfig } from '@/types/appConfig';

const MILESTONE_KEYS = ['milestoneFirst', 'milestoneSecond', 'milestoneThird', 'milestoneFourth'] as const;

/**
 * Raw config for the active milestone step (`currentStepIndex` or derived from `isCompleted`).
 */
export function getActiveMilestoneSlotRaw(ui: MilestoneUIConfig | null | undefined): MilestoneSlotConfig | null {
    if (ui == null) return null;
    const step = milestoneCurrentStepFromConfig(ui, 0);
    const key = MILESTONE_KEYS[step];
    if (!key) return null;
    const slot = (ui as Record<string, unknown>)[key] as MilestoneSlotConfig | undefined;
    return slot ?? null;
}

function parseNum(v: string | number | null | undefined): number | null {
    if (v == null) return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).trim());
    return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Backend may send `true`, `"true"`, or `1` for isGift. */
function slotIsGiftTrue(slot: MilestoneSlotConfig | null | undefined): boolean {
    if (slot == null) return false;
    const v = (slot as { isGift?: boolean | string | number | null }).isGift;
    if (v === true) return true;
    if (typeof v === 'string' && v.trim().toLowerCase() === 'true') return true;
    if (v === 1) return true;
    return false;
}

function titleFromSlot(slot: MilestoneSlotConfig): string {
    const t = (slot.header ?? slot.title ?? '').toString().trim();
    return t || 'Milestone offer';
}

/**
 * `true` when the slot’s `minCartValue` (if any) is reached by the cart subtotal.
 */
export function isMilestoneMinCartUnlocked(
    slot: MilestoneSlotConfig | null | undefined,
    itemSubtotal: number
): boolean {
    if (slot == null) return false;
    if (slot.minCartValue == null || String(slot.minCartValue).trim() === '') {
        return true;
    }
    const minC = parseNum(slot.minCartValue);
    if (minC == null) return true;
    return itemSubtotal >= minC;
}

/**
 * For `isGift: true` — use as the bill row label for free shoes / free puzzle.
 * If `header` / `title` are empty, returns `null` (bill uses default "Free Shoes" / "Free puzzle").
 */
export function milestoneGiftBillTitleFromSlot(slot: MilestoneSlotConfig | null | undefined): string | null {
    if (slot == null || !slotIsGiftTrue(slot)) return null;
    const t = (slot.header ?? slot.title ?? '').toString().trim();
    return t || null;
}

/**
 * `isGift` milestones on 1st/4th steps have no free-shoe/puzzle cart rail (`freeKind` is `none`).
 * When min cart is unlocked, bill details should show `Discount - {milestone title}`.
 */
export function milestoneIsGiftBillDiscountLineTitle(
    slot: MilestoneSlotConfig | null | undefined,
    itemSubtotal: number,
    freeKind: MilestoneFreeGiftKind
): string | null {
    if (slot == null || !slotIsGiftTrue(slot)) return null;
    if (freeKind !== 'none') return null;
    if (!isMilestoneMinCartUnlocked(slot, itemSubtotal)) return null;
    return titleFromSlot(slot);
}

/**
 * Non-gift milestone discount: same base rules as cart coupon math
 * (percentage or fixed on full item subtotal, optional max cap, optional `minCartValue` gate).
 * Skipped when `isGift === true`.
 */
export function computeMilestoneConfigDiscount(
    itemSubtotal: number,
    slot: MilestoneSlotConfig | null | undefined
): { amount: number; label: string } | null {
    if (slot == null || itemSubtotal <= 0) return null;
    if (slotIsGiftTrue(slot)) return null;
    const typeRaw = (slot.discount_type ?? (slot as { discountType?: string }).discountType ?? '')
        .toString()
        .trim()
        .toLowerCase();
    if (!typeRaw) return null;
    const value = parseNum(slot.discount_value ?? (slot as { discountValue?: string | number }).discountValue);
    if (value == null || value <= 0) return null;
    if (slot.minCartValue != null && String(slot.minCartValue).trim() !== '') {
        const minC = parseNum(slot.minCartValue);
        if (minC != null && itemSubtotal < minC) return null;
    }
    const maxD = parseNum(slot.max_discount ?? (slot as { maxDiscount?: string | number }).maxDiscount);
    let amount = 0;
    if (typeRaw === 'percentage' || typeRaw === 'percent') {
        amount = (itemSubtotal * value) / 100;
    } else if (typeRaw === 'fixed' || typeRaw === 'amount' || typeRaw === 'rupee' || typeRaw === '₹') {
        amount = Math.min(value, itemSubtotal);
    } else {
        return null;
    }
    if (maxD != null && maxD > 0) {
        amount = Math.min(amount, maxD);
    }
    amount = Math.min(amount, itemSubtotal);
    if (amount <= 0) return null;
    return { amount, label: titleFromSlot(slot) };
}
