import { GLASS_PILL_TINT } from '@/utils/tabBarLayout';
import {
    GlassContainer,
    GlassView,
    isGlassEffectAPIAvailable,
    type GlassStyle,
} from 'expo-glass-effect';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

const GLASS_CONTAINER_SPACING = 8;

type GlassPillSurfaceProps = {
    borderRadius: number;
    /** Override for bottom-left and bottom-right corners. Defaults to borderRadius. */
    bottomRadius?: number;
    glassEffectStyle?: GlassStyle;
    tintColor?: string;
    /** Wrap in `GlassContainer` (matches tab bar grouping). */
    useContainer?: boolean;
};

function glassShapeProps(radius: number) {
    return { borderRadius: radius, borderCurve: 'continuous' as const };
}

export function isNativeGlassAvailable() {
    return Platform.OS === 'ios' && isGlassEffectAPIAvailable();
}

/**
 * Native liquid glass when available; solid tint when not (never BlurView — avoids
 * mismatched fallback vs tab bar / cart).
 */
export function GlassPillSurface({
    borderRadius,
    bottomRadius,
    glassEffectStyle = 'regular',
    tintColor = GLASS_PILL_TINT,
    useContainer = false,
}: GlassPillSurfaceProps) {
    const br = bottomRadius !== undefined ? bottomRadius : borderRadius;
    if (Platform.OS === 'android') {
        return (
            <View
                pointerEvents="none"
                style={[
                    StyleSheet.absoluteFill,
                    {
                        borderTopLeftRadius: borderRadius,
                        borderTopRightRadius: borderRadius,
                        borderBottomLeftRadius: br,
                        borderBottomRightRadius: br,
                        overflow: 'hidden',
                    },
                ]}
            >
                <BlurView
                    intensity={65}
                    tint="default"
                    experimentalBlurMethod="dimezn"
                    style={StyleSheet.absoluteFill}
                />
                <View
                    style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: tintColor },
                    ]}
                />
            </View>
        );
    }

    if (!isNativeGlassAvailable()) {
        return (
            <View
                pointerEvents="none"
                style={[
                    StyleSheet.absoluteFill,
                    {
                        borderTopLeftRadius: borderRadius,
                        borderTopRightRadius: borderRadius,
                        borderBottomLeftRadius: br,
                        borderBottomRightRadius: br,
                        backgroundColor: tintColor,
                    },
                ]}
            />
        );
    }

    const glass = (
        <GlassView
            pointerEvents="none"
            borderRadius={borderRadius}
            borderCurve="continuous"
            style={[
                StyleSheet.absoluteFill,
                {
                    borderTopLeftRadius: borderRadius,
                    borderTopRightRadius: borderRadius,
                    borderBottomLeftRadius: br,
                    borderBottomRightRadius: br,
                },
            ]}
            glassEffectStyle={glassEffectStyle}
            tintColor={tintColor}
            colorScheme="light"
        />
    );

    if (!useContainer) {
        return glass;
    }

    return (
        <GlassContainer
            pointerEvents="none"
            spacing={GLASS_CONTAINER_SPACING}
            style={[StyleSheet.absoluteFill, { borderRadius }]}
        >
            {glass}
        </GlassContainer>
    );
}
