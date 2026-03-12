import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const LIGHT_GREEN_ACCENT = '#A8DDC6';
const CREAM_BG = '#FDFDF5';
const BAG_ICON_COLOR = '#D4A84B';
const MESSAGE_TEXT_COLOR = '#424242';

interface StockLimitModalProps {
    visible: boolean;
    maxQuantity: number;
    onClose: () => void;
}

export function StockLimitModal({ visible, maxQuantity, onClose }: StockLimitModalProps) {
    useEffect(() => {
        if (!visible) return;
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [visible, onClose]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.accentTop} />
                    <View style={styles.accentLeft} />
                    <View style={styles.accentRight} />
                    <View style={styles.iconWrap}>
                        <Ionicons name="bag" size={36} color={BAG_ICON_COLOR} />
                    </View>
                    <Text style={styles.message}>
                        Sorry, we have limited quantity available for this item!
                    </Text>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 56,
        paddingHorizontal: 20,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: CREAM_BG,
        borderRadius: 18,
        paddingVertical: 18,
        paddingHorizontal: 18,
        width: '100%',
        maxWidth: 400,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 6,
    },
    iconWrap: {
        marginRight: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        flex: 1,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.MediumWeight,
        fontSize: Fonts.SmallFontSize,
        color: MESSAGE_TEXT_COLOR,
        lineHeight: 22,
    },
});
