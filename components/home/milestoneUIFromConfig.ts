import type { MilestoneSlotConfig, MilestoneUIConfig } from '@/types/appConfig';

const MILESTONE_KEYS = [
    'milestoneFirst',
    'milestoneSecond',
    'milestoneThird',
    'milestoneFourth',
] as const;

function trimUrl(u?: string | null): string {
    const s = (u ?? '').trim();
    return s;
}

function trimCopy(v?: string | null): string {
    return (v ?? '').trim();
}

function horActiveFromSlot(s?: MilestoneSlotConfig): string {
    if (!s) return '';
    return trimUrl(s.horActiveLIne ?? s.horActiveLine);
}

/** `horizontallineUrl`; legacy: `horizontalLineUrl`, `horActiveLIne`. */
function slotHorizontallineUrl(s?: MilestoneSlotConfig): string {
    if (!s) return '';
    const a = trimUrl(s.horizontallineUrl);
    if (a) return a;
    const b = trimUrl(s.horizontalLineUrl);
    if (b) return b;
    return horActiveFromSlot(s);
}

/** `verticallineUrl`; legacy: `verticalLineUrl`, `verActiveLine`. */
function slotVerticallineUrl(s?: MilestoneSlotConfig): string {
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

/**
 * One milestone step: copy, icons, and per-slot `horizontallineUrl` / `verticallineUrl` only for connectors.
 */
export interface ResolvedMilestoneSlot {
    title: string;
    subtitle: string;
    unlockedTitle: string;
    unlockedSubtitle: string;
    minCartValue: number | null;
    orderNumber: string;
    color: string;
    activeIconUrl: string;
    inactiveIconUrl: string;
    entryIconUrl: string;
    isCompleted?: boolean;
    titleColorActive: string;
    subtitleColor: string;
    completedHorLine: string;
    completedVerLine: string;
    horizontallineUrl: string;
    pendingHorLine: string;
    pendingVerLine: string;
    verticallineUrl: string;
}

export interface ResolvedMilestoneUIModel {
    slots: ResolvedMilestoneSlot[];
    animationUrl?: string;
}

export type MilestoneConnectorAxis = 'horizontal' | 'vertical';

/**
 * Connector after `stepIndex` toward `stepIndex + 1`.
 * Per-slot URLs only (no reuse across segments).
 *
 * - **`axis === 'horizontal'`** → `horizontallineUrl` — **expanded** list (vertical gap between rows).
 * - **`axis === 'vertical'`** → `verticallineUrl` — **collapsed** strip (horizontal gap between icons).
 */
export function resolveMilestoneConnectorUri(
    model: ResolvedMilestoneUIModel,
    stepIndex: number,
    axis: MilestoneConnectorAxis,
    currentStepIndex: number
): string | null {
    const { slots } = model;
    if (stepIndex >= slots.length - 1) return null;
    const seg = slots[stepIndex];
    if (!seg) return null;

    if (stepIndex < currentStepIndex - 1) {
        return axis === 'horizontal'
            ? trimUrl(seg.completedHorLine) || trimUrl(seg.horizontallineUrl) || null
            : trimUrl(seg.completedVerLine) || trimUrl(seg.verticallineUrl) || null;
    }

    if (stepIndex === currentStepIndex - 1) {
        return axis === 'horizontal'
            ? trimUrl(seg.horizontallineUrl) || trimUrl(seg.pendingHorLine) || null
            : trimUrl(seg.verticallineUrl) || trimUrl(seg.pendingVerLine) || null;
    }

    return axis === 'vertical'
        ? trimUrl(seg.horizontallineUrl) || null
        : trimUrl(seg.verticallineUrl) || null;
}

/**
 * Maps `milestoneUI` to four ordered steps (`milestoneFirst` → `milestoneFourth`).
 */
/** True when backend marks every step `milestoneFirst`–`milestoneFourth` as completed. */
export function areAllMilestoneSlotsCompleted(ui: MilestoneUIConfig | null | undefined): boolean {
    if (ui == null) {
        return false;
    }
    for (const key of MILESTONE_KEYS) {
        const slot = ui[key];
        if (slot?.isCompleted !== true) {
            return false;
        }
    }
    return true;
}

export function buildMilestoneUIModel(ui: MilestoneUIConfig | null | undefined): ResolvedMilestoneUIModel | null {
    if (ui == null) {
        return null;
    }

    const root = ui;

    const slots: ResolvedMilestoneSlot[] = MILESTONE_KEYS.map((key) => {
        const raw = root[key] as MilestoneSlotConfig | undefined;

        const activeIconUrl = trimUrl(raw?.activeIconUrl) || trimUrl(raw?.iconUrl) || '';
        const inactiveIconUrl =
            trimUrl(raw?.inactiveIconUrl) ||
            trimUrl(raw?.defaultIconUrl) ||
            trimUrl(raw?.iconUrl) ||
            trimUrl(raw?.activeIconUrl) ||
            '';
        const entryIconUrl =
            trimUrl(raw?.entryIconUrl) ||
            trimUrl(raw?.entryiconUrl) ||
            '';

        return {
            minCartValue:
                raw?.minCartValue == null || String(raw.minCartValue).trim() === ''
                    ? null
                    : (() => {
                        const parsed = Number.parseFloat(String(raw.minCartValue));
                        return Number.isFinite(parsed) ? parsed : null;
                    })(),
            title: trimCopy(raw?.header) || trimCopy(raw?.title),
            subtitle: trimCopy(raw?.body) || trimCopy(raw?.description),
            unlockedTitle: trimCopy(raw?.unlockedTitle),
            unlockedSubtitle: trimCopy(raw?.unlockedSubTitle),
            orderNumber: trimCopy(raw?.orderNumber),
            color: trimUrl(raw?.color),
            activeIconUrl,
            inactiveIconUrl,
            entryIconUrl,
            isCompleted: raw?.isCompleted,
            titleColorActive: trimUrl(raw?.activeColor),
            subtitleColor: trimUrl(raw?.inactiveColor),
            completedHorLine:
                trimUrl(raw?.completedHorLine) || trimUrl(root.horizontalCompletedLineUrl) || slotHorizontallineUrl(raw),
            completedVerLine:
                trimUrl(raw?.completedVerLine) || trimUrl(root.verticalCompletedLineUrl) || slotVerticallineUrl(raw),
            horizontallineUrl: slotHorizontallineUrl(raw),
            pendingHorLine: trimUrl(raw?.pendingHorLine) || slotHorizontallineUrl(raw),
            pendingVerLine: trimUrl(raw?.pendingVerLine) || slotVerticallineUrl(raw),
            verticallineUrl: slotVerticallineUrl(raw),
        };
    });

    return { slots, animationUrl: trimUrl(ui.animationUrl) };
}

export function milestoneExpandedTitleFromConfig(ui: MilestoneUIConfig | null | undefined): string {
    if (ui == null) return '';
    return trimUrl(ui.expandedTitle);
}

export function milestoneExpandedSubtitleFromConfig(ui: MilestoneUIConfig | null | undefined): string {
    if (ui == null) return '';
    return trimCopy(ui.expandedSubTitle);
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
