import { Fonts } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type RefundStatus = 'initiated' | 'processing' | 'completed';

interface RefundStatusCardProps {
    amount: number;
    status: RefundStatus;
}

export const RefundStatusCard: React.FC<RefundStatusCardProps> = ({ amount, status }) => {

    const formattedAmount = `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

    let activeStep = 0;
    if (status === 'initiated') activeStep = 1;
    if (status === 'processing') activeStep = 2;
    if (status === 'completed') activeStep = 3;

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>
                        {status === 'completed'
                            ? 'Refund completed'
                            : status === 'processing'
                                ? `Refund of ${formattedAmount} processing`
                                : `Refund of ${formattedAmount} initiated`}
                    </Text>
                    {status !== 'completed' && (
                        <Text style={styles.subtitle}>May take upto 14 business days</Text>
                    )}
                </View>
                {status === 'completed' && (
                    <View style={styles.headerRight}>
                        <Text style={styles.completedAmountLabel}>Amount refunded</Text>
                        <Text style={styles.completedAmountValue}>{formattedAmount}</Text>
                    </View>
                )}
            </View>

            <View style={styles.progressTrack}>
                {/* Step 1 */}
                <View style={[styles.dot, activeStep >= 1 ? styles.dotActive : styles.dotInactive]} />
                <View style={[styles.line, activeStep >= 2 ? styles.lineActive : styles.lineInactive]} />

                {/* Step 2 */}
                <View style={[styles.dot, activeStep >= 2 ? styles.dotActive : styles.dotInactive]} />
                <View style={[styles.line, activeStep >= 3 ? styles.lineActive : styles.lineInactive]} />

                {/* Step 3 */}
                <View style={[styles.dot, activeStep >= 3 ? styles.dotActive : styles.dotInactive]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginTop: 16,

    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    headerLeft: {
        flex: 1,
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    title: {
        fontFamily: Fonts.LexendBold,
        fontSize: 14,
        color: '#1F2937',
        marginBottom: 4,
    },
    subtitle: {
        fontFamily: Fonts.LexendMedium,
        fontSize: 12,
        color: '#6B7280',
    },
    completedAmountLabel: {
        fontFamily: Fonts.LexendMedium,
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 2,
    },
    completedAmountValue: {
        fontFamily: Fonts.LexendBold,
        fontSize: 14,
        color: '#1F2937',
    },
    progressTrack: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotActive: {
        backgroundColor: '#F05A5D',
    },
    dotInactive: {
        backgroundColor: '#D1D5DB',
    },
    line: {
        flex: 1,
        height: 2,
        marginHorizontal: 4,
    },
    lineActive: {
        backgroundColor: '#F05A5D',
    },
    lineInactive: {
        backgroundColor: '#D1D5DB',
    },
});
