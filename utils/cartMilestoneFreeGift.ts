import { milestoneCurrentStepFromConfig } from '@/components/home/milestoneUIFromConfig';
import type { MilestoneUIConfig } from '@/types/appConfig';

export type MilestoneFreeGiftKind = 'puzzle' | 'shoes' | 'discount' | 'mystery' | 'none';

/**
 * Which free-gift or reward rail to show in cart, from active milestone (0-based index from config):
 * - index `0` → 1st order = **discount** (25% OFF)
 * - index `1` → 2nd order = **puzzle**
 * - index `2` → 3rd order = **shoes**
 * - index `3` → 4th order = **mystery** (Mystery Gift)
 */
export function getMilestoneFreeGiftKind(
    milestoneUI: MilestoneUIConfig | null | undefined
): MilestoneFreeGiftKind {
    const step = milestoneCurrentStepFromConfig(milestoneUI ?? null, 0);
    if (step === 0) return 'discount';
    if (step === 1) return 'puzzle';
    if (step === 2) return 'shoes';
    if (step === 3) return 'mystery';
    return 'none';
}
