import { Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface CancelOrderTimerProps {
    createdAt: string;
    onPress: () => void;
    onExpire: () => void;
    durationSeconds?: number;
}

export const CancelOrderTimer: React.FC<CancelOrderTimerProps> = ({
    createdAt,
    onPress,
    onExpire,
    durationSeconds = 60,
}) => {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    useEffect(() => {
        const orderTime = new Date(createdAt).getTime();

        const tick = () => {
            const now = Date.now();
            const elapsed = Math.floor((now - orderTime) / 1000);
            const remaining = Math.max(0, durationSeconds - elapsed);

            if (remaining <= 0) {
                setTimeLeft(0);
                onExpire();
            } else {
                setTimeLeft(remaining);
            }
        };

        // Initial tick
        tick();

        const intervalId = setInterval(tick, 1000);
        return () => clearInterval(intervalId);
    }, [createdAt, durationSeconds, onExpire]);

    if (timeLeft === null || timeLeft <= 0) {
        return null;
    }

    const progress = timeLeft / durationSeconds;
    const radius = 20;
    const strokeWidth = 4;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - progress * circumference;

    return (
        <TouchableOpacity style={styles.container} activeOpacity={0.8} onPress={onPress}>
            <View style={styles.timerWrap}>
                <Svg width={48} height={48} viewBox="0 0 48 48">
                    {/* Background track */}
                    <Circle
                        cx="24"
                        cy="24"
                        r={radius}
                        stroke="#E5E7EB"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                    {/* Progress */}
                    <Circle
                        cx="24"
                        cy="24"
                        r={radius}
                        stroke="#F15E5E"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        transform="rotate(-90 24 24)"
                    />
                </Svg>
                <View style={styles.timeTextWrap}>
                    <Text style={styles.timeText}>{timeLeft}s</Text>
                </View>
            </View>

            <View style={styles.textWrap}>
                <Text style={styles.title}>Changed your mind?</Text>
                <Text style={styles.subtitle}>Chat with us for further assistance</Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 8,
        marginBottom: 12,

    },
    timerWrap: {
        position: 'relative',
        width: 48,
        height: 48,
        marginRight: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeTextWrap: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        color: '#00000080',
    },
    textWrap: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        color: '#717680',
    },
});
