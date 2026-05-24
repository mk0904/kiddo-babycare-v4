import { FaqSection } from '@/components/referral/FaqSection';
import { WalletHowItWorksModal } from '@/components/wallet/WalletHowItWorksModal';
import { defaultWalletConfig, getMergedWalletConfig, WALLET_THEME_COLOR } from '@/config/walletDefaults';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
    referralService,
    ReferralStatusResponse,
    ReferralTransaction,
} from '@/services/referralService';
import { WalletCarouselItem } from '@/types/appConfig';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
/** Same page background as cart (`app/cart/index.tsx`). */
const WALLET_SECTION_BG = '#F4F3FF';
const WHITE_SECTION_PADDING = 20;
const CAROUSEL_SIDE_INSET = 20;
const CAROUSEL_PEEK_WIDTH = 52;
const CAROUSEL_CARD_GAP = 0;
/** Active card uses full width minus inset and peek of the next slide. */
const CAROUSEL_ITEM_WIDTH = width - CAROUSEL_SIDE_INSET - CAROUSEL_PEEK_WIDTH;
const CAROUSEL_SNAP_INTERVAL = CAROUSEL_ITEM_WIDTH + CAROUSEL_CARD_GAP;
const CAROUSEL_CARD_HEIGHT = CAROUSEL_ITEM_WIDTH * 0.38;
const CAROUSEL_AUTO_SCROLL_MS = 3500;
const HEADER_MIN_HEIGHT = 300;

type HistoryTab = 'earned' | 'spent';

function formatCurrency(amount: number) {
    return `₹${Math.round(amount)}`;
}

function formatTransactionDate(iso: string) {
    try {
        return new Date(iso).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    } catch {
        return '';
    }
}

function isEarnedTransaction(tx: ReferralTransaction) {
    const type = tx.type?.toLowerCase() ?? '';
    if (type === 'debit' || type === 'spend' || type === 'spent') return false;
    if (type === 'credit' || type === 'earn' || type === 'earned') return true;
    return tx.amount >= 0;
}

