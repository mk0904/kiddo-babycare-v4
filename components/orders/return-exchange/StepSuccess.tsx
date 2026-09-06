import { Fonts } from '@/constants/theme';
import { useUserStore } from '@/store/userStore';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useEffect } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ItemDetails } from './types';



interface StepSuccessProps {
    selectedItems: string[];
    itemDetails: Record<string, ItemDetails>;
    onClose: () => void;
}

export const StepSuccess: React.FC<StepSuccessProps> = ({ selectedItems, itemDetails, onClose }) => {
    const insets = useSafeAreaInsets();
    // Attempt to grab user from store if available
    const user = useUserStore((s: any) => s.user);

    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const titleText = useMemo(() => {
        let hasExchange = false;
        let hasReturn = false;
        selectedItems.forEach(id => {
            const type = itemDetails[id]?.type;
            if (type === 'Exchange') hasExchange = true;
            if (type === 'Return') hasReturn = true;
        });

        if (hasExchange && hasReturn) return 'Return & Exchange\nOrder Placed';
        if (hasExchange) return 'Exchange\nOrder Placed';
        if (hasReturn) return 'Return\nOrder Placed';
        return 'Order Placed';
    }, [selectedItems, itemDetails]);

    // We'll use a local fallback avatar if user avatar is unavailable, or just an icon.
    // Assuming the user has avatar/profileImage url.
    const avatarUrl = user?.avatar || user?.profileImage || user?.photoURL;

    return (
        <View style={styles.container}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    {/* Concentric circles background */}
                    <Svg height="160" width="160" style={styles.bgCircles}>
                        <Circle cx="80" cy="80" r="75" stroke="#E1EFE7" strokeWidth="1" fill="none" />
                        <Circle cx="80" cy="80" r="48" stroke="#E1EFE7" strokeWidth="1" fill="none" />
                    </Svg>

                    <View style={styles.checkCircle}>
                        <Ionicons name="checkmark" size={36} color="#FFFFFF" />
                    </View>


                </View>

                <Text style={styles.titleText}>{titleText}</Text>
            </View>

            {/* Bottom Footer */}
            <View style={[styles.footerBackground, { bottom: -insets.bottom, height: 190 + insets.bottom }]}>
                <Image source={require('@/assets/images/order-success-footer.png')} style={styles.footerImage} resizeMode="cover" />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    closeBtn: {
        position: 'absolute',
        top: 24, // accommodate safe area if not wrapped closely
        left: 20,
        zIndex: 10,
        padding: 4,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -100, // Move it up slightly above absolute center
    },
    iconContainer: {
        width: 160,
        height: 160,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    bgCircles: {
        position: 'absolute',
    },
    checkCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#0FA958', // Green check
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    avatarImg: {
        width: '100%',
        height: '100%',
    },
    avatarFallback: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4B5563',
    },
    titleText: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        textAlign: 'center',
        lineHeight: 24,
    },
    footerBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 190,
        zIndex: 1,
    },
    footerImage: {
        width: '100%',
        height: '100%',
    },
});
