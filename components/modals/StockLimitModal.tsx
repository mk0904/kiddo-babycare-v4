import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface StockLimitModalProps {
    visible: boolean;
    maxQuantity: number;
    onClose: () => void;
}

export function StockLimitModal({ visible, maxQuantity, onClose }: StockLimitModalProps) {
    const isSoldOut = maxQuantity === 0;
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
                    <View style={styles.iconWrap}>
                        <Ionicons name="bag-handle-outline" size={32} color={Colors.primary} />
                    </View>
                    <Text style={styles.title}>{isSoldOut ? 'Sold out' : 'Limit reached'}</Text>
                    <Text style={styles.message}>
                        {isSoldOut
                            ? 'This product is currently sold out.'
                            : `Only ${maxQuantity} item${maxQuantity === 1 ? '' : 's'} available for this product.`}
                    </Text>
                    <Pressable
                        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                        onPress={onClose}
                    >
                        <Text style={styles.buttonText}>OK</Text>
                    </Pressable>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 16,
        paddingVertical: 24,
        paddingHorizontal: 24,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 8,
    },
    iconWrap: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontFamily: Fonts.SemiBold,
        fontSize: 18,
        color: Colors.text,
        marginBottom: 8,
    },
    message: {
        fontFamily: Fonts.Regular,
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    button: {
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 10,
        minWidth: 120,
        alignItems: 'center',
    },
    buttonPressed: {
        opacity: 0.9,
    },
    buttonText: {
        fontFamily: Fonts.SemiBold,
        fontSize: 16,
        color: Colors.backgroundWhite,
    },
});
