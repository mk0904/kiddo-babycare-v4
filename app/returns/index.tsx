// Returns List Screen
// Shows all return requests

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import {
    returnsService,
    ReturnRequest,
    getReturnStatusText,
    getReturnStatusColor,
} from '@/services/returnsService';
import { Colors } from '@/constants/theme';

export default function ReturnsListScreen() {
    const [returns, setReturns] = useState<ReturnRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            loadReturns();
        }, [])
    );

    const loadReturns = async () => {
        setIsLoading(true);
        try {
            const allReturns = await returnsService.getAllReturns();
            setReturns(allReturns);
        } catch (error) {
            console.error('Error loading returns:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const renderReturnItem = ({ item }: { item: ReturnRequest }) => (
        <TouchableOpacity
            style={styles.returnCard}
            onPress={() => router.push(`/returns/${item.id}`)}
        >
            <View style={styles.returnHeader}>
                <Text style={styles.returnId}>#{item.id.slice(-8)}</Text>
                <View
                    style={[
                        styles.statusBadge,
                        { backgroundColor: getReturnStatusColor(item.status) + '20' },
                    ]}
                >
                    <Text
                        style={[styles.statusText, { color: getReturnStatusColor(item.status) }]}
                    >
                        {getReturnStatusText(item.status)}
                    </Text>
                </View>
            </View>
            <Text style={styles.returnItems}>
                {item.items.length} item{item.items.length > 1 ? 's' : ''} •{' '}
                {item.items.map((i) => i.title).join(', ').slice(0, 40)}...
            </Text>
            <View style={styles.returnFooter}>
                <Text style={styles.returnDate}>
                    {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                    })}
                </Text>
                <Text style={styles.refundAmount}>₹{item.totalRefundAmount.toFixed(0)}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Returns</Text>
                <View style={styles.headerRight} />
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : returns.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="arrow-undo-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyTitle}>No Returns Yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Return requests will appear here
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={returns}
                    renderItem={renderReturnItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Metropolis-SemiBold',
        color: '#333',
    },
    headerRight: {
        width: 32,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontFamily: 'Metropolis-SemiBold',
        color: '#333',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: 'Metropolis-Regular',
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    returnCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    returnHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    returnId: {
        fontSize: 15,
        fontFamily: 'Metropolis-SemiBold',
        color: '#333',
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        fontSize: 11,
        fontFamily: 'Metropolis-SemiBold',
    },
    returnItems: {
        fontSize: 13,
        fontFamily: 'Metropolis-Regular',
        color: '#666',
        marginBottom: 8,
    },
    returnFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    returnDate: {
        fontSize: 12,
        fontFamily: 'Metropolis-Regular',
        color: '#999',
    },
    refundAmount: {
        fontSize: 15,
        fontFamily: 'Metropolis-SemiBold',
        color: Colors.primary,
    },
});
