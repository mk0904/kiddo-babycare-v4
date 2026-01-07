import React, { useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useAddress, Address } from '@/context/AddressContext';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AddressesScreen() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const { addresses, loading, setDefaultAddressById, deleteAddress, loadAddresses } = useAddress();
    const isGuest = !isAuthenticated || user?.isGuest === true;

    useEffect(() => {
        if (isAuthenticated && !isGuest) {
            loadAddresses();
        }
    }, [isAuthenticated, isGuest]);

    const requireLogin = () => {
        Alert.alert(
            'Login Required',
            'Please login to manage addresses.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Login',
                    onPress: () => router.push('/(auth)/login' as any),
                },
            ]
        );
    };

    const handleSetDefault = async (addressId: string) => {
        try {
        await setDefaultAddressById(addressId);
        } catch (error) {
            console.error('Error setting default address:', error);
        }
    };

    const handleDeleteAddress = (addressId: string) => {
        Alert.alert(
            'Delete Address',
            'Are you sure you want to delete this address?',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                        await deleteAddress(addressId);
                        } catch (error) {
                            console.error('Error deleting address:', error);
                            Alert.alert('Error', 'Failed to delete address. Please try again.');
                        }
                    },
                },
            ]
        );
    };

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
                    <Text style={styles.headerTitle}>Saved Addresses</Text>
                    <View style={styles.placeholder} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
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
                <Text style={styles.headerTitle}>Saved Addresses</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                        if (isGuest) {
                            requireLogin();
                            return;
                        }
                        router.push('/address/add' as any);
                    }}
                >
                    <Ionicons name="add" size={24} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {addresses.length === 0 ? (
                <EmptyState
                    icon="location-outline"
                    title="No Saved Addresses"
                    subtitle="Add an address to make checkout faster and easier"
                    buttonText="Add Address"
                    onButtonPress={() => {
                        if (isGuest) {
                            requireLogin();
                            return;
                        }
                        router.push('/address/add' as any);
                    }}
                />
            ) : (
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {addresses.map((address) => (
                        <TouchableOpacity
                            key={address.id}
                            style={[
                                styles.addressCard,
                                address.isDefault && styles.defaultAddressCard,
                            ]}
                                onPress={() => handleSetDefault(address.id)}
                            activeOpacity={0.7}
                            >
                                <View style={styles.addressHeader}>
                                    <View style={styles.addressInfo}>
                                    <Text style={styles.addressName}>{address.name || address.firstName || 'Address'}</Text>
                                        {address.isDefault && (
                                            <View style={styles.defaultBadge}>
                                                <Text style={styles.defaultBadgeText}>Default</Text>
                                            </View>
                                        )}
                                    </View>
                                <View style={styles.addressActions}>
                                    <TouchableOpacity
                                        style={styles.editButton}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            router.push({
                                                pathname: '/address/edit',
                                                params: { addressId: address.id },
                                            } as any);
                                        }}
                                    >
                                        <Ionicons name="create-outline" size={20} color={Colors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.deleteButton}
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleDeleteAddress(address.id);
                                        }}
                                    >
                                        <Ionicons name="trash-outline" size={20} color="#ff4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <Text style={styles.addressText}>{address.address1 || address.address}</Text>
                                {address.address2 && (
                                    <Text style={styles.addressText}>{address.address2}</Text>
                                )}
                                <Text style={styles.addressText}>
                                    {address.city}, {address.province || address.state} {address.zip || address.pincode}
                                </Text>
                            <Text style={styles.addressText}>{address.country || 'India'}</Text>
                                {address.phone && (
                                    <Text style={styles.addressPhone}>{address.phone}</Text>
                                )}
                            </TouchableOpacity>
                    ))}
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
    addButton: {
        padding: 4,
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
    addressCard: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    defaultAddressCard: {
        borderColor: Colors.primary,
        borderWidth: 2,
    },
    addressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    addressInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    addressName: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: Colors.text,
        marginRight: 12,
    },
    defaultBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    defaultBadgeText: {
        fontSize: 10,
        fontFamily: Fonts.SemiBold,
        color: Colors.backgroundWhite,
        textTransform: 'uppercase',
    },
    addressActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    editButton: {
        padding: 4,
        marginRight: 8,
    },
    deleteButton: {
        padding: 4,
    },
    addressText: {
        fontSize: 14,
        color: Colors.text,
        fontFamily: Fonts.Regular,
        marginBottom: 4,
        lineHeight: 20,
    },
    addressPhone: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontFamily: Fonts.Regular,
        marginTop: 8,
    },
});
