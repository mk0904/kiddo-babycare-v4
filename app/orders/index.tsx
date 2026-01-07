import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { shopifyApi } from '@/services/shopifyApi';
import { EmptyState } from '@/components/ui/EmptyState';

const formatOrderId = (orderIdOrName: string | number) => {
    if (typeof orderIdOrName === 'number') {
        return `#${orderIdOrName}`;
    }
    if (typeof orderIdOrName === 'string') {
        const match = orderIdOrName.match(/\d+/);
        if (match) {
            return `#${match[0]}`;
        }
    }
    return `#${orderIdOrName}`;
};

const getStatusText = (status: string) => {
    switch (status) {
        case 'FULFILLED':
            return 'Delivered';
        case 'UNFULFILLED':
            return 'Processing';
        case 'PAID':
            return 'Paid';
        case 'PENDING':
            return 'Pending';
        default:
            return status;
    }
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'FULFILLED':
        case 'PAID':
            return Colors.success;
        case 'UNFULFILLED':
        case 'PENDING':
            return '#FFA500';
        default:
            return Colors.textSecondary;
    }
};

export default function OrdersScreen() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadOrders = async () => {
        try {
            setLoading(true);
            if (!user?.customerAccessToken) {
                setOrders([]);
                return;
            }
            const fetchedOrders = await shopifyApi.getCustomerOrders(user.customerAccessToken, 50);
            if (fetchedOrders?.edges) {
                const allOrders = fetchedOrders.edges.map((edge: any) => edge.node);
                // Sort by creation date (newest first)
                allOrders.sort((a: any, b: any) => 
                    new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime()
                );
                setOrders(allOrders);
            } else {
                setOrders([]);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated) {
            loadOrders();
        } else {
            setLoading(false);
        }
    }, [isAuthenticated, user]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Orders</Text>
                    <View style={styles.placeholder} />
                </View>
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
            </SafeAreaView>
        );
    }

    if (!isAuthenticated) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Orders</Text>
                    <View style={styles.placeholder} />
                </View>
                <EmptyState
                    icon="lock-closed-outline"
                    title="Sign in to view orders"
                    subtitle="You need to be logged in to access your order history"
                    buttonText="Sign In"
                    onButtonPress={() => router.push('/(auth)/login' as any)}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Orders</Text>
                <View style={styles.placeholder} />
            </View>

            {orders.length === 0 ? (
                <EmptyState
                    icon="receipt-outline"
                    title="No Orders Yet"
                    subtitle="When you place your first order, it will appear here"
                    buttonText="Start Shopping"
                    onButtonPress={() => router.push('/' as any)}
                />
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {orders.map((order) => {
                        const statusText = getStatusText(order.fulfillmentStatus || order.financialStatus);
                        
                        return (
                            <TouchableOpacity
                                key={order.id}
                                style={styles.orderCard}
                                activeOpacity={0.7}
                                onPress={() => router.push(`/orders/${encodeURIComponent(order.id)}` as any)}
                            >
                                <View style={styles.orderHeader}>
                                    <View>
                                        <View style={styles.orderIdRow}>
                                            <Text style={styles.orderId}>
                                                Order {formatOrderId(order.orderNumber || order.id)}
                                            </Text>
                                        </View>
                                        <Text style={styles.orderDate}>
                                            {new Date(order.processedAt).toLocaleDateString('en-IN', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </Text>
                                    </View>
                                    <View style={styles.orderStatusContainer}>
                                        <Text style={[styles.orderStatus, { color: getStatusColor(order.fulfillmentStatus || order.financialStatus) }]}>
                                            {statusText}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.orderItems}>
                                    {order.lineItems?.edges?.slice(0, 3).map((edge: any, index: number) => (
                                        <Image
                                            key={index}
                                            source={{ uri: edge.node.variant?.image?.url || 'https://via.placeholder.com/60' }}
                                            style={styles.orderItemImage}
                                        />
                                    ))}
                                    {order.lineItems?.edges?.length > 3 && (
                                        <View style={styles.moreItemsContainer}>
                                            <Text style={styles.moreItemsText}>+{order.lineItems.edges.length - 3}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.orderFooter}>
                                    <Text style={styles.orderTotal}>
                                        {new Intl.NumberFormat('en-IN', {
                                            style: 'currency',
                                            currency: order.currentTotalPrice?.currencyCode || 'INR',
                                            minimumFractionDigits: 0,
                                        }).format(parseFloat(order.currentTotalPrice?.amount || '0'))}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.backgroundWhite,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: Colors.backgroundWhite,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    placeholder: {
        width: 32,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
    },
    orderCard: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    orderIdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    orderId: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
    orderDate: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: Colors.textSecondary,
    },
    orderStatusContainer: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    orderStatus: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
    },
    orderItems: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 8,
    },
    orderItemImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: Colors.backgroundSecondary,
    },
    moreItemsContainer: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: Colors.backgroundSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreItemsText: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        color: Colors.textSecondary,
    },
    orderFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    orderTotal: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: Colors.text,
    },
});
