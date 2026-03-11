import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface ScheduleDeliveryModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (schedule: DeliverySchedule) => void;
    initialSchedule?: DeliverySchedule | null;
    /** Title from backend app config (e.g. "Schedule your delivery"). */
    title?: string | null;
}

export interface DeliverySchedule {
    date: string; // Format: DD/MM/YYYY
    time: string; // Format: HH:MM AM/PM
    day: string; // Day name (e.g., "Saturday")
    dateFormat: string; // Format: "dd/mm/yy"
    timeSlotLabel?: string; // Display label e.g. "11AM - 12PM"
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Next 3 days: today, tomorrow, day after. Each has label and date in "12 March" format. */
function getNextThreeDays(): { label: string; date: Date; dateLabel: string }[] {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const result: { label: string; date: Date; dateLabel: string }[] = [];
    const labels = ['Today', 'Tomorrow', 'Day after'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    for (let i = 0; i < 3; i++) {
        const d = new Date(base);
        d.setDate(d.getDate() + i);
        const dateLabel = `${d.getDate()} ${monthNames[d.getMonth()]}`;
        result.push({ label: labels[i], date: d, dateLabel });
    }
    return result;
}

// Design spec: vibrant red and neutrals to match the Schedule delivery mock
const DESIGN_RED = '#E84E4E';
const PILL_RADIUS = 999;

/** Parse slot value like "10:00 AM" or "01:00 PM" to minutes since midnight (0–1439). */
function parseSlotMinutes(value: string): number {
    const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return 0;
    let hour = parseInt(match[1], 10);
    const min = parseInt(match[2], 10);
    if ((match[3].toUpperCase()) === 'PM' && hour !== 12) hour += 12;
    if (match[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
    return hour * 60 + min;
}

/** When date is today, return only slots whose start time is after the current time. */
function getAvailableTimeSlots(isToday: boolean): { label: string; value: string }[] {
    if (!isToday) return TIME_SLOT_RANGES;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    return TIME_SLOT_RANGES.filter((slot) => parseSlotMinutes(slot.value) > currentMinutes);
}

// Time slots as ranges for display; value is start time for DeliverySchedule
const TIME_SLOT_RANGES: { label: string; value: string }[] = [
    { label: '7AM - 8AM', value: '07:00 AM' },
    { label: '8AM - 9AM', value: '08:00 AM' },
    { label: '9AM - 10AM', value: '09:00 AM' },
    { label: '10AM - 11AM', value: '10:00 AM' },
    { label: '11AM - 12PM', value: '11:00 AM' },
    { label: '12PM - 1PM', value: '12:00 PM' },
    { label: '1PM - 2PM', value: '01:00 PM' },
    { label: '2PM - 3PM', value: '02:00 PM' },
    { label: '3PM - 4PM', value: '03:00 PM' },
    { label: '4PM - 5PM', value: '04:00 PM' },
    { label: '5PM - 6PM', value: '05:00 PM' },
    { label: '6PM - 7PM', value: '06:00 PM' },
    { label: '7PM - 8PM', value: '07:00 PM' },
    { label: '8PM - 9PM', value: '08:00 PM' },
    { label: '9PM - 10PM', value: '09:00 PM' },
    { label: '10PM - 11PM', value: '10:00 PM' },
    { label: '11PM - 11:30AM', value: '11:00 PM' },
];

export const ScheduleDeliveryModal = ({ visible, onClose, onConfirm, initialSchedule, title }: ScheduleDeliveryModalProps) => {
    const [selectedDayIndex, setSelectedDayIndex] = useState(0); // 0 = Today, 1 = Tomorrow, 2 = Day after
    const [selectedTime, setSelectedTime] = useState<string>('');

    const nextThreeDays = React.useMemo(() => getNextThreeDays(), [visible]);

    useEffect(() => {
        if (visible) {
            const days = getNextThreeDays();
            if (initialSchedule?.date && initialSchedule?.time) {
                const matchIndex = days.findIndex((opt) => formatDate(opt.date) === initialSchedule.date);
                const idx = matchIndex >= 0 ? matchIndex : 0;
                setSelectedDayIndex(idx);
                const isToday = idx === 0;
                const available = getAvailableTimeSlots(isToday);
                const stillValid = available.some((s) => s.value === initialSchedule.time);
                setSelectedTime(stillValid ? initialSchedule.time : '');
            } else {
                setSelectedDayIndex(0);
                setSelectedTime('');
            }
        }
    }, [visible, initialSchedule]);

    // When "Today" is selected, clear time if it's now in the past
    useEffect(() => {
        if (selectedDayIndex !== 0 || !selectedTime) return;
        const available = getAvailableTimeSlots(true);
        if (!available.some((s) => s.value === selectedTime)) setSelectedTime('');
    }, [selectedDayIndex, selectedTime]);

    const formatDate = (date: Date): string => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const formatDateShort = (date: Date): string => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    };

    const getDayName = (date: Date): string => DAYS[date.getDay()];

    const selectedDate = nextThreeDays[selectedDayIndex]?.date ?? new Date();
    const isTodaySelected = selectedDayIndex === 0;

    const handleConfirm = () => {
        if (!selectedTime) return;

        const selectedSlot = TIME_SLOT_RANGES.find(s => s.value === selectedTime);
        const schedule: DeliverySchedule = {
            date: formatDate(selectedDate),
            time: selectedTime,
            day: getDayName(selectedDate),
            dateFormat: formatDateShort(selectedDate),
            timeSlotLabel: selectedSlot?.label,
        };

        onConfirm(schedule);
        onClose();
    };

    const handleWantItNow = () => {
        onConfirm({
            date: '',
            time: '',
            day: '',
            dateFormat: '',
        });
        onClose();
    };

    const { height: screenHeight } = Dimensions.get('window');
    const contentHeight = Math.min(screenHeight * 0.7, 560);

    return (
        <Modal
            animationType="slide"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={[styles.content, { height: contentHeight }]}>
                    {/* Header: calendar icon + title + close */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View style={styles.headerIconWrap}>
                                <Ionicons name="calendar-outline" size={22} color="#5C5C5C" />
                            </View>
                            <Text style={styles.headerTitle}>{title?.trim() || 'Schedule delivery'}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={12}>
                            <Ionicons name="close" size={24} color="#4A4A4A" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>Get your order delivered at your chosen time</Text>

                    {/* Date: Today (with date); next two show date only (e.g. 13 March, 14 March) */}
                    <View style={styles.dateTrack}>
                        {nextThreeDays.map((opt, index) => {
                            const isSelected = selectedDayIndex === index;
                            const isToday = index === 0;
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                                    onPress={() => setSelectedDayIndex(index)}
                                    activeOpacity={0.8}
                                >
                                    {isToday ? (
                                        <>
                                            <Text style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}>
                                                Today
                                            </Text>
                                            
                                        </>
                                    ) : (
                                        <Text style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}>
                                            {opt.dateLabel}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={styles.dateTimeDivider} />

                    {/* Only time slots (hours) are scrollable */}
                    <ScrollView
                        style={styles.timeSlotsScrollView}
                        contentContainerStyle={styles.timeSlotsScrollContent}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.timeSlotsSection}>
                            {getAvailableTimeSlots(isTodaySelected).map((slot) => {
                                const isSelected = selectedTime === slot.value;
                                return (
                                    <TouchableOpacity
                                        key={slot.value}
                                        style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
                                        onPress={() => setSelectedTime(slot.value)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextSelected]}>
                                            {slot.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Confirm button + reset link */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.confirmButton, !selectedTime && styles.confirmButtonDisabled]}
                            onPress={handleConfirm}
                            disabled={!selectedTime}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleWantItNow} style={styles.wantItNowButton} activeOpacity={0.7}>
                            <Text style={styles.wantItNowText}>No, I want it now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        width: '100%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 8,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#F2F2F2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    closeButton: {
        padding: 4,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#888888',
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    timeSlotsScrollView: {
        flex: 1,
        minHeight: 0,
        maxHeight: 360,
    },
    timeSlotsScrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    dateTrack: {
        width: '80%',
        alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: '#E8E8E8',
        borderRadius: 36,
        padding: 4,
        marginBottom: 16,
    },
    dateChip: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateChipSelected: {
        backgroundColor: '#FFFFFF',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: '#D8D8D8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    dateChipText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#6B6B6B',
    },
    dateChipTextSelected: {
        color: DESIGN_RED,
        fontFamily: Fonts.Bold,
    },
    dateChipSubtext: {
        fontSize: 11,
        fontFamily: Fonts.Regular,
        color: '#6B6B6B',
        marginTop: 2,
    },
    dateChipSubtextSelected: {
        color: DESIGN_RED,
    },
    dateTimeDivider: {
        height: 1,
        backgroundColor: '#E8E8E8',
        marginBottom: 20,
    },
    timeSlotsSection: {
        gap: 10,
    },
    timeSlot: {
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeSlotSelected: {
        backgroundColor: '#FEEFEF',
        borderColor: DESIGN_RED,
        borderWidth: 1,
        borderRadius: PILL_RADIUS
    },
    timeSlotText: {
        fontSize: 15,
        fontFamily: Fonts.Medium,
        color: '#181D27',
    },
    timeSlotTextSelected: {
        color: '#181D27',
        fontFamily: Fonts.Bold,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
    },
    confirmButton: {
        width: '100%',
        backgroundColor: DESIGN_RED,
        paddingVertical: 16,
        borderRadius: PILL_RADIUS,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonDisabled: {
        backgroundColor: '#D0D0D0',
    },
    confirmButtonText: {
        fontSize: 17,
        fontFamily: Fonts.Bold,
        color: '#FFFFFF',
    },
    wantItNowButton: {
        alignSelf: 'center',
        paddingVertical: 14,
        paddingHorizontal: 8,
    },
    wantItNowText: {
        fontSize: 15,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
        textDecorationLine: 'underline',
    },
});
