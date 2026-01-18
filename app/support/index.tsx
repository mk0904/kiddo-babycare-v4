import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SupportScreen() {
    const handleCall = () => {
        Linking.openURL('tel:+919999999999');
    };

    const handleEmail = () => {
        Linking.openURL('mailto:hi@allforkiddo.com');
    };

    const handleWhatsApp = () => {
        const text = "Hi, I need help with my order.";
        const url = `whatsapp://send?phone=+919999999999&text=${encodeURIComponent(text)}`;
        Linking.canOpenURL(url).then(supported => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Linking.openURL(`https://wa.me/919999999999?text=${encodeURIComponent(text)}`);
            }
        });
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: 'Help & Support',
                    headerBackTitle: '',
                    headerTintColor: Colors.text,
                }}
            />

            <View style={styles.headerSection}>
                <Ionicons name="headset-outline" size={64} color={Colors.primary} />
                <Text style={styles.title}>How can we help you?</Text>
                <Text style={styles.subtitle}>
                    Our team is available All Days, 10am - 10pm to assist you with any queries.
                </Text>
            </View>

            <View style={styles.optionsContainer}>
                <TouchableOpacity style={styles.optionCard} onPress={handleCall} activeOpacity={0.7}>
                    <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                        <Ionicons name="call" size={24} color="#1E88E5" />
                    </View>
                    <View style={styles.optionInfo}>
                        <Text style={styles.optionTitle}>Call Us</Text>
                        <Text style={styles.optionSubtitle}>+91 93109 93990</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionCard} onPress={handleEmail} activeOpacity={0.7}>
                    <View style={[styles.iconContainer, { backgroundColor: '#FCE4EC' }]}>
                        <Ionicons name="mail" size={24} color="#D81B60" />
                    </View>
                    <View style={styles.optionInfo}>
                        <Text style={styles.optionTitle}>Email Us</Text>
                        <Text style={styles.optionSubtitle}>hi@allforkiddo.com</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerSection: {
        alignItems: 'center',
        padding: 40,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        maxWidth: '80%',
    },
    optionsContainer: {
        padding: 20,
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionInfo: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 2,
    },
    optionSubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
});
