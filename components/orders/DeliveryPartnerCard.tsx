import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Fonts } from '@/constants/theme';
import type { DeliveryPartnerOrderStatus } from '@/services/deliveryPartnerService';

type DeliveryPartnerCardProps = {
    isRiderAtCustomer: boolean;
    shouldShowAssignSoonMessage: boolean;
    shouldShowDeliveryPartnerDetails: boolean;
    partnerAvatarSrc: any;
    deliveryPartnerStatus: DeliveryPartnerOrderStatus | null;
    handleDeliveryPartnerCall: () => void;
};

export const DeliveryPartnerCard: React.FC<DeliveryPartnerCardProps> = ({
    isRiderAtCustomer,
    shouldShowAssignSoonMessage,
    shouldShowDeliveryPartnerDetails,
    partnerAvatarSrc,
    deliveryPartnerStatus,
    handleDeliveryPartnerCall,
}) => {
    return (
        <>
            {isRiderAtCustomer ? (
                <View style={styles.arrivedAtCustomerBox}>
                    <View style={styles.arrivedAtIconWrap}>
                        <Ionicons name="checkmark-circle" size={32} color="#16A34A" />
                    </View>
                    <View style={styles.arrivedAtTextWrap}>
                        <Text style={styles.arrivedAtTitle}>Rider has arrived</Text>
                        <Text style={styles.arrivedAtSubtitle}>
                            Your delivery partner is at your location. Please collect your order.
                        </Text>
                    </View>
                </View>
            ) : null}

            {shouldShowAssignSoonMessage && (
                <View style={styles.deliveryPartnerCard}>
                    <View style={styles.deliveryPartnerContent}>
                        <View style={styles.deliveryPartnerAvatarWait}>
                            <Ionicons name="time-outline" size={26} color="#8B5E00" />
                        </View>
                        <View style={styles.deliveryPartnerTextWrap}>
                            <Text style={styles.deliveryPartnerIntro}>Your delivery partner will be assigned soon</Text>
                            <Text style={styles.deliveryPartnerPendingText}>We will share the rider details here shortly</Text>
                        </View>
                        <View style={styles.deliveryPartnerPendingBadge}>
                            <Ionicons name="hourglass-outline" size={18} color="#9CA3AF" />
                        </View>
                    </View>
                </View>
            )}

            {shouldShowDeliveryPartnerDetails && deliveryPartnerStatus?.deliveryPartner && (
                <View style={styles.deliveryPartnerCard}>
                    <View style={styles.deliveryPartnerContent}>
                        <View style={styles.deliveryPartnerAvatar}>
                            <Image
                                source={partnerAvatarSrc}
                                style={styles.deliveryPartnerAvatarImage}
                                contentFit="cover"
                            />
                        </View>
                        <View style={styles.deliveryPartnerTextWrap}>
                            <Text style={styles.deliveryPartnerIntro}>
                                {`I'm ${deliveryPartnerStatus.deliveryPartner.name || 'your delivery partner'}, your delivery partner`}
                            </Text>
                            <Text style={styles.deliveryPartnerContactText}>
                                {isRiderAtCustomer
                                    ? "I've arrived at your location. Please meet me for your delivery."
                                    : 'I have picked up your order, and I am on the way'}
                            </Text>
                        </View>
                        {!!deliveryPartnerStatus.deliveryPartner.contact && (
                            <TouchableOpacity
                                style={styles.deliveryPartnerCallButton}
                                onPress={handleDeliveryPartnerCall}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={`Call ${deliveryPartnerStatus.deliveryPartner.name || 'delivery partner'}`}
                            >
                                <Ionicons name="call" size={20} color="#16A34A" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    arrivedAtCustomerBox: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    arrivedAtIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    arrivedAtTextWrap: {
        flex: 1,
    },
    arrivedAtTitle: {
        fontSize: 16,
        fontFamily: Fonts.LexendBold,
        color: '#14532D',
        marginBottom: 4,
    },
    arrivedAtSubtitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#166534',
        lineHeight: 20,
    },
    deliveryPartnerCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        padding: 14,
    },
    deliveryPartnerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    deliveryPartnerAvatar: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    deliveryPartnerAvatarWait: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    deliveryPartnerAvatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 34,
    },
    deliveryPartnerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    deliveryPartnerIntro: {
        fontSize: Fonts.SmallFontSize,
        lineHeight: 20,
        fontFamily: Fonts.LexendBold,
        color: '#414651',
    },
    deliveryPartnerContactText: {
        marginTop: 4,
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#717680',
    },
    deliveryPartnerCallButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        marginLeft: 12,
    },
    deliveryPartnerPendingBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        marginLeft: 12,
    },
    deliveryPartnerPendingText: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#4B5563',
        marginTop: 4,
    },
});