export default function WalletScreen() {
    const router = useRouter();
    const { user: authUser, isAuthenticated } = useAuth();
    const [walletStatus, setWalletStatus] = useState<ReferralStatusResponse | null>(null);
    const [howItWorksVisible, setHowItWorksVisible] = useState(false);
    const [historyTab, setHistoryTab] = useState<HistoryTab>('earned');
    const [activeCarousel, setActiveCarousel] = useState(0);
    const carouselRef = useRef<FlatList<WalletCarouselItem>>(null);

    const config = getMergedWalletConfig();
    const screen = { ...defaultWalletConfig.walletScreen, ...config.walletScreen };
    const themeColor = config.howItWorks?.themeColor ?? WALLET_THEME_COLOR;
    const steps = config.howItWorks?.steps ?? [];
    const faqs = config.faqs ?? [];
    const carousel = config.carousel ?? [];
    const bgImage = screen.bgImage;
    const moneyPot = screen.moneyPot;

    const fetchWalletStatus = useCallback(() => {
        if (!isAuthenticated || !authUser?.phone) return;
        referralService
            .getReferralStatus(authUser.phone)
            .then(setWalletStatus)
            .catch((err) => console.error('[Wallet] Failed to load wallet status:', err));
    }, [isAuthenticated, authUser?.phone]);

    useFocusEffect(
        useCallback(() => {
            fetchWalletStatus();
        }, [fetchWalletStatus]),
    );

    useFocusEffect(
        useCallback(() => {
            if (carousel.length <= 1) return;

            const interval = setInterval(() => {
                setActiveCarousel((prev) => {
                    const next = (prev + 1) % carousel.length;
                    carouselRef.current?.scrollToOffset({
                        offset: next * CAROUSEL_SNAP_INTERVAL,
                        animated: true,
                    });
                    return next;
                });
            }, CAROUSEL_AUTO_SCROLL_MS);

            return () => clearInterval(interval);
        }, [carousel.length]),
    );

    const balance = walletStatus?.wallet?.total_amount ?? 0;
    const totalEarned = walletStatus?.wallet?.earn_amount ?? 0;
    const transactions = walletStatus?.transactions ?? [];
    const filteredTransactions = transactions.filter((tx) =>
        historyTab === 'earned' ? isEarnedTransaction(tx) : !isEarnedTransaction(tx),
    );

    const onAddBalance = () => {
        router.push({
            pathname: '/wallet/add-balance',
            params: { balance: String(Math.round(balance)) },
        } as any);
    };

    const handleHowItWorksCta = (stepId: number) => {
        setHowItWorksVisible(false);
        const step = steps.find((s) => s.id === stepId);
        if (step?.cta) {
            onAddBalance();
        }
    };

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <View style={styles.customHeader}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: Colors.text }]}>{screen.title}</Text>
                </View>
                <View style={styles.loginRequiredWrapper}>
                    <Text style={styles.loginTitle}>Login to access Kiddo Cash</Text>
                    <Text style={styles.loginSubtitle}>
                        View your balance, cashback, and wallet history after you login.
                    </Text>
                    <TouchableOpacity
                        style={styles.loginCTA}
                        onPress={() => router.push('/(auth)/login' as any)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="log-in" size={20} color={Colors.backgroundWhite} style={{ marginRight: 8 }} />
                        <Text style={styles.loginCTAText}>Login</Text>
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
                <View style={[styles.headerSection, { backgroundColor: themeColor }]}>
                    <SafeAreaView edges={['top']} style={styles.headerSafe}>
                        <View style={[styles.header, { backgroundColor: themeColor }]}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                            <View>
                                <Text style={styles.headerTitle}>{screen.title}</Text>
                                <TouchableOpacity onPress={() => setHowItWorksVisible(true)}>
                                    <Text style={styles.howItWorksLink}>How does it work?</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.headerBgArea}>
                            {bgImage ? (
                                <Image
                                    source={{ uri: bgImage }}
                                    style={styles.headerBgImage}
                                    contentFit="cover"
                                />
                            ) : (
                                <View style={[styles.headerBgImage, { backgroundColor: themeColor }]} />
                            )}
                            <View style={styles.balanceHero}>
                                <View >
                                    <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
                                    <Text style={styles.balanceLabel}>{screen.balanceLabel}</Text>
                                </View>
                            </View>
                        </View>
                    </SafeAreaView>

                </View>

                <View style={styles.whiteSection}>
                    <View style={styles.earnedCard}>
                        <View style={styles.earnedLeft}>
                            {moneyPot ? (
                                <Image
                                    source={{ uri: moneyPot }}
                                    style={styles.moneyPot}
                                    contentFit="contain"
                                />
                            ) : null}
                            <Text style={[styles.earnedLabel, { color: themeColor }]}>
                                {screen.earnedLabel}
                            </Text>
                        </View>
                        <View style={styles.earnedRight}>
                            <Text style={[styles.earnedAmount, { color: themeColor }]}>
                                {formatCurrency(totalEarned)}
                            </Text>

                        </View>
                    </View>

                    {carousel.length > 0 && (
                        <View style={styles.carouselSection}>
                            <FlatList
                                ref={carouselRef}
                                data={carousel}
                                keyExtractor={(_, index) => `carousel-${index}`}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                snapToInterval={CAROUSEL_SNAP_INTERVAL}
                                snapToAlignment="start"
                                decelerationRate="fast"
                                disableIntervalMomentum
                                contentContainerStyle={styles.carouselList}
                                getItemLayout={(_, index) => ({
                                    length: CAROUSEL_SNAP_INTERVAL,
                                    offset: CAROUSEL_SNAP_INTERVAL * index,
                                    index,
                                })}
                                onMomentumScrollEnd={(e) => {
                                    const index = Math.round(
                                        e.nativeEvent.contentOffset.x / CAROUSEL_SNAP_INTERVAL,
                                    );
                                    setActiveCarousel(Math.min(index, carousel.length - 1));
                                }}
                                onScroll={(e) => {
                                    const index = Math.round(
                                        e.nativeEvent.contentOffset.x / CAROUSEL_SNAP_INTERVAL,
                                    );
                                    if (index !== activeCarousel && index >= 0 && index < carousel.length) {
                                        setActiveCarousel(index);
                                    }
                                }}
                                scrollEventThrottle={16}
                                renderItem={({ item }) => (
                                    <View style={styles.carouselItem}>
                                        <Image
                                            source={{ uri: item.imageUrl }}
                                            style={styles.carouselImage}
                                            contentFit="contain"
                                        />
                                    </View>
                                )}
                            />
                            {carousel.length > 1 && (
                                <View style={styles.carouselDots}>
                                    {carousel.map((_, index) => (
                                        <View
                                            key={index}
                                            style={[
                                                styles.carouselDot,
                                                activeCarousel === index && styles.carouselDotActive,
                                            ]}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.historySection}>
                        <Text style={styles.historyTitle}>Kiddo Cash history</Text>
                        <View style={styles.historyTabs}>
                            <TouchableOpacity
                                style={[
                                    styles.historyTab,
                                    historyTab === 'earned' && styles.historyTabActive,
                                ]}
                                onPress={() => setHistoryTab('earned')}
                            >
                                <Text
                                    style={[
                                        styles.historyTabText,
                                        historyTab === 'earned' && styles.historyTabTextActive,
                                    ]}
                                >
                                    Earned
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.historyTab,
                                    historyTab === 'spent' && styles.historyTabActive,
                                ]}
                                onPress={() => setHistoryTab('spent')}
                            >
                                <Text
                                    style={[
                                        styles.historyTabText,
                                        historyTab === 'spent' && styles.historyTabTextActive,
                                    ]}
                                >
                                    Spent
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {filteredTransactions.length === 0 ? (
                            <View style={styles.emptyHistory}>
                                <Text style={styles.emptyHistoryText}>No activity here!</Text>
                            </View>
                        ) : (
                            filteredTransactions.map((tx) => (
                                <View key={tx.id} style={styles.transactionRow}>
                                    <View style={styles.transactionInfo}>
                                        <Text style={styles.transactionDesc} numberOfLines={2}>
                                            {tx.description || 'Wallet transaction'}
                                        </Text>
                                        <Text style={styles.transactionDate}>
                                            {formatTransactionDate(tx.created_at)}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[
                                            styles.transactionAmount,
                                            isEarnedTransaction(tx)
                                                ? styles.transactionAmountEarned
                                                : styles.transactionAmountSpent,
                                        ]}
                                    >
                                        {isEarnedTransaction(tx) ? '+' : '-'}
                                        {formatCurrency(Math.abs(tx.amount))}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>

                    <FaqSection faqs={faqs} />
                </View>
            </ScrollView>

            <SafeAreaView edges={['bottom']} style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.ctaButton,
                        {
                            backgroundColor: themeColor,
                            shadowColor: themeColor,
                        },
                    ]}
                    onPress={onAddBalance}
                    activeOpacity={0.9}
                >
                    <Text style={styles.ctaButtonText}>{screen.ctaText}</Text>
                </TouchableOpacity>
            </SafeAreaView>

            <WalletHowItWorksModal
                visible={howItWorksVisible}
                onClose={() => setHowItWorksVisible(false)}
                themeColor={themeColor}
                modalTitle={config.howItWorks?.title ?? 'How it works'}
                steps={steps}
                onStepCtaPress={handleHowItWorksCta}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: WALLET_SECTION_BG,
    },
    scrollView: {
        flex: 1,
        backgroundColor: WALLET_SECTION_BG,
    },
    scrollContent: {
        paddingBottom: 140,
    },
    headerSection: {
        overflow: 'hidden',
        zIndex: 1,
        borderBottomEndRadius: 20,
        borderBottomStartRadius: 20,
    },
    headerSafe: {
        flex: 1,
    },
    headerBgArea: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 200,
    },
    headerBgImage: {
        ...StyleSheet.absoluteFillObject,
    },
    curveContainer: {
        position: 'absolute',
        bottom: -70,
        left: 0,
        right: 0,
        height: 80,
        overflow: 'hidden',
    },

    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 16,
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
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#FFFFFF',
        marginTop: 2,
        borderBottomWidth: 1,
        borderBottomColor: '#FFFFFF',
        alignSelf: 'flex-start',
        paddingBottom: 0.5,
    },
    balanceHero: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },

    balanceAmount: {
        fontSize: 28,
        fontFamily: Fonts.LexendSemiBold,
        color: '#FFFFFF',
        textAlign: 'center',
    },
    balanceLabel: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 4,
    },
    whiteSection: {
        backgroundColor: WALLET_SECTION_BG,
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    earnedCard: {
        backgroundColor: '#7A5AF833',
        borderRadius: 24,
        paddingVertical: 8,
        paddingHorizontal: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    earnedLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    earnedIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    earnedLabel: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
    },
    earnedRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    earnedAmount: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        marginRight: 4,
    },
    moneyPot: {
        width: 28,
        height: 28,
    },
    carouselSection: {
        marginHorizontal: -WHITE_SECTION_PADDING,
        marginBottom: 24,
        overflow: 'visible',
    },
    carouselList: {
        paddingLeft: CAROUSEL_SIDE_INSET,
        paddingRight: CAROUSEL_SIDE_INSET + CAROUSEL_PEEK_WIDTH,
    },
    carouselItem: {
        width: CAROUSEL_ITEM_WIDTH,
        height: CAROUSEL_CARD_HEIGHT,
        marginRight: CAROUSEL_CARD_GAP,
    },
    carouselImage: {
        width: '100%',
        height: '100%',
        borderRadius: 16,
    },
    carouselDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
    },
    carouselDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E5E7EB',
    },
    carouselDotActive: {
        backgroundColor: '#6B7280',
        width: 8,
    },
    historySection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 28,
    },
    historyTitle: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
        color: '#717680',
        marginBottom: 12,
    },
    historyTabs: {
        width: '50%',
        alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 24,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E9EAEB',
    },
    historyTab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 24,
    },
    historyTabActive: {
        backgroundColor: '#FFFFFF',
    },
    historyTabText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#717680',
    },
    historyTabTextActive: {
        fontFamily: Fonts.LexendSemiBold,
        color: '#F15E5E',
    },
    emptyHistory: {
        borderRadius: 12,
        paddingVertical: 28,
        alignItems: 'center',
    },
    emptyHistoryText: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#9CA3AF',
    },
    transactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    transactionInfo: {
        flex: 1,
        marginRight: 12,
    },
    transactionDesc: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#181D27',
    },
    transactionDate: {
        fontSize: Fonts.ExtraSmallFontSize,
        fontFamily: Fonts.LexendMedium,
        color: '#00000080',
        marginTop: 4,
    },
    transactionAmount: {
        fontSize: Fonts.SmallFontSize,
        fontFamily: Fonts.LexendSemiBold,
    },
    transactionAmountEarned: {
        color: '#059669',
    },
    transactionAmountSpent: {
        color: '#181D27',
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
    ctaButton: {
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    ctaButtonText: {
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
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: '#FFFFFF',
    },
    loginRequiredWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#FFFFFF',
    },
    loginTitle: {
        fontSize: 20,
        color: Colors.text,
        fontFamily: Fonts.Bold,
        textAlign: 'center',
        marginBottom: 8,
    },
    loginSubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
    },
    loginCTA: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
    },
    loginCTAText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: Fonts.Bold,
    },
});
