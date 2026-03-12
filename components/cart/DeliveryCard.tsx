import { DEFAULT_ETA_MINUTES } from '@/config/deliveryConfig';
import { Colors, Fonts } from '@/constants/theme';
import { appConfigService } from '@/services/appConfigService';
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
    /** ETA in minutes (uses deliveryConfig formula). When not provided, shows default unless isUnserviceable. */
    estimatedDeliveryMinutes?: number | null;
    /** When true, show "Area unserviceable" instead of ETA (e.g. detected location outside delivery range). */
    isUnserviceable?: boolean;
}

/** Format date string (DD/MM/YYYY or YYYY-MM-DD) to "7 March 2026" style. */
function formatDeliveryDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    let d: Date | null = null;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/').map(Number);
        d = new Date(year, month - 1, day);
    } else {
        d = new Date(trimmed);
    }
    if (!d || Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const DEFAULT_SCHEDULED_TITLE = 'Delivery scheduled!';
const DEFAULT_INSTANT_LABEL = 'Delivery in {minutes} min';
const DEFAULT_SCHEDULE_CTA = 'Want it later? Schedule delivery';

export function DeliveryCard({ deliverySchedule, onSchedulePress, estimatedDeliveryMinutes, isUnserviceable }: DeliveryCardProps) {
    const isScheduled = Boolean(deliverySchedule?.date && deliverySchedule?.time);
    const etaMins = estimatedDeliveryMinutes != null ? estimatedDeliveryMinutes : DEFAULT_ETA_MINUTES;
    const deliveryCardCopy = appConfigService.getCartConfig()?.deliveryCard;
    const scheduledTitle = deliveryCardCopy?.scheduledTitle?.trim() || DEFAULT_SCHEDULED_TITLE;
    const instantLabel = (deliveryCardCopy?.instantLabel?.trim() || DEFAULT_INSTANT_LABEL).replace(/\{minutes\}/g, String(etaMins));
    const scheduleCta = deliveryCardCopy?.scheduleCta?.trim() || DEFAULT_SCHEDULE_CTA;

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
                            {scheduledTitle}
                        </Text>
                        <Text style={styles.subtitle}>
                            For {deliverySchedule?.timeSlotLabel ?? deliverySchedule?.time} · {formatDeliveryDate(deliverySchedule?.date)}
                        </Text>
                        <TouchableOpacity onPress={onSchedulePress} activeOpacity={0.7}>
                            <Text style={styles.link}>
                                <Text>Changed your mind? Update now</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                <>
                    <Ionicons name="flash" size={24} color="#E6B800" style={styles.icon} />
                    <View style={styles.content}>
                        <Text style={[styles.title, isUnserviceable && styles.unserviceableTitle]}>
                            {isUnserviceable ? 'Area unserviceable' : instantLabel}
                        </Text>
                        <TouchableOpacity onPress={onSchedulePress} activeOpacity={0.7}>
                            <Text style={[styles.link]}>
                                {scheduleCta}
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
        marginBottom: 24,
        padding: 8,
        paddingVertical: 16,
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
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.Lexend,
        color: '#181D27',
        marginBottom: 4,
        fontWeight: Fonts.BoldWeight,
    },
    unserviceableTitle: {
        color: '#DC2626',
    },
    subtitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.MediumWeight,
        color: '#414651',
        marginBottom: 6,
    },
    link: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.Lexend,
        fontWeight: Fonts.MediumWeight,
        color: '#F15E5E',
    },
    linkUnderline: {
        textDecorationLine: 'underline',
        color: Colors.primary,
    },
});
