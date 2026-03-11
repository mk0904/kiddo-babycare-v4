import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
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
    isAuthenticated: boolean;
    onPlaceOrder: () => void;
    onAddAddress: () => void;
    onPaymentMethodPress?: () => void;
    /** Pay button prefix from backend app config (e.g. "Pay"). */
    payButtonLabel?: string | null;
}

export function CartFooterPayment({
    showPayButton,
    paymentMethod,
    toPay,
    formatCurrency,
    orderLoading,
    isAuthenticated,
    onPlaceOrder,
    onAddAddress,
    onPaymentMethodPress,
    payButtonLabel,
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

            {showPayButton ? (
                <TouchableOpacity
                    style={[styles.payButton, (orderLoading || !isAuthenticated) && styles.payButtonDisabled]}
                    onPress={onPlaceOrder}
                    disabled={orderLoading || !isAuthenticated}
                    activeOpacity={0.85}
                >
                    {orderLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : isAuthenticated ? (
                        <View style={styles.payButtonContent}>
                            <Text style={styles.payButtonPrefix}>{payPrefix} </Text>
                            <Text style={styles.payButtonAmount}>{formatCurrency(toPay)}</Text>
                            <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.payButtonArrow} />
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
        borderRadius: 28,
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
    payButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    payButtonPrefix: {
        color: '#fff',
        fontSize: 15,
        fontFamily: Fonts.Regular,
    },
    payButtonAmount: {
        color: '#fff',
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
    },
    payButtonArrow: {
        marginLeft: 6,
    },
    payButtonText: {
        color: '#fff',
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
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
});
