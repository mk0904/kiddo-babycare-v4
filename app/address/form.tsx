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
import { useAuth } from '@/context/AuthContext';
import { useAddress } from '@/context/AddressContext';
import { Colors, Fonts } from '@/constants/theme';

const ADDRESS_TAGS = [
    { id: 'home', label: 'Home', icon: 'home' as const },
    { id: 'work', label: 'Work', icon: 'briefcase' as const },
    { id: 'other', label: 'Other', icon: 'location' as const },
];

export default function AddressFormScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();
    const { addAddress } = useAddress();

    // Parse location data passed from params
    const locationData = params.locationData ? JSON.parse(params.locationData as string) : null;

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState(user?.phone || '');
    const [flat, setFlat] = useState('');
    const [area, setArea] = useState(locationData?.city || '');
    const [street, setStreet] = useState(locationData?.address1 || '');
    const [selectedTag, setSelectedTag] = useState<'home' | 'work' | 'other'>('home');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!locationData) {
            Alert.alert('Error', 'No location data found', [
                { text: 'Go Back', onPress: () => router.back() }
            ]);
        }
    }, [locationData]);

    const validateForm = () => {
        if (!fullName.trim()) return alertError('Please enter your full name');
        if (!phone.trim()) return alertError('Please enter your phone number');
        if (!flat.trim()) return alertError('Please enter Flat / House No / Floor');
        if (!area.trim()) return alertError('Please enter your area');
        return true;
    };

    const alertError = (msg: string) => {
        Alert.alert('Validation Error', msg);
        return false;
    };

    const handleSaveAddress = async () => {
        if (!validateForm()) return;

        setSaving(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const addressData = {
                name: selectedTag === 'home' ? 'Home' : selectedTag === 'work' ? 'Work' : 'Other',
                firstName: fullName.trim(),
                lastName: '_',
                phone: phone.trim(),
                address1: `${flat.trim()}, ${street.trim()}`.trim(), // Combine flat and street for full address line 1
                address2: area.trim(),
                city: locationData?.city || area.trim(),
                province: locationData?.state || '',
                state: locationData?.state || '',
                zip: locationData?.pincode || '',
                pincode: locationData?.pincode || '',
                country: 'India',
                tag: selectedTag,
            };

            await addAddress(addressData);

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Success', 'Address saved successfully!', [
                {
                    text: 'OK',
                    onPress: () => {
                        // Navigate back to address list (or 2 steps back depending on stack)
                        router.dismissTo('/address');
                    }
                },
            ]);
        } catch (error) {
            console.error('Error saving address:', error);
            Alert.alert('Error', 'Failed to save address. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Address Details</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Location Summary */}
                {locationData && (
                    <View style={styles.locationSummary}>
                        <View style={styles.locationHeader}>
                            <Ionicons name="location" size={20} color={Colors.primary} />
                            <Text style={styles.locationSummaryTitle}>Selected Location</Text>
                        </View>
                        <Text style={styles.locationSummaryText}>{locationData.formattedAddress}</Text>
                    </View>
                )}

                {/* Form Fields */}
                <View style={styles.formContainer}>

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
                            maxLength={10}
                        />
                    </View>

                    {/* Flat / Building */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Flat / House No / Floor *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Apt 4B, 2nd Floor"
                            placeholderTextColor="#999"
                            value={flat}
                            onChangeText={setFlat}
                        />
                    </View>

                    {/* Area / Street */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Area / Colony / Street *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter area or street name"
                            placeholderTextColor="#999"
                            value={street}
                            onChangeText={setStreet}
                            multiline
                        />
                    </View>

                    {/* Landmark (Optional) */}
                    {/* Could add landmark here if needed, keeping it simple for now matching Kiddo */}

                    {/* Save As Tag */}
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
                                <Text style={styles.saveButtonText}>Save Address</Text>
                                <Ionicons name="checkmark" size={20} color="#FFF" />
                            </>
                        )}
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        spaceBetween: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backButton: {
        padding: 4,
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: Fonts.Bold,
        color: '#000',
        flex: 1,
    },
    placeholder: {
        width: 32,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    locationSummary: {
        backgroundColor: '#F5F5F5',
        margin: 20,
        marginBottom: 10,
        padding: 16,
        borderRadius: 12,
    },
    locationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    locationSummaryTitle: {
        fontSize: 14,
        fontFamily: Fonts.Bold,
        marginLeft: 8,
        color: Colors.text,
    },
    locationSummaryText: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#555',
        lineHeight: 18,
    },
    formContainer: {
        padding: 20,
    },
    inputContainer: {
        marginBottom: 20,
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
