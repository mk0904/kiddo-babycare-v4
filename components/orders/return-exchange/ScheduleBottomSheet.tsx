import BaseModal from '@/components/ui/BaseModal';
import { Button } from '@/components/ui/Button';
import { Fonts } from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ScheduleBottomSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (schedule: { date: string; time: string }) => void;
}

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export const ScheduleBottomSheet: React.FC<ScheduleBottomSheetProps> = ({
    visible,
    onClose,
    onSelect,
}) => {
    const [availableSlots, setAvailableSlots] = useState<{ date: string, slots: string[] }[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            setLoading(true);
            fetch('https://delivery-partner-service-874125225773.asia-south1.run.app/api/limechat/orders/exchange-time-slots', {
                headers: {
                    'x-kiddo-secret': 'PLACEHOLDER_KIDDO_SECRET'
                }
            })
                .then(res => res.json())
                .then(res => {
                    if (res.ok && res.data) {
                        setAvailableSlots(res.data);
                        if (res.data.length > 0) {
                            setSelectedDate(res.data[0].date);
                            if (res.data[0].slots.length > 0) {
                                setSelectedTime(res.data[0].slots[0]);
                            }
                        }
                    }
                })
                .catch(err => console.error("Error fetching slots:", err))
                .finally(() => setLoading(false));
        }
    }, [visible]);

    const handleSelect = () => {
        if (selectedDate && selectedTime) {
            onSelect({ date: selectedDate, time: selectedTime });
        }
    };

    return (
        <BaseModal
            visible={visible}
            onClose={onClose}
            type="bottomSheet"
            showDragHandle={true}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Schedule return/exchange</Text>
                    <Text style={styles.subtitle}>Get your order delivered at your chosen time</Text>
                </View>

                {/* Dates */}
                <View>
                    {loading ? (
                        <ActivityIndicator style={{ paddingVertical: 12, marginLeft: 20 }} color="#F05A5D" />
                    ) : (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                            style={styles.scrollWrapper}
                        >
                            <View style={styles.datesContainer}>
                                {availableSlots.map((d) => {
                                    const isSelected = selectedDate === d.date;
                                    return (
                                        <TouchableOpacity
                                            key={d.date}
                                            style={[styles.dateTab, isSelected && styles.dateTabSelected]}
                                            onPress={() => {
                                                setSelectedDate(d.date);
                                                if (d.slots.length > 0) {
                                                    setSelectedTime(d.slots[0]);
                                                } else {
                                                    setSelectedTime(null);
                                                }
                                            }}
                                        >
                                            <Text style={[styles.dateTabText, isSelected && styles.dateTabTextSelected]}>
                                                {formatDate(d.date)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}
                </View>

                {/* Times */}
                <View style={styles.timesContainer}>
                    {!loading && selectedDate && availableSlots.find(d => d.date === selectedDate)?.slots.map((t) => {
                        const isSelected = selectedTime === t;
                        return (
                            <TouchableOpacity
                                key={t}
                                style={[styles.timeSlot, isSelected && styles.timeSlotSelected]}
                                onPress={() => setSelectedTime(t)}
                            >
                                <Text style={[styles.timeSlotText, isSelected && styles.timeSlotTextSelected]}>
                                    {t}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                    {!loading && availableSlots.length === 0 && (
                        <Text style={{ textAlign: 'center', color: '#6B7280', fontFamily: Fonts.LexendMedium }}>No slots available</Text>
                    )}
                </View>

                <View style={styles.footer}>
                    <Button
                        title="Select"
                        onPress={handleSelect}
                        disabled={!selectedDate || !selectedTime}
                        style={[styles.selectBtn, (!selectedDate || !selectedTime) && { opacity: 0.5 }]}
                        textStyle={styles.selectBtnText}
                    />
                </View>
            </View>
        </BaseModal>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingBottom: 24,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
    },
    title: {
        fontSize: 18,
        fontFamily: Fonts.LexendBold,
        color: '#111827',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: Fonts.LexendRegular,
        color: '#535862',
    },
    scrollWrapper: {
        marginHorizontal: 20,
        marginBottom: 8,
    },
    datesContainer: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        borderRadius: 100,
        padding: 4,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    dateTab: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 100,
    },
    dateTabSelected: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    dateTabText: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#6B7280',
    },
    dateTabTextSelected: {
        color: '#F05A5D',
        fontFamily: Fonts.LexendSemiBold,
    },
    timesContainer: {
        paddingHorizontal: 20,
        paddingTop: 24,
        gap: 12,
    },
    timeSlot: {
        paddingVertical: 14,
        alignItems: 'center',

        borderRadius: 24,
        backgroundColor: '#FFFFFF',
    },
    timeSlotSelected: {
        borderWidth: 1,
        borderColor: '#F05A5D',
        backgroundColor: '#FFF5F5',
    },
    timeSlotText: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#374151',
    },
    timeSlotTextSelected: {
        color: '#F05A5D',
        fontFamily: Fonts.LexendSemiBold,
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 32,
    },
    selectBtn: {
        backgroundColor: '#F05A5D',
        borderRadius: 16,
        height: 52,
    },
    selectBtnText: {
        fontFamily: Fonts.LexendSemiBold,
        fontSize: 16,
        color: '#FFFFFF',
    },
});
