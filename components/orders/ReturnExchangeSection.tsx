import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { Alert, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ReturnExchangeItem {
    id: string;
    title: string;
    price: string;
    volume: string;
    quantity: number;
    image?: string;
    exchangeVariant?: string;
}

export type RefundTrackerStatus = 'return_initiated' | 'qc_initiated' | 'qc_rejected' | 'return_accepted' | 'refund_initiated' | 'refund_completed';

interface ReturnExchangeSectionProps {
    type: 'Returns' | 'Exchanges';
    orderId: string;
    items: ReturnExchangeItem[];
    status?: RefundTrackerStatus | string;
}

export const ReturnExchangeSection: React.FC<ReturnExchangeSectionProps> = ({ type, orderId, items, status = 'return_initiated' }) => {

    const copyOrderId = async () => {
        try {
            await Share.share({ message: `Order ID: ${orderId}` });
        } catch (_) {
            Alert.alert('Order ID', orderId);
        }
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>{type === 'Returns' ? 'Return Order' : 'Exchange Order'}</Text>
                <TouchableOpacity style={styles.orderIdRow} onPress={copyOrderId} activeOpacity={0.7}>
                    <Text style={styles.orderIdText}>Order ID #{orderId}</Text>
                </TouchableOpacity>
            </View>

            {/* Product Cards */}
            {items.map((item) => (
                <View key={item.id} style={styles.productCard}>
                    <View style={styles.imageContainer}>
                        {item.image ? (
                            <Image source={{ uri: item.image }} style={styles.productImage} contentFit="contain" />
                        ) : (
                            <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                        )}
                    </View>
                    <View style={styles.productDetails}>
                        <Text style={styles.productTitle} numberOfLines={2}>
                            {item.title}
                        </Text>
                        <View style={styles.productMetaRow}>
                            <Text style={styles.productPrice}>₹{item.price}</Text>
                            <Text style={styles.productVolume}>{item.volume}</Text>
                            <Text style={styles.productQty}>QTY:{item.quantity}</Text>
                        </View>
                        {item.exchangeVariant && (
                            <View style={styles.exchangeVariantContainer}>
                                <Text style={styles.exchangeVariantText}>Exchanging for: {item.exchangeVariant}</Text>
                            </View>
                        )}
                    </View>
                </View>
            ))}

            {/* Refund Tracker (Only for Returns) */}
            {type === 'Returns' && (
                <View style={styles.trackerCard}>
                    {(() => {
                        let activeDots = 1;
                        let activeLines = 0;
                        let isRejected = false;
                        let title = '';
                        let subtitle = '';

                        switch (status) {
                            case 'qc_rejected':
                                activeDots = 2;
                                activeLines = 1;
                                isRejected = true;
                                title = 'QC rejected';
                                subtitle = 'Your claim for a refund did not qualify';
                                break;
                            case 'qc_initiated':
                                activeDots = 2;
                                activeLines = 1;
                                title = 'Quality check in progress';
                                subtitle = 'Reviewing details';
                                break;
                            case 'return_accepted':
                            case 'refund_initiated':
                                activeDots = 3;
                                activeLines = 2;
                                title = 'Refund initiated';
                                subtitle = 'May take up to 36 hours';
                                break;
                            case 'refund_completed':
                                activeDots = 4;
                                activeLines = 3;
                                title = 'Refund completed';
                                subtitle = 'Amount refunded to source account';
                                break;
                            case 'return_initiated':
                            default:
                                activeDots = 1;
                                activeLines = 0;
                                title = 'Request accepted';
                                subtitle = 'Reviewing details';
                                break;
                        }

                        return (
                            <>
                                <View style={styles.trackerHeader}>
                                    <View>
                                        <Text style={styles.trackerTitle}>{title}</Text>
                                        <Text style={styles.trackerSubtitle}>{subtitle}</Text>
                                    </View>
                                </View>
                                <View style={styles.progressTrack}>
                                    <View style={[styles.dot, activeDots >= 1 ? (isRejected ? styles.dotRejected : styles.dotActive) : styles.dotInactive]} />
                                    <View style={[styles.line, activeLines >= 1 ? (isRejected ? styles.lineRejected : styles.lineActive) : styles.lineInactive]} />
                                    <View style={[styles.dot, activeDots >= 2 ? (isRejected ? styles.dotRejected : styles.dotActive) : styles.dotInactive]} />
                                    <View style={[styles.line, activeLines >= 2 ? (isRejected ? styles.lineRejected : styles.lineActive) : styles.lineInactive]} />
                                    <View style={[styles.dot, activeDots >= 3 ? (isRejected ? styles.dotRejected : styles.dotActive) : styles.dotInactive]} />
                                    <View style={[styles.line, activeLines >= 3 ? (isRejected ? styles.lineRejected : styles.lineActive) : styles.lineInactive]} />
                                    <View style={[styles.dot, activeDots >= 4 ? (isRejected ? styles.dotRejected : styles.dotActive) : styles.dotInactive]} />
                                </View>
                            </>
                        );
                    })()}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
        paddingHorizontal: 0,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#6B7280',
    },
    orderIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    orderIdText: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
    },
    copyIcon: {
        marginLeft: 6,
    },
    productCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    imageContainer: {
        width: 60,
        height: 60,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        backgroundColor: '#FFFFFF',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    productDetails: {
        flex: 1,
    },
    productTitle: {
        fontFamily: Fonts.LexendMedium,
        fontSize: 13,
        color: '#111827',
        marginBottom: 8,
        lineHeight: 18,
    },
    productMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    productPrice: {
        fontFamily: Fonts.LexendBold,
        fontSize: 13,
        color: '#374151',
        marginRight: 8,
    },
    productVolume: {
        fontFamily: Fonts.LexendMedium,
        fontSize: 13,
        color: '#9CA3AF',
        flex: 1,
    },
    productQty: {
        fontFamily: Fonts.LexendBold,
        fontSize: 13,
        color: '#6B7280',
    },
    exchangeVariantContainer: {
        marginTop: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    exchangeVariantText: {
        fontFamily: Fonts.LexendMedium,
        fontSize: 12,
        color: '#4B5563',
    },
    trackerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginTop: 4,
    },
    trackerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    trackerTitle: {
        fontFamily: Fonts.LexendSemiBold,
        fontSize: 14,
        color: '#181D27',
        marginBottom: 4,
    },
    trackerSubtitle: {
        fontFamily: Fonts.LexendMedium,
        fontSize: 12,
        color: '#717680',
    },
    progressTrack: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 2,
        marginTop: 0,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    dotActive: {
        backgroundColor: '#10B981', // Green
    },
    dotInactive: {
        backgroundColor: '#D1D5DB', // Gray
    },
    dotRejected: {
        backgroundColor: '#EF4444', // Red
    },
    line: {
        flex: 1,
        height: 2,
        marginHorizontal: 4,
    },
    lineActive: {
        backgroundColor: '#10B981',
    },
    lineInactive: {
        backgroundColor: '#E5E7EB',
    },
    lineRejected: {
        backgroundColor: '#EF4444',
    },
});
