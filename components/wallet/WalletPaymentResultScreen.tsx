import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ICON_SIZE = 88;
const RING_SIZES = [ICON_SIZE + 48, ICON_SIZE + 96];
const SUCCESS_AUTO_REDIRECT_MS = 3000;

export type WalletPaymentResultVariant = 'success' | 'failure';

type WalletPaymentResultScreenProps = {
    variant: WalletPaymentResultVariant;
    balance?: string;
    onClose?: () => void;
    onTryAgain?: () => void;
};

function StatusIcon({ variant }: { variant: WalletPaymentResultVariant }) {
    const isSuccess = variant === 'success';
    const mainColor = isSuccess ? '#22C55E' : Colors.primary;
    const ringColor = isSuccess ? 'rgba(34, 197, 94, 0.18)' : 'rgba(252, 93, 91, 0.18)';

    return (
        <View style={styles.iconStack}>
            {RING_SIZES.map((size) => (
                <View
                    key={size}
                    style={[
                        styles.ring,
                        {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            backgroundColor: ringColor,
                        },
                    ]}
                />
            ))}
            <View
                style={[
                    styles.iconCircle,
                    {
                        width: ICON_SIZE,
                        height: ICON_SIZE,
                        borderRadius: ICON_SIZE / 2,
                        backgroundColor: mainColor,
                    },
                ]}
            >
                <Ionicons
                    name={isSuccess ? 'checkmark' : 'close'}
                    size={44}
                    color="#FFFFFF"
                />
            </View>
        </View>
    );
}

export function WalletPaymentResultScreen({
    variant,
    balance,
    onClose,
    onTryAgain,
}: WalletPaymentResultScreenProps) {
    const router = useRouter();
    const isSuccess = variant === 'success';

    useEffect(() => {
        if (!isSuccess || onClose) return;

        const timer = setTimeout(() => {
            router.replace('/referral');
        }, SUCCESS_AUTO_REDIRECT_MS);

        return () => clearTimeout(timer);
    }, [isSuccess, onClose, router]);

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onClose) {
            onClose();
            return;
        }
        router.replace('/wallet');
    };

    const handleTryAgain = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onTryAgain) {
            onTryAgain();
            return;
        }
        router.replace({
            pathname: '/wallet/add-balance',
            params: { balance: balance ?? '0' },
        } as never);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <StatusBar style="dark" />

            <TouchableOpacity style={styles.closeButton} onPress={handleClose} hitSlop={12}>
                <Ionicons name="close" size={28} color="#1A1A1A" />
            </TouchableOpacity>

            <View style={styles.content}>
                <StatusIcon variant={variant} />
                <Text style={styles.title}>
                    {isSuccess ? 'Balance Added!' : 'Balance Could not be added!'}
                </Text>
            </View>

            {!isSuccess ? (
                <View style={styles.failureActions}>
                    <TouchableOpacity
                        style={styles.tryAgainButton}
                        onPress={handleTryAgain}
                        activeOpacity={0.9}
                    >
                        <Text style={styles.tryAgainText}>Try again</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.successSpacer} />
            )}

            {isSuccess ? (
                <View style={styles.footerBackground}>
                    <Image
                        source={require('@/assets/images/order-success-footer.png')}
                        style={styles.footerImage}
                        contentFit="cover"
                    />
                </View>
            ) : null}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    closeButton: {
        paddingHorizontal: 20,
        paddingTop: 8,
        alignSelf: 'flex-start',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    iconStack: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
    },
    ring: {
        position: 'absolute',
    },
    iconCircle: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    title: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        textAlign: 'center',
        marginTop: 48,
    },
    successSpacer: {
        flex: 0,
    },
    failureActions: {
        width: '50%',
        alignSelf: 'center',
        paddingHorizontal: 24,
        paddingBottom: 48,
    },
    tryAgainButton: {
        backgroundColor: Colors.primary,
        borderRadius: 20,
        paddingVertical: 16,
        alignItems: 'center',
    },
    tryAgainText: {
        fontSize: 16,
        fontFamily: Fonts.LexendSemiBold,
        color: '#FFFFFF',
    },
    footerBackground: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 180,
        pointerEvents: 'none',
    },
    footerImage: {
        width: '100%',
        height: '100%',
    },
});
