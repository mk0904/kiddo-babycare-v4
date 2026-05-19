import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNector } from '@/context/NectorContext';
import { appConfigService } from '@/services/appConfigService';
import { referralService, ReferralStatusResponse } from '@/services/referralService';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Clipboard,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const BRAND_BLUE = '#0CB6FF';

export default function ReferralScreen() {
    const router = useRouter();
    const { user: nectorUser, isLoading, rules } = useNector();
    const { user: authUser, isAuthenticated } = useAuth();
    const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
    const [copied, setCopied] = useState(false);
    const [howItWorksVisible, setHowItWorksVisible] = useState(false);
    const [activeStep, setActiveStep] = useState(0);

    const scrollViewRef = useRef<ScrollView>(null);

    const [referralStatus, setReferralStatus] = useState<ReferralStatusResponse | null>(null);
    const [fetchingStatus, setFetchingStatus] = useState(false);

    useEffect(() => {
        if (isAuthenticated && authUser?.phone) {
            setFetchingStatus(true);
            referralService.getReferralStatus(authUser.phone)
                .then(status => {
                    setReferralStatus(status);
                })
                .catch(err => {
                    console.error('Failed to load referral status:', err);
                })
                .finally(() => {
                    setFetchingStatus(false);
                });
        }
    }, [isAuthenticated, authUser?.phone]);

    const config = appConfigService.getReferralConfig();

    const referralReward = config?.referralScreen?.youGetAmt ?? rules?.referral_config?.referrer_reward ?? 25;
    const friendReward = config?.referralScreen?.theyGetAmt ?? rules?.referral_config?.referee_reward ?? 25;

    const howItWorks = config?.howItWorks;
    const steps = howItWorks?.steps || [];
    const themeColor = howItWorks?.themeColor || '#0CB6FF';
    const modalTitle = howItWorks?.title || 'How it works';

    // Auto-scroll logic for carousel modal
    useEffect(() => {
        let interval: any;
        if (howItWorksVisible) {
            interval = setInterval(() => {
                setActiveStep((prevStep) => {
                    const nextStep = (prevStep + 1) % steps.length;
                    scrollViewRef.current?.scrollTo({
                        x: nextStep * (width - 40),
                        animated: true,
                    });
                    return nextStep;
                });
            }, 3000); // Scroll automatically every 3 seconds
        }
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [howItWorksVisible, steps.length]);

    const handleCloseModal = () => {
        setHowItWorksVisible(false);
        setActiveStep(0);
        scrollViewRef.current?.scrollTo({ x: 0, animated: false });
    };

    const referralCode = referralStatus?.profile?.referral_code || 'KIDDO';
    const totalEarned = referralStatus?.wallet?.referral_amount ?? 0;

    const onShare = async () => {
        try {
            const appDownloadConfig = appConfigService.getAppDownloadConfig();
            const iosUrl = appDownloadConfig?.ios?.url || 'https://apps.apple.com/in/app/kiddo-baby-care-in-minutes/id6755881583';
            const androidUrl = appDownloadConfig?.android?.url || 'https://play.google.com/store/apps/details?id=com.barereactnativeapp072';

            await Share.share({
                message: `Hey! Download Kiddo App and use my referral code ${referralCode} to get ₹${friendReward} off on your first order! \n\nDownload here:\nAndroid: ${androidUrl}\niOS: ${iosUrl}`,
            });
        } catch (error: any) {
            Alert.alert(error.message);
        }
    };

    const copyToClipboard = () => {
        Clipboard.setString(referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        Alert.alert('Copied!', 'Referral code copied to clipboard.');
    };

    const faqs = config?.faqs || [];

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={[styles.header]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Refer & Earn</Text>
                </View>
                <View style={styles.emptyContainer}>
                    <Ionicons name="people-outline" size={80} color="#E5E7EB" />
                    <Text style={styles.emptyTitle}>Login to Refer Friends</Text>
                    <Text style={styles.emptySubtitle}>
                        Share your love for Kiddo and earn rewards for every friend you invite!
                    </Text>
                    <TouchableOpacity
                        style={[styles.shareButton, { width: '80%', marginTop: 24 }]}
                        onPress={() => router.push('/(auth)/login' as any)}
                    >
                        <Text style={styles.shareButtonText}>Login Now</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                {/* Blue Header Section */}
                <View style={[styles.blueBackground, { backgroundColor: themeColor }]}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                            <View>
                                <Text style={styles.headerTitle}>{config?.referralScreen?.title ?? 'Refer & Earn'}</Text>
                                <TouchableOpacity onPress={() => setHowItWorksVisible(true)}>
                                    <Text style={styles.howItWorksLink}>How does it work?</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.heroContent}>
                            <View style={styles.codeRow}>
                                <MaskedView
                                    maskElement={
                                        <Text style={styles.codeText}>
                                            #{referralCode}
                                        </Text>
                                    }
                                >
                                    <LinearGradient
                                        colors={[
                                            'rgba(255,255,255,0.45)',
                                            'rgba(255,255,255,1)',
                                            'rgba(255,255,255,0.4)',
                                        ]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={[styles.codeText, { opacity: 0 }]}>
                                            #{referralCode}
                                        </Text>
                                    </LinearGradient>
                                </MaskedView>
                                <TouchableOpacity onPress={copyToClipboard} style={styles.copyIcon}>
                                    <Ionicons
                                        name={copied ? "checkmark" : "copy-outline"}
                                        size={20}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.heroSubtitle} numberOfLines={2}>
                                {config?.referralScreen?.description ?? 'Invite a friend using your unique referral link'}
                            </Text>

                            <View style={styles.rewardContainer}>
                                <View style={styles.rewardItem}>
                                    <Text style={styles.rewardLabel}>You get</Text>
                                    <Text style={styles.rewardAmount}>₹{referralReward}</Text>
                                </View>
                                <View style={styles.verticalDivider} />
                                <View style={styles.rewardItem}>
                                    <Text style={styles.rewardLabel}>They get</Text>
                                    <Text style={styles.rewardAmount}>₹{friendReward}</Text>
                                </View>
                            </View>
                        </View>
                    </SafeAreaView>

                    {/* Convex Blue Arch */}
                    <View style={styles.curveContainer}>
                        <View style={[styles.blueCurve, { backgroundColor: themeColor }]} />
                    </View>
                </View>

                {/* White Content Section */}
                <View style={styles.whiteSection}>
                    {/* Total Earned Card */}
                    <View style={styles.totalEarnedCard}>
                        <Text style={styles.totalEarnedText}>Total earned</Text>
                        <Text style={styles.totalEarnedAmount}>₹{totalEarned}</Text>
                    </View>

                    {/* FAQs */}
                    <View style={styles.faqSection}>
                        <Text style={styles.faqTitle}>FAQs</Text>
                        {faqs.map((faq, index) => (
                            <View key={index} style={styles.faqItem}>
                                <TouchableOpacity
                                    style={styles.faqHeader}
                                    onPress={() => setExpandedFaq(expandedFaq === index ? null : index)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.faqQuestion}>{faq.question}</Text>
                                    <Ionicons
                                        name={expandedFaq === index ? "remove-circle-outline" : "add-circle-outline"}
                                        size={24}
                                        color={Colors.textSecondary}
                                    />
                                </TouchableOpacity>
                                {expandedFaq === index && (
                                    <Text style={styles.faqAnswer}>{faq.answer}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Sticky Footer */}
            <SafeAreaView edges={['bottom']} style={styles.footer}>
                <TouchableOpacity style={styles.shareButton} onPress={onShare} activeOpacity={0.9}>
                    <Text style={styles.shareButtonText}>{config?.referralScreen?.ctaText ?? 'Share via WhatsApp'}</Text>
                </TouchableOpacity>
            </SafeAreaView>

            {/* How It Works Carousel Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={howItWorksVisible}
                onRequestClose={handleCloseModal}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={handleCloseModal}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={[styles.modalContainer, { backgroundColor: themeColor }]}
                    >
                        {/* Header Row */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.howItWorksTitle}>{modalTitle}</Text>
                            <TouchableOpacity
                                onPress={handleCloseModal}
                                style={styles.modalCloseButton}
                                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Step Indicators */}
                        <View style={styles.indicatorContainer}>
                            {steps.map((step) => (
                                <View
                                    key={step.id}
                                    style={[
                                        styles.indicatorBar,
                                        {
                                            backgroundColor:
                                                activeStep === step.id
                                                    ? 'rgba(255, 255, 255, 1)'
                                                    : 'rgba(255, 255, 255, 0.4)',
                                        },
                                    ]}
                                />
                            ))}
                        </View>

                        {/* Carousel ScrollView */}
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
                                        <Image
                                            source={{ uri: step.image }}
                                            style={styles.slideImage}
                                        />
                                        {step.cta && (
                                            <TouchableOpacity
                                                activeOpacity={0.8}
                                                onPress={() => {
                                                    if (step.id === 0) {
                                                        onShare();
                                                    } else {
                                                        handleCloseModal();
                                                    }
                                                }}
                                                style={styles.ctaButton}
                                            >
                                                <Image
                                                    source={{ uri: step.cta }}
                                                    style={styles.ctaImage}
                                                />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <Text style={styles.stepText}>{step.stepText}</Text>
                                    <Text style={styles.slideTitle}>{step.title}</Text>
                                    <Text style={styles.slideSubtitle}>{step.subtitle}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 140, // Space for sticky footer
    },
    blueBackground: {
        backgroundColor: BRAND_BLUE,

        zIndex: 1,
    },
    curveContainer: {
        position: 'absolute',
        bottom: -70,
        left: 0,
        right: 0,
        height: 80,
        overflow: 'hidden',
    },
    blueCurve: {
        position: 'absolute',
        top: -width * 1.8,
        width: width * 2,
        height: width * 2,
        borderRadius: width,
        backgroundColor: BRAND_BLUE,
        left: -width / 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    backButton: {
        padding: 4,
        marginRight: 16,
        marginTop: 2,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: 'Fredoka_600SemiBold',
        color: '#FFFFFF',
    },
    howItWorksLink: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#FFFFFF',
        marginTop: 2,
        borderBottomWidth: 1,
        borderBottomColor: '#FFFFFF',
        alignSelf: 'flex-start',
        paddingBottom: 0.5,
    },
    heroContent: {
        alignItems: 'center',
        marginTop: 60,
        paddingHorizontal: 20,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    codeText: {
        fontSize: 40,
        fontFamily: Fonts.LexendSemiBold,
        color: '#FFFFFF',
        letterSpacing: 1,
    },
    copyIcon: {
        marginLeft: 12,
        padding: 4,
    },
    heroSubtitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#FFFFFF',
        textAlign: 'center',
        marginTop: 16,
        opacity: 0.9,
        paddingHorizontal: 40,
    },
    rewardContainer: {
        flexDirection: 'row',
        marginTop: 40,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rewardItem: {
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    rewardLabel: {
        fontSize: 14,
        fontFamily: Fonts.LexendMedium,
        color: '#FFFFFF',
        opacity: 0.8,
    },
    rewardAmount: {
        fontSize: 32,
        fontFamily: Fonts.LexendSemiBold,
        color: '#FFFFFF',
    },
    verticalDivider: {
        width: 2,
        height: 80,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    whiteSection: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 90,
    },
    totalEarnedCard: {
        backgroundColor: '#36BFFA1A',
        borderRadius: 24,
        paddingVertical: 16,
        paddingHorizontal: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 40,
    },
    totalEarnedText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: BRAND_BLUE,
    },
    totalEarnedAmount: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: BRAND_BLUE,
    },
    faqSection: {
        marginBottom: 20,
    },
    faqTitle: {
        fontSize: 24,
        fontFamily: 'Fredoka_600SemiBold',
        color: '#181D27',
        marginBottom: 20,
    },
    faqItem: {
        marginBottom: 10,
    },
    faqHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    faqQuestion: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#181D27',
        flex: 1,
        marginRight: 10,
    },
    faqAnswer: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.Regular,
        color: '#535862',
        lineHeight: 20,
        paddingBottom: 15,
        paddingRight: 50,
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginTop: 5,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 30,
        paddingBottom: 0,
        paddingTop: 20,
        borderTopWidth: 2,
        borderTopColor: '#F3F4F6',
    },
    shareButton: {
        backgroundColor: BRAND_BLUE,
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: BRAND_BLUE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    shareButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: Fonts.LexendSemiBold,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyTitle: {
        fontSize: 20,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        marginTop: 24,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 15,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 22,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: width - 40,
        height: Dimensions.get('window').height * 0.83,
        backgroundColor: '#0CB6FF',
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
        width: width - 40,
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
        width: (width - 40) * 0.58,
        height: (width - 40) * 1.05,
        resizeMode: 'contain',
    },
    ctaButton: {
        position: 'absolute',
        bottom: -30,
        alignSelf: 'center',
    },
    ctaImage: {
        width: (width - 40) * 0.62,
        height: (width - 40) * 0.3,
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
    slideSubtitle: {
        color: '#FFFFFFCC',
        fontSize: 12,
        fontFamily: Fonts.LexendMedium,
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
});
