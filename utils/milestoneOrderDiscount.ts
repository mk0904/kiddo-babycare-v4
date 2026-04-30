import { milestoneCurrentStepFromConfig } from '@/components/home/milestoneUIFromConfig';
import type { MilestoneSlotConfig, MilestoneUIConfig } from '@/types/appConfig';
import type { MilestoneFreeGiftKind } from '@/utils/cartMilestoneFreeGift';

const MILESTONE_KEYS = ['milestoneFirst', 'milestoneSecond', 'milestoneThird', 'milestoneFourth'] as const;

/**
 * Raw config for the active milestone step (`currentStepIndex` or derived from `isCompleted`).
 */
export function getActiveMilestoneSlotRaw(ui: MilestoneUIConfig | null | undefined): MilestoneSlotConfig | null {
    if (ui == null) return null;

    // Count completed steps to detect total completion
    let completedCount = 0;
    for (const key of MILESTONE_KEYS) {
        const slot = (ui as Record<string, unknown>)[key] as MilestoneSlotConfig | undefined;
        if (slotIsCompletedTrue(slot)) completedCount++;
        else break;
    }

    // If all 4 milestones are done, there is no "active" slot for rewards/UI
    if (completedCount >= 4) return null;

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

export function slotIsCompletedTrue(slot: MilestoneSlotConfig | null | undefined): boolean {
    if (slot == null) return false;
    const v = (slot as { isCompleted?: boolean | string | number | null }).isCompleted;
    if (v === true) return true;
    if (typeof v === 'string' && v.trim().toLowerCase() === 'true') return true;
    if (v === 1) return true;
    return false;
}

function titleFromSlot(slot: MilestoneSlotConfig): string {
    const t = (slot.header ?? slot.title ?? '').toString().trim();
    return t || 'Milestone offer';
}

/** Bill row prefix from `orderNumber` (e.g. "1st order") for rewards copy. */
function orderBitForBillRow(slot: MilestoneSlotConfig): string {
    const o = (slot.orderNumber ?? '').toString().trim();
    if (!o) return '1st order';
    const lower = o.toLowerCase();
    if (lower.includes('order')) return o;
    return `${o} order`;
}

function billRowLabelForConfigDiscount(slot: MilestoneSlotConfig, typeRaw: string, value: number): string {
    const ob = orderBitForBillRow(slot);
    if (typeRaw === 'percentage' || typeRaw === 'percent') {
        const pctStr = Number.isInteger(value) ? String(Math.round(value)) : String(value);
        return `${ob} reward - ${pctStr}% off`;
    }
    const rupee = Math.round(value);
    return `${ob} reward - ₹${rupee} off`;
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
): { amount: number; label: string; billRowLabel: string } | null {
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
    return {
        amount,
        label: titleFromSlot(slot),
        billRowLabel: billRowLabelForConfigDiscount(slot, typeRaw, value),
    };
}

/**
 * When true, the active milestone is eligible to apply; manual/stacked discount codes
 * may be removed so the milestone (percent, gift-bill, or free-shoe/puzzle rail) wins.
 */
export function milestoneTakesPrecedenceOverOtherCoupons(
    itemSubtotal: number,
    slot: MilestoneSlotConfig | null | undefined,
    freeKind: MilestoneFreeGiftKind
): boolean {
    if (itemSubtotal <= 0) return false;
    const pct = computeMilestoneConfigDiscount(itemSubtotal, slot);
    if (pct != null && pct.amount > 0) return true;
    if (slot == null || !slotIsGiftTrue(slot) || !isMilestoneMinCartUnlocked(slot, itemSubtotal)) {
        return false;
    }
    if (milestoneIsGiftBillDiscountLineTitle(slot, itemSubtotal, freeKind) != null) {
        return true;
    }
    if (freeKind === 'shoes' || freeKind === 'puzzle') {
        return true;
    }
    return false;
}
