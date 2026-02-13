import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { useNector } from '@/context/NectorContext';
import { useAuth } from '@/context/AuthContext';
import { ScreenHeader } from '@/components/ui/ScreenHeader';

export default function RewardsScreen() {
    const router = useRouter();
    const { user: authUser, isAuthenticated } = useAuth();
    const nector = useNector();
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (isAuthenticated && authUser) {
            nector.refreshRewards();
            nector.refreshTransactions();
            nector.refreshProgram();
        }
    }, [isAuthenticated, authUser]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            nector.refreshRewards(),
            nector.refreshTransactions(),
            nector.refreshProgram(),
        ]);
        setRefreshing(false);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container}>
                <ScreenHeader title="Rewards" showBack={true} showSearch={false} />
                <View style={styles.notAuthContainer}>
                    <Ionicons name="gift-outline" size={64} color={Colors.textSecondary} />
                    <Text style={styles.notAuthTitle}>Login to View Rewards</Text>
                    <Text style={styles.notAuthSubtitle}>
                        Earn coins on every purchase and redeem them for discounts!
                    </Text>
                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={() => router.push('/(auth)/login' as any)}
                    >
                        <Text style={styles.loginButtonText}>Login</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (nector.isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <ScreenHeader title="Rewards" showBack={true} showSearch={false} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const availableCoins = nector.availableCoins || 0;
    const lifetimeCoins = nector.lifetimeCoins || 0;
    const redeemedCoins = nector.user?.redeemed || 0;
    const tier = (nector.user?.tier as any)?.name || 'Member';
    const waysToEarn = nector.waysToEarn || [];
    const transactions = nector.transactions || [];

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScreenHeader title="Rewards" showBack={true} showSearch={false} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Balance Card */}
                <View style={styles.balanceCard}>
                    <View style={styles.balanceHeader}>
                        <Ionicons name="star" size={24} color="#FFD700" />
                        <Text style={styles.tierText}>{tier}</Text>
                    </View>
                    <Text style={styles.balanceAmount}>{availableCoins}</Text>
                    <Text style={styles.balanceLabel}>Available Coins</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{lifetimeCoins}</Text>
                            <Text style={styles.statLabel}>Lifetime Earned</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{redeemedCoins}</Text>
                            <Text style={styles.statLabel}>Redeemed</Text>
                        </View>
                    </View>
                </View>

                {/* Ways to Earn */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ways to Earn</Text>
                    {waysToEarn.length > 0 ? (
                        waysToEarn.map((way: any, index: number) => (
                            <View key={index} style={styles.earnCard}>
                                <View style={styles.earnIcon}>
                                    <Ionicons
                                        name={getEarnIcon(way.action)}
                                        size={20}
                                        color={Colors.primary}
                                    />
                                </View>
                                <View style={styles.earnInfo}>
                                    <Text style={styles.earnTitle}>{way.name || way.action}</Text>
                                    {way.description && (
                                        <Text style={styles.earnDescription}>{way.description}</Text>
                                    )}
                                </View>
                                <View style={styles.earnReward}>
                                    <Text style={styles.earnAmount}>+{way.coins || way.amount}</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No earning opportunities available</Text>
                    )}
                </View>

                {/* Transaction History */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Transaction History</Text>
                    {transactions.length > 0 ? (
                        transactions.slice(0, 10).map((tx: any, index: number) => (
                            <View key={index} style={styles.transactionCard}>
                                <View style={styles.transactionLeft}>
                                    <Ionicons
                                        name={tx.coins > 0 ? 'add-circle' : 'remove-circle'}
                                        size={24}
                                        color={tx.coins > 0 ? Colors.success : '#ff4444'}
                                    />
                                    <View style={styles.transactionInfo}>
                                        <Text style={styles.transactionTitle}>
                                            {tx.description || tx.action || 'Transaction'}
                                        </Text>
                                        <Text style={styles.transactionDate}>
                                            {formatDate(tx.createdAt || tx.created_at)}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={[
                                    styles.transactionAmount,
                                    { color: tx.coins > 0 ? Colors.success : '#ff4444' }
                                ]}>
                                    {tx.coins > 0 ? '+' : ''}{tx.coins}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyText}>No transactions yet</Text>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const getEarnIcon = (action: string): any => {
    const icons: Record<string, string> = {
        'purchase': 'cart-outline',
        'signup': 'person-add-outline',
        'referral': 'people-outline',
        'review': 'star-outline',
        'birthday': 'gift-outline',
        'social_share': 'share-social-outline',
    };
    return icons[action?.toLowerCase()] || 'gift-outline';
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notAuthContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    notAuthTitle: {
        fontSize: 20,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        marginTop: 16,
    },
    notAuthSubtitle: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    loginButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 12,
        marginTop: 24,
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    balanceCard: {
        backgroundColor: Colors.primary,
        margin: 16,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
    },
    balanceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    tierText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#fff',
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    balanceAmount: {
        fontSize: 48,
        fontFamily: Fonts.Bold,
        color: '#fff',
        marginVertical: 8,
    },
    balanceLabel: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: 'rgba(255,255,255,0.8)',
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 24,
        width: '100%',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    statValue: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#fff',
    },
    statLabel: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
    section: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 16,
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        marginBottom: 16,
    },
    earnCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    earnIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    earnInfo: {
        flex: 1,
        marginLeft: 12,
    },
    earnTitle: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.text,
    },
    earnDescription: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    earnReward: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    earnAmount: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: Colors.success,
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    transactionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    transactionInfo: {
        marginLeft: 12,
        flex: 1,
    },
    transactionTitle: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: Colors.text,
    },
    transactionDate: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    transactionAmount: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
    },
    emptyText: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
        textAlign: 'center',
        paddingVertical: 20,
    },
});
