import FlashIcon from '@/assets/icons/Icon.svg';
import { DEFAULT_ETA_MINUTES } from '@/config/deliveryConfig';
import { Colors, Fonts } from '@/constants/theme';
import { appConfigService } from '@/services/appConfigService';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
                    <FlashIcon width={44} height={44} style={styles.icon} />
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
        marginBottom: 16,
        padding: 6,
        paddingVertical: 12,
        borderRadius: 16,
    },
    icon: {
        marginRight: 6,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#181D27',
        marginBottom: 2,
    },
    unserviceableTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendBold,
        color: '#181D27',
    },
    subtitle: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#414651',
        marginBottom: 4,
    },
    link: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#F15E5E',
    },
    linkUnderline: {
        textDecorationLine: 'underline',
        color: Colors.primary,
    },
});
