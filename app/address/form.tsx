import { useDeliveryStatus } from '@/components/ui/EstimatedDeliveryTime';
import { Colors, Fonts } from '@/constants/theme';
import { useAddress } from '@/context/AddressContext';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ADDRESS_TAGS = [
    { id: 'home', label: 'Home', icon: 'home' as const },
    { id: 'work', label: 'Work', icon: 'briefcase' as const },
    { id: 'other', label: 'Other', icon: 'location' as const },
];

export default function AddressFormScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ locationData?: string; returnToCart?: string; returnToHome?: string }>();
    const { user } = useAuth();
    const { addAddress } = useAddress();

    // Parse location data passed from params
    let locationData = null;
    try {
        if (params.locationData) {
            locationData = typeof params.locationData === 'string' 
                ? JSON.parse(params.locationData) 
                : params.locationData;
        }
    } catch (error) {
        console.error('Error parsing location data:', error);
        Alert.alert('Error', 'Invalid location data', [
            { text: 'Go Back', onPress: () => router.back() }
        ]);
    }

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState(user?.phone || '');
    const [flat, setFlat] = useState('');
    const [area, setArea] = useState(locationData?.city || '');
    const [street, setStreet] = useState(locationData?.address1 || '');
    const [selectedTag, setSelectedTag] = useState<'home' | 'work' | 'other'>('home');
    const [saving, setSaving] = useState(false);

    // Use synchronous delivery time calculation
    const { deliveryTime, loading: loadingDeliveryTime } = useDeliveryStatus(
        locationData?.latitude,
        locationData?.longitude
    );

    React.useEffect(() => {
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

        // Check if delivery time exceeds 60 minutes
        if (deliveryTime !== null && deliveryTime > 60) {
            Alert.alert(
                'Delivery Not Available',
                'We will soon be at this place! 🚀\n\nDelivery to this location takes more than 60 minutes. Please select a location closer to our store.',
                [{ text: 'OK' }]
            );
            return;
        }

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
            const goToCart = params.returnToCart === '1';
            const returnToHome = params.returnToHome === '1';
            const targetRoute = returnToHome ? '/(tabs)' : goToCart ? '/cart' : '/address';
            Alert.alert('Success', 'Address saved successfully!', [
                {
                    text: 'OK',
                    onPress: () => {
                        router.dismissTo(targetRoute);
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

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    nestedScrollEnabled={true}
                >
                {/* Location Summary */}
                {locationData && (
                    <View style={styles.locationSummary}>
                        <View style={styles.locationHeader}>
                            <Ionicons name="location" size={20} color={Colors.primary} />
                            <Text style={styles.locationSummaryTitle}>Selected Location</Text>
                        </View>
                        <Text style={styles.locationSummaryText}>{locationData.formattedAddress}</Text>
                        {deliveryTime !== null ? (
                            <View style={styles.deliveryTimeContainer}>
                                <Ionicons name="time-outline" size={16} color={deliveryTime > 60 ? Colors.secondary : Colors.primary} />
                                <Text style={[
                                    styles.deliveryTimeText,
                                    deliveryTime > 60 && styles.deliveryTimeTextError
                                ]}>
                                    {deliveryTime > 60
                                        ? `Delivery time: ${deliveryTime} mins (exceeds 60 mins)`
                                        : `Delivery available in ${deliveryTime} mins`}
                                </Text>
                            </View>
                        ) : null}
                        {deliveryTime !== null && deliveryTime > 60 && (
                            <View style={styles.warningContainer}>
                                <Ionicons name="information-circle-outline" size={16} color={Colors.secondary} />
                                <Text style={styles.warningText}>
                                    We will soon be at this place! Please select a location closer to our store.
                                </Text>
                            </View>
                        )}
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
                        style={[
                            styles.saveButton,
                            (saving || (deliveryTime !== null && deliveryTime > 60)) && styles.saveButtonDisabled
                        ]}
                        onPress={handleSaveAddress}
                        disabled={saving || (deliveryTime !== null && deliveryTime > 60)}
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
            </KeyboardAvoidingView>
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
        justifyContent: 'space-between',
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
    keyboardView: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100, // Increased padding to ensure all fields are accessible when keyboard is open
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
        marginBottom: 8,
    },
    deliveryTimeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    deliveryTimeText: {
        fontSize: 13,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
    deliveryTimeTextError: {
        color: Colors.secondary,
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
        padding: 10,
        backgroundColor: '#FFF5F5',
        borderRadius: 8,
        gap: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        fontFamily: Fonts.Regular,
        color: Colors.secondary,
        lineHeight: 16,
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
