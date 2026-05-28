import type { HeaderGlassConfig, ResolvedHeaderGlassConfig } from '@/types/headerGlassTypes';

export const DEFAULT_HEADER_GLASS: ResolvedHeaderGlassConfig = {
    enabled: true,
    tintColor: 'transparent',
    blurIntensityIos: 50,
    blurIntensityAndroid: 30,
    blurTint: 'light',
};

export function resolveHeaderGlassConfig(
    globalGlass?: HeaderGlassConfig | null,
    categoryGlass?: HeaderGlassConfig | null
): ResolvedHeaderGlassConfig {
    return {
        ...DEFAULT_HEADER_GLASS,
        ...globalGlass,
        ...categoryGlass,
    };
}

export function headerGlassTintIsVisible(tintColor: string): boolean {
    const normalized = tintColor.trim().toLowerCase();
    return (
        normalized !== 'transparent' &&
        normalized !== 'rgba(0,0,0,0)' &&
        normalized !== '#00000000'
    );
}
