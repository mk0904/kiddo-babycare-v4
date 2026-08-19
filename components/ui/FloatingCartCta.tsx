import { GlassPillSurface } from '@/components/ui/GlassPillSurface';
import { Fonts } from '@/constants/theme';
import { useCartItemCount } from '@/store/cartStore';
import { MILESTONE_CART_ROW_PILL_HEIGHT } from '@/utils/homeMilestoneRowLayout';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const CART_BUTTON_TINT = 'rgba(241, 94, 94, 0.9)';

export type FloatingCartCtaProps = {
    /** Sits in the 30% column next to `MilestoneTracker` (tighter padding, can shrink). */
    inMilestoneRow?: boolean;
    onPress?: () => void;
    testID?: string;
};

const CART_PILL_RADIUS = MILESTONE_CART_ROW_PILL_HEIGHT / 2;

/**
 * Shared “View Cart” control. Used by `FloatingCartButton` and `MilestoneCartRow`.
 * Layout: [count in white disc] — “View Cart” — [outlined white arrow]
 */
export function FloatingCartCta({ inMilestoneRow = false, onPress, testID }: FloatingCartCtaProps) {
    const router = useRouter();
    const itemCount = useCartItemCount();

    const countLabel = useMemo(() => {
        if (itemCount > 99) return '99+';
        return String(Math.max(0, itemCount));
    }, [itemCount]);

    const handlePress = useCallback(() => {
        if (process.env.EXPO_OS === 'ios') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        if (onPress) {
            onPress();
            return;
        }
        router.push('/cart' as any);
    }, [onPress, router]);

    return (
        <TouchableOpacity
            testID={testID}
            style={[
                styles.buttonOuter,
                inMilestoneRow ? styles.buttonOuterInMilestoneRow : styles.buttonOuterFloating,
            ]}
            onPress={handlePress}
            activeOpacity={0.92}
        >
            <View
                style={[
                    styles.glassPill,
                    inMilestoneRow ? styles.glassPillInMilestoneRow : styles.glassPillFloating,
                ]}
            >
                <GlassPillSurface
                    borderRadius={CART_PILL_RADIUS}
                    glassEffectStyle="regular"
                    tintColor={CART_BUTTON_TINT}
                    useContainer
                />
                <View style={[styles.content, inMilestoneRow && styles.contentInMilestoneRow]}>
                    <View style={styles.startSlot}>
                        <View
                            style={styles.countBadge}
                            accessibilityLabel={`${itemCount} items in cart`}
                        >
                            <Text style={styles.countText} numberOfLines={1} allowFontScaling>
                                {countLabel}
                            </Text>
                        </View>
                        <View style={styles.labelSlot}>
                            <Text style={styles.cartLabel} numberOfLines={1}>
                                Cart
                            </Text>
                        </View>
                    </View>

                    <View style={styles.endSlot} pointerEvents="none">
                        <View style={styles.arrowRing}>
                            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    buttonOuter: {
        minWidth: 140,
    },
    buttonOuterFloating: {
        marginBottom: 10,
    },
    buttonOuterInMilestoneRow: {
        minWidth: 0,
        width: '100%',
        maxWidth: '100%',
        alignSelf: 'stretch',
        marginBottom: 0,
    },
    glassPill: {
        height: MILESTONE_CART_ROW_PILL_HEIGHT,
        borderRadius: CART_PILL_RADIUS,
        overflow: 'hidden',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 12,
    },
    glassPillFloating: {
        minWidth: 140,
        paddingHorizontal: 4,
    },
    glassPillInMilestoneRow: {
        width: '100%',
        minHeight: MILESTONE_CART_ROW_PILL_HEIGHT,
        maxHeight: MILESTONE_CART_ROW_PILL_HEIGHT,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        height: '100%',
        zIndex: 1,
    },
    contentInMilestoneRow: {
        paddingHorizontal: 10,
        minWidth: 0,
    },
    startSlot: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    labelSlot: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    endSlot: {
        width: 28,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    countBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countText: {
        fontSize: 12,
        lineHeight: 18,
        fontFamily: Fonts.LexendSemiBold,
        fontWeight: '600',
        color: CART_BUTTON_TINT,
    },
    cartLabel: {
        fontSize: 18,
        lineHeight: 18,
        fontFamily: Fonts.LexendSemiBold,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    arrowRing: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
