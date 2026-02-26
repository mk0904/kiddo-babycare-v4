import { EstimatedDeliveryTime } from '@/components/ui/EstimatedDeliveryTime';
import { Colors, Fonts } from '@/constants/theme';
import { Address, useAddress } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AddressModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectAddress?: (address: Address) => void;
    fromHome?: boolean;
    returnToCart?: boolean;
}

export const AddressModal: React.FC<AddressModalProps> = ({
    visible,
    onClose,
    onSelectAddress,
    fromHome = false,
    returnToCart = false,
}) => {
    const router = useRouter();
    const { addresses, defaultAddress, setDefaultAddressById, loading } = useAddress();
    const { user, isAuthenticated } = useAuth();
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

    useEffect(() => {
        if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
        } else if (addresses.length > 0) {
            const defaultAddr = addresses.find(addr => addr.isDefault) || addresses[0];
            if (defaultAddr) {
                setSelectedAddressId(defaultAddr.id);
            }
        }
    }, [defaultAddress, addresses]);

    const handleSelectAddress = async (address: Address) => {
        setSelectedAddressId(address.id);
        await setDefaultAddressById(address.id);

        if (onSelectAddress) {
            onSelectAddress(address);
        }

        if (fromHome) {
            setTimeout(() => onClose(), 100);
        }
    };

    const handleAddNewAddress = () => {
        onClose();
        const params: Record<string, string> = {};
        if (returnToCart) params.returnToCart = '1';
        if (fromHome) params.returnToHome = '1';
        router.push({
            pathname: '/address/add',
            params,
        });
    };

    const handleEditAddress = (address: Address) => {
        onClose();
        router.push({
            pathname: '/address/edit',
            params: { addressId: address.id },
        });
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.overlayTouch} onPress={onClose} />

                <View style={styles.modalContainer}>
                    {/* Handle */}
                    <View style={styles.handleContainer}>
                        <View style={styles.handle} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Saved Addresses</Text>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <Ionicons name="close" size={24} color="#000" />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    ) : addresses.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconContainer}>
                                <Ionicons name="location-outline" size={48} color="#D1D5DB" />
                            </View>
                            <Text style={styles.emptyTitle}>No Saved Addresses</Text>
                            <Text style={styles.emptySubtitle}>
                                Add an address to make checkout faster
                            </Text>
                            <TouchableOpacity
                                style={styles.addAddressButton}
                                onPress={handleAddNewAddress}
                            >
                                <Ionicons name="add" size={18} color="#FFF" />
                                <Text style={styles.addAddressButtonText}>Add Address</Text>
                            </TouchableOpacity>
                        </View>
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
                                        selectedAddressId === address.id && styles.selectedAddressCard,
                                    ]}
                                    onPress={() => handleSelectAddress(address)}
                                >
                                    <View style={styles.addressContent}>
                                        <View style={styles.addressHeader}>
                                            <View style={styles.addressInfo}>
                                                <Text style={styles.addressName}>
                                                    {(address.name || `${address.firstName || ''} ${address.lastName || ''}`.trim())
                                                        .replace(/\s*_\s*$/g, '')
                                                        .trim() || 'Address'}
                                                </Text>
                                                {address.isDefault && (
                                                    <View style={styles.defaultBadge}>
                                                        <Text style={styles.defaultBadgeText}>Default</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.addressHeaderRight}>
                                                {/* Estimated Delivery Time - shown on the right */}
                                                {selectedAddressId === address.id && address.latitude && address.longitude && (
                                                    <EstimatedDeliveryTime
                                                        addressLatitude={address.latitude}
                                                        addressLongitude={address.longitude}
                                                        style={styles.deliveryTime}
                                                    />
                                                )}
                                            <TouchableOpacity
                                                style={styles.editButton}
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    handleEditAddress(address);
                                                }}
                                            >
                                                <Ionicons name="create-outline" size={20} color={Colors.primary} />
                                            </TouchableOpacity>
                                            </View>
                                        </View>
                                        <Text style={styles.addressText}>{address.address1}</Text>
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
                                        {selectedAddressId === address.id && (
                                            <View style={styles.selectedIndicator}>
                                                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                                                <Text style={styles.selectedText}>Selected</Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {/* Add New Address Button */}
                            <TouchableOpacity
                                style={styles.addNewButton}
                                onPress={handleAddNewAddress}
                            >
                                <Ionicons name="add" size={20} color={Colors.primary} />
                                <Text style={styles.addNewButtonText}>Add New Address</Text>
                            </TouchableOpacity>

                            {/* Done Button */}
                            {!fromHome && (
                                <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                                    <Text style={styles.doneButtonText}>Done</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    overlayTouch: {
        flex: 1,
    },
    modalContainer: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: SCREEN_HEIGHT * 0.85,
        minHeight: SCREEN_HEIGHT * 0.5,
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#DDD',
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    title: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#000',
    },
    closeButton: {
        padding: 4,
    },
    loadingContainer: {
        padding: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        padding: 32,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 280,
    },
    emptyIconContainer: {
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#000',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        fontFamily: Fonts.Regular,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    addAddressButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    addAddressButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    addressCard: {
        backgroundColor: '#FFF',
        borderRadius: 10,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    defaultAddressCard: {
        borderColor: Colors.primary,
        borderWidth: 2,
        backgroundColor: `${Colors.primary}08`,
    },
    selectedAddressCard: {
        borderColor: Colors.primary,
        borderWidth: 2,
    },
    addressContent: {},
    addressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    addressInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    addressHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    deliveryTime: {
        marginRight: 4,
    },
    addressName: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        color: '#000',
    },
    defaultBadge: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
    },
    defaultBadgeText: {
        fontSize: 9,
        fontFamily: Fonts.SemiBold,
        color: '#FFF',
        textTransform: 'uppercase',
    },
    editButton: {
        padding: 4,
    },
    addressText: {
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: '#000',
        marginBottom: 1,
        lineHeight: 16,
    },
    addressPhone: {
        fontSize: 11,
        fontFamily: Fonts.Regular,
        color: '#666',
        marginTop: 4,
    },
    selectedIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
        gap: 6,
    },
    selectedText: {
        fontSize: 12,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    addNewButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: 12,
        borderStyle: 'dashed',
        gap: 8,
    },
    addNewButtonText: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    doneButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 12,
        alignItems: 'center',
    },
    doneButtonText: {
        fontSize: 16,
        fontFamily: Fonts.SemiBold,
        color: '#FFF',
    },
});

export default AddressModal;
