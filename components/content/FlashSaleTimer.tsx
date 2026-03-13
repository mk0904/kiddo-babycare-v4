import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { FlashSaleBlock } from '@/types/content';
import { processFontStyle } from '@/utils/fontUtils';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { BaseContentBlock, BaseContentBlockProps } from './base/BaseContentBlock';

interface FlashSaleTimerProps extends Omit<BaseContentBlockProps, 'onPress'> {
    block: FlashSaleBlock;
    onPress?: (link?: string, item?: any) => void;
}

type SaleStatus = 'upcoming' | 'live' | 'ended';

export function FlashSaleTimer({ block, onPress }: FlashSaleTimerProps) {
    const { data, flashSaleConfig = {}, styles: blockStyles } = block;
    const { startTime, endTime, backgroundImage, link } = data;
    const layout = flashSaleConfig.layout || 'modern';

    const [status, setStatus] = useState<SaleStatus>('live');
    const [timeLeft, setTimeLeft] = useState({
        years: '00',
        days: '00',
        hours: '00',
        minutes: '00',
        seconds: '00'
    });

    useEffect(() => {
        const calculateState = () => {
            const now = new Date().getTime();
            const start = new Date(startTime).getTime();
            const end = new Date(endTime).getTime();

            // 1. Check if Ended
            if (now >= end) {
                return { status: 'ended', diff: 0 } as const;
            }

            // 2. Check if Upcoming (Waiting for start)
            if (now < start) {
                return { status: 'upcoming', diff: start - now } as const;
            }

            // 3. Otherwise Live (Counting down to end)
            return { status: 'live', diff: end - now } as const;
        };

        const updateTimer = () => {
            const { status: newStatus, diff } = calculateState();
            setStatus(newStatus);

            if (diff > 0) {
                setTimeLeft({
                    years: String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365))).padStart(2, '0'),
                    days: String(Math.floor((diff / (1000 * 60 * 60 * 24)) % 365)).padStart(2, '0'),
                    hours: String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0'),
                    minutes: String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, '0'),
                    seconds: String(Math.floor((diff / 1000) % 60)).padStart(2, '0'),
                });
            } else {
                setTimeLeft({ years: '00', days: '00', hours: '00', minutes: '00', seconds: '00' });
            }
        };

        // Initial call
        updateTimer();

        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, [startTime, endTime]);

    const handlePress = () => {
        if (link && onPress) {
            onPress(link);
        }
    };

    // Check visibility flags
    const showBeforeSaleStart = flashSaleConfig.showBeforeSaleStart ?? true; // Default to true
    const showBeforeSaleEnd = flashSaleConfig.showBeforeSaleEnd ?? true; // Default to true

    // Hide block based on status and flags
    if (status === 'ended') return null;
    if (status === 'upcoming' && !showBeforeSaleStart) return null;
    if (status === 'live' && !showBeforeSaleEnd) return null;

    const gradientColors = status === 'upcoming'
        ? ['#4facfe', '#00f2fe'] as const // Blue/Cyan for Upcoming
        : ['#FF512F', '#DD2476'] as const; // Red/Pink for Live (Urgency)

    // Dynamic Labels based on state
    const getStatusLabel = () => {
        if (status === 'upcoming') {
            return flashSaleConfig.startSubtitle || flashSaleConfig.subtitle;
        }
        return flashSaleConfig.subtitle;
    };

    const getMainLabel = () => {
        if (status === 'upcoming') {
            return flashSaleConfig.startTitle || flashSaleConfig.label;
        }
        return flashSaleConfig.label;
    };

    // Timer Component
    const SeparatedDigitTimer = ({ showLabel = false }: { showLabel?: boolean }) => {
        const showYears = parseInt(timeLeft.years) > 0;
        const showDays = showYears || parseInt(timeLeft.days) > 0;

        const units = [];
        if (showYears) units.push({ value: timeLeft.years, label: 'YRS' });
        if (showDays) units.push({ value: timeLeft.days, label: 'DAYS' });
        units.push({ value: timeLeft.hours, label: 'HRS' });
        units.push({ value: timeLeft.minutes, label: 'MIN' });
        if (flashSaleConfig.showSeconds !== false) {
            units.push({ value: timeLeft.seconds, label: 'SEC' });
        }

        return (
            <View style={styles.timerContainer}>
                {units.map((unit, index) => (
                    <React.Fragment key={index}>
                        <DigitGroup value={unit.value} label={unit.label} showLabel={showLabel} layout={layout} />
                        {index < units.length - 1 && (
                            <Text style={[styles.separator, layout === 'basic' && styles.basicSeparator]}>:</Text>
                        )}
                    </React.Fragment>
                ))}
            </View>
        );
    };

    // --- Layouts ---

    const renderBasic = () => (
        <View style={styles.basicContent}>
            <View style={styles.basicHeader}>
                <IconSymbol name={status === 'upcoming' ? "clock.fill" : "bolt.fill"} size={16} color="#FFD700" />
                <Text style={styles.basicTitle}>{getMainLabel()}</Text>
            </View>
            <SeparatedDigitTimer showLabel={false} />
        </View>
    );

    const renderModern = () => (
        <View style={styles.modernContent}>
            <View style={styles.leftSection}>
                <View style={styles.headerRow}>
                    <IconSymbol name={status === 'upcoming' ? "clock.fill" : "bolt.fill"} size={20} color="#FFD700" />
                    <Text style={[styles.title, processFontStyle(blockStyles?.title, Fonts.Black)]}>
                        {getMainLabel()}
                    </Text>
                </View>
                <Text style={styles.subtitle}>{getStatusLabel()}</Text>
            </View>

            <View style={styles.rightSection}>
                <SeparatedDigitTimer showLabel={false} />
                {link && (
                    <View style={styles.seeAllBtn}>
                        <Text style={styles.seeAllText}>
                            {status === 'upcoming' ? 'Notify Me' : 'Shop Now'}
                        </Text>
                        <IconSymbol name="chevron.right" size={12} color="#FFF" />
                    </View>
                )}
            </View>
        </View>
    );

    const renderCinematic = () => (
        <View style={styles.cinematicContent}>
            <View style={styles.cinematicHeader}>
                <Text style={styles.cinematicTitle}>{getMainLabel()}</Text>
                <Text style={styles.cinematicSubtitle}>{getStatusLabel()}</Text>
            </View>

            <View style={styles.cinematicFooter}>
                {getStatusLabel() ? (
                    <Text style={styles.cinematicEndingText}>{getStatusLabel()}</Text>
                ) : null}
                <SeparatedDigitTimer showLabel={true} />
                {link && (
                    <View style={styles.cinematicButton}>
                        <Text style={styles.cinematicButtonText}>
                            {status === 'upcoming' ? 'Notify Me' : 'Shop Now'}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );

    const getContainerStyle = () => {
        const {
            margin, marginHorizontal, marginVertical, marginTop, marginBottom, marginLeft, marginRight,
            ...innerStyles
        } = blockStyles?.container || {};

        const baseStyle: ViewStyle[] = [styles.container, innerStyles];

        if (flashSaleConfig.height) {
            baseStyle.push({ height: flashSaleConfig.height, minHeight: undefined });
        }
        if (flashSaleConfig.aspectRatio) {
            baseStyle.push({ aspectRatio: flashSaleConfig.aspectRatio });
        }

        if (layout === 'cinematic') {
            if (!flashSaleConfig.height && !flashSaleConfig.aspectRatio) {
                baseStyle.push({ aspectRatio: 9 / 16 });
            }
            baseStyle.push({ paddingVertical: 0, paddingHorizontal: 0 });
        } else if (layout === 'basic') {
            if (!flashSaleConfig.height) {
                baseStyle.push({ minHeight: 60 });
            }
            baseStyle.push({ paddingVertical: 10 });
        }

        return baseStyle;
    };

    const renderContent = () => {
        switch (layout) {
            case 'basic': return renderBasic();
            case 'cinematic': return renderCinematic();
            default: return renderModern();
        }
    };

    const Wrapper = link ? TouchableOpacity : View;

    return (
        <BaseContentBlock block={block}>
            <Wrapper
                activeOpacity={link ? 0.9 : 1}
                onPress={handlePress}
                style={{ width: '100%' }}
            >
                {backgroundImage ? (
                    <ImageBackground
                        source={{ uri: backgroundImage }}
                        style={getContainerStyle()}
                        resizeMode="cover"
                        imageStyle={{ borderRadius: 16 }}
                    >
                        {/* Overlay: Blueish for upcoming, Dark for live */}
                        <LinearGradient
                            colors={status === 'upcoming'
                                ? ['rgba(0,30,60,0.6)', 'rgba(0,10,20,0.8)']
                                : ['transparent', 'rgba(0,0,0,0.8)']}
                            style={StyleSheet.absoluteFill}
                        />
                        {renderContent()}
                    </ImageBackground>
                ) : (
                    <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={getContainerStyle()}
                    >
                        {renderContent()}
                    </LinearGradient>
                )}
            </Wrapper>
        </BaseContentBlock>
    );
}

const DigitGroup = ({ value, label, showLabel, layout }: { value: string, label: string, showLabel: boolean, layout: string }) => {
    const d1 = value.length > 2 ? value[value.length - 2] : value[0];
    const d2 = value.length > 2 ? value[value.length - 1] : value[1];

    return (
        <View style={styles.boxWrapper}>
            <View style={styles.digitRow}>
                <SingleDigit digit={d1 || '0'} layout={layout} />
                <SingleDigit digit={d2 || '0'} layout={layout} />
            </View>
            {showLabel && <Text style={styles.timeLabel}>{label}</Text>}
        </View>
    );
};

const SingleDigit = ({ digit, layout }: { digit: string, layout: string }) => (
    <View style={[styles.digitBox, layout === 'cinematic' && styles.cinematicDigitBox, layout === 'basic' && styles.basicDigitBox]}>
        <Text style={[styles.digitText, layout === 'cinematic' && styles.cinematicDigitText, layout === 'basic' && styles.basicDigitText]}>
            {digit}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 100,
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    boxWrapper: {
        alignItems: 'center',
    },
    digitRow: {
        flexDirection: 'row',
        gap: 2,
    },
    separator: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 16,
        fontFamily: Fonts.Bold,
        marginBottom: 4,
        marginHorizontal: 1,
    },
    digitBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 4,
        paddingHorizontal: 1,
        width: 22,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    digitText: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: '#FFFFFF',
    },
    timeLabel: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 9,
        fontFamily: Fonts.SemiBold,
        marginTop: 4,
    },

    // --- Basic Layout Styles ---
    basicContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    basicHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    basicTitle: {
        fontSize: 16,
        fontFamily: Fonts.Black,
        color: '#FFF',
        textTransform: 'uppercase'
    },
    basicDigitBox: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        width: 14,
        height: 20,
        paddingHorizontal: 0,
    },
    basicDigitText: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
    },
    basicSeparator: {
        marginBottom: 0,
    },

    // --- Modern Layout Styles ---
    modernContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    leftSection: {
        justifyContent: 'center',
        flex: 1,
    },
    rightSection: {
        alignItems: 'flex-end',
        gap: 8,
        flexShrink: 0,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    title: {
        fontSize: 18,
        fontFamily: Fonts.Black,
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        fontFamily: Fonts.Medium,
        marginLeft: 2,
    },
    seeAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(0,0,0,0.2)',
        borderRadius: 12,
    },
    seeAllText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: Fonts.SemiBold,
    },

    // --- Cinematic Layout Styles ---
    cinematicContent: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 20,
        width: '100%',
    },
    cinematicHeader: {
        marginTop: 20,
    },
    cinematicTitle: {
        fontSize: 32,
        fontFamily: Fonts.Black,
        color: '#FFF',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    cinematicSubtitle: {
        fontSize: 16,
        color: '#FFF',
        fontFamily: Fonts.SemiBold,
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    cinematicFooter: {
        alignItems: 'center',
        marginBottom: 20
    },
    cinematicEndingText: {
        color: '#FFF',
        marginBottom: 10,
        fontFamily: Fonts.SemiBold,
        fontSize: 14
    },
    cinematicDigitBox: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 32,
        height: 44,
        borderRadius: 8,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    cinematicDigitText: {
        fontSize: 20,
    },
    cinematicButton: {
        marginTop: 20,
        backgroundColor: '#FFF',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cinematicButtonText: {
        color: '#000',
        fontSize: 16,
        fontFamily: Fonts.Bold,
        textTransform: 'uppercase'
    },
});
