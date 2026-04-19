import type { MilestoneSlotConfig, MilestoneUIConfig } from '@/types/appConfig';
import { MILESTONE_ASSETS, MILESTONE_NODE_IMAGES } from './milestoneTrackerAssets';

const MILESTONE_KEYS = [
    'milestoneFirst',
    'milestoneSecond',
    'milestoneThird',
    'milestoneFourth',
] as const;

const DEFAULT_COPY: { title: string; subtitle: string }[] = [
    { title: '25% off up to ₹500; MOV ₹499', subtitle: 'Min. cart value Rs. 499' },
    { title: 'Shop for ₹999 and get a free puzzle!', subtitle: 'Min. cart value Rs. 999' },
    { title: 'Free shoes on orders above ₹999', subtitle: 'Min. cart value Rs. 999' },
    { title: 'Mystery gift on orders above ₹999', subtitle: 'Min. cart value Rs. 999' },
];

function trimUrl(u?: string | null): string {
    const s = (u ?? '').trim();
    return s;
}

function horActiveFromSlot(s?: MilestoneSlotConfig): string {
    if (!s) return '';
    return trimUrl(s.horActiveLIne ?? s.horActiveLine);
}

/** Latest schema: `horizontallineUrl`; legacy: `horizontalLineUrl`, `horActiveLIne`. Empty string falls through. */
function slotHorizontalActiveUrl(s?: MilestoneSlotConfig): string {
    if (!s) return '';
    const a = trimUrl(s.horizontallineUrl);
    if (a) return a;
    const b = trimUrl(s.horizontalLineUrl);
    if (b) return b;
    return horActiveFromSlot(s);
}

/** Latest schema: `verticallineUrl`; legacy: `verticalLineUrl`, `verActiveLine`. */
function slotVerticalActiveUrl(s?: MilestoneSlotConfig): string {
    if (!s) return '';
    const a = trimUrl(s.verticallineUrl);
    if (a) return a;
    const b = trimUrl(s.verticalLineUrl);
    if (b) return b;
    return trimUrl(s.verActiveLine);
}

/** Count leading `isCompleted: true` steps → active step index (next incomplete), capped at 3. */
function currentStepFromIsCompleted(ui: MilestoneUIConfig): number | null {
    let consecutive = 0;
    for (const key of MILESTONE_KEYS) {
        const slot = ui[key];
        if (slot?.isCompleted === true) consecutive += 1;
        else break;
    }
    if (consecutive === 0) return null;
    return Math.min(consecutive, 3);
}

export interface ResolvedMilestoneSlot {
    title: string;
    subtitle: string;
    activeIconUrl: string;
    inactiveIconUrl: string;
    titleColorActive: string;
    subtitleColor: string;
    completedHorLine: string;
    completedVerLine: string;
    horActiveLine: string;
    pendingHorLine: string;
    pendingVerLine: string;
    verActiveLine: string;
}

/**
 * Flattens `milestoneUI` into four ordered steps. Missing URLs fall back to bundled defaults
 * so the tracker still renders before the backend ships assets.
 */
export function buildMilestoneSlotsFromConfig(
    ui: MilestoneUIConfig | null | undefined
): ResolvedMilestoneSlot[] {
    const root = ui ?? undefined;
    return MILESTONE_KEYS.map((key, index) => {
        const raw = root?.[key] as MilestoneSlotConfig | undefined;
        const copy = DEFAULT_COPY[index] ?? DEFAULT_COPY[0];
        const defIcon = MILESTONE_NODE_IMAGES[Math.min(index, MILESTONE_NODE_IMAGES.length - 1)];

        const globalHorDone = trimUrl(root?.horizontalCompletedLineUrl);
        const globalVerDone = trimUrl(root?.verticalCompletedLineUrl);

        const activeIconUrl =
            trimUrl(raw?.activeIconUrl) || trimUrl(raw?.iconUrl) || defIcon;
        const inactiveIconUrl =
            trimUrl(raw?.inactiveIconUrl) ||
            trimUrl(raw?.defaultIconUrl) ||
            trimUrl(raw?.iconUrl) ||
            trimUrl(raw?.activeIconUrl) ||
            defIcon;

        const horActiveResolved =
            slotHorizontalActiveUrl(raw) || globalHorDone || MILESTONE_ASSETS.horCompLine;
        const verActiveResolved =
            slotVerticalActiveUrl(raw) || globalVerDone || MILESTONE_ASSETS.verticalActiveLine;

        return {
            title: trimUrl(raw?.title) || copy.title,
            subtitle: trimUrl(raw?.description) || copy.subtitle,
            activeIconUrl,
            inactiveIconUrl,
            titleColorActive: trimUrl(raw?.activeColor) || '#FFFFFF',
            subtitleColor: trimUrl(raw?.inactiveColor) || 'rgba(255,255,255,0.6)',
            completedHorLine:
                trimUrl(raw?.completedHorLine) || globalHorDone || MILESTONE_ASSETS.horCompLine,
            completedVerLine:
                trimUrl(raw?.completedVerLine) || globalVerDone || MILESTONE_ASSETS.verticalActiveLine,
            horActiveLine: horActiveResolved,
            pendingHorLine: trimUrl(raw?.pendingHorLine) || MILESTONE_ASSETS.horInActiveLine,
            pendingVerLine: trimUrl(raw?.pendingVerLine) || MILESTONE_ASSETS.verticalInactiveLine,
            verActiveLine: verActiveResolved,
        };
    });
}

export function milestoneExpandedTitleFromConfig(ui: MilestoneUIConfig | null | undefined): string {
    return trimUrl(ui?.expandedTitle) || 'On your next 4 orders';
}

export function milestoneCurrentStepFromConfig(
    ui: MilestoneUIConfig | null | undefined,
    propFallback: number
): number {
    if (ui != null && typeof ui.currentStepIndex === 'number' && Number.isFinite(ui.currentStepIndex)) {
        return Math.min(Math.max(0, Math.floor(ui.currentStepIndex)), 3);
    }
    if (ui != null) {
        const fromFlags = currentStepFromIsCompleted(ui);
        if (fromFlags !== null) return fromFlags;
    }
    return propFallback;
}
