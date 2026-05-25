import { SharedValue } from 'react-native-reanimated';

export const NAV_BAR_PADDING = 8;

export type LensPresetName = 'apple' | 'water';

/** Flat numeric params — worklets cannot read JS preset objects reliably. */
export type LensPresetParams = {
    maxScale: number;
    minScaleY: number;
    skew: number;
    pull: number;
    rotate: number;
    fadeTravelPx: number;
};

/** Default Contacts-style lens. */
export const LENS_PRESET_APPLE: LensPresetParams = {
    maxScale: 1.28,
    minScaleY: 0.88,
    skew: 0.22,
    pull: 4.5,
    rotate: 0.12,
    fadeTravelPx: 72,
};

/** Wobbly liquid lens — stronger on leave/arrive, normal when landed. */
export const LENS_PRESET_WATER: LensPresetParams = {
    maxScale: 1.45,
    minScaleY: 0.82,
    skew: 0.45,
    pull: 10,
    rotate: 0.22,
    fadeTravelPx: 56,
};

export const LENS_PRESETS: Record<LensPresetName, LensPresetParams> = {
    apple: LENS_PRESET_APPLE,
    water: LENS_PRESET_WATER,
};

export const DEFAULT_LENS_PRESET: LensPresetName = 'apple';

export function resolveLensPreset(name?: string): LensPresetParams {
    if (name === 'water') {
        return LENS_PRESET_WATER;
    }
    return LENS_PRESET_APPLE;
}

export type TabBarLensInput = {
    pillLeft: number;
    pillRight: number;
    pillCx: number;
    pillCy: number;
    tabLeft: number;
    tabRight: number;
    tabCx: number;
    tabCy: number;
    pillWidth: number;
    travelPx: number;
    motionDir: number;
    startCx: number;
    targetCx: number;
    fadeTravelPx: number;
    pillDragging: boolean;
    maxScale: number;
    minScaleY: number;
    skew: number;
    pull: number;
    rotate: number;
};

export type TabBarLensOutput = {
    overlap: number;
    influence: number;
    scaleX: number;
    scaleY: number;
    skewX: number;
    skewY: number;
    pullX: number;
    pullY: number;
    rotate: number;
};

const SETTLE_PX = 2;
const ENDPOINT_MATCH = 0.52;

function clamp(value: number, min: number, max: number) {
    'worklet';
    return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number) {
    'worklet';
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
}

function zeroLens(): TabBarLensOutput {
    'worklet';
    return {
        overlap: 0,
        influence: 0,
        scaleX: 1,
        scaleY: 1,
        skewX: 0,
        skewY: 0,
        pullX: 0,
        pullY: 0,
        rotate: 0,
    };
}

function computeLensGate(
    travelPx: number,
    motionDir: number,
    pillCx: number,
    tabCx: number,
    tabW: number,
    overlap: number,
    startCx: number,
    targetCx: number,
    fadeTravelPx: number
) {
    'worklet';

    if (travelPx < SETTLE_PX || overlap <= 0) {
        return 0;
    }

    const slideGate = smoothstep(
        (travelPx - SETTLE_PX) / Math.max(fadeTravelPx * 0.42, 14)
    );

    const tabHalfW = tabW * ENDPOINT_MATCH;
    const isSourceTab = Math.abs(tabCx - startCx) < tabHalfW;
    const isDestTab = Math.abs(tabCx - targetCx) < tabHalfW;

    const offsetFromTab = pillCx - tabCx;
    const aligned = motionDir * offsetFromTab;
    let endpointGate = 0;

    if (isSourceTab && aligned > -1) {
        const decenter = clamp(Math.abs(offsetFromTab) / Math.max(tabW * 0.1, 1), 0, 1);
        endpointGate = Math.max(endpointGate, smoothstep(decenter * 2.4));
    }

    if (isDestTab && aligned < 1 && overlap > 0.06) {
        const decenter = clamp(Math.abs(offsetFromTab) / Math.max(tabW * 0.1, 1), 0, 1);
        endpointGate = Math.max(
            endpointGate,
            smoothstep(decenter * 2) * smoothstep(overlap * 1.35)
        );
    }

    if (!isSourceTab && !isDestTab && (aligned > 1 || aligned < -1)) {
        const decenter = clamp(Math.abs(offsetFromTab) / Math.max(tabW * 0.35, 1), 0, 1);
        endpointGate = smoothstep(decenter) * 0.2;
    }

    return slideGate * endpointGate;
}

