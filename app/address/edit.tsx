import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAddress, Address } from '@/context/AddressContext';
import { Colors, Fonts } from '@/constants/theme';

const ADDRESS_TAGS = [
    { id: 'home', label: 'Home', icon: 'home' as const },
    { id: 'work', label: 'Work', icon: 'briefcase' as const },
    { id: 'other', label: 'Other', icon: 'location' as const },
];

export default function EditAddressScreen() {
    const router = useRouter();
    const { addressId } = useLocalSearchParams<{ addressId: string }>();
    const { addresses, updateAddress, deleteAddress } = useAddress();

    const [existingAddress, setExistingAddress] = useState<Address | null>(null);
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [address1, setAddress1] = useState('');
    const [address2, setAddress2] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [pincode, setPincode] = useState('');
    const [selectedTag, setSelectedTag] = useState<'home' | 'work' | 'other'>('home');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const address = addresses.find(a => a.id === addressId);
        if (address) {
            setExistingAddress(address);
            setFullName(address.firstName || '');
            setPhone(address.phone || '');
            setAddress1(address.address1 || '');
            setAddress2(address.address2 || '');
            setCity(address.city || '');
            setState(address.state || address.province || '');
            setPincode(address.pincode || address.zip || '');
            setSelectedTag(address.tag || 'home');
        }
    }, [addressId, addresses]);

    const validateForm = () => {
        if (!fullName.trim()) {
            Alert.alert('Validation Error', 'Please enter your full name');
            return false;
        }
        if (!phone.trim()) {
            Alert.alert('Validation Error', 'Please enter your phone number');
            return false;
        }
        if (!address1.trim()) {
            Alert.alert('Validation Error', 'Please enter your address');
            return false;
        }
        if (!city.trim()) {
            Alert.alert('Validation Error', 'Please enter your city');
            return false;
        }
        if (!pincode.trim()) {
            Alert.alert('Validation Error', 'Please enter your pincode');
            return false;
        }
        return true;
    };

    const handleSaveAddress = async () => {
        if (!validateForm() || !addressId) return;

        setSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const addressData = {
                name: selectedTag === 'home' ? 'Home' : selectedTag === 'work' ? 'Work' : 'Other',
                firstName: fullName.trim(),
                lastName: '_',
                phone: phone.trim(),
                address1: address1.trim(),
                address2: address2.trim(),
                city: city.trim(),
                province: state.trim(),
                state: state.trim(),
                zip: pincode.trim(),
                pincode: pincode.trim(),
                country: 'India',
                tag: selectedTag,
            };

            await updateAddress(addressId, addressData);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Address updated successfully!', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error('Error updating address:', error);
            Alert.alert('Error', 'Failed to update address. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAddress = () => {
        Alert.alert(
            'Delete Address',
            'Are you sure you want to delete this address?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (!addressId) return;
                        setDeleting(true);
                        try {
                            await deleteAddress(addressId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            router.back();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to delete address');
                        } finally {
                            setDeleting(false);
                        }
                    },
                },
            ]
        );
    };

    if (!existingAddress) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Address</Text>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={handleDeleteAddress}
                    disabled={deleting}
                >
                    {deleting ? (
                        <ActivityIndicator size="small" color="#FF4444" />
                    ) : (
                        <Ionicons name="trash-outline" size={22} color="#FF4444" />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Full Name */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Full Name *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your full name"
                        placeholderTextColor="#999"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                    />
                </View>

                {/* Phone */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Phone Number *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your phone number"
                        placeholderTextColor="#999"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                    />
                </View>

                {/* Address Line 1 */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Address Line 1 *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="House/Flat No., Building Name, Street"
                        placeholderTextColor="#999"
                        value={address1}
                        onChangeText={setAddress1}
                    />
                </View>

                {/* Address Line 2 */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Address Line 2</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Landmark, Area (Optional)"
                        placeholderTextColor="#999"
                        value={address2}
                        onChangeText={setAddress2}
                    />
                </View>

                {/* City & State Row */}
                <View style={styles.rowContainer}>
                    <View style={[styles.inputContainer, styles.halfWidth]}>
                        <Text style={styles.label}>City *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="City"
                            placeholderTextColor="#999"
                            value={city}
                            onChangeText={setCity}
                        />
                    </View>
                    <View style={[styles.inputContainer, styles.halfWidth]}>
                        <Text style={styles.label}>State</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="State"
                            placeholderTextColor="#999"
                            value={state}
                            onChangeText={setState}
                        />
                    </View>
                </View>

                {/* Pincode */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Pincode *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="6-digit pincode"
                        placeholderTextColor="#999"
                        value={pincode}
                        onChangeText={setPincode}
                        keyboardType="number-pad"
                        maxLength={6}
                    />
                </View>

                {/* Address Tag */}
                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Save as</Text>
                    <View style={styles.tagContainer}>
                        {ADDRESS_TAGS.map((tag) => (
                            <TouchableOpacity
                                key={tag.id}
                                style={[
                                    styles.tagButton,
                                    selectedTag === tag.id && styles.tagButtonActive,
                                ]}
                                onPress={() => setSelectedTag(tag.id as 'home' | 'work' | 'other')}
                            >
                                <Ionicons
                                    name={tag.icon}
                                    size={20}
                                    color={selectedTag === tag.id ? '#FFF' : '#000'}
                                />
                                <Text
                                    style={[
                                        styles.tagButtonText,
                                        selectedTag === tag.id && styles.tagButtonTextActive,
                                    ]}
                                >
                                    {tag.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Save Button */}
                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSaveAddress}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <>
                            <Text style={styles.saveButtonText}>Update Address</Text>
                            <Ionicons name="checkmark" size={20} color="#FFF" />
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#000',
    },
    deleteButton: {
        padding: 4,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    inputContainer: {
        marginBottom: 20,
    },
    rowContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    halfWidth: {
        flex: 1,
    },
    label: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#000',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        fontFamily: Fonts.Regular,
        color: '#000',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    tagContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    tagButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: '#FFF',
        gap: 8,
    },
    tagButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    tagButtonText: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: '#000',
    },
    tagButtonTextActive: {
        color: '#FFF',
    },
    saveButton: {
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 20,
        gap: 8,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: Fonts.Bold,
    },
});
