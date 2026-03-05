import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface DeliverySchedule {
    date?: string;
    time?: string;
    timeSlotLabel?: string;
}

export interface DeliveryCardProps {
    deliverySchedule: DeliverySchedule | null;
    onSchedulePress: () => void;
}

export function DeliveryCard({ deliverySchedule, onSchedulePress }: DeliveryCardProps) {
    const isScheduled = Boolean(deliverySchedule?.date && deliverySchedule?.time);

    return (
        <View style={styles.card}>
            {isScheduled ? (
                <>
                    <Ionicons
                        name="calendar-outline"
                        size={24}
                        color={Colors.primary}
                        style={styles.icon}
                    />
                    <View style={styles.content}>
                        <Text style={styles.title}>
                            Delivery scheduled for {deliverySchedule?.timeSlotLabel ?? deliverySchedule?.time}
                        </Text>
                        <TouchableOpacity onPress={onSchedulePress} activeOpacity={0.7}>
                            <Text style={styles.link}>
                                Changed your mind? <Text style={styles.linkUnderline}>Update now</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                <>
                    <Ionicons name="flash" size={24} color="#E6B800" style={styles.icon} />
                    <View style={styles.content}>
                        <Text style={styles.title}>Delivery in 35 min</Text>
                        <TouchableOpacity onPress={onSchedulePress} activeOpacity={0.7}>
                            <Text style={[styles.link, styles.linkUnderline]}>
                                Want it later? Schedule delivery
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 0,
        marginBottom: 12,
        padding: 16,
        borderRadius: 12,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
    },
    icon: {
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#2D2D2D',
        marginBottom: 4,
    },
    link: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: Colors.primary,
    },
    linkUnderline: {
        textDecorationLine: 'underline',
        color: Colors.primary,
    },
});