/** Full lens under the pill while manually dragging (scrub mode). */
function computeScrubGate(
    pillCx: number,
    tabCx: number,
    pillWidth: number,
    overlap: number
) {
    'worklet';

    if (overlap <= 0) {
        return 0;
    }

    const reach = Math.max(pillWidth * 0.5, 1);
    const dist = Math.abs(tabCx - pillCx);
    const centerT = clamp(1 - dist / reach, 0, 1);
    return smoothstep(overlap * 1.35) * (0.5 + 0.5 * centerT * centerT);
}

export function computeTabBarLens({
    pillLeft,
    pillRight,
    pillCx,
    pillCy,
    tabLeft,
    tabRight,
    tabCx,
    tabCy,
    pillWidth,
    travelPx,
    motionDir,
    startCx,
    targetCx,
    fadeTravelPx,
    pillDragging,
    maxScale,
    minScaleY,
    skew,
    pull,
    rotate,
}: TabBarLensInput): TabBarLensOutput {
    'worklet';

    const overlapW = Math.max(0, Math.min(pillRight, tabRight) - Math.max(pillLeft, tabLeft));
    const tabW = Math.max(tabRight - tabLeft, 1);
    const overlap = clamp(overlapW / tabW, 0, 1);

    if (overlap <= 0) {
        return zeroLens();
    }

    const gate = pillDragging
        ? computeScrubGate(pillCx, tabCx, pillWidth, overlap)
        : computeLensGate(
              travelPx,
              motionDir,
              pillCx,
              tabCx,
              tabW,
              overlap,
              startCx,
              targetCx,
              fadeTravelPx
          );
    if (gate <= 0) {
        return { ...zeroLens(), overlap };
    }

    const dx = tabCx - pillCx;
    const dy = tabCy - pillCy;
    const reach = Math.max(pillWidth * 0.5, 1);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const centerT = clamp(1 - dist / reach, 0, 1);

    const influence = overlap * (0.35 + 0.65 * centerT * centerT) * gate;

    const scaleX = 1 + influence * (maxScale - 1);
    const scaleY = 1 - influence * (1 - minScaleY);
    const skewX = influence * (dx / reach) * skew;
    const skewY = influence * (dy / reach) * skew * 0.45;
    const pullX = influence * (pillCx - tabCx) * (pull / reach);
    const pullY = influence * (pillCy - tabCy) * (pull / reach) * 0.35;
    const rotateRad = influence * (dx / reach) * rotate;

    return {
        overlap,
        influence,
        scaleX,
        scaleY,
        skewX,
        skewY,
        pullX,
        pullY,
        rotate: rotateRad,
    };
}

export function computeTabBarLensFromSharedValues(
    tabSlotX: SharedValue<number>,
    tabSlotWidth: SharedValue<number>,
    tabIconCenterX: SharedValue<number>,
    indicatorX: SharedValue<number>,
    indicatorWidth: SharedValue<number>,
    indicatorTop: SharedValue<number>,
    indicatorHeight: SharedValue<number>,
    barHeight: SharedValue<number>,
    indicatorTargetX: SharedValue<number>,
    indicatorStartX: SharedValue<number>,
    pillDragging: SharedValue<number>,
    maxScale: number,
    minScaleY: number,
    skew: number,
    pull: number,
    rotate: number,
    fadeTravelPx: number
): TabBarLensOutput {
    'worklet';

    const travelPx = Math.abs(indicatorX.value - indicatorTargetX.value);
    const motionDir = indicatorTargetX.value >= indicatorX.value ? 1 : -1;
    const startCx = indicatorStartX.value + indicatorWidth.value / 2;
    const targetCx = indicatorTargetX.value + indicatorWidth.value / 2;

    const pillLeft = indicatorX.value;
    const pillRight = pillLeft + indicatorWidth.value;
    const pillCx = pillLeft + indicatorWidth.value / 2;
    const pillCy = indicatorTop.value + indicatorHeight.value / 2;

    const tabLeft = tabSlotX.value;
    const tabRight = tabLeft + tabSlotWidth.value;
    const tabCx =
        tabIconCenterX.value > 0
            ? tabIconCenterX.value
            : tabLeft + tabSlotWidth.value / 2;
    const tabCy = barHeight.value / 2;

    return computeTabBarLens({
        pillLeft,
        pillRight,
        pillCx,
        pillCy,
        tabLeft,
        tabRight,
        tabCx,
        tabCy,
        pillWidth: indicatorWidth.value,
        travelPx,
        motionDir,
        startCx,
        targetCx,
        fadeTravelPx,
        pillDragging: pillDragging.value > 0.5,
        maxScale,
        minScaleY,
        skew,
        pull,
        rotate,
    });
}

/** @deprecated Use LensPresetParams */
export type LensPresetConfig = LensPresetParams;
