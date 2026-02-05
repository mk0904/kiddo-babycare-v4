import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
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
}

export interface DeliverySchedule {
    date: string; // Format: DD/MM/YYYY
    time: string; // Format: HH:MM AM/PM
    day: string; // Day name (e.g., "Saturday")
    dateFormat: string; // Format: "dd/mm/yy"
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_SLOTS = [
    '10:00 AM', '11:00 AM', '12:00 PM',
    '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM',
    '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM'
];

export const ScheduleDeliveryModal = ({ visible, onClose, onConfirm, initialSchedule }: ScheduleDeliveryModalProps) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    useEffect(() => {
        if (visible) {
            if (initialSchedule) {
                // Parse initial schedule
                const [day, month, year] = initialSchedule.date.split('/');
                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                setSelectedDate(date);
                setSelectedTime(initialSchedule.time);
            } else {
                // Default to tomorrow
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setSelectedDate(tomorrow);
                setSelectedTime('');
            }
        }
    }, [visible, initialSchedule]);

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

    const getDayName = (date: Date): string => {
        return DAYS[date.getDay()];
    };

    const getAvailableDates = (): Date[] => {
        const dates: Date[] = [];
        const today = new Date();
        // Generate next 5 days
        for (let i = 1; i <= 5; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            dates.push(date);
        }
        return dates;
    };

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        setShowDatePicker(false);
    };

    const handleTimeSelect = (time: string) => {
        setSelectedTime(time);
        setShowTimePicker(false);
    };

    const handleConfirm = () => {
        if (!selectedDate || !selectedTime) {
            return;
        }

        const schedule: DeliverySchedule = {
            date: formatDate(selectedDate),
            time: selectedTime,
            day: getDayName(selectedDate),
            dateFormat: formatDateShort(selectedDate),
        };

        onConfirm(schedule);
        onClose();
    };

    const handleRemove = () => {
        setSelectedDate(null);
        setSelectedTime('');
        onConfirm({
            date: '',
            time: '',
            day: '',
            dateFormat: '',
        });
        onClose();
    };

    const availableDates = getAvailableDates();

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Schedule Delivery</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.scrollContainer}>
                        <ScrollView
                            style={styles.scrollView}
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={true}
                            nestedScrollEnabled={true}
                        >
                        {/* Date Selection */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Select Delivery Date</Text>
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => setShowDatePicker(!showDatePicker)}
                            >
                                <View style={styles.pickerButtonContent}>
                                    <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                                    <View style={styles.pickerButtonTextContainer}>
                                        {selectedDate ? (
                                            <>
                                                <Text style={styles.pickerButtonText}>
                                                    {formatDate(selectedDate)}
                                                </Text>
                                                <Text style={styles.pickerButtonSubtext}>
                                                    {getDayName(selectedDate)}
                                                </Text>
                                            </>
                                        ) : (
                                            <Text style={[styles.pickerButtonText, styles.pickerButtonPlaceholder]}>
                                                Select Date
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <Ionicons
                                    name={showDatePicker ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color="#666"
                                />
                            </TouchableOpacity>

                            {showDatePicker && (
                                <View style={styles.pickerContainer}>
                                    <ScrollView
                                        style={styles.dateScrollView}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        {availableDates.map((date, index) => {
                                            const isSelected = selectedDate && 
                                                date.toDateString() === selectedDate.toDateString();
                                            const isToday = date.toDateString() === new Date().toDateString();
                                            
                                            return (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={[
                                                        styles.dateOption,
                                                        isSelected && styles.dateOptionSelected,
                                                    ]}
                                                    onPress={() => handleDateSelect(date)}
                                                >
                                                    <View style={styles.dateOptionContent}>
                                                        <Text style={styles.dateOptionDay}>
                                                            {getDayName(date)}
                                                        </Text>
                                                        <Text style={styles.dateOptionDate}>
                                                            {formatDate(date)}
                                                        </Text>
                                                    </View>
                                                    {isSelected && (
                                                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                                                    )}
                                                    {isToday && !isSelected && (
                                                        <Text style={styles.todayBadge}>Today</Text>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {/* Time Selection */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Select Delivery Time</Text>
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => setShowTimePicker(!showTimePicker)}
                            >
                                <View style={styles.pickerButtonContent}>
                                    <Ionicons name="time-outline" size={20} color={Colors.primary} />
                                    <View style={styles.pickerButtonTextContainer}>
                                        {selectedTime ? (
                                            <Text style={styles.pickerButtonText}>
                                                {selectedTime}
                                            </Text>
                                        ) : (
                                            <Text style={[styles.pickerButtonText, styles.pickerButtonPlaceholder]}>
                                                Select Time
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <Ionicons
                                    name={showTimePicker ? 'chevron-up' : 'chevron-down'}
                                    size={20}
                                    color="#666"
                                />
                            </TouchableOpacity>

                            {showTimePicker && (
                                <View style={styles.pickerContainer}>
                                    <ScrollView
                                        style={styles.timeScrollView}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        {TIME_SLOTS.map((time, index) => {
                                            const isSelected = selectedTime === time;
                                            return (
                                                <TouchableOpacity
                                                    key={index}
                                                    style={[
                                                        styles.timeOption,
                                                        isSelected && styles.timeOptionSelected,
                                                    ]}
                                                    onPress={() => handleTimeSelect(time)}
                                                >
                                                    <Text style={[
                                                        styles.timeOptionText,
                                                        isSelected && styles.timeOptionTextSelected,
                                                    ]}>
                                                        {time}
                                                    </Text>
                                                    {isSelected && (
                                                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {/* Summary */}
                        {selectedDate && selectedTime && (
                            <View style={styles.summaryContainer}>
                                <Text style={styles.summaryTitle}>Delivery Scheduled</Text>
                                <View style={styles.summaryContent}>
                                    <View style={styles.summaryRow}>
                                        <Ionicons name="calendar" size={16} color={Colors.primary} />
                                        <Text style={styles.summaryText}>
                                            {formatDate(selectedDate)} ({getDayName(selectedDate)})
                                        </Text>
                                    </View>
                                    <View style={styles.summaryRow}>
                                        <Ionicons name="time" size={16} color={Colors.primary} />
                                        <Text style={styles.summaryText}>{selectedTime}</Text>
                                    </View>
                                </View>
                            </View>
                        )}
                        </ScrollView>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        {initialSchedule && (
                            <TouchableOpacity style={styles.removeButton} onPress={handleRemove}>
                                <Ionicons name="trash-outline" size={18} color="#FF4444" />
                                <Text style={styles.removeButtonText}>Remove</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.confirmButton,
                                (!selectedDate || !selectedTime) && styles.confirmButtonDisabled
                            ]}
                            onPress={handleConfirm}
                            disabled={!selectedDate || !selectedTime}
                        >
                            <Text style={styles.confirmButtonText}>Confirm</Text>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '90%',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#000',
    },
    closeButton: {
        padding: 4,
    },
    scrollContainer: {
        flex: 1,
        minHeight: 0,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
        flexGrow: 1,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#000',
        marginBottom: 12,
    },
    pickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    pickerButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    pickerButtonTextContainer: {
        marginLeft: 12,
        flex: 1,
    },
    pickerButtonText: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#000',
    },
    pickerButtonSubtext: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#666',
        marginTop: 2,
    },
    pickerButtonPlaceholder: {
        color: '#999',
        fontFamily: Fonts.Regular,
    },
    pickerContainer: {
        marginTop: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e0e0e0',
        maxHeight: 200,
    },
    dateScrollView: {
        maxHeight: 200,
    },
    timeScrollView: {
        maxHeight: 200,
    },
    dateOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    dateOptionSelected: {
        backgroundColor: '#fff',
    },
    dateOptionContent: {
        flex: 1,
    },
    dateOptionDay: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#000',
        marginBottom: 4,
    },
    dateOptionDate: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#666',
    },
    todayBadge: {
        fontSize: 10,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
        backgroundColor: `${Colors.primary}20`,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    timeOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
        backgroundColor: '#fff',
    },
    timeOptionSelected: {
        backgroundColor: '#fff',
    },
    timeOptionText: {
        fontSize: 16,
        fontFamily: Fonts.Regular,
        color: '#000',
    },
    timeOptionTextSelected: {
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    summaryContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    summaryTitle: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#000',
        marginBottom: 12,
    },
    summaryContent: {
        gap: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    summaryText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#000',
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        flexDirection: 'row',
        gap: 15,
    },
    removeButton: {
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ff4444',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    removeButtonText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#ff4444',
    },
    confirmButton: {
        flex: 1,
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    confirmButtonDisabled: {
        backgroundColor: '#ccc',
        shadowOpacity: 0,
        elevation: 0,
    },
    confirmButtonText: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#fff',
    },
});

