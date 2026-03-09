import { Colors, Fonts } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NeedHelpChatCardProps {
    onChatPress?: () => void;
}

export function NeedHelpChatCard({ onChatPress }: NeedHelpChatCardProps) {
    return (
        <View style={styles.card}>
            <View style={styles.iconWrap}>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#6B7280" />
            </View>
            <View style={styles.textWrap}>
                <Text style={styles.title}>Need help?</Text>
                <Text style={styles.sub}>
                    Chat with us for any issue related to your order
                </Text>
            </View>
            <TouchableOpacity
                style={styles.chatLinkWrap}
                onPress={onChatPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Chat with us"
            >
                <Text style={styles.chatLink}>Chat with us</Text>
            </TouchableOpacity>
        </View>
    );
}

const CARD_RADIUS = 12;

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: CARD_RADIUS,
        padding: 16,
        marginBottom: 12,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
            },
            android: { elevation: 2 },
        }),
    },
    iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textWrap: {
        flex: 1,
        minWidth: 0,
    },
    title: {
        fontSize: 16,
        fontFamily: Fonts.Bold,
        color: '#1A1A1A',
    },
    sub: {
        fontSize: 13,
        fontFamily: Fonts.Regular,
        color: '#6B7280',
        marginTop: 2,
        lineHeight: 18,
    },
    chatLinkWrap: {
        paddingVertical: 4,
        paddingLeft: 8,
    },
    chatLink: {
        fontSize: 14,
        fontFamily: Fonts.SemiBold,
        color: Colors.primary,
    },
});
