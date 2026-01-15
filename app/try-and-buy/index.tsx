// Try & Buy Cart Screen
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTryAndBuy, TryAndBuyItem } from '@/context/TryAndBuyContext';
import { useAddress } from '@/context/AddressContext';
import { Colors, Fonts } from '@/constants/theme';

const MAX_ITEMS = 5;

export default function TryAndBuyCartScreen() {
    const {
        cartItems,
        cartTotal,
        cartItemCount,
        isLoading,
        removeItem,
        updateQuantity,
        clearCart,
        createOrder,
        canAddMoreItems,
    } = useTryAndBuy();

    const { defaultAddress } = useAddress();

    const handleCheckout = async () => {
        if (cartItems.length === 0) {
            Alert.alert('Empty Cart', 'Add items to your Try & Buy cart first.');
            return;
        }

        if (!defaultAddress) {
            Alert.alert('No Address', 'Please select a delivery address first.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Add Address', onPress: () => router.push('/address') },
            ]);
            return;
        }

        try {
            const order = await createOrder({
                name: defaultAddress.name || 'Customer',
                address: defaultAddress.address1 || '',
                city: defaultAddress.city || '',
                state: defaultAddress.province || defaultAddress.state || '',
                pincode: defaultAddress.zip || defaultAddress.pincode || '',
                phone: defaultAddress.phone || '',
            });

            if (order) {
                Alert.alert('Order Placed!', `Your Try & Buy order #${order.id} has been placed. Our rider will arrive with your items soon.`, [
                    { text: 'View Orders', onPress: () => router.push('/orders') },
                ]);
            } else {
                Alert.alert('Error', 'Failed to create order. Please try again.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        }
    };

    const handleRemoveItem = (itemId: string) => {
        Alert.alert('Remove Item', 'Are you sure you want to remove this item?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeItem(itemId) },
        ]);
    };

    const renderItem = ({ item }: { item: TryAndBuyItem }) => (
        <View style={styles.itemCard}>
            <Image
                source={{ uri: item.image || 'https://via.placeholder.com/80' }}
                style={styles.itemImage}
                contentFit="cover"
            />
            <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title}
                </Text>
                {item.variantTitle && (
                    <Text style={styles.variantTitle}>{item.variantTitle}</Text>
                )}
                <Text style={styles.itemPrice}>₹{item.price.toFixed(0)}</Text>
            </View>
            <View style={styles.quantityContainer}>
                <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.id, item.quantity - 1)}
                >
                    <Ionicons name="remove" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity
                    style={[styles.quantityButton, !canAddMoreItems() && styles.disabledButton]}
                    onPress={() => canAddMoreItems() && updateQuantity(item.id, item.quantity + 1)}
                    disabled={!canAddMoreItems()}
                >
                    <Ionicons name="add" size={18} color={canAddMoreItems() ? Colors.primary : '#ccc'} />
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveItem(item.id)}
            >
                <Ionicons name="trash-outline" size={20} color="#F44336" />
            </TouchableOpacity>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Try & Buy</Text>
                <View style={styles.headerRight}>
                    {cartItems.length > 0 && (
                        <TouchableOpacity onPress={() => clearCart()}>
                            <Text style={styles.clearText}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Info Banner */}
            <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={20} color="#2196F3" />
                <Text style={styles.infoText}>
                    Try up to {MAX_ITEMS} items. Pay only for what you keep!
                </Text>
            </View>

            {/* Items Limit */}
            <View style={styles.limitBar}>
                <Text style={styles.limitText}>
                    {cartItemCount}/{MAX_ITEMS} items
                </Text>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${(cartItemCount / MAX_ITEMS) * 100}%` }]} />
                </View>
            </View>

            {/* Cart Items */}
            {cartItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="shirt-outline" size={64} color="#ccc" />
                    <Text style={styles.emptyTitle}>Your Try & Buy cart is empty</Text>
                    <Text style={styles.emptySubtitle}>
                        Add fashion items to try before you buy!
                    </Text>
                    <TouchableOpacity
                        style={styles.shopButton}
                        onPress={() => router.push('/(tabs)')}
                    >
                        <Text style={styles.shopButtonText}>Start Shopping</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={cartItems}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Footer */}
            {cartItems.length > 0 && (
                <View style={styles.footer}>
                    <View style={styles.totalContainer}>
                        <Text style={styles.totalLabel}>Max Total</Text>
                        <Text style={styles.totalAmount}>₹{cartTotal.toFixed(0)}</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.checkoutButton, isLoading && styles.disabledButton]}
                        onPress={handleCheckout}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Text style={styles.checkoutText}>Place Try & Buy Order</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
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
        fontFamily: Fonts.SemiBold,
        color: '#333',
    },
    headerRight: {
        width: 60,
        alignItems: 'flex-end',
    },
    clearText: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: '#F44336',
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E3F2FD',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
    },
    infoText: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#1976D2',
        flex: 1,
    },
    limitBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        gap: 12,
    },
    limitText: {
        fontSize: 13,
        fontFamily: Fonts.Medium,
        color: '#666',
    },
    progressBar: {
        flex: 1,
        height: 6,
        backgroundColor: '#eee',
        borderRadius: 3,
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 3,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    itemImage: {
        width: 70,
        height: 70,
        borderRadius: 8,
        backgroundColor: '#f0f0f0',
    },
    itemInfo: {
        flex: 1,
    },
    itemTitle: {
        fontSize: 14,
        fontFamily: Fonts.Medium,
        color: '#333',
        marginBottom: 2,
    },
    variantTitle: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#888',
        marginBottom: 4,
    },
    itemPrice: {
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    quantityContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        padding: 4,
    },
    quantityButton: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#333',
        minWidth: 24,
        textAlign: 'center',
    },
    removeButton: {
        padding: 8,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 18,
        fontFamily: Fonts.SemiBold,
        color: '#333',
        marginTop: 16,
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
    },
    shopButton: {
        marginTop: 24,
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    shopButtonText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#fff',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    totalContainer: {},
    totalLabel: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#888',
    },
    totalAmount: {
        fontSize: 20,
        fontFamily: Fonts.Bold,
        color: '#333',
    },
    checkoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 10,
        gap: 8,
    },
    checkoutText: {
        fontSize: 15,
        fontFamily: Fonts.SemiBold,
        color: '#fff',
    },
    disabledButton: {
        opacity: 0.5,
    },
});
