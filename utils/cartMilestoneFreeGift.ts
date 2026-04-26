import { milestoneCurrentStepFromConfig } from '@/components/home/milestoneUIFromConfig';
import type { MilestoneUIConfig } from '@/types/appConfig';

export type MilestoneFreeGiftKind = 'puzzle' | 'shoes' | 'none';

/**
 * Which free-gift rail to show in cart, from active milestone (0-based index from config):
 * - index `1` → 2nd order = **puzzle** (`milestone 2` in product copy)
 * - index `2` → 3rd order = **shoes** (`milestone 3`)
 * - index `0` or `3` → 1st / 4th order = **neither** gift in cart
 */
export function getMilestoneFreeGiftKind(
    milestoneUI: MilestoneUIConfig | null | undefined
): MilestoneFreeGiftKind {
    const step = milestoneCurrentStepFromConfig(milestoneUI ?? null, 0);
    if (step === 1) return 'puzzle';
    if (step === 2) return 'shoes';
    return 'none';
}
