import { Fonts } from '@/constants/theme';
import { ReferralStep } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 40;

interface HowItWorksModalProps {
    visible: boolean;
    onClose: () => void;
    themeColor: string;
    modalTitle: string;
    steps: ReferralStep[];
    onStepCtaPress?: (stepId: number) => void;
    autoAdvanceMs?: number;
}

export function HowItWorksModal({
    visible,
    onClose,
    themeColor,
    modalTitle,
    steps,
    onStepCtaPress,
    autoAdvanceMs = 3000,
}: HowItWorksModalProps) {
    const [activeStep, setActiveStep] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        if (visible && steps.length > 0 && autoAdvanceMs > 0) {
            timeout = setTimeout(() => {
                if (activeStep + 1 >= steps.length) {
                    handleClose();
                } else {
                    const nextStep = activeStep + 1;
                    setActiveStep(nextStep);
                    scrollViewRef.current?.scrollTo({
                        x: nextStep * SLIDE_WIDTH,
                        animated: true,
                    });
                }
            }, autoAdvanceMs);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [visible, steps.length, autoAdvanceMs, activeStep]);

    const handleClose = () => {
        setActiveStep(0);
        scrollViewRef.current?.scrollTo({ x: 0, animated: false });
        onClose();
    };

    if (!steps.length) return null;

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={handleClose}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={handleClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.modalContainer, { backgroundColor: themeColor }]}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.howItWorksTitle}>{modalTitle}</Text>
                        <TouchableOpacity
                            onPress={handleClose}
                            style={styles.modalCloseButton}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="close" size={28} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.indicatorContainer}>
                        {steps.map((step, index) => (
                            <View
                                key={step.id}
                                style={[
                                    styles.indicatorBar,
                                    {
                                        backgroundColor:
                                            activeStep === index
                                                ? step.color ?? 'rgba(255, 255, 255, 1)'
                                                : 'rgba(255, 255, 255, 0.4)',
                                    },
                                ]}
                            />
                        ))}
                    </View>

                    <ScrollView
                        ref={scrollViewRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={(event) => {
                            const slideWidth = event.nativeEvent.layoutMeasurement.width;
                            const offset = event.nativeEvent.contentOffset.x;
                            const index = Math.round(offset / slideWidth);
                            if (index !== activeStep) {
                                setActiveStep(index);
                            }
                        }}
                        scrollEventThrottle={16}
                        style={styles.modalScrollView}
                        contentContainerStyle={styles.modalScrollContent}
                    >
                        {steps.map((step) => (
                            <View key={step.id} style={styles.slideContainer}>
                                <View style={styles.imageContainer}>
                                    <Image source={{ uri: step.image }} style={styles.slideImage} />
                                    {step.cta && (
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                if (onStepCtaPress) {
                                                    onStepCtaPress(step.id);
                                                } else {
                                                    handleClose();
                                                }
                                            }}
                                            style={styles.ctaButton}
                                        >
                                            <Image source={{ uri: step.cta }} style={styles.ctaImage} />
                                        </TouchableOpacity>
                                    )}
                                    {step.isCta && (
                                        <TouchableOpacity
                                            activeOpacity={0.85}
                                            onPress={() => {
                                                if (onStepCtaPress) {
                                                    onStepCtaPress(step.id);
                                                } else {
                                                    handleClose();
                                                }
                                            }}
                                            style={[
                                                styles.stepCtaButton,
                                                step.color ? { backgroundColor: step.color } : null,
                                            ]}
                                        >
                                            <Text style={styles.stepCtaButtonText}>{step.title}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <Text style={styles.stepText}>{step.stepText}</Text>
                                {!step.isCta &&
                                    (step.isGradient ? (
                                        <LinearGradient
                                            colors={['#7A5AF8', '#53B1FD']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.gradientTitleWrap}
                                        >
                                            <Text style={styles.slideTitleGradient}>{step.title}</Text>
                                        </LinearGradient>
                                    ) : (
                                        <Text style={styles.slideTitle}>{step.title}</Text>
                                    ))}
                                <Text style={styles.slideSubtitle}>{step.subtitle}</Text>
                            </View>
                        ))}
                    </ScrollView>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: SLIDE_WIDTH,
        height: Dimensions.get('window').height * 0.83,
        borderRadius: 24,
        overflow: 'hidden',
        paddingBottom: 24,
        paddingTop: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 8,
    },
    howItWorksTitle: {
        color: '#FFFFFF',
        fontSize: 30,
        fontFamily: 'Fredoka_600SemiBold',
    },
    modalCloseButton: {
        padding: 4,
    },
    indicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginTop: 10,
        marginBottom: 16,
    },
    indicatorBar: {
        flex: 1,
        height: 8,
        borderRadius: 3,
        marginHorizontal: 4,
    },
    modalScrollView: {
        flex: 1,
    },
    modalScrollContent: {
        alignItems: 'center',
    },
    slideContainer: {
        width: SLIDE_WIDTH,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    imageContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    slideImage: {
        width: SLIDE_WIDTH * 0.58,
        height: SLIDE_WIDTH * 1.05,
        resizeMode: 'contain',
    },
    ctaButton: {
        position: 'absolute',
        bottom: -30,
        alignSelf: 'center',
    },
    ctaImage: {
        width: SLIDE_WIDTH * 0.62,
        height: SLIDE_WIDTH * 0.3,
        resizeMode: 'contain',
    },
    stepText: {
        color: '#FFFFFFCC',
        fontSize: 16,
        fontFamily: Fonts.LexendMedium,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 12,
    },
    slideTitle: {
        color: '#FFFFFF',
        fontSize: 40,
        fontFamily: 'Fredoka_600SemiBold',
        textAlign: 'center',
        marginBottom: 12,
    },
    gradientTitleWrap: {
        borderRadius: 12,
        paddingHorizontal: 20,
        paddingVertical: 6,
        marginBottom: 12,
    },
    slideTitleGradient: {
        color: '#FFFFFF',
        fontSize: 40,
        fontFamily: 'Fredoka_600SemiBold',
        textAlign: 'center',
    },
    stepCtaButton: {
        position: 'absolute',
        bottom: -24,
        alignSelf: 'center',
        backgroundColor: '#7A5AF8',
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: 24,
    },
    stepCtaButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: Fonts.LexendSemiBold,
    },
    slideSubtitle: {
        color: '#FFFFFFCC',
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
});
