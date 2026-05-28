/** Frosted-glass overlay for the home header (global + per-category overrides). */
export interface HeaderGlassConfig {
    /** When false, header uses only the background image / color with no blur. */
    enabled?: boolean;
    /**
     * Color wash on top of the blur. Use `transparent` for plain glass;
     * later e.g. `#C4000099` or `rgba(196, 0, 0, 0.6)`.
     */
    tintColor?: string;
    blurIntensityIos?: number;
    blurIntensityAndroid?: number;
    /** expo-blur tint mode */
    blurTint?: 'light' | 'dark' | 'default';
}

export type ResolvedHeaderGlassConfig = {
    enabled: boolean;
    tintColor: string;
    blurIntensityIos: number;
    blurIntensityAndroid: number;
    blurTint: 'light' | 'dark' | 'default';
};
