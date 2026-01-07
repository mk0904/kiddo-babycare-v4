import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';

export default function EditProfileScreen() {
    const router = useRouter();
    const { user, login } = useAuth(); // Assuming login updates the local user state

    // Split name
    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!firstName.trim() || !phone.trim()) {
            Alert.alert('Error', 'First Name and Phone are required');
            return;
        }

        setLoading(true);
        try {
            // In a real app, API call to update customer
            // await shopifyApi.updateCustomer(user.accessToken, { firstName, lastName, phone });

            // Mock update
            await new Promise(resolve => setTimeout(resolve, 1000));

            const updatedUser = {
                ...user,
                firstName,
                lastName,
                phone,
                displayName: `${firstName} ${lastName}`.trim()
            };

            await login(updatedUser as any); // Update local context
            Alert.alert('Success', 'Profile updated successfully');
            router.back();
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: 'Edit Profile',
                    headerBackTitle: '',
                    headerTintColor: Colors.text,
                }}
            />

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>First Name</Text>
                    <TextInput
                        style={styles.input}
                        value={firstName}
                        onChangeText={setFirstName}
                        placeholder="Enter first name"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Last Name</Text>
                    <TextInput
                        style={styles.input}
                        value={lastName}
                        onChangeText={setLastName}
                        placeholder="Enter last name"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                        style={[styles.input, styles.disabledInput]}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="Enter phone number"
                        keyboardType="phone-pad"
                        editable={false} // Phone is usually unique ID, keeping editable false for now
                    />
                    <Text style={styles.helperText}>Phone number cannot be changed</Text>
                </View>

                <Button
                    title={loading ? 'Saving...' : 'Save Changes'}
                    onPress={handleSave}
                    disabled={loading}
                    style={{ marginTop: 20 }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
    },
    form: {
        marginTop: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: Colors.text,
        backgroundColor: '#F9FAFB',
    },
    disabledInput: {
        backgroundColor: '#F3F4F6',
        color: '#9CA3AF',
    },
    helperText: {
        marginTop: 4,
        fontSize: 12,
        color: Colors.textSecondary,
    },
});
