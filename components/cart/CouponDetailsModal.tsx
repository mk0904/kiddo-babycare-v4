import { Fonts } from '@/constants/theme';
import React from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface CouponDetailsModalProps {
    visible: boolean;
    /** Coupon code shown as main title (e.g. SCHOOL20). */
    code: string;
    /** Short offer line under the code (e.g. 20% off up to ₹500). */
    subtitle: string;
    /** Condition lines (no leading • — added in UI). */
    bullets: string[];
    onClose: () => void;
}

export function CouponDetailsModal({
    visible,
    code,
    subtitle,
    bullets,
    onClose,
}: CouponDetailsModalProps) {
    const insets = useSafeAreaInsets();
    const { height: windowHeight } = useWindowDimensions();
    const scrollMaxHeight = Math.min(windowHeight * 0.42, 320);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button">
                <Pressable
                    style={[styles.card, { marginBottom: Math.max(insets.bottom, 16) }]}
                    onPress={(e) => e.stopPropagation()}
                >
                    <Text style={styles.codeTitle} numberOfLines={2}>
                        {code || 'Coupon'}
                    </Text>
                    {subtitle ? (
                        <Text style={styles.subtitle} numberOfLines={3}>
                            {subtitle}
                        </Text>
                    ) : null}
                    <ScrollView
                        style={[styles.bulletScroll, { maxHeight: scrollMaxHeight }]}
                        showsVerticalScrollIndicator={bullets.length > 4}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                    >
                        {bullets.map((line, i) => (
                            <View key={`${i}-${line.slice(0, 24)}`} style={styles.bulletRow}>
                                <Text style={styles.bulletGlyph}>•</Text>
                                <Text style={styles.bulletText}>{line}</Text>
                            </View>
                        ))}
                    </ScrollView>
                    <TouchableOpacity
                        style={styles.okButton}
                        onPress={onClose}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="OK"
                    >
                        <Text style={styles.okButtonText}>OK</Text>
                    </TouchableOpacity>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.48)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#F4F4F5',
        borderRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 12,
    },
    codeTitle: {
        fontSize: 22,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        letterSpacing: 0.5,
    },
    subtitle: {
        marginTop: 10,
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
        lineHeight: 21,
    },
    bulletScroll: {
        marginTop: 20,
    },
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    bulletGlyph: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
        marginRight: 8,
        lineHeight: 21,
        marginTop: 0,
    },
    bulletText: {
        flex: 1,
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
        lineHeight: 21,
    },
    okButton: {
        marginTop: 22,
        backgroundColor: '#D4D4D8',
        borderRadius: 999,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    okButtonText: {
        fontSize: Fonts.MediumFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#18181B',
        letterSpacing: 0.3,
    },
});
