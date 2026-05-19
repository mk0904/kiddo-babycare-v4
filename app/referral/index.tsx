import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNector } from '@/context/NectorContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Clipboard,
    Dimensions,
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

    const referralCode = nectorUser?.referral_code || 'KIDDOX7Q';
    const referralReward = rules?.referral_config?.referrer_reward || 25;
    const friendReward = rules?.referral_config?.referee_reward || 25;
    const totalEarned = nectorUser?.lifetime || 0;

    const onShare = async () => {
        try {
            await Share.share({
                message: `Hey! Download Kiddo App and use my referral code ${referralCode} to get ₹${friendReward} off on your first order! \n\nDownload here: https://kiddo.app/download`,
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

    const faqs = [
        {
            question: "How does the referral program work?",
            answer: `Invite your friends to Kiddo Cash and earn ₹${referralReward} for every successful referral. Your friend also receives ₹${friendReward}.`
        },
        {
            question: "When will the referral reward be credited?",
            answer: "The referral reward will be credited to your account as soon as your friend completes their first purchase and the order is delivered."
        },
        {
            question: "Will cancelled orders qualify for referral rewards?",
            answer: "No, if the order is cancelled or returned, the referral reward will not be credited."
        },
        {
            question: "Is there a limit to the number of referrals I can make?",
            answer: "No, you can refer as many friends as you like and earn rewards for each one!"
        }
    ];

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
                <View style={styles.blueBackground}>
                    <SafeAreaView edges={['top']}>
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                            <View>
                                <Text style={styles.headerTitle}>Refer & Earn</Text>
                                <TouchableOpacity>
                                    <Text style={styles.howItWorksLink}>How does it work?</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.heroContent}>
                            <View style={styles.codeRow}>
                                <Text style={styles.codeText}>#{referralCode}</Text>
                                <TouchableOpacity onPress={copyToClipboard} style={styles.copyIcon}>
                                    <Ionicons
                                        name={copied ? "checkmark" : "copy-outline"}
                                        size={20}
                                        color="#FFFFFF"
                                    />
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.heroSubtitle} numberOfLines={2}>
                                Invite a friend using your unique referral link
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
                        <View style={styles.blueCurve} />
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
                    <Text style={styles.shareButtonText}>Share via WhatsApp</Text>
                </TouchableOpacity>
            </SafeAreaView>
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
});
