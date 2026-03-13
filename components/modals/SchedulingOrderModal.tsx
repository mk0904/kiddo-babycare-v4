import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const DURATION_MS = 2000;
const TICK_MS = 50;

export interface SchedulingOrderModalProps {
    visible: boolean;
    onComplete: () => void;
    /** Arriving time/date e.g. "11am-12pm | 29th Feb" */
    arrivingText: string;
    /** Delivering to address e.g. "Home: 301/9 Sagar Darshan Towers, Sec-..." */
    deliveringToText: string;
}

export function SchedulingOrderModal({
    visible,
    onComplete,
    arrivingText,
    deliveringToText,
}: SchedulingOrderModalProps) {
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!visible) {
            setProgress(0);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }
        setProgress(0);
        const increment = TICK_MS / DURATION_MS;
        intervalRef.current = setInterval(() => {
            setProgress((p) => {
                const next = p + increment;
                if (next >= 1) {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                    }
                    // Defer so we don't update parent (CartScreen) during this component's render
                    setTimeout(() => onComplete(), 0);
                    return 1;
                }
                return next;
            });
        }, TICK_MS);
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [visible, onComplete]);

    const handleWantItNow = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        onComplete();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleWantItNow}
        >
            <View style={styles.container}>
                <Pressable style={styles.backdrop} onPress={handleWantItNow} />
                <View style={styles.card}>
                    <Text style={styles.title}>Scheduling your order</Text>

                    <View style={styles.row}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                        </View>
                        <Text style={styles.label}>Arriving</Text>
                        <Text style={styles.value} numberOfLines={1}>{arrivingText}</Text>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.iconWrap}>
                            <Ionicons name="location-outline" size={20} color={Colors.primary} />
                        </View>
                        <Text style={styles.label}>Delivering to</Text>
                        <Text style={styles.value} numberOfLines={2}>{deliveringToText}</Text>
                    </View>

                    <View style={styles.progressWrap}>
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
                        </View>
                    </View>

                    <View style={styles.wantItNowWrap}>
                        <TouchableOpacity onPress={handleWantItNow} activeOpacity={0.7}>
                            <Text style={styles.wantItNow}>No, I want it now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        paddingBottom: 32,
        marginHorizontal: 20,
        marginBottom: 28,
    },
    title: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#111',
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: `${Colors.primary}18`,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    label: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#374151',
        marginRight: 8,
    },
    value: {
        flex: 1,
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#111',
    },
    progressWrap: {
        marginTop: 8,
        marginBottom: 20,
    },
    progressTrack: {
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 4,
    },
    wantItNowWrap: {
        alignItems: 'center',
    },
    wantItNow: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
        textDecorationLine: 'underline',
    },
});
