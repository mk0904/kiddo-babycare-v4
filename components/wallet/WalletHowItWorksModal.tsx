import { Fonts } from '@/constants/theme';
import { ReferralStep } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
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

const { width, height } = Dimensions.get('window');
const SLIDE_WIDTH = width - 40;

interface WalletHowItWorksModalProps {
    visible: boolean;
    onClose: () => void;
    themeColor: string;
    modalTitle: string;
    steps: ReferralStep[];
    onStepCtaPress?: (stepId: number) => void;
    autoAdvanceMs?: number;
}

export function WalletHowItWorksModal({
    visible,
    onClose,
    themeColor,
    modalTitle,
    steps,
    onStepCtaPress,
    autoAdvanceMs = 3000,
}: WalletHowItWorksModalProps) {
    const [activeStep, setActiveStep] = useState(0);
    const scrollViewRef = useRef<ScrollView>(null);

    const slideBackground = steps[activeStep]?.color ?? themeColor;

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (visible && steps.length > 1 && autoAdvanceMs > 0) {
            interval = setInterval(() => {
                setActiveStep((prevStep) => {
                    const nextStep = (prevStep + 1) % steps.length;
                    scrollViewRef.current?.scrollTo({
                        x: nextStep * SLIDE_WIDTH,
                        animated: true,
                    });
                    return nextStep;
                });
            }, autoAdvanceMs);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [visible, steps.length, autoAdvanceMs]);

    const handleClose = () => {
        setActiveStep(0);
        scrollViewRef.current?.scrollTo({ x: 0, animated: false });
        onClose();
    };

    const handleDonePress = (step: ReferralStep) => {
        if (onStepCtaPress) {
            onStepCtaPress(step.id);
        } else {
            handleClose();
        }
    };

    if (!steps.length) return null;

    const activeSlide = steps[activeStep];
    const showDoneButton = Boolean(activeSlide?.isCta);

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
                    style={[styles.modalContainer, { backgroundColor: slideBackground }]}
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
                                                ? 'rgba(255, 255, 255, 1)'
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
                                <Text style={styles.slideTitle}>{step.title}</Text>
                                <Text style={styles.slideSubtitle}>{step.subtitle}</Text>

                                <View
                                    style={[
                                        styles.imageContainer,
                                        !step.cta && styles.imageContainerEdgeToEdge,
                                    ]}
                                >
                                    <Image
                                        source={{ uri: step.image }}
                                        style={[
                                            styles.slideImage,
                                            !step.cta && styles.slideImageEdgeToEdge,
                                        ]}
                                    />
                                    {step.cta ? (
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
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {showDoneButton ? (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => handleDonePress(activeSlide)}
                            style={styles.doneButton}
                        >
                            <Text style={[styles.doneButtonText, { color: themeColor }]}>
                                {'Done!'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
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
        height: height * 0.83,
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
        fontSize: 22,
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
        marginBottom: 8,
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
        flex: 1,
    },
    slideTitle: {
        color: '#FFFFFF',
        fontSize: 48,
        fontFamily: 'Fredoka_600SemiBold',
        textAlign: 'center',
        marginBottom: 8,
        marginTop: 12,
        paddingHorizontal: 20,
    },
    slideSubtitle: {
        color: '#FFFFFFCC',
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        textAlign: 'center',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    imageContainer: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    imageContainerEdgeToEdge: {
        width: '100%',
        alignSelf: 'stretch',
        alignItems: 'stretch',
    },
    slideImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    slideImageEdgeToEdge: {
        width: SLIDE_WIDTH ,
        flex: 1,
        resizeMode: 'contain',
    },
    ctaButton: {
        position: 'absolute',
        alignSelf: 'center',
    },
    ctaImage: {
        width: SLIDE_WIDTH * 0.62,
        height: SLIDE_WIDTH * 0.3,
        resizeMode: 'contain',
    },
    doneButton: {
        marginHorizontal: 20,
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
    },
    doneButtonText: {
        fontSize: 18,
        fontFamily: Fonts.LexendSemiBold,
    },
});
