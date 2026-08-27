import { Colors, Fonts } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const PAY_BUTTON_COLOR = '#DB5656';

export interface CartFooterPaymentProps {
    /** Whether to show the Pay button (true when address selected or ticketing-only). */
    showPayButton: boolean;
    paymentMethod: 'cod' | 'razorpay';
    toPay: number;
    formatCurrency: (amount: number) => string;
    orderLoading: boolean;
    isSyncing?: boolean;
    isAuthenticated: boolean;
    onPlaceOrder: () => void;
    onAddAddress: () => void;
    /** Called when user taps "Login to Order" (when not authenticated). */
    onLoginPress?: () => void;
    onPaymentMethodPress?: () => void;
    /** Pay button prefix from backend app config (e.g. "Pay"). */
    payButtonLabel?: string | null;
    /** If true, the pay button will be disabled because the cart value is below min order value. */
    minOrderValueNotMet?: boolean;
    minOrderValue?: number;
    cartSubtotal?: number;
    hotWheelConfig?: {
        isEnabled: boolean;
        minCartValue: number;
        deliveryText: string;
    } | null;
}

export function CartFooterPayment({
    showPayButton,
    paymentMethod,
    toPay,
    formatCurrency,
    orderLoading,
    isSyncing = false,
    isAuthenticated,
    onPlaceOrder,
    onAddAddress,
    onLoginPress,
    onPaymentMethodPress,
    payButtonLabel,
    minOrderValueNotMet = false,
    minOrderValue,
    cartSubtotal,
    hotWheelConfig,
}: CartFooterPaymentProps) {
    const payPrefix = payButtonLabel?.trim() || 'Pay';
    const paymentMethodLabel =
        paymentMethod === 'cod'
            ? 'Cash on Delivery (COD)'
            : 'Pay Online - Card, UPI, Net Banking';

    return (
        <View style={styles.container}>
            {/* <View style={styles.left}>
                <TouchableOpacity
                    style={styles.payUsingRow}
                    onPress={onPaymentMethodPress}
                    activeOpacity={onPaymentMethodPress ? 0.7 : 1}
                    disabled={!onPaymentMethodPress}
                >
                    <Text style={styles.payUsingLabel}>Pay using</Text>
                    <Ionicons name="chevron-down" size={18} color="#666" />
                </TouchableOpacity>
                <Text style={styles.paymentMethod}>{paymentMethodLabel}</Text>
            </View> */}

            {minOrderValueNotMet && minOrderValue && cartSubtotal !== undefined ? (
                <View style={styles.minOrderBanner}>
                    <Text style={styles.minOrderText}>
                        Add items worth ₹{(minOrderValue - cartSubtotal)} or more to place an order
                    </Text>
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(0, (cartSubtotal / minOrderValue) * 100))}%` }]} />
                    </View>
                </View>
            ) : hotWheelConfig?.isEnabled && cartSubtotal !== undefined ? (
                cartSubtotal < hotWheelConfig.minCartValue ? (
                    <View style={styles.hwGreyBanner}>
                        <Text style={styles.hwGreyText}>
                            Add items worth ₹{(hotWheelConfig.minCartValue - cartSubtotal)} or more to unlock free delivery
                        </Text>
                        <View style={styles.hwProgressBarContainer}>
                            <View style={[styles.hwProgressBarFill, { width: `${Math.min(100, Math.max(0, (cartSubtotal / hotWheelConfig.minCartValue) * 100))}%` }]} />
                        </View>
                    </View>
                ) : (
                    <View style={styles.hwGreenBanner}>
                        <Text style={styles.hwGreenText}>
                            {hotWheelConfig.deliveryText}
                        </Text>
                    </View>
                )
            ) : null}

            {showPayButton ? (
                <TouchableOpacity

                    style={[
                        styles.payButton,
                        (orderLoading || isSyncing) && !minOrderValueNotMet && styles.payButtonDisabled,
                        minOrderValueNotMet && styles.payButtonMinOrderNotMet
                    ]}

                    onPress={() => {
                        if (process.env.EXPO_OS === 'ios') {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }
                        (isAuthenticated ? onPlaceOrder : (onLoginPress ?? onPlaceOrder))();
                    }}
                    disabled={orderLoading || isSyncing || minOrderValueNotMet}
                    activeOpacity={0.85}
                >
                    {orderLoading ? (
                        <ActivityIndicator color={minOrderValueNotMet ? '#9CA3AF' : '#fff'} size="small" />
                    ) : isAuthenticated ? (
                        <View style={styles.payButtonContent}>
                            <Text style={[styles.payButtonPrefix, minOrderValueNotMet && styles.payButtonTextDisabled]}>{payPrefix} </Text>
                            <Text style={[styles.payButtonAmount, minOrderValueNotMet && styles.payButtonTextDisabled]}>{formatCurrency(toPay)}</Text>
                        </View>
                    ) : (
                        <Text style={styles.payButtonText}>Login to Order</Text>
                    )}
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={styles.addAddressButton} onPress={onAddAddress} activeOpacity={0.85}>
                    <Text style={styles.addAddressButtonText}>Add Address</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    left: {
        flex: 1,
    },
    payUsingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    payUsingLabel: {
        fontSize: 13,
        color: '#666',
        fontFamily: Fonts.Regular,
    },
    paymentMethod: {
        fontSize: 14,
        color: '#2D2D2D',
        fontFamily: Fonts.SemiBold,
    },
    payButton: {
        width: '90%',
        alignSelf: 'center',
        backgroundColor: '#DB5656',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        minWidth: 140,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 4,
            },
            android: { elevation: 3 },
        }),
    },
    payButtonDisabled: {
        opacity: 0.6,
    },
    payButtonMinOrderNotMet: {
        backgroundColor: '#F3F4F6',
        shadowOpacity: 0,
        elevation: 0,
    },
    payButtonTextDisabled: {
        color: '#9CA3AF',
    },
    payButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    payButtonPrefix: {
        color: '#fff',
        fontSize: Fonts.MediumFontSize,
        fontFamily: Fonts.LexendBold,
    },
    payButtonAmount: {
        color: '#fff',
        fontSize: Fonts.MediumFontSize,
        fontFamily: Fonts.LexendBold,
    },
    payButtonArrow: {
        marginLeft: 6,
    },
    payButtonText: {
        color: '#fff',
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
    },
    addAddressButton: {
        width: '90%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 28,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 4,
            },
            android: { elevation: 3 },
        }),
    },
    addAddressButtonText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
    },
    minOrderBanner: {
        width: '100%',
        backgroundColor: '#FFEFEF',
        marginTop: -15,
        marginBottom: 15,
        paddingTop: 8,
        alignItems: 'center',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    minOrderText: {
        color: '#F15E5E',
        fontFamily: Fonts.LexendSemiBold,
        fontSize: Fonts.ExtraSmallFontSize,
        marginBottom: 10,
    },
    progressBarContainer: {
        width: '100%',
        height: 4,
        backgroundColor: '#FFEFEF',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#F15E5E',
    },
    hwGreyBanner: {
        width: '100%',
        backgroundColor: '#F5F5F5',
        marginTop: -15,
        marginBottom: 15,
        paddingTop: 8,
        alignItems: 'center',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    hwGreyText: {
        color: '#717680',
        fontFamily: Fonts.LexendSemiBold,
        fontSize: Fonts.ExtraSmallFontSize,
        marginBottom: 10,
    },
    hwProgressBarContainer: {
        width: '100%',
        height: 4,
        backgroundColor: '#E4E7EC',
    },
    hwProgressBarFill: {
        height: '100%',
        backgroundColor: '#47CD89',
    },
    hwGreenBanner: {
        width: '100%',
        backgroundColor: '#E8F5E9',
        marginTop: -15,
        marginBottom: 15,
        paddingVertical: 8,
        alignItems: 'center',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    hwGreenText: {
        color: '#099250',
        fontFamily: Fonts.LexendSemiBold,
        fontSize: Fonts.ExtraSmallFontSize,
    }
});
